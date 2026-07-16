import express from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import http from "http";

async function main() {
  const app = express();
  app.use(express.json());

  // Fake x402 buffering middleware (same pattern as @okxweb3/x402-express)
  app.use("/mcp", async (req, res, next) => {
    const originalWriteHead = res.writeHead.bind(res);
    const originalWrite = res.write.bind(res);
    const originalEnd = res.end.bind(res);
    const originalFlushHeaders = res.flushHeaders.bind(res);
    let buffered: Array<[string, any[]]> = [];
    let settled = false;
    let endResolve!: () => void;
    const endPromise = new Promise<void>((r) => { endResolve = r; });
    res.writeHead = function (...args: any[]) {
      if (!settled) { buffered.push(["writeHead", args]); return res; }
      return originalWriteHead(...(args as any));
    } as any;
    res.write = function (...args: any[]) {
      if (!settled) { buffered.push(["write", args]); return true; }
      return originalWrite(...(args as any));
    } as any;
    res.end = function (...args: any[]) {
      if (!settled) { buffered.push(["end", args]); endResolve(); return res; }
      return originalEnd(...(args as any));
    } as any;
    res.flushHeaders = function () {
      if (!settled) { buffered.push(["flushHeaders", []]); return; }
      return originalFlushHeaders();
    } as any;

    next();
    await endPromise;
    console.error("[fake-x402] statusCode after handler=", res.statusCode, "buffered=", buffered.map(b => b[0]));
    // settle ok path if <400
    if (res.statusCode < 400 || res.statusCode === 200) {
      res.setHeader("payment-response", "fake-ok");
    }
    settled = true;
    res.writeHead = originalWriteHead;
    res.write = originalWrite;
    res.end = originalEnd;
    res.flushHeaders = originalFlushHeaders;
    for (const [method, args] of buffered) {
      if (method === "writeHead") originalWriteHead(...(args as any));
      else if (method === "write") originalWrite(...(args as any));
      else if (method === "end") originalEnd(...(args as any));
      else if (method === "flushHeaders") originalFlushHeaders();
    }
  });

  app.post("/mcp", async (req, res) => {
    try {
      const mcp = new McpServer({ name: "m", version: "1" });
      mcp.tool("check-continuity", "t", {
        page_image_base64: z.string(),
        mime_type: z.enum(["image/png", "image/jpeg", "image/webp"]),
      }, async () => ({ content: [{ type: "text" as const, text: JSON.stringify({ flags: [{ a: 1 }] }) }] }));
      const t = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
      await mcp.connect(t);
      await t.handleRequest(req as never, res as never, req.body);
      await t.close().catch(() => {});
    } catch (e) {
      console.error("handler err", e);
      if (!res.headersSent) res.status(500).json({ error: String(e) });
    }
  });

  const s = await new Promise<http.Server>((r) => { const x = app.listen(0, "127.0.0.1", () => r(x)); });
  const port = (s.address() as any).port;
  const res = await fetch(`http://127.0.0.1:${port}/mcp`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream" },
    body: JSON.stringify({
      jsonrpc: "2.0", method: "tools/call", id: 1,
      params: { name: "check-continuity", arguments: { page_image_base64: "x", mime_type: "image/png" } },
    }),
  });
  const text = await res.text();
  console.log(JSON.stringify({ status: res.status, pr: res.headers.get("payment-response"), body: text.slice(0, 300) }));
  s.close();
}
main();
