// ─────────────────────────────────────────────────────────────────────────────
// probe-p28-retry.ts  — Retry ep003_p28 with the remaining 0.1 USDT.
// ─────────────────────────────────────────────────────────────────────────────

import * as https from "https";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

dotenv.config();

const HOST = "mnemo-production-c4f1.up.railway.app";

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
      { hostname: HOST, port: 443, path, method, headers, timeout: 60_000 },
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
    req.on("timeout", () => { req.destroy(); reject(new Error("Client timeout")); });
    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

async function main() {
  const imagePath = path.resolve(__dirname, "..", "data", "series", "lore-olympus", "pages", "ep003_p28.jpg");
  const imageBase64 = fs.readFileSync(imagePath).toString("base64");
  console.log(`Image: ${(Buffer.byteLength(imageBase64) / 1024).toFixed(1)} KB base64`);

  const mcpBody = JSON.stringify({
    jsonrpc: "2.0",
    method: "tools/call",
    id: 28,
    params: {
      name: "check-continuity",
      arguments: {
        page_image_base64: imageBase64,
        mime_type: "image/jpeg",
        series_id: "lore-olympus",
        ep_number: 3,
        panel_number: 28,
      },
    },
  });

  // Step 1: unpaid → 402
  console.log("Step 1: unpaid...");
  const unpaid = await httpsRequest("/mcp", "POST", {
    "Content-Type": "application/json",
    "Content-Length": String(Buffer.byteLength(mcpBody)),
    Accept: "application/json, text/event-stream",
  }, mcpBody);
  console.log(`  Status: ${unpaid.statusCode}`);

  if (unpaid.statusCode !== 402) {
    console.log(`  Expected 402, got ${unpaid.statusCode}. Body: ${unpaid.body.slice(0, 200)}`);
    process.exit(1);
  }

  const prHeader = unpaid.headers["payment-required"];
  if (!prHeader) { console.log("  No payment-required header"); process.exit(1); }

  // Step 2: sign
  console.log("Step 2: sign...");
  const { decodePaymentRequiredHeader } = await import("@okxweb3/x402-core/http");
  const pr = decodePaymentRequiredHeader(prHeader);

  const payerKey = process.env.TEST_PAYER_PRIVATE_KEY ?? "";
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

  // Step 3: paid
  console.log("Step 3: paid...");
  const paid = await httpsRequest("/mcp", "POST", {
    "Content-Type": "application/json",
    "Content-Length": String(Buffer.byteLength(mcpBody)),
    Accept: "application/json, text/event-stream",
    "PAYMENT-SIGNATURE": sig,
  }, mcpBody);

  console.log(`  Status: ${paid.statusCode}`);

  let parsed: any;
  try { parsed = JSON.parse(paid.body); } catch {
    console.log(`  Body is not JSON: ${paid.body.slice(0, 300)}`);
    process.exit(1);
  }

  if (parsed.error) {
    console.log(`  JSON-RPC error: ${JSON.stringify(parsed.error)}`);
    process.exit(1);
  }

  const toolResult = parsed.result?.content?.[0]?.text;
  if (!toolResult) {
    console.log(`  No content. Result: ${JSON.stringify(parsed.result).slice(0, 300)}`);
    process.exit(1);
  }

  const checkResult = JSON.parse(toolResult);
  const flags = checkResult.flags ?? [];
  const additions = checkResult.canon_additions ?? [];

  console.log(`\n📄  Panel: ep003_p28.jpg (ep 3, panel 28)\n`);

  if (flags.length === 0 && additions.length === 0) {
    console.log(`  ✅ No flags or additions — panel matches canon.`);
  }

  if (flags.length > 0) {
    console.log(`  🚩  FLAGS (${flags.length}):`);
    for (const f of flags) {
      console.log(`     ┌ ${f.severity.toUpperCase()} | ${f.character} → ${f.field}`);
      console.log(`     │ canon: ${f.canon_value}`);
      console.log(`     │ new:   ${f.new_value}`);
      if (f.ep_ref) console.log(`     │ ep ref: ep ${f.ep_ref} panel ${f.panel_ref}`);
      console.log(`     │ ${f.explanation}`);
      console.log(`     └`);
    }
  }

  if (additions.length > 0) {
    console.log(`  📝  CANON ADDITIONS (${additions.length}):`);
    for (const a of additions) {
      console.log(`     ┌ type: ${a.type}`);
      for (const [k, v] of Object.entries(a.data)) {
        console.log(`     │ ${k}: ${v}`);
      }
      console.log(`     └`);
    }
  }
}

main().catch((e) => { console.error("Unhandled error:", e); process.exit(1); });
