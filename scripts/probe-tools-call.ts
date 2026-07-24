// ─────────────────────────────────────────────────────────────────────────────
// probe-tools-call.ts — Strict paid-path canary.
//
// REQUIRES: HTTP 200, valid JSON-RPC 2.0 body, no .error, .result.content
//           present, and a PAYMENT-RESPONSE settlement header.
// ANYTHING ELSE is FAIL with exit 1 — no more permissive passes.
// Catches the OKX reviewer's -32603 internal_error / x402 middleware timeout
// / missing txHash failure mode decisively.
// ─────────────────────────────────────────────────────────────────────────────

import * as https from "https";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

dotenv.config();

const HOST = "mnemo-production-c4f1.up.railway.app";
const TEST_IMAGE_PATH = path.resolve(__dirname, "..", "test-images", "page_contradiction.png");

interface HttpResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
}

const CLIENT_TIMEOUT_MS = 180_000; // 3 min — x402 auth window is 300s; OpenRouter is 60s+retry

function withTimeout(req: any, ms: number): void {
  req.setTimeout(ms);
}

function httpsRequest(
  path: string,
  method: string,
  headers: Record<string, string>,
  body?: string
): Promise<HttpResponse> {
  return new Promise((resolve, reject) => {
    const req = https.request(
      { hostname: HOST, port: 443, path, method, headers, timeout: CLIENT_TIMEOUT_MS },
      (res) => {
        let data = "";
        res.on("data", (chunk: Buffer) => { data += chunk.toString(); });
        res.on("end", () => {
          const h: Record<string, string> = {};
          for (const [k, v] of Object.entries(res.headers)) {
            if (v) h[k.toLowerCase()] = Array.isArray(v) ? v[0] : v;
          }
          resolve({ statusCode: res.statusCode ?? 0, headers: h, body: data });
        });
      }
    );
    req.on("error", reject);
    req.on("timeout", () => req.destroy(new Error(`client timeout after ${CLIENT_TIMEOUT_MS}ms`)));
    if (body) req.write(body);
    req.end();
  });
}

async function main() {
  if (!fs.existsSync(TEST_IMAGE_PATH)) {
    console.error(`Test image not found at ${TEST_IMAGE_PATH}`);
    process.exit(1);
  }
  const imageBase64 = fs.readFileSync(TEST_IMAGE_PATH).toString("base64");

  // ── Step 1: Unpaid tools/call → expect 402 ──────────────────────────────────
  console.log("Step 1: Unpaid tools/call (should return 402)...");
  const mcpBody = JSON.stringify({
    jsonrpc: "2.0",
    method: "tools/call",
    id: 1,
    params: {
      name: "check-continuity",
      arguments: { page_image_base64: imageBase64, mime_type: "image/png" },
    },
  });

  const unpaid = await httpsRequest("/mcp", "POST", {
    "Content-Type": "application/json",
    "Content-Length": String(Buffer.byteLength(mcpBody)),
    Accept: "application/json, text/event-stream",
  }, mcpBody);

  console.log(`  Status: ${unpaid.statusCode}`);
  if (unpaid.statusCode !== 402) {
    console.log(`  ❌ Expected 402, got ${unpaid.statusCode}. Body: ${unpaid.body.slice(0, 200)}`);
    process.exit(1);
  }
  const prHeader = unpaid.headers["payment-required"];
  if (!prHeader) {
    console.log("  ❌ No payment-required header in 402 response");
    process.exit(1);
  }
  console.log("  ✅ Got 402 with payment-required header");

  // ── Step 2: Decode + sign ────────────────────────────────────────────────────
  console.log("\nStep 2: Decode payment challenge + sign...");
  const { decodePaymentRequiredHeader } = await import("@okxweb3/x402-core/http");
  const pr = decodePaymentRequiredHeader(prHeader);
  console.log(`  x402 v${pr.x402Version}, scheme=${pr.accepts[0]?.scheme}, network=${pr.accepts[0]?.network}`);

  const payerKey = process.env.TEST_PAYER_PRIVATE_KEY ?? "";
  if (!payerKey) {
    console.log("  ❌ TEST_PAYER_PRIVATE_KEY not set in .env");
    process.exit(1);
  }

  const { privateKeyToAccount } = await import("viem/accounts");
  const { x402Client, x402HTTPClient } = await import("@okxweb3/x402-core/client");
  const { registerExactEvmScheme } = await import("@okxweb3/x402-evm/exact/client");

  const account = privateKeyToAccount(payerKey as `0x${string}`);
  const client = new x402Client();
  registerExactEvmScheme(client, { signer: account });
  const httpClient = new x402HTTPClient(client);
  const payload = await httpClient.createPaymentPayload(pr);
  const sigHeaders = httpClient.encodePaymentSignatureHeader(payload);
  const sig = sigHeaders["PAYMENT-SIGNATURE"] ?? Object.values(sigHeaders)[0];
  console.log("  ✅ Payment payload signed");

  // ── Step 3: Paid tools/call → expect 200 with JSON-RPC result ──────────────
  console.log("\nStep 3: Paid tools/call (should return 200 JSON-RPC)...");
  const step3Start = Date.now();
  const paid = await httpsRequest("/mcp", "POST", {
    "Content-Type": "application/json",
    "Content-Length": String(Buffer.byteLength(mcpBody)),
    Accept: "application/json, text/event-stream",
    "PAYMENT-SIGNATURE": sig,
  }, mcpBody);

  console.log(`  Status: ${paid.statusCode}`);
  console.log(`  Content-Type: ${paid.headers["content-type"] ?? "(none)"}`);
  console.log(`  Body[:600]: ${paid.body.slice(0, 600)}`);
  const paidElapsedMs = Date.now() - step3Start;
  console.log(`  Elapsed: ${paidElapsedMs}ms`);

  // Step 4: Interpret the result — strict canary.
  // Pass requires: HTTP 200, JSON body, JSON-RPC 2.0, no .error, has .result.content,
  // and a payment-response header proving settlement actually happened.
  console.log("\nStep 4: Strict canary interpretation...");

  if (paid.statusCode !== 200) {
    console.log(`  ❌ FAIL — expected 200, got ${paid.statusCode}. Content-Type: ${paid.headers["content-type"] ?? "(none)"}.`);
    console.log(`  Body[:400]: ${paid.body.slice(0, 400)}`);
    process.exit(1);
  }

  let parsed: any;
  try {
    parsed = JSON.parse(paid.body);
  } catch {
    console.log("  ❌ FAIL — 200 response but body is not valid JSON.");
    console.log(`  Body[:400]: ${paid.body.slice(0, 400)}`);
    process.exit(1);
  }

  if (parsed.jsonrpc !== "2.0") {
    console.log("  ❌ FAIL — 200 response but body is not JSON-RPC 2.0.");
    console.log(`  Body[:400]: ${paid.body.slice(0, 400)}`);
    process.exit(1);
  }

  if (parsed.error) {
    const code = parsed.error?.code;
    const msg = parsed.error?.message ?? "";
    const data = parsed.error?.data ?? "";
    const isOKXRejection =
      code === -32603 ||
      /x402 middleware timeout/i.test(data) ||
      /x402 middleware timeout/i.test(msg) ||
      /internal_error/i.test(msg);
    if (isOKXRejection) {
      console.log("  ❌ FAIL — OKX REJECTION RECREATED: -32603 / x402 middleware timeout / internal_error.");
      console.log(`  code=${code} message=${msg} data=${data}`);
      process.exit(1);
    }
    console.log(`  ❌ FAIL — JSON-RPC error returned. code=${code} message=${msg}`);
    process.exit(1);
  }

  if (!parsed.result || !Array.isArray(parsed.result.content) || parsed.result.content.length === 0) {
    console.log("  ❌ FAIL — 200 response missing parsed.result.content (no tool output).");
    console.log(`  Body[:400]: ${paid.body.slice(0, 400)}`);
    process.exit(1);
  }

  if (parsed.result.isError) {
    console.log("  ❌ FAIL — tool returned isError:true; settlement would have been skipped (good!) but the canary requires a real continuity result.");
    process.exit(1);
  }

  // Try to parse the first text content as JSON; print flag/addition counts
  let inner: any = null;
  try {
    const text = parsed.result.content[0]?.text;
    if (typeof text === "string") inner = JSON.parse(text);
  } catch { /* not JSON is OK as long as content was non-empty */ }

  // Settlement proof: the OKX SDK attaches a payment-response header post-settle.
  const paymentResponse = paid.headers["payment-response"] ?? paid.headers["x-payment-response"];
  if (!paymentResponse) {
    console.log("  ❌ FAIL — missing PAYMENT-RESPONSE settlement header — settlement did not occur.");
    console.log(`  All headers: ${Object.keys(paid.headers).join(", ")}`);
    process.exit(1);
  }

  console.log("  ✅ PASS — 200 + JSON-RPC result + PAYMENT-RESPONSE settlement header.");
  if (inner) {
    console.log(`  flags: ${inner.flags?.length ?? 0}, canon_additions: ${inner.canon_additions?.length ?? 0}`);
  } else {
    const first = parsed.result.content[0]?.text ?? "";
    console.log(`  content[0].text[:200]: ${String(first).slice(0, 200)}`);
  }
  console.log(`  payment-response[:80]: ${String(paymentResponse).slice(0, 80)}`);
  process.exit(0);
}

main().catch((e) => {
  console.error("Unhandled error:", e);
  process.exit(1);
});
