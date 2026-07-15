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
// Stub facilitator: when OKX credentials are absent we use a local stub whose
// getSupported() resolves immediately with a synthetic supported-kinds list.
// This lets initialize() succeed so the middleware can issue proper 402 responses
// without a live OKX API connection. Verify/settle are no-ops in stub mode.
// ─────────────────────────────────────────────────────────────────────────────

import express, { type Request, type Response } from "express";
import multer from "multer";
import * as fs from "fs";
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

if (!hasOKXCredentials) {
  console.warn(
    "⚠️  [x402] OKX_API_KEY / OKX_SECRET_KEY / OKX_PASSPHRASE not set.\n" +
      "    Using stub facilitator — POST /mcp will correctly return HTTP 402\n" +
      "    for unpaid requests, but valid payment signatures cannot be settled\n" +
      "    until real OKX credentials are provided."
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Stub facilitator (used when OKX credentials are absent)
//
// Returns a synthetic SupportedResponse so resourceServer.initialize() succeeds
// without a live OKX API call. Verify/settle throw so genuine payments can't
// accidentally be accepted in stub mode.
// ─────────────────────────────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const stubFacilitatorClient: any = {
  async getSupported() {
    return {
      kinds: [
        {
          x402Version: 2,
          scheme: "exact",
          network: "eip155:196",
        },
      ],
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
// x402 — resource server + payment middleware
// ─────────────────────────────────────────────────────────────────────────────
const facilitatorClient = hasOKXCredentials
  ? new OKXFacilitatorClient({
      apiKey: OKX_API_KEY,
      secretKey: OKX_SECRET_KEY,
      passphrase: OKX_PASSPHRASE,
    })
  : stubFacilitatorClient;

// Register ExactEvmScheme for eip155:196 (X Layer mainnet).
const resourceServer = new x402ResourceServer(facilitatorClient).register(
  "eip155:196",
  new ExactEvmScheme()
);

// Route config: x402 v2 shape — payTo inside accepts object.
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

// syncFacilitatorOnStart=true: middleware calls initialize() on first use.
// With the stub client this resolves immediately; with real OKXFacilitatorClient
// it calls out to OKX's API to confirm supported kinds.
const x402Middleware = paymentMiddleware(
  x402Routes,
  resourceServer,
  undefined, // paywallConfig — machine-to-machine only
  undefined, // paywall provider
  true       // syncFacilitatorOnStart — needed for buildPaymentRequirements to work
);

// ─────────────────────────────────────────────────────────────────────────────
// MCP server + stateless transport
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
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  }
);

// Stateless transport — no session map.
const mcpTransport = new StreamableHTTPServerTransport({
  sessionIdGenerator: undefined,
});

mcpServer.connect(mcpTransport).catch((err: unknown) => {
  console.error("[MCP] Failed to connect server to transport:", err);
  process.exit(1);
});

// ─────────────────────────────────────────────────────────────────────────────
// Express app
// ─────────────────────────────────────────────────────────────────────────────
const app = express();
app.use(express.json());

const upload = multer({ storage: multer.memoryStorage() });

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
      const result = await checkContinuity(
        canonDoc,
        imageBase64,
        mimeType,
        dialogue
      );

      res.json(result);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[/check error]", message);
      res.status(500).json({ error: message });
    }
  }
);

// ─── POST /mcp  (x402-gated → MCP transport) ──────────────────────────────────
app.post("/mcp", x402Middleware, async (req: Request, res: Response) => {
  try {
    await mcpTransport.handleRequest(req as never, res as never, req.body);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[/mcp POST error]", message);
    if (!res.headersSent) {
      res.status(500).json({ error: message });
    }
  }
});

// ─── GET /mcp  (SSE / capability negotiation — no payment gate) ────────────────
app.get("/mcp", async (req: Request, res: Response) => {
  try {
    await mcpTransport.handleRequest(req as never, res as never);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[/mcp GET error]", message);
    if (!res.headersSent) {
      res.status(500).json({ error: message });
    }
  }
});

// ─── DELETE /mcp  (session teardown — no payment gate) ────────────────────────
app.delete("/mcp", async (req: Request, res: Response) => {
  try {
    await mcpTransport.handleRequest(req as never, res as never);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[/mcp DELETE error]", message);
    if (!res.headersSent) {
      res.status(500).json({ error: message });
    }
  }
});

// ─── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🎨  Mnemo API running on http://localhost:${PORT}`);
  console.log(`     GET  /health       — liveness probe`);
  console.log(`     POST /check        — multipart REST (ungated, local dev)`);
  console.log(`     POST /mcp          — x402-gated MCP endpoint ($0.15 USDT, eip155:196)`);
  console.log(`     GET  /mcp          — MCP SSE / capability negotiation`);
  console.log(`     DELETE /mcp        — MCP session teardown\n`);
});

export default app;
