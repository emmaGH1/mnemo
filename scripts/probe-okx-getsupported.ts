import * as crypto from "crypto";
import * as dotenv from "dotenv";
dotenv.config();

const apiKey = process.env.OKX_API_KEY ?? "";
const secretKey = process.env.OKX_SECRET_KEY ?? "";
const passphrase = process.env.OKX_PASSPHRASE ?? "";
const baseUrl = "https://web3.okx.com";
const path = "/api/v6/pay/x402/supported";

function redact(s: string, n = 4) {
  if (!s) return "(empty)";
  if (s.length <= n * 2) return `len=${s.length}`;
  return `len=${s.length} ${s.slice(0, n)}…${s.slice(-n)}`;
}

async function main() {
  console.log("=== CREDENTIAL SHAPE ===");
  console.log("OKX_API_KEY:", redact(apiKey));
  console.log("OKX_SECRET_KEY:", redact(secretKey));
  console.log("OKX_PASSPHRASE:", `len=${passphrase.length} (value not printed)`);
  console.log("local ISO now:", new Date().toISOString());

  const timestamp = new Date().toISOString();
  const method = "GET";
  const prehash = timestamp + method + path;
  const sign = crypto.createHmac("sha256", secretKey).update(prehash).digest("base64");

  const headers: Record<string, string> = {
    "OK-ACCESS-KEY": apiKey,
    "OK-ACCESS-SIGN": sign,
    "OK-ACCESS-TIMESTAMP": timestamp,
    "OK-ACCESS-PASSPHRASE": passphrase,
    "Content-Type": "application/json",
  };

  console.log("=== REQUEST ===");
  console.log("URL:", baseUrl + path);
  console.log("timestamp:", timestamp);
  console.log("prehash (no secret):", prehash);
  console.log("sign:", redact(sign, 6));

  const res = await fetch(baseUrl + path, { method, headers });
  const rawText = await res.text();

  console.log("=== RAW RESPONSE ===");
  console.log("status:", res.status, res.statusText);
  console.log("date header:", res.headers.get("date"));
  console.log("content-type:", res.headers.get("content-type"));
  console.log("body length:", rawText.length);
  console.log("--- body start ---");
  console.log(rawText);
  console.log("--- body end ---");

  try {
    const j = JSON.parse(rawText) as Record<string, unknown>;
    console.log("parsed keys:", Object.keys(j).join(", "));
    console.log("code:", j.code ?? j.errorCode ?? j.error_code);
    console.log("msg:", j.msg ?? j.message ?? j.errorMsg ?? j.error_message);
  } catch {
    console.log("body is not JSON");
  }
}

main().catch((e) => {
  console.error("PROBE FATAL:", e);
  process.exit(1);
});
