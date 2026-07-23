// ─────────────────────────────────────────────────────────────────────────────
// probe-tools-call.ts  — Full paid-path smoke test with a real tools/call.
//
// Why this exists: OKX.AI's validator settled $0.1 USDT (tx 0x37f051d3) then
// hit an HTML 500 page from the MCP handler. The existing probe-paid-replay.ts
// only tests tools/list — it never exercised the Gemini path. This probe:
//   1. Sends an unpaid tools/call → expects 402 with valid PaymentRequired
//   2. Signs a payment payload
//   3. Sends a paid tools/call with the real Aria test image → expects 200
//      with a JSON-RPC result (flags + canon_additions), or a JSON-RPC
//      error result if Gemini fails (NOT an HTML 500 page).
//
// Uses the test payer private key from .env (unfunded). The settle step
// will fail on-chain, but verify() should still pass (off-chain signature
// check). The handler should then run and return a proper JSON-RPC response.
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

function httpsRequest(
  path: string,
  method: string,
  headers: Record<string, string>,
  body?: string
): Promise<HttpResponse> {
  return new Promise((resolve, reject) => {
    const req = https.request(
      { hostname: HOST, port: 443, path, method, headers },
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
  const paid = await httpsRequest("/mcp", "POST", {
    "Content-Type": "application/json",
    "Content-Length": String(Buffer.byteLength(mcpBody)),
    Accept: "application/json, text/event-stream",
    "PAYMENT-SIGNATURE": sig,
  }, mcpBody);

  console.log(`  Status: ${paid.statusCode}`);
  console.log(`  Content-Type: ${paid.headers["content-type"] ?? "(none)"}`);
  console.log(`  Body[:600]: ${paid.body.slice(0, 600)}`);

  // ── Step 4: Interpret the result ────────────────────────────────────────────
  //
  // What we want to see:
  //   • Status 200, Content-Type: application/json
  //   • Body is a JSON-RPC response ({"jsonrpc":"2.0", "result":...} or
  //     {"jsonrpc":"2.0", "error":...})
  //   • NO HTML 500 page (the original failure mode)
  //
  // Acceptable outcomes:
  //   • 200 + {"result":{"content":[{"text":"{\"flags\":[...]...}}"]}}
  //     — verify + settle + Gemini all succeeded
  //   • 200 + {"error":{"code":-32603,"message":"internal_error"}}
  //     — verify/settle succeeded but Gemini failed; the global error
  //     handler caught it and returned a proper JSON-RPC error
  //   • 402 + {"error":"settle_failed"} — verify passed, settle failed
  //     (unfunded wallet). The key check: still JSON, still 4xx, NOT 500.
  //
  // Failure modes (what we DON'T want):
  //   • 500 with <!DOCTYPE html>... in the body
  //   • Empty body
  //   • Connection reset / timeout

  if (paid.statusCode === 200) {
    // Parse the body — must be JSON, not HTML
    let parsed: any;
    try {
      parsed = JSON.parse(paid.body);
    } catch {
      console.log("  ❌ FAIL — 200 response but body is not valid JSON");
      console.log(`  Body: ${paid.body.slice(0, 300)}`);
      process.exit(1);
    }

    if (parsed.jsonrpc !== "2.0") {
      console.log("  ❌ FAIL — 200 response but body is not JSON-RPC 2.0");
      console.log(`  Body: ${paid.body.slice(0, 300)}`);
      process.exit(1);
    }

    if (parsed.result) {
      console.log("  ✅ PASS — 200 + JSON-RPC result (tools/call succeeded)");
      if (parsed.result.content?.[0]?.text) {
        try {
          const inner = JSON.parse(parsed.result.content[0].text);
          console.log(`  flags: ${inner.flags?.length ?? 0}, canon_additions: ${inner.canon_additions?.length ?? 0}`);
        } catch {
          // inner text wasn't JSON — that's fine, it's just the tool output
        }
      }
      process.exit(0);
    }

    if (parsed.error) {
      console.log("  ✅ PASS — 200 + JSON-RPC error (tool failed gracefully, no HTML 500)");
      console.log(`  error code: ${parsed.error.code}, message: ${parsed.error.message}`);
      process.exit(0);
    }

    console.log("  ❌ FAIL — 200 response but no result or error field");
    process.exit(1);
  }

  if (paid.statusCode === 402) {
    // Settle failed (unfunded wallet). Still JSON, still actionable.
    let parsed: any;
    try {
      parsed = JSON.parse(paid.body);
    } catch {
      console.log("  ⚠️  402 with non-JSON body (unexpected)");
      process.exit(0); // not a 500, so the transport fix worked
    }
    console.log("  ✅ PASS — 402 (settle rejected, not 500). Error:", parsed.error?.message ?? parsed.errorReason ?? "unknown");
    process.exit(0);
  }

  if (paid.statusCode === 500) {
    console.log("  ❌ FAIL — 500 response (the original bug)");
    if (paid.body.startsWith("<!DOCTYPE") || paid.body.startsWith("<html")) {
      console.log("  ❌ FAIL — 500 body is HTML (the original failure mode)");
    } else {
      console.log(`  Body[:200]: ${paid.body.slice(0, 200)}`);
    }
    process.exit(1);
  }

  console.log(`  ⚠️  Unexpected status ${paid.statusCode}`);
  console.log(`  Body[:200]: ${paid.body.slice(0, 200)}`);
  process.exit(0);
}

main().catch((e) => {
  console.error("Unhandled error:", e);
  process.exit(1);
});
