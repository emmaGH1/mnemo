// Production: body-hardening checks (lenient JSON must not 500).
import * as https from "https";

const HOST = process.env.MNEMO_HOST ?? "mnemo-production-c4f1.up.railway.app";
const B64 = "aGVsbG8gd29ybGQ=";

function request(
  method: string,
  path: string,
  body?: string,
  contentType = "application/json"
): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const headers: Record<string, string> = {};
    if (body !== undefined) {
      headers["Content-Type"] = contentType;
      headers["Content-Length"] = String(Buffer.byteLength(body));
    }
    const req = https.request(
      { hostname: HOST, port: 443, path, method, headers },
      (res) => {
        let b = "";
        res.on("data", (c: Buffer) => {
          b += c.toString();
        });
        res.on("end", () => resolve({ status: res.statusCode ?? 0, body: b }));
      }
    );
    req.on("error", reject);
    if (body !== undefined) req.write(body);
    req.end();
  });
}

async function main(): Promise<void> {
  let failed = false;

  const cases: Array<{ label: string; body: string; expect: number[] }> = [
    {
      label: "simple JSON",
      body: JSON.stringify({ page_image_base64: B64, mime_type: "image/png" }),
      expect: [402],
    },
    {
      label: "JSON-RPC tools/list",
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
      expect: [402],
    },
    {
      label: "JSON-RPC tools/call",
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: {
          name: "check-continuity",
          arguments: { page_image_base64: B64, mime_type: "image/png" },
        },
      }),
      expect: [402],
    },
    {
      label: "single-quoted JSON (OKX failure mode)",
      body: `{'page_image_base64':'${B64}','mime_type':'image/png'}`,
      expect: [402, 400], // 402 if lenient accept, 400 if rejected — never 500
    },
    {
      label: "empty body",
      body: "",
      expect: [402, 400],
    },
    {
      label: "unquoted keys tools/list",
      body: '{jsonrpc: "2.0", id: 1, method: "tools/list"}',
      expect: [402, 400],
    },
  ];

  for (const c of cases) {
    const res = await request("POST", "/mcp", c.body || undefined);
    const ok = c.expect.includes(res.status) && res.status !== 500;
    console.log(
      `${ok ? "OK" : "FAIL"} ${c.label}: status=${res.status} (expect ${c.expect.join("|")}, never 500)`
    );
    if (res.status === 500) {
      console.log(`  body: ${res.body.slice(0, 300)}`);
      failed = true;
    } else if (!ok) {
      console.log(`  body: ${res.body.slice(0, 300)}`);
      failed = true;
    } else if (res.status === 402) {
      try {
        const j = JSON.parse(res.body) as { resource?: { description?: string } };
        const desc = j.resource?.description ?? "";
        if (c.label.includes("simple") || c.label.includes("tools/call")) {
          if (!desc.includes("page_image_base64")) {
            console.log("  WARN: 402 description missing page_image_base64 (old deploy?)");
            console.log(`  desc: ${desc.slice(0, 120)}`);
            failed = true;
          }
        }
      } catch {
        /* challenge may be header-only in some cases */
      }
    }
  }

  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
