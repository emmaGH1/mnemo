import * as https from "https";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";
dotenv.config();

const HOST = process.env.MNEMO_HOST ?? "mnemo-production-c4f1.up.railway.app";

// ─── helpers ────────────────────────────────────────────────────────────────

interface HttpResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
}

function httpsRequest(
  path: string, method: string, headers: Record<string, string>, body?: string
): Promise<HttpResponse> {
  return new Promise((resolve, reject) => {
    const req = https.request({ hostname: HOST, port: 443, path, method, headers }, (res) => {
      let data = "";
      res.on("data", (chunk: Buffer) => { data += chunk.toString(); });
      res.on("end", () => {
        const h: Record<string, string> = {};
        for (const [k, v] of Object.entries(res.headers)) {
          if (v) h[k.toLowerCase()] = Array.isArray(v) ? v[0] : v;
        }
        resolve({ statusCode: res.statusCode ?? 0, headers: h, body: data });
      });
    });
    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

async function getPaymentSignature(): Promise<string> {
  const mcpBody = JSON.stringify({ jsonrpc: "2.0", method: "tools/list", id: 999 });
  const unpaid = await httpsRequest("/mcp", "POST", {
    "Content-Type": "application/json",
    "Content-Length": String(Buffer.byteLength(mcpBody)),
    Accept: "application/json",
  }, mcpBody);

  if (unpaid.statusCode !== 402) throw new Error(`Expected 402, got ${unpaid.statusCode}`);

  const prHeader = unpaid.headers["payment-required"];
  if (!prHeader) throw new Error("No payment-required header");

  const { decodePaymentRequiredHeader } = await import("@okxweb3/x402-core/http");
  const { privateKeyToAccount } = await import("viem/accounts");
  const { x402Client, x402HTTPClient } = await import("@okxweb3/x402-core/client");
  const { registerExactEvmScheme } = await import("@okxweb3/x402-evm/exact/client");

  const pr = decodePaymentRequiredHeader(prHeader);
  const pk = process.env.TEST_PAYER_PRIVATE_KEY ?? "";
  if (!pk) throw new Error("TEST_PAYER_PRIVATE_KEY not set");
  const account = privateKeyToAccount(pk as `0x${string}`);
  const client = new x402Client();
  registerExactEvmScheme(client, { signer: account });
  const httpClient = new x402HTTPClient(client);
  const payload = await httpClient.createPaymentPayload(pr);
  const sigHeaders = httpClient.encodePaymentSignatureHeader(payload);
  return sigHeaders["PAYMENT-SIGNATURE"] ?? Object.values(sigHeaders)[0];
}

// ─── main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log("🧪  Mnemo Production End-to-End Test\n");
  console.log(`  Target: https://${HOST}\n`);

  // ── Test 1: tools/list (paid) ─────────────────────────────────────────────
  console.log("── Test 1: tools/list (paid replay) ──");
  try {
    const sig = await getPaymentSignature();
    const listBody = JSON.stringify({ jsonrpc: "2.0", method: "tools/list", id: 1 });
    const res = await httpsRequest("/mcp", "POST", {
      "Content-Type": "application/json",
      "Content-Length": String(Buffer.byteLength(listBody)),
      Accept: "application/json",
      "PAYMENT-SIGNATURE": sig,
    }, listBody);

    console.log(`  Status: ${res.statusCode}`);
    if (res.statusCode !== 200) {
      console.log(`  Body: ${res.body.slice(0, 400)}`);
      console.log("  ⚠️  Expected 200 (unfunded wallet — settle may reject)");
    } else {
      const parsed = JSON.parse(res.body);
      const tools = parsed?.result?.tools ?? [];
      console.log(`  ✅ tools/list returned ${tools.length} tool(s):`);
      for (const t of tools) console.log(`     - ${t.name}: ${t.description?.slice(0, 80)}...`);
    }
  } catch (e) {
    console.log(`  ❌ Error: ${e instanceof Error ? e.message : String(e)}`);
  }

  // ── Test 2: tools/call check-continuity (paid) ─────────────────────────────
  console.log("\n── Test 2: tools/call check-continuity (paid replay) ──");
  try {
    const testImagePath = path.resolve(__dirname, "..", "test-images", "page_contradiction.png");
    if (!fs.existsSync(testImagePath)) {
      console.log(`  ⏭️  SKIP — test image not found at ${testImagePath}`);
    } else {
      const imageBase64 = fs.readFileSync(testImagePath).toString("base64");
      const sig = await getPaymentSignature();

      const callBody = JSON.stringify({
        jsonrpc: "2.0",
        method: "tools/call",
        params: {
          name: "check-continuity",
          arguments: {
            page_image_base64: imageBase64,
            mime_type: "image/png",
          },
        },
        id: 2,
      });

      console.log(`  Image size: ${(imageBase64.length / 1024 / 1024).toFixed(1)} MB`);
      console.log("  Sending tools/call (may take 10-30s for Gemini)...");

      const start = Date.now();
      const res = await httpsRequest("/mcp", "POST", {
        "Content-Type": "application/json",
        "Content-Length": String(Buffer.byteLength(callBody)),
        Accept: "application/json",
        "PAYMENT-SIGNATURE": sig,
      }, callBody);
      const elapsed = ((Date.now() - start) / 1000).toFixed(1);

      console.log(`  Status: ${res.statusCode} (${elapsed}s)`);
      if (res.statusCode !== 200) {
        console.log(`  Body: ${res.body.slice(0, 500)}`);
        console.log("  ⚠️  Expected 200 (unfunded wallet — settle may reject)");
      } else {
        const parsed = JSON.parse(res.body);
        const content = parsed?.result?.content;
        if (content?.[0]?.text) {
          const result = JSON.parse(content[0].text);
          console.log(`  ✅ check-continuity succeeded!`);
          console.log(`     flags: ${result.flags.length}`);
          console.log(`     canon_additions: ${result.canon_additions.length}`);
        } else {
          console.log(`  ⚠️  Unexpected result structure. Raw: ${res.body.slice(0, 500)}`);
        }
      }
    }
  } catch (e) {
    console.log(`  ❌ Error: ${e instanceof Error ? e.message : String(e)}`);
  }

  console.log("\n✅  End-to-end tests complete.\n");
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
