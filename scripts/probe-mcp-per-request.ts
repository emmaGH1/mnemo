import express from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import http from "http";

async function main() {
  // NEW transport per request + enableJsonResponse
  const app = express();
  app.use(express.json({ limit: "20mb" }));

  function createServer() {
    const mcpServer = new McpServer({ name: "mnemo", version: "1.0.0" });
    mcpServer.tool(
      "check-continuity",
      "test tool",
      {
        page_image_base64: z.string(),
        mime_type: z.enum(["image/png", "image/jpeg", "image/webp"]),
      },
      async () => ({
        content: [{ type: "text" as const, text: JSON.stringify({ flags: [{ severity: "high", attribute: "eye_color" }], ok: true }) }],
      })
    );
    return mcpServer;
  }

  app.post("/mcp", async (req, res) => {
    try {
      const mcpServer = createServer();
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
        enableJsonResponse: true,
      });
      await mcpServer.connect(transport);
      console.error("[per-req] method", req.body?.method);
      await transport.handleRequest(req as never, res as never, req.body);
      console.error("[per-req] status", res.statusCode, "headersSent", res.headersSent);
      // close transport
      await transport.close().catch(() => {});
    } catch (err: unknown) {
      console.error("[per-req] CATCH STACK:", err instanceof Error ? err.stack : err);
      if (!res.headersSent) res.status(500).json({ error: String(err) });
    }
  });

  // Also probe: reuse ONE server, NEW transport each time
  const app2 = express();
  app2.use(express.json({ limit: "20mb" }));
  const sharedMcp = createServer();
  app2.post("/mcp", async (req, res) => {
    try {
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
        enableJsonResponse: true,
      });
      // reconnect each time?
      await sharedMcp.connect(transport);
      await transport.handleRequest(req as never, res as never, req.body);
      await transport.close().catch(() => {});
    } catch (err: unknown) {
      console.error("[shared] CATCH:", err instanceof Error ? err.stack : err);
      if (!res.headersSent) res.status(500).json({ error: String(err) });
    }
  });

  const s1 = await new Promise<http.Server>((r) => { const s = app.listen(0, "127.0.0.1", () => r(s)); });
  const s2 = await new Promise<http.Server>((r) => { const s = app2.listen(0, "127.0.0.1", () => r(s)); });
  const p1 = (s1.address() as any).port;
  const p2 = (s2.address() as any).port;

  async function call(port: number, label: string, body: object) {
    const res = await fetch(`http://127.0.0.1:${port}/mcp`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
      },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    console.log(JSON.stringify({ label, status: res.status, ct: res.headers.get("content-type"), bodyHead: text.slice(0, 350) }));
  }

  const listBody = { jsonrpc: "2.0", method: "tools/list", id: 1 };
  const callBody = {
    jsonrpc: "2.0",
    method: "tools/call",
    id: 3,
    params: { name: "check-continuity", arguments: { page_image_base64: "aa", mime_type: "image/png" } },
  };

  await call(p1, "fresh-server list", listBody);
  await call(p1, "fresh-server call", callBody);
  await call(p1, "fresh-server list2", listBody);

  await call(p2, "shared-mcp list", listBody);
  await call(p2, "shared-mcp call", callBody);
  await call(p2, "shared-mcp list2", listBody);

  s1.close(); s2.close();
}
main().catch((e) => { console.error(e); process.exit(1); });
