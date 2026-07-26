// Quick local smoke: dual-mode POST /mcp body + 402 schema documentation.
import * as http from "http";
import { adaptMcpPostBody } from "../src/server.js";

function assertAdapt(): void {
  console.log("── adaptMcpPostBody unit checks ──");
  const cases: Array<{ label: string; body: unknown; mode: string }> = [
    {
      label: "jsonrpc tools/call",
      body: {
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: { name: "check-continuity", arguments: { page_image_base64: "x", mime_type: "image/png" } },
      },
      mode: "jsonrpc",
    },
    {
      label: "flat simple JSON",
      body: { page_image_base64: "x", mime_type: "image/png" },
      mode: "simple-check",
    },
    {
      label: "named tool arguments",
      body: { name: "check-continuity", arguments: { page_image_base64: "x", mime_type: "image/png" } },
      mode: "simple-check",
    },
    {
      label: "page_image alias",
      body: { page_image: "x", mime_type: "image/jpeg" },
      mode: "simple-check",
    },
    {
      label: "garbage",
      body: { foo: "bar" },
      mode: "invalid",
    },
  ];
  let failed = false;
  for (const c of cases) {
    const got = adaptMcpPostBody(c.body);
    if (got.mode !== c.mode) {
      console.log(`  FAIL ${c.label}: expected ${c.mode}, got ${got.mode}`);
      failed = true;
    } else {
      console.log(`  OK ${c.label} → ${got.mode}`);
    }
  }
  if (failed) throw new Error("adaptMcpPostBody unit checks failed");
}

async function main(): Promise<void> {
  assertAdapt();

  const { default: app, serverReady } = await import("../src/server.js");
  await serverReady;

  const server = await new Promise<http.Server>((resolve) => {
    const s = (app as import("express").Express).listen(0, "127.0.0.1", () => resolve(s));
  });
  const port = (server.address() as { port: number }).port;

  function req(body: unknown): Promise<{ status: number; body: string }> {
    return new Promise((resolve, reject) => {
      const data = JSON.stringify(body);
      const r = http.request(
        {
          hostname: "127.0.0.1",
          port,
          path: "/mcp",
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Content-Length": Buffer.byteLength(data),
          },
        },
        (res) => {
          let b = "";
          res.on("data", (c: Buffer) => {
            b += c.toString();
          });
          res.on("end", () => resolve({ status: res.statusCode ?? 0, body: b }));
        }
      );
      r.on("error", reject);
      r.write(data);
      r.end();
    });
  }

  let failed = false;

  const a = await req({ jsonrpc: "2.0", method: "tools/list", id: 1 });
  console.log(`JSON-RPC unpaid: ${a.status}`);
  if (a.status !== 402) {
    console.log("  FAIL expected 402");
    failed = true;
  } else {
    const challenge = JSON.parse(a.body) as {
      resource?: { description?: string };
    };
    const desc = challenge.resource?.description ?? "";
    console.log(`  description: ${desc.slice(0, 160)}…`);
    if (!desc.includes("page_image_base64")) {
      console.log("  FAIL description missing page_image_base64");
      failed = true;
    } else {
      console.log("  OK schema in 402 description");
    }
  }

  const b = await req({ page_image_base64: "aGVsbG8=", mime_type: "image/png" });
  console.log(`simple JSON unpaid: ${b.status}`);
  if (b.status !== 402) {
    console.log(`  FAIL expected 402, body=${b.body.slice(0, 200)}`);
    failed = true;
  } else {
    console.log("  OK simple JSON hits x402 gate (not 400)");
  }

  const c = await req({ foo: "bar" });
  console.log(`garbage unpaid: ${c.status}`);
  if (c.status !== 402) {
    console.log(`  FAIL expected 402 before body adapter, got ${c.status}`);
    failed = true;
  } else {
    console.log("  OK x402 gates before body validation");
  }

  server.close();
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
