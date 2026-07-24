// ─────────────────────────────────────────────────────────────────────────────
// probe-okx-replay.ts — OKX review wire-flow canary.
//
// Phase A (GET):  unpaid GET /mcp → 402 → sign → paid GET /mcp → 200 JSON-RPC
// Phase B (POST): unpaid GET /mcp → 402 → sign → POST tools/list → 200 JSON-RPC
//
// Any timeout, non-200, missing settlement proof, or elapsed ≥30s → exit 1.
// ─────────────────────────────────────────────────────────────────────────────

import * as https from "https";
import * as dotenv from "dotenv";
dotenv.config();

const HOST = "mnemo-production-c4f1.up.railway.app";
const REQ_TIMEOUT_MS = 40_000;
const MAX_ELAPSED_MS = 30_000;

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

async function fetchChallenge(): Promise<string> {
  const res = await httpsHelp("GET", "/mcp", { Accept: "application/json" });
  if (res.statusCode !== 402) die(`expected 402 for unpaid GET /mcp, got ${res.statusCode}`);
  const pr = res.headers["payment-required"];
  if (!pr) die("missing payment-required header in 402 response");
  return pr;
}

async function signChallenge(prHeader: string): Promise<string> {
  const payerKey = process.env.TEST_PAYER_PRIVATE_KEY ?? "";
  if (!payerKey) die("TEST_PAYER_PRIVATE_KEY not set in .env");

  const { decodePaymentRequiredHeader } = await import("@okxweb3/x402-core/http");
  const { privateKeyToAccount } = await import("viem/accounts");
  const { x402Client, x402HTTPClient } = await import("@okxweb3/x402-core/client");
  const { registerExactEvmScheme } = await import("@okxweb3/x402-evm/exact/client");

  const pr = decodePaymentRequiredHeader(prHeader);
  const account = privateKeyToAccount(payerKey as `0x${string}`);
  const client = new x402Client();
  registerExactEvmScheme(client, { signer: account });
  const httpClient = new x402HTTPClient(client);
  const payload = await httpClient.createPaymentPayload(pr);
  const sigHeaders = httpClient.encodePaymentSignatureHeader(payload);
  return sigHeaders["PAYMENT-SIGNATURE"] ?? Object.values(sigHeaders)[0];
}

function validatePaidResponse(res: HttpResponse, label: string): void {
  if (res.statusCode === 0) die(`${label}: status 0 — timeout or connection failure`);
  if (res.statusCode !== 200) die(`${label}: expected 200, got ${res.statusCode}`);
  if (res.elapsedMs >= MAX_ELAPSED_MS) die(`${label}: elapsed ${res.elapsedMs}ms >= ${MAX_ELAPSED_MS}ms`);

  let parsed: any;
  try { parsed = JSON.parse(res.body); } catch { die(`${label}: body is not valid JSON`); }

  if (parsed.jsonrpc !== "2.0") die(`${label}: not JSON-RPC 2.0`);
  if (!parsed.result) die(`${label}: missing JSON-RPC result`);

  const proof = settlementProof(res.headers);
  if (!proof) die(`${label}: missing settlement proof header`);

  console.log(`  ✅ ${res.elapsedMs}ms, proof: ${proof.slice(0, 40)}...`);
}

async function phaseA() {
  console.log("Phase A: GET /mcp (funded, one payment)");
  const challenge = await fetchChallenge();
  const sig = await signChallenge(challenge);
  const paid = await httpsHelp("GET", "/mcp", {
    Accept: "application/json",
    "PAYMENT-SIGNATURE": sig,
  });
  console.log(`  Status: ${paid.statusCode}`);
  validatePaidResponse(paid, "Phase A");
}

async function phaseB() {
  console.log("\nPhase B: POST tools/list (funded, second payment)");
  const challenge = await fetchChallenge();
  const sig = await signChallenge(challenge);
  const body = JSON.stringify({ jsonrpc: "2.0", method: "tools/list", id: 1 });
  const paid = await httpsHelp("POST", "/mcp", {
    "Content-Type": "application/json",
    "Content-Length": String(Buffer.byteLength(body)),
    Accept: "application/json",
    "PAYMENT-SIGNATURE": sig,
  }, body);
  console.log(`  Status: ${paid.statusCode}`);
  validatePaidResponse(paid, "Phase B");
}

async function main() {
  await phaseA();
  await phaseB();
  console.log("\nPASS");
}

main().catch((e) => {
  console.error("Unhandled:", e);
  process.exit(1);
});
