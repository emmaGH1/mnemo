// ─────────────────────────────────────────────────────────────────────────────
// server.ts  — Express API server for the ASP
//
// Route table:
//   GET  /health  — liveness probe (no payment gate)
//   POST /check   — convenience REST, ungated (local dev / direct HTTP clients)
//   POST /mcp     — x402 payment gate ($0.10 USDT, eip155:196) → MCP tool
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
import * as dns from "dns";
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
import { checkContinuity, getActiveModel } from "./checker.js";
import { runCheck } from "./check-handler.js";
import { loadCanon, listSeries, seriesDir as resolveCanonDir } from "./resolve-canon.js";
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
// verify() and settle() return {isValid:false} / {success:false} — the SDK
// translates these into a proper 402 response with invalidReason in the body,
// so the paid POST never crashes the request. Genuine payments are still
// rejected in stub mode (no real facilitator, no settlement).
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
    return {
      isValid: false,
      invalidReason: "stub_mode",
      invalidMessage: "Facilitator unavailable — real OKX credentials required for payment verification.",
      payer: "0x0000000000000000000000000000000000000000",
    };
  },
  async settle() {
    return {
      success: false,
      errorReason: "stub_mode",
      status: "timeout",
      transaction: "",
      network: "eip155:196",
      payer: "0x0000000000000000000000000000000000000000",
    };
  },
  async getSettleStatus() {
    return { success: false, status: "timeout", errorReason: "stub_mode" };
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
// MCP — per-request server + transport (stateless)
//
// Root cause of post-settle HTTP 500 (empty text/plain): a module-scoped
// StreamableHTTPServerTransport was reused across requests. After the first
// SSE/JSON-RPC exchange its stream mapping is closed; subsequent handleRequest
// calls finish with status 500 and no body (observed locally: initialize /
// tools/call after tools/list → 500 text/plain "").
//
// x402 middleware also buffers res.write/end until settle completes, which is
// incompatible with long-lived SSE streams. enableJsonResponse:true returns a
// single JSON body that write/end can buffer cleanly.
// ─────────────────────────────────────────────────────────────────────────────
function createMcpServer(): McpServer {
  const mcpServer = new McpServer({
    name: "mnemo",
    version: "1.0.0",
  });

  mcpServer.tool(
    "check-continuity",
    "Check a webtoon page image against the series canon document for continuity errors. " +
      "Returns flags (contradictions) and canon_additions (new facts). " +
      "Requires $0.10 USDT payment via x402 on X Layer (eip155:196).",
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
          "Optional JSON string of the CanonDoc. If omitted, the server loads from data/canon.json or data/series/<series_id>/canon.json."
        ),
      series_id: z
        .string()
        .optional()
        .describe(
          "Optional series identifier to load canon from data/series/<id>/canon.json. Ignored if canon is provided."
        ),
      dialogue: z
        .string()
        .optional()
        .describe("Optional raw dialogue / script text from the page"),
      ep_number: z
        .number()
        .int()
        .optional()
        .describe("Optional episode number of this page (used in canon_additions)"),
      panel_number: z
        .number()
        .int()
        .optional()
        .describe("Optional panel number of this page (used in canon_additions)"),
    },
    async ({ page_image_base64, mime_type, canon, series_id, dialogue, ep_number, panel_number }) => {
      try {
        let canonOverride: CanonDoc | undefined;
        if (canon) {
          try {
            canonOverride = JSON.parse(canon) as CanonDoc;
          } catch (parseErr) {
            return {
              isError: true,
              content: [{ type: "text" as const, text: JSON.stringify({
                error: "Invalid canon JSON",
                detail: parseErr instanceof Error ? parseErr.message : String(parseErr),
              }) }],
            };
          }
        }

        const result = await runCheck(
          page_image_base64,
          mime_type,
          canonOverride,
          dialogue,
          series_id,
          ep_number,
          panel_number
        );

        return {
          content: [
            { type: "text" as const, text: JSON.stringify(result, null, 2) },
          ],
        };
      } catch (err: unknown) {
        // Never let a tool error crash the MCP transport — return a proper
        // JSON-RPC error result so the buyer gets an actionable response
        // instead of an HTML 500 page.
        const message = err instanceof Error ? err.message : String(err);
        const isQuota = /quota|429|too many requests|rate limit/i.test(message);
        console.error(`[check-continuity error${isQuota ? " (quota)" : ""}]`, message);
        return {
          isError: true,
          content: [{ type: "text" as const, text: JSON.stringify({
            error: isQuota ? "quota_exceeded" : "continuity_check_failed",
            detail: message,
          }) }],
        };
      }
    }
  );

  mcpServer.tool(
    "register-series",
    "Register a webtoon series for automatic continuity monitoring. " +
      "Returns series info and current alert count. Watcher runs in background.",
    {
      series_id: z.string().describe("Series identifier (e.g. 'lore-olympus')"),
      url: z.string().optional().describe("Webtoon URL to scrape (not yet implemented)"),
    },
    async ({ series_id }) => {
      const canon = loadCanon(series_id);
      const episodesPath = path.join(resolveCanonDir(series_id), "episodes.json");
      const episodes = fs.existsSync(episodesPath) ? JSON.parse(fs.readFileSync(episodesPath, "utf-8")) : [];
      const dataDir = resolveCanonDir(series_id);
      const pagesPath = path.join(dataDir, "pages");
      const pageCount = fs.existsSync(pagesPath) ? fs.readdirSync(pagesPath).length : 0;

      const alertsPath = path.join(__dirname, "..", "data", "alerts", `${series_id}.json`);
      let alertCount = 0;
      let flagsTotal = 0;
      if (fs.existsSync(alertsPath)) {
        const log = JSON.parse(fs.readFileSync(alertsPath, "utf-8"));
        alertCount = log.stats?.pages_checked ?? 0;
        flagsTotal = log.total_flags ?? 0;
      }

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            series: canon.series,
            episodes_available: episodes.length,
            canon_upto_episode: canon.last_updated_episode,
            pages_downloaded: pageCount,
            characters_in_canon: canon.characters.length,
            alerts: alertCount,
            flags_found: flagsTotal,
            status: "watching",
          }, null, 2),
        }],
      };
    }
  );

  mcpServer.tool(
    "get-alerts",
    "Retrieve continuity alerts for a watched series. " +
      "Returns per-page flags and canon_additions detected by the watcher.",
    {
      series_id: z.string().describe("Series identifier (e.g. 'lore-olympus')"),
      since_episode: z.number().int().optional().describe("Filter alerts from this episode onward"),
      limit: z.number().int().optional().describe("Maximum number of alert entries to return (default 20)"),
    },
    async ({ series_id, since_episode, limit = 20 }) => {
      const alertsPath = path.join(__dirname, "..", "data", "alerts", `${series_id}.json`);
      if (!fs.existsSync(alertsPath)) {
        return { content: [{ type: "text" as const, text: JSON.stringify({ error: `No alerts found for series "${series_id}". Register it first.` }) }] };
      }
      const log = JSON.parse(fs.readFileSync(alertsPath, "utf-8"));
      let entries = log.alerts ?? [];
      if (since_episode) entries = entries.filter((a: any) => a.episode >= since_episode!);
      entries = entries.slice(-limit);

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            series_id,
            total_alerts: log.alerts?.length ?? 0,
            total_flags: log.total_flags ?? 0,
            total_additions: log.total_additions ?? 0,
            pages_flagged: log.stats?.pages_with_flags ?? 0,
            entries,
          }, null, 2),
        }],
      };
    }
  );

  return mcpServer;
}

/** Handle one MCP HTTP request with a fresh transport (must not share across requests). */
async function handleMcpHttp(
  req: Request,
  res: Response,
  parsedBody?: unknown
): Promise<void> {
  const mcpServer = createMcpServer();
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  await mcpServer.connect(transport);
  try {
    await transport.handleRequest(req as never, res as never, parsedBody);
  } finally {
    await transport.close().catch((err: unknown) => {
      console.error("[MCP] transport.close error:", err);
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Express app — middleware and routes wired here; x402 middleware is applied
// lazily so the async facilitator resolution completes before first request.
// ─────────────────────────────────────────────────────────────────────────────
const app = express();
// Railway / most reverse proxies terminate TLS in front of the app, so
// `req.protocol` defaults to "http" unless we trust the proxy's
// X-Forwarded-Proto. Without this, the PaymentRequired.resource.url
// embedded in the 402 challenge advertises "http://" instead of
// "https://" — OKX.AI's x402 validator rejects mismatched schemes.
app.set("trust proxy", true);
// Continuity checks send base64 page images — default 100kb is too small.
app.use(express.json({ limit: "15mb" }));

// ─────────────────────────────────────────────────────────────────────────────
// x402 402-body interceptor
//
// The OKX SDK's paymentMiddleware writes the PaymentRequired challenge into
// the `payment-required` header (base64 JSON) and sends an EMPTY JSON body
// `{}`. The x402 v2 spec says the body MAY also carry the PaymentRequired,
// and OKX.AI's marketplace validator requires it. We wrap res.json to
// detect a 402 with the header and an empty body, then decode the header
// and re-emit the PaymentRequired JSON as the body. The header is kept
// intact so standard x402 clients still work.
// ─────────────────────────────────────────────────────────────────────────────
function with402Body(mw: express.RequestHandler): express.RequestHandler {
  return (req, res, next) => {
    const origJson = res.json.bind(res);
    res.json = ((body: unknown) => {
      if (
        res.statusCode === 402 &&
        res.getHeader("payment-required") &&
        (body === undefined || body === null ||
          (typeof body === "object" && body !== null && Object.keys(body).length === 0))
      ) {
        const prHeader = res.getHeader("payment-required");
        if (typeof prHeader === "string") {
          try {
            const decoded = JSON.parse(
              Buffer.from(prHeader, "base64").toString("utf-8")
            ) as Record<string, unknown>;
            res.setHeader("content-type", "application/json; charset=utf-8");
            return origJson(decoded);
          } catch {
            // fall through to original body
          }
        }
      }
      return origJson(body);
    }) as typeof res.json;

    // Safety net: catch any thrown error from the x402 middleware and
    // return a proper 402 with error details. Without this, a facilitator
    // error (network, invalid signature, timeout) causes the promise to
    // reject and the connection to die with no HTTP response — which the
    // OKX.AI validator reports as "replayStatus=0, error sending request".
    // paymentMiddleware returns Promise<void> at runtime; express's
    // RequestHandler type lies and says void, so we cast through unknown.
    const mwPromise = mw(req, res, next) as unknown as Promise<unknown> | undefined;
    if (mwPromise && typeof mwPromise.catch === "function") {
      mwPromise.catch((err: Error) => {
        if (res.headersSent) return; // can't change response now
        console.error(`[x402] middleware error on ${req.method} ${req.path}:`, err.message);
        res.status(402).json({
          x402Version: 2,
          error: "Payment processing failed",
          errorReason: err.message || "unknown",
          resource: {
            url: `${req.protocol}://${req.get("host")}${req.originalUrl}`,
            description: "x402 payment processing error",
            mimeType: "application/json",
          },
          accepts: [],
        });
      });
    }

    // Timeout: cap the x402 middleware at 25s. If the facilitator hangs
    // (e.g. web3.okx.com is reachable for DNS but the API is slow), the
    // OKX.AI validator's HTTP client gives up before our middleware
    // returns — the validator reports "replayStatus=0". Returning a
    // proper 402 with a timeout error keeps the request lifecycle clean.
    const timeoutMs = 25_000;
    const timeoutPromise = new Promise<void>((_, reject) => {
      setTimeout(() => reject(new Error(`x402 middleware timeout after ${timeoutMs}ms`)), timeoutMs);
    });
    return mwPromise
      ? Promise.race([mwPromise, timeoutPromise])
      : timeoutPromise;
  };
}


const upload = multer({ storage: multer.memoryStorage() });

// x402 route config (constant regardless of which facilitator is used).
// tokenAddress is the USDT contract on X Layer (eip155:196).
const USDT_X_LAYER = "0x779ded0c9e1022225f8e0630b35a9b54be713736" as const;

const x402Routes = {
  "POST /mcp": {
    accepts: {
      scheme: "exact" as const,
      price: "$0.10",
      network: "eip155:196" as const,
      payTo: AGENTIC_WALLET_ADDRESS,
      tokenAddress: USDT_X_LAYER,
    },
    description: "Webtoon continuity check — $0.10 USDT per call (X Layer)",
    mimeType: "application/json",
  },
  "GET /mcp": {
    accepts: {
      scheme: "exact" as const,
      price: "$0.10",
      network: "eip155:196" as const,
      payTo: AGENTIC_WALLET_ADDRESS,
      tokenAddress: USDT_X_LAYER,
    },
    description: "MCP discovery / SSE endpoint — $0.10 USDT per call (X Layer)",
    mimeType: "application/json",
  },
};

// ─── Health ────────────────────────────────────────────────────────────────────
app.get("/health", (_req: Request, res: Response) => {
  res.json({
    status: "ok",
    model: getActiveModel(),
    series: listSeries(),
  });
});

// ─── GET /demo/alert-log  (ungated, for demo website) ───────────────────────
app.get("/demo/alert-log", (req: Request, res: Response) => {
  const seriesId = (req.query.series_id as string) || "lore-olympus";
  // ponytail: whitelist series_id — query param goes into path.join; reject anything
  // that isn't [a-z0-9_-] so `?series_id=../.env` can't escape data/alerts/.
  if (!/^[a-z0-9_-]+$/.test(seriesId)) {
    res.status(400).json({ error: "invalid series_id" });
    return;
  }
  const alertsPath = path.join(__dirname, "..", "data", "alerts", `${seriesId}.json`);
  if (!fs.existsSync(alertsPath)) {
    res.status(404).json({ error: `No alerts for series "${seriesId}"` });
    return;
  }
  res.json(JSON.parse(fs.readFileSync(alertsPath, "utf-8")));
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
      } else {
        const seriesId = (req.body.series_id as string) || undefined;
        canonDoc = loadCanon(seriesId);
      }

      const dialogue = req.body.dialogue as string | undefined;
      const result = await checkContinuity(canonDoc, imageBase64, mimeType, dialogue);
      res.json(result);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      const isQuota = /quota|429|too many requests|rate limit/i.test(message);
      const status = isQuota ? 429 : 500;
      console.error(`[/check error ${status}]`, message);
      res.status(status).json({ error: message, kind: isQuota ? "quota_exceeded" : "server_error" });
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
    if (!reachable) {
      console.warn(
        "⚠️  [x402] OKX credentials present but web3.okx.com DNS lookup failed.\n" +
          "    Using stub facilitator — Tests A+B work; Test C must run on a machine\n" +
          "with OKX API access."
      );
    } else {
      try {
        const real = new OKXFacilitatorClient({
          apiKey: OKX_API_KEY,
          secretKey: OKX_SECRET_KEY,
          passphrase: OKX_PASSPHRASE,
        });
        // ponytail: pre-flight getSupported so a network failure here flips to stub
        // instead of crashing the whole server. Real client stays attached for later verify/settle.
        await real.getSupported();
        facilitatorClient = real;
        isStubMode = false;
        console.log(
          "[x402] OKX credentials present and web3.okx.com reachable — using real OKXFacilitatorClient."
        );
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        console.warn(
          `⚠️  [x402] OKX credentials present but facilitator unreachable (${msg}).\n` +
            "    Using stub facilitator — POST /mcp will return 402 for unpaid, but\n" +
            "verify/settle require network access to web3.okx.com."
        );
      }
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

  // ─── POST /mcp  (Accept-header fix → x402-gated → MCP transport) ──────────────────
  //
  // Accept-header fix: x402 discovery probes may send any Accept value;
  // MCP's handlePostRequest requires BOTH "application/json" AND
  // "text/event-stream" — force both so the MCP transport never 406s before
  // the x402 middleware can return 402 for unpaid requests.
  app.post(
    "/mcp",
    (req: Request, _res: Response, next) => {
      req.headers.accept = "application/json, text/event-stream";
      for (let i = 0; i < req.rawHeaders.length; i += 2) {
        if (req.rawHeaders[i].toLowerCase() === "accept") {
          req.rawHeaders[i + 1] = "application/json, text/event-stream";
          next();
          return;
        }
      }
      req.rawHeaders.push("accept", "application/json, text/event-stream");
      next();
    },
    with402Body(x402Mw),
    async (req: Request, res: Response) => {

    try {
      // Guard against empty / non-JSON-RPC bodies — return a proper
      // JSON-RPC parse error instead of letting the MCP transport crash.
      const body = req.body;
      if (!body || typeof body !== "object" || !("jsonrpc" in body)) {
        console.error(`[/mcp POST] invalid/empty body: ${JSON.stringify(body).slice(0, 100)}`);
        res.status(400).json({
          jsonrpc: "2.0",
          error: { code: -32700, message: "Parse error", data: "Request body must be a JSON-RPC 2.0 message" },
          id: null,
        });
        return;
      }
      await handleMcpHttp(req, res, body);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      const stack = err instanceof Error ? err.stack : undefined;
      const isQuota = /quota|429|too many requests|rate limit/i.test(message);
      const status = isQuota ? 429 : 500;
      console.error(`[/mcp POST error ${status}]`, message);
      if (stack) console.error(stack);
      if (!res.headersSent) res.status(status).json({ error: message, kind: isQuota ? "quota_exceeded" : "server_error" });
    }
  });

  // ─── GET /mcp  (x402 discovery probe fix → MCP transport) ──────────────────
  //
  // OKX x402-check may send GET /mcp without text/event-stream in Accept.
  // MCP's GET handler (handleGetRequest) hard-requires text/event-stream and
  // would return 406 without this fix. Also force application/json so the
  // Accept header is fully MCP-conformant for both GET and POST paths.
  app.get(
    "/mcp",
    (req: Request, _res: Response, next) => {
      req.headers.accept = "application/json, text/event-stream";
      for (let i = 0; i < req.rawHeaders.length; i += 2) {
        if (req.rawHeaders[i].toLowerCase() === "accept") {
          req.rawHeaders[i + 1] = "application/json, text/event-stream";
          next();
          return;
        }
      }
      req.rawHeaders.push("accept", "application/json, text/event-stream");
      next();
    },
    with402Body(x402Mw),
    async (req: Request, res: Response) => {
    try {
      await handleMcpHttp(req, res);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      const stack = err instanceof Error ? err.stack : undefined;
      const isQuota = /quota|429|too many requests|rate limit/i.test(message);
      const status = isQuota ? 429 : 500;
      console.error(`[/mcp GET error ${status}]`, message);
      if (stack) console.error(stack);
      if (!res.headersSent) res.status(status).json({ error: message, kind: isQuota ? "quota_exceeded" : "server_error" });
    }
  });

  // ─── DELETE /mcp  (Accept-header fix → MCP transport) ─────────────────────
  app.delete(
    "/mcp",
    (req: Request, _res: Response, next) => {
      const accept = req.headers.accept || "";
      if (!accept.includes("text/event-stream")) {
        const forced = accept
          ? `${accept}, text/event-stream`
          : "application/json, text/event-stream";
        req.headers.accept = forced;
        for (let i = 0; i < req.rawHeaders.length; i += 2) {
          if (req.rawHeaders[i].toLowerCase() === "accept") {
            req.rawHeaders[i + 1] = forced;
            next();
            return;
          }
        }
        req.rawHeaders.push("accept", forced);
      }
      next();
    },
    async (req: Request, res: Response) => {
    try {
      await handleMcpHttp(req, res);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      const stack = err instanceof Error ? err.stack : undefined;
      const isQuota = /quota|429|too many requests|rate limit/i.test(message);
      const status = isQuota ? 429 : 500;
      console.error(`[/mcp DELETE error ${status}]`, message);
      if (stack) console.error(stack);
      if (!res.headersSent) res.status(status).json({ error: message, kind: isQuota ? "quota_exceeded" : "server_error" });
    }
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Global JSON error handler for /mcp — never return HTML 500 pages.
  //
  // OKX.AI's x402 validator pays $0.10 USDT per call, then expects a
  // JSON-RPC response. If anything in the MCP tool chain throws AFTER
  // the route handler's try/catch sees `headersSent`, Express's default
  // error handler returns an HTML 500 page (148 bytes) — the buyer paid
  // and got nothing. This handler catches anything that falls through
  // and returns a proper JSON-RPC error instead.
  // ─────────────────────────────────────────────────────────────────────────────
  app.use((err: Error, req: Request, res: Response, _next: express.NextFunction) => {
    if (res.headersSent) {
      console.error(`[/mcp error AFTER headers sent] ${req.method} ${req.path}:`, err.message);
      return;
    }
    const message = err instanceof Error ? err.message : String(err);
    const isQuota = /quota|429|too many requests|rate limit/i.test(message);
    const status = isQuota ? 429 : 500;
    console.error(`[/mcp global error ${status}] ${req.method} ${req.path}:`, message);
    if (err instanceof Error && err.stack) console.error(err.stack);
    res.status(status).json({
      jsonrpc: "2.0",
      error: {
        code: isQuota ? -32029 : -32603,
        message: isQuota ? "quota_exceeded" : "internal_error",
        data: message,
      },
      id: null,
    });
  });

  // Start listening (skipped when imported by test-server.ts, which calls listen itself).
  if (require.main === module) {
    app.listen(PORT, () => {
      console.log(`\n🎨  Mnemo API running on http://localhost:${PORT}`);
      console.log(`     GET  /health       — liveness probe`);
      console.log(`     POST /check        — multipart REST (ungated, local dev)`);
      console.log(`     POST /mcp          — x402-gated MCP endpoint ($0.10 USDT, eip155:196)`);
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
