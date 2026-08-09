import * as https from "https";
import * as dotenv from "dotenv";
dotenv.config();

interface HttpResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
}

function httpsRequest(
  hostname: string,
  path: string,
  method: string,
  headers: Record<string, string>,
  body?: string
): Promise<HttpResponse> {
  return new Promise((resolve, reject) => {
    const req = https.request(
      { hostname, port: 443, path, method, headers },
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
  const HOST = process.env.MNEMO_HOST ?? "mnemo-production-c4f1.up.railway.app";
  // Charge only on tools/call (initialize/tools/list are free per OKX.AI A2MCP).
  const mcpBody = JSON.stringify({
    jsonrpc: "2.0",
    method: "tools/call",
    id: 1,
    params: {
      name: "check-continuity",
      arguments: { page_image_base64: "aGVsbG8=", mime_type: "image/png" },
    },
  });

  console.log("Step 1: Unpaid tools/call probe (Accept: application/json only)...");
  const unpaid = await httpsRequest(HOST, "/mcp", "POST", {
    "Content-Type": "application/json",
    "Content-Length": String(Buffer.byteLength(mcpBody)),
    Accept: "application/json",
  }, mcpBody);

  console.log(`  Status: ${unpaid.statusCode}`);
  if (unpaid.statusCode === 406) {
    console.log("  ❌ STILL RETURNS 406 — Accept-header fix NOT deployed to Railway!");
    process.exit(1);
  }
  if (unpaid.statusCode !== 402) {
    console.log(`  ❌ Expected 402, got ${unpaid.statusCode}. Body: ${unpaid.body.slice(0, 200)}`);
    process.exit(1);
  }
  console.log("  ✅ Got 402 (no 406 — pre-payment handshake OK)");

  const prHeader = unpaid.headers["payment-required"];
  if (!prHeader) {
    console.log("  ❌ No payment-required header in 402 response");
    process.exit(1);
  }
  console.log("  ✅ payment-required header present");

  console.log("\nStep 2: Decode payment challenge...");
  const { decodePaymentRequiredHeader } = await import("@okxweb3/x402-core/http");
  const pr = decodePaymentRequiredHeader(prHeader);
  console.log(`  x402 v${pr.x402Version}, scheme=${pr.accepts[0]?.scheme}, network=${pr.accepts[0]?.network}`);

  console.log("\nStep 3: Build & sign payment payload...");
  const { privateKeyToAccount } = await import("viem/accounts");
  const { x402Client, x402HTTPClient } = await import("@okxweb3/x402-core/client");
  const { registerExactEvmScheme } = await import("@okxweb3/x402-evm/exact/client");

  const pk = process.env.TEST_PAYER_PRIVATE_KEY ?? "";
  if (!pk) {
    console.log("  ❌ TEST_PAYER_PRIVATE_KEY not set in .env");
    process.exit(1);
  }

  const account = privateKeyToAccount(pk as `0x${string}`);
  console.log(`  Signer: ${account.address}`);

  const client = new x402Client();
  registerExactEvmScheme(client, { signer: account });
  const httpClient = new x402HTTPClient(client);
  const payload = await httpClient.createPaymentPayload(pr);
  const sigHeaders = httpClient.encodePaymentSignatureHeader(payload);
  const sig = sigHeaders["PAYMENT-SIGNATURE"] ?? Object.values(sigHeaders)[0];
  console.log("  ✅ Payment payload signed");

  console.log("\nStep 4: Paid replay (Accept: application/json only — the 406 test)...");
  const paid = await httpsRequest(HOST, "/mcp", "POST", {
    "Content-Type": "application/json",
    "Content-Length": String(Buffer.byteLength(mcpBody)),
    Accept: "application/json",
    "PAYMENT-SIGNATURE": sig,
  }, mcpBody);

  console.log(`  Status: ${paid.statusCode}`);
  console.log(`  Body: ${paid.body.slice(0, 500)}`);

  if (paid.statusCode === 406) {
    console.log("\n  ❌ FAIL — 406 still returned on paid replay. Fix NOT working.");
    process.exit(1);
  }

  if (paid.statusCode === 402) {
    console.log("\n  ⚠️  402 on paid replay — verify/settle rejected (expected: unfunded wallet).");
    console.log("  ✅ CRITICAL: NOT 406. Accept-header fix IS working in production.");
    process.exit(0);
  }

  // 200 or any other status — transport ran successfully
  console.log(`\n  ✅ Paid replay returned ${paid.statusCode} (not 406). Fix confirmed working.`);
}

main().catch((e) => {
  console.error("Unhandled error:", e);
  process.exit(1);
});
