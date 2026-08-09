// ─────────────────────────────────────────────────────────────────────────────
// probe-okx-replay.ts — OKX reviewer wire-flow canary.
//
// Phase A (GET):  free GET /mcp → 200 JSON-RPC tools list (no payment)
// Phase B (POST): unpaid tools/call → 402 → sign → paid → 200 + settlement
//
// Any timeout, non-200, missing settlement proof, or elapsed ≥120s → exit 1.
// ─────────────────────────────────────────────────────────────────────────────

import * as https from "https";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";
dotenv.config();

const HOST = process.env.MNEMO_HOST ?? "mnemo-production-c4f1.up.railway.app";
const TEST_IMAGE_PATH = path.resolve(__dirname, "..", "test-images", "page_contradiction.png");
const REQ_TIMEOUT_MS = 180_000; // 3 min — x402 auth window is 300s
const MAX_ELAPSED_MS = 120_000;

interface HttpResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
  elapsedMs: number;
}

function httpsHelp(
  method: string,
  path: string,
  headers: Record<string, string>,
  body?: string
): Promise<HttpResponse> {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const req = https.request(
      { hostname: HOST, port: 443, path, method, headers, timeout: REQ_TIMEOUT_MS },
      (res) => {
        let data = "";
        res.on("data", (chunk: Buffer) => { data += chunk.toString(); });
        res.on("end", () => {
          const h: Record<string, string> = {};
          for (const [k, v] of Object.entries(res.headers)) {
            if (v) h[k.toLowerCase()] = Array.isArray(v) ? v[0] : v;
          }
          resolve({ statusCode: res.statusCode ?? 0, headers: h, body: data, elapsedMs: Date.now() - start });
        });
      }
    );
    req.on("error", reject);
    req.on("timeout", () => req.destroy(new Error("client timeout")));
    if (body) req.write(body);
    req.end();
  });
}

function die(msg: string): never {
  console.log(`❌ ${msg}`);
  process.exit(1);
}

function settlementProof(headers: Record<string, string>): string {
  return headers["payment-response"] ?? headers["x-payment-response"] ?? "";
}

// ── Phase A: GET /mcp free discovery ────────────────────────────────────────

async function phaseA() {
  console.log("Phase A: GET /mcp (free discovery — no payment)");
  const res = await httpsHelp("GET", "/mcp", { Accept: "application/json" });

  console.log(`  Status: ${res.statusCode} (${res.elapsedMs}ms)`);
  if (res.statusCode !== 200) die(`Phase A: expected 200, got ${res.statusCode}`);
  if (res.elapsedMs >= 10_000) die(`Phase A: elapsed ${res.elapsedMs}ms >= 10s`);

  let parsed: any;
  try { parsed = JSON.parse(res.body); } catch { die("Phase A: body is not valid JSON"); }
  if (parsed.jsonrpc !== "2.0") die("Phase A: not JSON-RPC 2.0");
  if (!parsed.result?.tools || !Array.isArray(parsed.result.tools)) {
    die("Phase A: missing tools array in discovery response");
  }

  const toolNames = parsed.result.tools.map((t: any) => t.name);
  console.log(`  Tools: ${toolNames.join(", ")}`);
  if (!toolNames.includes("check-continuity")) {
    die("Phase A: check-continuity tool not found in discovery");
  }
  console.log("  ✅ Free discovery OK — check-continuity tool present");
}

// ── Phase B: POST tools/call paid path ──────────────────────────────────────

async function phaseB() {
  console.log("\nPhase B: POST tools/call (paid path: 402 → sign → 200)");

  if (!fs.existsSync(TEST_IMAGE_PATH)) {
    die(`Phase B: test image not found at ${TEST_IMAGE_PATH}`);
  }
  const imageBase64 = fs.readFileSync(TEST_IMAGE_PATH).toString("base64");

  const mcpBody = JSON.stringify({
    jsonrpc: "2.0",
    method: "tools/call",
    id: 1,
    params: {
      name: "check-continuity",
      arguments: { page_image_base64: imageBase64, mime_type: "image/png" },
    },
  });

  // Step B1: Unpaid → expect 402
  console.log("  B1: Unpaid tools/call → expect 402...");
  const unpaid = await httpsHelp("POST", "/mcp", {
    "Content-Type": "application/json",
    "Content-Length": String(Buffer.byteLength(mcpBody)),
    Accept: "application/json, text/event-stream",
  }, mcpBody);

  console.log(`  Status: ${unpaid.statusCode} (${unpaid.elapsedMs}ms)`);
  if (unpaid.statusCode !== 402) {
    die(`Phase B1: expected 402, got ${unpaid.statusCode}. Body[:200]: ${unpaid.body.slice(0, 200)}`);
  }
  const prHeader = unpaid.headers["payment-required"];
  if (!prHeader) die("Phase B1: missing payment-required header in 402 response");
  console.log("  ✅ Got 402 with payment-required header");

  // Step B2: Sign the challenge
  console.log("  B2: Decode + sign payment challenge...");
  const payerKey = process.env.TEST_PAYER_PRIVATE_KEY ?? "";
  if (!payerKey) die("Phase B2: TEST_PAYER_PRIVATE_KEY not set in .env");

  const { decodePaymentRequiredHeader } = await import("@okxweb3/x402-core/http");
  const { privateKeyToAccount } = await import("viem/accounts");
  const { x402Client, x402HTTPClient } = await import("@okxweb3/x402-core/client");
  const { registerExactEvmScheme } = await import("@okxweb3/x402-evm/exact/client");

  const pr = decodePaymentRequiredHeader(prHeader);
  console.log(`  x402 v${pr.x402Version}, scheme=${pr.accepts[0]?.scheme}, network=${pr.accepts[0]?.network}`);

  const account = privateKeyToAccount(payerKey as `0x${string}`);
  const client = new x402Client();
  registerExactEvmScheme(client, { signer: account });
  const httpClient = new x402HTTPClient(client);
  const payload = await httpClient.createPaymentPayload(pr);
  const sigHeaders = httpClient.encodePaymentSignatureHeader(payload);
  const sig = sigHeaders["PAYMENT-SIGNATURE"] ?? Object.values(sigHeaders)[0];
  console.log("  ✅ Payment payload signed");

  // Step B3: Paid → expect 200 + JSON-RPC result + settlement
  console.log("  B3: Paid tools/call → expect 200 + JSON-RPC result + settlement...");
  const paid = await httpsHelp("POST", "/mcp", {
    "Content-Type": "application/json",
    "Content-Length": String(Buffer.byteLength(mcpBody)),
    Accept: "application/json, text/event-stream",
    "PAYMENT-SIGNATURE": sig,
  }, mcpBody);

  console.log(`  Status: ${paid.statusCode} (${paid.elapsedMs}ms)`);
  if (paid.statusCode !== 200) {
    die(`Phase B3: expected 200, got ${paid.statusCode}. Body[:400]: ${paid.body.slice(0, 400)}`);
  }
  if (paid.elapsedMs >= MAX_ELAPSED_MS) {
    die(`Phase B3: elapsed ${paid.elapsedMs}ms >= ${MAX_ELAPSED_MS}ms`);
  }

  let parsed: any;
  try { parsed = JSON.parse(paid.body); } catch { die("Phase B3: body is not valid JSON"); }
  if (parsed.jsonrpc !== "2.0") die("Phase B3: not JSON-RPC 2.0");

  if (parsed.error) {
    const c = parsed.error;
    die(`Phase B3: JSON-RPC error — code=${c?.code} message=${c?.message} data=${c?.data}`);
  }
  if (!parsed.result?.content || !Array.isArray(parsed.result.content) || parsed.result.content.length === 0) {
    die("Phase B3: missing parsed.result.content (no tool output)");
  }
  if (parsed.result.isError) {
    die("Phase B3: tool returned isError:true — settlement skipped, no continuity result");
  }

  // Settlement proof
  const proof = settlementProof(paid.headers);
  if (!proof) die("Phase B3: missing PAYMENT-RESPONSE settlement header");

  // Parse the continuity result
  let inner: any = null;
  try {
    const text = parsed.result.content[0]?.text;
    if (typeof text === "string") inner = JSON.parse(text);
  } catch { /* non-JSON text is OK */ }

  console.log("  ✅ 200 + JSON-RPC result + PAYMENT-RESPONSE settlement header");
  if (inner) {
    console.log(`  flags: ${inner.flags?.length ?? 0}, canon_additions: ${inner.canon_additions?.length ?? 0}`);
    console.log("  --- continuity result (parsed) ---");
    console.log(JSON.stringify(inner, null, 2));
  } else {
    console.log(`  content[0].text[:200]: ${String(parsed.result.content[0]?.text ?? "").slice(0, 200)}`);
  }
  console.log(`  payment-response base64 length: ${String(proof).length}`);
  try {
    const settled = JSON.parse(Buffer.from(String(proof), "base64").toString("utf-8"));
    console.log("  --- payment-response (decoded) ---");
    console.log(JSON.stringify(settled, null, 2));
  } catch {
    console.log(`  payment-response (raw): ${String(proof)}`);
  }
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  await phaseA();
  await phaseB();
  console.log("\n✅ PASS");
}

main().catch((e) => {
  console.error("Unhandled:", e);
  process.exit(1);
});
