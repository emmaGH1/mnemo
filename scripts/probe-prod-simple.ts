// Production smoke: dual-mode unpaid shapes + 402 schema documentation.
import * as https from "https";

const HOST = "mnemo-production-c4f1.up.railway.app";

function request(
  method: string,
  path: string,
  body?: unknown
): Promise<{ status: number; body: string; headers: Record<string, string> }> {
  return new Promise((resolve, reject) => {
    const data = body !== undefined ? JSON.stringify(body) : undefined;
    const headers: Record<string, string> = {};
    if (data) {
      headers["Content-Type"] = "application/json";
      headers["Content-Length"] = String(Buffer.byteLength(data));
    }
    const req = https.request(
      { hostname: HOST, port: 443, path, method, headers },
      (res) => {
        let b = "";
        res.on("data", (c: Buffer) => {
          b += c.toString();
        });
        res.on("end", () => {
          const h: Record<string, string> = {};
          for (const [k, v] of Object.entries(res.headers)) {
            if (v) h[k.toLowerCase()] = Array.isArray(v) ? v[0] : v;
          }
          resolve({ status: res.statusCode ?? 0, body: b, headers: h });
        });
      }
    );
    req.on("error", reject);
    if (data) req.write(data);
    req.end();
  });
}

async function main(): Promise<void> {
  let failed = false;

  const health = await request("GET", "/health");
  console.log(`health: ${health.status} ${health.body.slice(0, 200)}`);
  if (health.status !== 200) failed = true;

  const simple = await request("POST", "/mcp", {
    page_image_base64: "aGVsbG8=",
    mime_type: "image/png",
  });
  console.log(`simple unpaid: ${simple.status}`);
  if (simple.status !== 402) {
    console.log(`  FAIL expected 402, body=${simple.body.slice(0, 300)}`);
    failed = true;
  } else {
    const j = JSON.parse(simple.body) as { resource?: { description?: string } };
    const desc = j.resource?.description ?? "";
    console.log(`  description: ${desc.slice(0, 200)}`);
    if (!desc.includes("page_image_base64")) {
      console.log("  FAIL 402 description missing page_image_base64 (old deploy?)");
      failed = true;
    } else {
      console.log("  OK schema in 402 description (new deploy live)");
    }
  }

  const rpc = await request("POST", "/mcp", {
    jsonrpc: "2.0",
    id: 1,
    method: "tools/list",
  });
  console.log(`jsonrpc unpaid: ${rpc.status}`);
  if (rpc.status !== 402) {
    console.log(`  FAIL expected 402, body=${rpc.body.slice(0, 200)}`);
    failed = true;
  } else {
    console.log("  OK");
  }

  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
