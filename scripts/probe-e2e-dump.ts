// One-shot production dump: full 402 → sign → 200 + decoded PAYMENT-RESPONSE.
// Target: https://mnemo-production-c4f1.up.railway.app/mcp
// Spends real $0.10 USDT on eip155:196.

import * as https from "https";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

dotenv.config();

const HOST = "mnemo-production-c4f1.up.railway.app";
const IMG = path.resolve(__dirname, "..", "test-images", "page_contradiction.png");

interface HttpResponse {
  status: number;
  headers: Record<string, string>;
  body: string;
}

function httpsRequest(
  headers: Record<string, string>,
  body?: string
): Promise<HttpResponse> {
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: HOST,
        port: 443,
        path: "/mcp",
        method: "POST",
        headers,
        timeout: 180_000,
      },
      (res) => {
        let data = "";
        res.on("data", (c: Buffer) => {
          data += c.toString();
        });
        res.on("end", () => {
          const h: Record<string, string> = {};
          for (const [k, v] of Object.entries(res.headers)) {
            if (v) h[k.toLowerCase()] = Array.isArray(v) ? v[0] : v;
          }
          resolve({ status: res.statusCode ?? 0, headers: h, body: data });
        });
      }
    );
    req.on("error", reject);
    req.on("timeout", () => req.destroy(new Error("client timeout after 180s")));
    if (body) req.write(body);
    req.end();
  });
}

async function main(): Promise<void> {
  if (!fs.existsSync(IMG)) {
    console.error("Missing test image:", IMG);
    process.exit(1);
  }
  const imageBase64 = fs.readFileSync(IMG).toString("base64");
  console.log("Host: https://" + HOST + "/mcp");
  console.log("Image:", IMG, "bytes=" + fs.statSync(IMG).size);

  const mcpBody = JSON.stringify({
    jsonrpc: "2.0",
    method: "tools/call",
    id: 1,
    params: {
      name: "check-continuity",
      arguments: {
        page_image_base64: imageBase64,
        mime_type: "image/png",
        series_id: "lore-olympus",
      },
    },
  });

  // ── Step 1: unpaid ──────────────────────────────────────────────────────────
  console.log("\n=== STEP 1: Unpaid tools/call → expect 402 ===");
  const unpaid = await httpsRequest(
    {
      "Content-Type": "application/json",
      "Content-Length": String(Buffer.byteLength(mcpBody)),
      Accept: "application/json, text/event-stream",
    },
    mcpBody
  );
  console.log("HTTP", unpaid.status);
  const prHeader = unpaid.headers["payment-required"];
  if (unpaid.status !== 402 || !prHeader) {
    console.error("Expected 402 + payment-required. Body:", unpaid.body.slice(0, 500));
    process.exit(1);
  }

  const { decodePaymentRequiredHeader } = await import("@okxweb3/x402-core/http");
  const challenge = decodePaymentRequiredHeader(prHeader);
  console.log("\n--- payment-required (decoded) ---");
  console.log(JSON.stringify(challenge, null, 2));
  if (unpaid.body && unpaid.body !== "{}") {
    console.log("\n--- 402 body (may mirror challenge) ---");
    console.log(unpaid.body.slice(0, 1200));
  }

  // ── Step 2: sign ────────────────────────────────────────────────────────────
  console.log("\n=== STEP 2: Sign payment with TEST_PAYER_PRIVATE_KEY ===");
  const pk = process.env.TEST_PAYER_PRIVATE_KEY ?? "";
  if (!pk) {
    console.error("TEST_PAYER_PRIVATE_KEY not set in .env");
    process.exit(1);
  }

  const { privateKeyToAccount } = await import("viem/accounts");
  const { x402Client, x402HTTPClient } = await import("@okxweb3/x402-core/client");
  const { registerExactEvmScheme } = await import("@okxweb3/x402-evm/exact/client");

  const account = privateKeyToAccount(pk as `0x${string}`);
  console.log("Signer:", account.address);

  const client = new x402Client();
  registerExactEvmScheme(client, { signer: account });
  const httpClient = new x402HTTPClient(client);
  const payload = await httpClient.createPaymentPayload(challenge);
  const sigHeaders = httpClient.encodePaymentSignatureHeader(payload);
  const sig =
    sigHeaders["PAYMENT-SIGNATURE"] ?? Object.values(sigHeaders)[0];
  console.log("PAYMENT-SIGNATURE length:", String(sig).length);
  console.log("PAYMENT-SIGNATURE prefix:", String(sig).slice(0, 72) + "...");
  try {
    const decodedSig = JSON.parse(
      Buffer.from(String(sig), "base64").toString("utf-8")
    );
    console.log("\n--- signed payload structure (decoded) ---");
    console.log(JSON.stringify(decodedSig, null, 2).slice(0, 2000));
  } catch {
    console.log("(signature is not JSON-base64; that is OK for some encodings)");
  }

  // ── Step 3: paid replay ─────────────────────────────────────────────────────
  console.log("\n=== STEP 3: Paid tools/call → expect 200 + PAYMENT-RESPONSE ===");
  const t0 = Date.now();
  const paid = await httpsRequest(
    {
      "Content-Type": "application/json",
      "Content-Length": String(Buffer.byteLength(mcpBody)),
      Accept: "application/json, text/event-stream",
      "PAYMENT-SIGNATURE": String(sig),
    },
    mcpBody
  );
  console.log("HTTP", paid.status, "elapsed_ms=" + (Date.now() - t0));
  console.log("Content-Type:", paid.headers["content-type"] ?? "(none)");

  const paymentResponse =
    paid.headers["payment-response"] ?? paid.headers["x-payment-response"];
  console.log("Has payment-response:", Boolean(paymentResponse));
  if (paymentResponse) {
    console.log("payment-response base64 length:", paymentResponse.length);
    try {
      const settled = JSON.parse(
        Buffer.from(paymentResponse, "base64").toString("utf-8")
      );
      console.log("\n--- payment-response (decoded settlement) ---");
      console.log(JSON.stringify(settled, null, 2));
    } catch {
      console.log("payment-response raw:", paymentResponse);
    }
  } else {
    console.log("Response headers:", Object.keys(paid.headers).join(", "));
  }

  console.log("\n=== FINAL RESPONSE BODY ===");
  console.log(paid.body);

  if (paid.status !== 200) {
    console.error("\nFAIL: expected HTTP 200");
    process.exit(1);
  }
  let parsed: { jsonrpc?: string; result?: unknown; error?: unknown };
  try {
    parsed = JSON.parse(paid.body);
  } catch {
    console.error("\nFAIL: body not JSON");
    process.exit(1);
  }
  if (parsed.error) {
    console.error("\nFAIL: JSON-RPC error");
    process.exit(1);
  }
  if (!paymentResponse) {
    console.error("\nFAIL: missing payment-response settlement header");
    process.exit(1);
  }
  console.log("\n✅ FULL E2E PASS — 200 + JSON-RPC result + settlement header");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
