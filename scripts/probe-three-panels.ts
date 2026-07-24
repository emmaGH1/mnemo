// ─────────────────────────────────────────────────────────────────────────────
// probe-three-panels.ts  — Paid continuity check on 3 ep003 panels.
//
// Sends ep003_p28.jpg, ep003_p30.jpg, ep003_p35.jpg through the x402-gated
// MCP endpoint (check-continuity tool) at $0.10 USDT each. Uses the test
// payer wallet from .env (currently ~0.3 USDT — exactly 3 checks).
// ─────────────────────────────────────────────────────────────────────────────

import * as https from "https";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

dotenv.config();

const HOST = "mnemo-production-c4f1.up.railway.app";
const SERIES_ID = "lore-olympus";

const PANEL_FILES = [
  { file: "ep003_p28.jpg", ep: 3, panel: 28 },
  { file: "ep003_p30.jpg", ep: 3, panel: 30 },
  { file: "ep003_p35.jpg", ep: 3, panel: 35 },
];

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

/**
 * Perform the x402 dance for one JSON-RPC tools/call body:
 *   1. Send unpaid → expect 402
 *   2. Decode + sign the PaymentRequired challenge
 *   3. Send paid → expect 200 with JSON-RPC result
 */
async function x402Call(mcpBody: string): Promise<HttpResponse> {
  // ── Step 1: Unpaid tools/call → expect 402 ──────────────────────────
  const unpaid = await httpsRequest("/mcp", "POST", {
    "Content-Type": "application/json",
    "Content-Length": String(Buffer.byteLength(mcpBody)),
    Accept: "application/json, text/event-stream",
  }, mcpBody);

  if (unpaid.statusCode !== 402) {
    console.error(`  Expected 402 but got ${unpaid.statusCode}. Body: ${unpaid.body.slice(0, 200)}`);
    process.exit(1);
  }

  const prHeader = unpaid.headers["payment-required"];
  if (!prHeader) {
    console.error("  No payment-required header in 402 response");
    process.exit(1);
  }

  // ── Step 2: Decode + sign ────────────────────────────────────────────
  const { decodePaymentRequiredHeader } = await import("@okxweb3/x402-core/http");
  const pr = decodePaymentRequiredHeader(prHeader);

  const payerKey = process.env.TEST_PAYER_PRIVATE_KEY ?? "";
  if (!payerKey) {
    console.error("  TEST_PAYER_PRIVATE_KEY not set in .env");
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

  // ── Step 3: Paid tools/call → expect 200 ────────────────────────────
  return httpsRequest("/mcp", "POST", {
    "Content-Type": "application/json",
    "Content-Length": String(Buffer.byteLength(mcpBody)),
    Accept: "application/json, text/event-stream",
    "PAYMENT-SIGNATURE": sig,
  }, mcpBody);
}

async function main() {
  const pagesDir = path.resolve(__dirname, "..", "data", "series", SERIES_ID, "pages");

  for (const { file, ep, panel } of PANEL_FILES) {
    const imagePath = path.join(pagesDir, file);
    if (!fs.existsSync(imagePath)) {
      console.error(`Image not found: ${imagePath}`);
      process.exit(1);
    }

    console.log(`\n${"═".repeat(60)}`);
    console.log(`📄  Panel: ${file}  (ep ${ep}, panel ${panel})`);
    console.log(`${"═".repeat(60)}`);

    const imageBase64 = fs.readFileSync(imagePath).toString("base64");
    console.log(`  Image size: ${(Buffer.byteLength(imageBase64) / 1024).toFixed(1)} KB base64`);

    const mcpBody = JSON.stringify({
      jsonrpc: "2.0",
      method: "tools/call",
      id: panel, // use panel number as request id for traceability
      params: {
        name: "check-continuity",
        arguments: {
          page_image_base64: imageBase64,
          mime_type: "image/jpeg",
          series_id: SERIES_ID,
          ep_number: ep,
          panel_number: panel,
        },
      },
    });

    console.log(`  Sending request...`);
    const paid = await x402Call(mcpBody);

    console.log(`  Status: ${paid.statusCode}`);
    console.log(`  Content-Type: ${paid.headers["content-type"] ?? "(none)"}`);

    if (paid.statusCode !== 200) {
      console.log(`  ❌ Non-200 response. Body[:300]: ${paid.body.slice(0, 300)}`);
      continue;
    }

    // Parse the JSON-RPC response
    let parsed: any;
    try {
      parsed = JSON.parse(paid.body);
    } catch {
      console.log(`  ❌ Body is not valid JSON. Body[:300]: ${paid.body.slice(0, 300)}`);
      continue;
    }

    if (!parsed.result) {
      // JSON-RPC error
      console.log(`  ⚠️  JSON-RPC error: ${JSON.stringify(parsed.error)}`);
      continue;
    }

    // Extract the tool result
    const toolResult = parsed.result.content?.[0]?.text;
    if (!toolResult) {
      console.log(`  ⚠️  No content in result. Result: ${JSON.stringify(parsed.result).slice(0, 300)}`);
      continue;
    }

    let checkResult: any;
    try {
      checkResult = JSON.parse(toolResult);
    } catch {
      console.log(`  ⚠️  Tool result is not JSON: ${toolResult.slice(0, 200)}`);
      continue;
    }

    // ── Pretty-print the flags ────────────────────────────────────────────
    const flags = checkResult.flags ?? [];
    const additions = checkResult.canon_additions ?? [];

    if (flags.length === 0 && additions.length === 0) {
      console.log(`  ✅ No continuity flags or additions — panel matches canon.`);
    } else {
      if (flags.length > 0) {
        console.log(`\n  🚩  FLAGS (${flags.length}):`);
        for (const f of flags) {
          console.log(`     ┌ ${f.severity.toUpperCase()} | ${f.character} → ${f.field}`);
          console.log(`     │ canon:   ${f.canon_value}`);
          console.log(`     │ new:     ${f.new_value}`);
          if (f.ep_ref) console.log(`     │ ep ref:  episode ${f.ep_ref} panel ${f.panel_ref}`);
          console.log(`     │ ${f.explanation}`);
          console.log(`     └`);
        }
      }
      if (additions.length > 0) {
        console.log(`\n  📝  CANON ADDITIONS (${additions.length}):`);
        for (const a of additions) {
          console.log(`     ┌ type: ${a.type}`);
          for (const [k, v] of Object.entries(a.data)) {
            console.log(`     │ ${k}: ${v}`);
          }
          console.log(`     └`);
        }
      }
    }
  }

  console.log(`\n${"═".repeat(60)}`);
  console.log(`✅  Done. All 3 panels checked.`);
  console.log(`${"═".repeat(60)}`);
}

main().catch((e) => {
  console.error("Unhandled error:", e);
  process.exit(1);
});
