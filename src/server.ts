// ─────────────────────────────────────────────────────────────────────────────
// server.ts  — Express API server for the ASP
//
// Route table:
//   GET  /health  — liveness probe (no payment gate)
//   POST /check   — convenience REST, ungated (local dev / direct HTTP clients)
//   POST /mcp     — x402 payment gate ($0.15 USDT, eip155:196) → MCP tool
//   GET  /mcp     — MCP SSE / GET endpoint (some MCP clients require this)
//   DELETE /mcp   — MCP session teardown
//
// Payment shape (confirmed from @okxweb3/x402-express v0.1.1 .d.ts):
//   paymentMiddleware(routes: RoutesConfig, server: x402ResourceServer, ...)
//   routes = { "POST /mcp": { accepts: { scheme, price, network, payTo }, description } }
//
// Facilitator selection:
//   If OKX credentials are present AND web3.okx.com resolves via DNS →
//     real OKXFacilitatorClient (verify/settle work for live payments).
//   Otherwise → stub client (getSupported() succeeds locally, verify/settle throw).
//   This lets Tests A+B run in any environment; Test C self-skips when OKX
//   is unreachable.
// ─────────────────────────────────────────────────────────────────────────────

import express, { type Request, type Response } from "express";
import multer from "multer";
import * as fs from "fs";
import * as dns from "dns";
import * as path from "path";
import * as dotenv from "dotenv";
import { z } from "zod";

// ── x402 imports ──────────────────────────────────────────────────────────────
import {
  paymentMiddleware,
  x402ResourceServer,
} from "@okxweb3/x402-express";
import { ExactEvmScheme } from "@okxweb3/x402-evm/exact/server";
import { OKXFacilitatorClient } from "@okxweb3/x402-core";

// ── MCP SDK imports ────────────────────────────────────────────────────────────
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

// ── Local imports ──────────────────────────────────────────────────────────────
import { checkContinuity } from "./checker.js";
import { runCheck, DEFAULT_CANON_PATH } from "./check-handler.js";
import type { CanonDoc } from "./types.js";

dotenv.config();

// ─────────────────────────────────────────────────────────────────────────────
// Environment
// ─────────────────────────────────────────────────────────────────────────────
const PORT = Number(process.env.PORT ?? 3000);

const AGENTIC_WALLET_ADDRESS =
  process.env.AGENTIC_WALLET_ADDRESS ??
  "0x0000000000000000000000000000000000000000";

const OKX_API_KEY = process.env.OKX_API_KEY ?? "";
const OKX_SECRET_KEY = process.env.OKX_SECRET_KEY ?? "";
const OKX_PASSPHRASE = process.env.OKX_PASSPHRASE ?? "";
const hasOKXCredentials = !!(OKX_API_KEY && OKX_SECRET_KEY && OKX_PASSPHRASE);

// ─────────────────────────────────────────────────────────────────────────────
// Stub facilitator
//
// Used when OKX credentials are absent OR when web3.okx.com is unreachable
// (e.g. sandbox/CI with no outbound DNS). getSupported() resolves immediately
// so initialize() succeeds and the middleware can issue proper 402 responses.
// verify() and settle() throw — genuine payments are never accepted in stub mode.
// ─────────────────────────────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const stubFacilitatorClient: any = {
  async getSupported() {
    return {
      kinds: [{ x402Version: 2, scheme: "exact", network: "eip155:196" }],
      extensions: [],
      signers: {},
    };
  },
  async verify() {
    throw new Error("Stub facilitator: cannot verify real payments without OKX credentials.");
  },
  async settle() {
    throw new Error("Stub facilitator: cannot settle real payments without OKX credentials.");
  },
  async getSettleStatus() {
    throw new Error("Stub facilitator: not implemented without OKX credentials.");
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// DNS probe — synchronous wrapper using dns.lookup callback API
// ─────────────────────────────────────────────────────────────────────────────
function canReachOKX(): Promise<boolean> {
  return new Promise((resolve) => {
    dns.lookup("web3.okx.com", (err) => resolve(!err));
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// isStubMode — exported so test-server.ts can detect sandbox environment
// and self-skip Test C when OKX API is unreachable.
// ─────────────────────────────────────────────────────────────────────────────
export let isStubMode = true;

// ─────────────────────────────────────────────────────────────────────────────
// MCP server + stateless transport — built once at module load
// ─────────────────────────────────────────────────────────────────────────────
const mcpServer = new McpServer({
  name: "mnemo",
  version: "1.0.0",
  capabilities: { tools: {} },
});

mcpServer.tool(
  "check-continuity",
  "Check a webtoon page image against the series canon document for continuity errors. " +
    "Returns flags (contradictions) and canon_additions (new facts). " +
    "Requires $0.15 USDT payment via x402 on X Layer (eip155:196).",
  {
    page_image_base64: z
      .string()
      .describe("Base64-encoded page image (PNG, JPEG, or WebP)"),
    mime_type: z
      .enum(["image/png", "image/jpeg", "image/webp"])
      .describe("MIME type of the image"),
    canon: z
      .string()
      .optional()
      .describe(
        "Optional JSON string of the CanonDoc. If omitted, the server uses its built-in data/canon.json."
      ),
    dialogue: z
      .string()
      .optional()
      .describe("Optional raw dialogue / script text from the page"),
  },
  async ({ page_image_base64, mime_type, canon, dialogue }) => {
    let canonOverride: CanonDoc | undefined;
    if (canon) {
      canonOverride = JSON.parse(canon) as CanonDoc;
    }

    const result = await runCheck(
      page_image_base64,
      mime_type,
      canonOverride,
      dialogue
    );

    return {
      content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
    };
  }
);

const mcpTransport = new StreamableHTTPServerTransport({
  sessionIdGenerator: undefined,
});

mcpServer.connect(mcpTransport).catch((err: unknown) => {
  console.error("[MCP] Failed to connect server to transport:", err);
  process.exit(1);
});

// ─────────────────────────────────────────────────────────────────────────────
// Express app — middleware and routes wired here; x402 middleware is applied
// lazily so the async facilitator resolution completes before first request.
// ─────────────────────────────────────────────────────────────────────────────
const app = express();
app.use(express.json());

const upload = multer({ storage: multer.memoryStorage() });

// x402 route config (constant regardless of which facilitator is used).
const x402Routes = {
  "POST /mcp": {
    accepts: {
      scheme: "exact" as const,
      price: "$0.15",
      network: "eip155:196" as const,
      payTo: AGENTIC_WALLET_ADDRESS,
    },
    description: "Webtoon continuity check — $0.15 USDT per call (X Layer)",
  },
};

// ─── Health ────────────────────────────────────────────────────────────────────
app.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "ok", model: "gemini-2.5-flash" });
});

// ─── POST /check  (ungated, local dev convenience) ────────────────────────────
app.post(
  "/check",
  upload.single("page_image"),
  async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        res.status(400).json({ error: "page_image file is required." });
        return;
      }

      const imageBase64 = req.file.buffer.toString("base64");
      const mimeType = (req.file.mimetype ?? "image/png") as
        | "image/png"
        | "image/jpeg"
        | "image/webp";

      let canonDoc: CanonDoc;
      if (req.body.canon) {
        canonDoc = JSON.parse(req.body.canon as string) as CanonDoc;
      } else if (fs.existsSync(DEFAULT_CANON_PATH)) {
        canonDoc = JSON.parse(
          fs.readFileSync(DEFAULT_CANON_PATH, "utf-8")
        ) as CanonDoc;
      } else {
        res.status(400).json({
          error:
            "No canon doc provided and no default canon.json found. " +
            "POST with `canon` field or add data/canon.json.",
        });
        return;
      }

      const dialogue = req.body.dialogue as string | undefined;
      const result = await checkContinuity(canonDoc, imageBase64, mimeType, dialogue);
      res.json(result);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[/check error]", message);
      res.status(500).json({ error: message });
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// startServer() — resolves the facilitator asynchronously (DNS probe), then
// wires the x402 middleware and starts listening. Called once at module load
// (and re-called by test-server.ts which imports `app` and calls listen itself).
// ─────────────────────────────────────────────────────────────────────────────
async function startServer(): Promise<void> {
  // Resolve facilitator
  let facilitatorClient = stubFacilitatorClient;

  if (!hasOKXCredentials) {
    console.warn(
      "⚠️  [x402] OKX_API_KEY / OKX_SECRET_KEY / OKX_PASSPHRASE not set.\n" +
        "    Using stub facilitator — POST /mcp correctly returns HTTP 402 for\n" +
        "    unpaid requests; verify/settle require real credentials."
    );
  } else {
    const reachable = await canReachOKX();
    if (reachable) {
      console.log(
        "[x402] OKX credentials present and web3.okx.com reachable — using real OKXFacilitatorClient."
      );
      facilitatorClient = new OKXFacilitatorClient({
        apiKey: OKX_API_KEY,
        secretKey: OKX_SECRET_KEY,
        passphrase: OKX_PASSPHRASE,
      });
      isStubMode = false;
    } else {
      console.warn(
        "⚠️  [x402] OKX credentials present but web3.okx.com unreachable (DNS failure).\n" +
          "    Using stub facilitator — Tests A+B work; Test C must run on a machine\n" +
          "    with OKX API access."
      );
    }
  }

  // Build resource server and x402 middleware with the resolved facilitator.
  const resourceServer = new x402ResourceServer(facilitatorClient).register(
    "eip155:196",
    new ExactEvmScheme()
  );

  const x402Mw = paymentMiddleware(
    x402Routes,
    resourceServer,
    undefined, // paywallConfig — machine-to-machine only
    undefined, // paywall provider
    true       // syncFacilitatorOnStart — stub resolves immediately; real client hits OKX
  );

  // ─── POST /mcp  (x402-gated → MCP transport) ────────────────────────────────
  app.post("/mcp", x402Mw, async (req: Request, res: Response) => {
    try {
      await mcpTransport.handleRequest(req as never, res as never, req.body);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[/mcp POST error]", message);
      if (!res.headersSent) res.status(500).json({ error: message });
    }
  });

  // ─── GET /mcp  (SSE / capability negotiation — no payment gate) ────────────
  app.get("/mcp", async (req: Request, res: Response) => {
    try {
      await mcpTransport.handleRequest(req as never, res as never);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[/mcp GET error]", message);
      if (!res.headersSent) res.status(500).json({ error: message });
    }
  });

  // ─── DELETE /mcp  (session teardown — no payment gate) ────────────────────
  app.delete("/mcp", async (req: Request, res: Response) => {
    try {
      await mcpTransport.handleRequest(req as never, res as never);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[/mcp DELETE error]", message);
      if (!res.headersSent) res.status(500).json({ error: message });
    }
  });

  // Start listening (skipped when imported by test-server.ts, which calls listen itself).
  if (require.main === module) {
    app.listen(PORT, () => {
      console.log(`\n🎨  Mnemo API running on http://localhost:${PORT}`);
      console.log(`     GET  /health       — liveness probe`);
      console.log(`     POST /check        — multipart REST (ungated, local dev)`);
      console.log(`     POST /mcp          — x402-gated MCP endpoint ($0.15 USDT, eip155:196)`);
      console.log(`     GET  /mcp          — MCP SSE / capability negotiation`);
      console.log(`     DELETE /mcp        — MCP session teardown\n`);
    });
  }
}

// Export the Express app for test-server.ts to attach its own listener.
export default app;

// Kick off async initialization. Export the promise so consumers (test-server.ts)
// can await full startup before sending requests.
export const serverReady: Promise<void> = startServer().catch((err: unknown) => {
  console.error("[server] Fatal startup error:", err);
  process.exit(1);
});
