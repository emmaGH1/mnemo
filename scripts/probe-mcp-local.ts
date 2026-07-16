import express from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import http from "http";

async function main() {
  const app = express();
  app.use(express.json({ limit: "20mb" }));

  const mcpServer = new McpServer({ name: "mnemo", version: "1.0.0" });
  mcpServer.tool(
    "check-continuity",
    "test tool",
    {
      page_image_base64: z.string(),
      mime_type: z.enum(["image/png", "image/jpeg", "image/webp"]),
    },
    async () => ({
      content: [{ type: "text" as const, text: JSON.stringify({ flags: [], ok: true }) }],
    })
  );

  const transportSse = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  await mcpServer.connect(transportSse);

  app.post("/mcp", async (req, res) => {
    try {
      console.error("[probe] method", req.body?.method, "id", req.body?.id);
      await transportSse.handleRequest(req as never, res as never, req.body);
      console.error("[probe] after handleRequest headersSent=", res.headersSent, "status=", res.statusCode);
    } catch (err: unknown) {
      console.error("[probe] CATCH:", err instanceof Error ? err.stack : err);
      if (!res.headersSent) res.status(500).json({ error: String(err) });
    }
  });

  // Second server with enableJsonResponse
  const app2 = express();
  app2.use(express.json({ limit: "20mb" }));
  const mcp2 = new McpServer({ name: "mnemo-json", version: "1.0.0" });
  mcp2.tool(
    "check-continuity",
    "test tool",
    {
      page_image_base64: z.string(),
      mime_type: z.enum(["image/png", "image/jpeg", "image/webp"]),
    },
    async () => ({
      content: [{ type: "text" as const, text: JSON.stringify({ flags: [{ id: 1 }], ok: true }) }],
    })
  );
  const transportJson = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  await mcp2.connect(transportJson);
  app2.post("/mcp", async (req, res) => {
    try {
      await transportJson.handleRequest(req as never, res as never, req.body);
    } catch (err: unknown) {
      console.error("[json] CATCH:", err instanceof Error ? err.stack : err);
      if (!res.headersSent) res.status(500).json({ error: String(err) });
    }
  });

  const server = await new Promise<http.Server>((resolve) => {
    const s = app.listen(0, "127.0.0.1", () => resolve(s));
  });
  const port = (server.address() as { port: number }).port;

  const server2 = await new Promise<http.Server>((resolve) => {
    const s = app2.listen(0, "127.0.0.1", () => resolve(s));
  });
  const port2 = (server2.address() as { port: number }).port;

  async function call(base: string, label: string, body: object, accept: string) {
    const res = await fetch(`${base}/mcp`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: accept },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    console.log(JSON.stringify({ label, status: res.status, ct: res.headers.get("content-type"), bodyHead: text.slice(0, 400) }));
  }

  const accept = "application/json, text/event-stream";
  const base = `http://127.0.0.1:${port}`;
  const base2 = `http://127.0.0.1:${port2}`;

  await call(base, "SSE tools/list", { jsonrpc: "2.0", method: "tools/list", id: 1 }, accept);
  await call(base, "SSE initialize", {
    jsonrpc: "2.0",
    method: "initialize",
    id: 0,
    params: { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "p", version: "1" } },
  }, accept);
  await call(base, "SSE tools/call", {
    jsonrpc: "2.0",
    method: "tools/call",
    id: 3,
    params: { name: "check-continuity", arguments: { page_image_base64: "aa", mime_type: "image/png" } },
  }, accept);

  await call(base2, "JSON tools/list", { jsonrpc: "2.0", method: "tools/list", id: 1 }, accept);
  await call(base2, "JSON tools/call", {
    jsonrpc: "2.0",
    method: "tools/call",
    id: 3,
    params: { name: "check-continuity", arguments: { page_image_base64: "aa", mime_type: "image/png" } },
  }, accept);

  // Simulate x402-style response buffering around SSE transport
  console.log("--- buffered write/end simulation on JSON transport ---");
  // already works with JSON

  server.close();
  server2.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
