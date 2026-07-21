// Live paid-path test against production /mcp.
// Reproduces the OKX review flow: 402 → sign EIP-3009 → retry with PAYMENT-SIGNATURE.
// Payer wallet is intentionally unfunded → settle rejection (non-500) = verify OK.
import dotenv from "dotenv";
dotenv.config();

const BASE = process.env.LIVE_BASE ?? "https://mnemo-production-c4f1.up.railway.app";
const payerKey = process.env.TEST_PAYER_PRIVATE_KEY;
if (!payerKey) { console.error("TEST_PAYER_PRIVATE_KEY missing"); process.exit(1); }

const mcpBody = JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "live-test", version: "1.0" } } });

// Step 1: unpaid request → expect 402 + payment-required header
const unpaid = await fetch(`${BASE}/mcp`, { method: "POST", headers: { "Content-Type": "application/json" }, body: mcpBody });
console.log("Step 1 unpaid status:", unpaid.status);
const prHeader = unpaid.headers.get("payment-required");
if (unpaid.status !== 402 || !prHeader) { console.error("FAIL: expected 402 + payment-required header"); process.exit(1); }
console.log("Step 1 OK: 402 with payment-required header");

// Step 2: decode + sign
const { decodePaymentRequiredHeader } = await import("@okxweb3/x402-core/http");
const { privateKeyToAccount } = await import("viem/accounts");
const { x402Client, x402HTTPClient } = await import("@okxweb3/x402-core/client");
const { registerExactEvmScheme } = await import("@okxweb3/x402-evm/exact/client");

const paymentRequired = decodePaymentRequiredHeader(prHeader);
console.log("Step 2 decoded: x402v" + paymentRequired.x402Version, "network=" + paymentRequired.accepts[0]?.network, "payTo=" + paymentRequired.accepts[0]?.payTo);

const account = privateKeyToAccount(payerKey);
console.log("Step 3 signer:", account.address);
const client = new x402Client();
registerExactEvmScheme(client, { signer: account });
const httpClient = new x402HTTPClient(client);
const payload = await httpClient.createPaymentPayload(paymentRequired);
const sigHeaders = httpClient.encodePaymentSignatureHeader(payload);
const sig = sigHeaders["PAYMENT-SIGNATURE"] ?? Object.values(sigHeaders)[0];
console.log("Step 3 OK: payment payload signed");

// Step 4: retry with payment
const paid = await fetch(`${BASE}/mcp`, { method: "POST", headers: { "Content-Type": "application/json", "PAYMENT-SIGNATURE": sig }, body: mcpBody });
const paidText = await paid.text();
console.log("Step 4 paid status:", paid.status);
console.log("Step 4 paid body (first 600 chars):", paidText.slice(0, 600));

// Interpret
if (paid.status === 500) { console.error("FAIL: 500 after verify — post-settle crash NOT fixed"); process.exit(1); }
if (paid.status === 402) {
  const lower = paidText.toLowerCase();
  if (lower.includes("invalid") || lower.includes("verify")) { console.error("FAIL: verify() rejected the payment"); process.exit(1); }
  console.log("PASS: verify() succeeded; settle rejected (expected — unfunded payer wallet)");
  process.exit(0);
}
console.log("PASS: verify() succeeded and MCP responded (status " + paid.status + ")");
process.exit(0);
