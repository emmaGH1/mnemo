// ─────────────────────────────────────────────────────────────────────────────
// server.ts  — Express API server for the ASP
//
// Route table:
//   GET  /health  — liveness probe (no payment gate)
//   POST /check   — convenience REST, ungated (local dev / direct HTTP clients)
//   POST /mcp     — MCP JSON-RPC; x402 ($0.10 USDT) ONLY on tools/call (and simple-JSON tool body)
//   GET  /mcp     — free discovery (tools list + body schema; no payment)
//   DELETE /mcp   — MCP session teardown (no payment)
//
// OKX.AI rule: charge only at tools/call. initialize / tools/list / GET discovery
// must never hit the x402 middleware (no 402, no facilitator verify/settle).
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
import { moderate, effectiveVerdict, type CachedVerdict, type ModerationResult } from "./moderation.js";
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

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY ?? "";
if (!OPENROUTER_API_KEY) {
  // ponytail: log loud at startup — silent AI failure was hard to diagnose when
  // Railway env var was set in the dashboard but the running container hadn't
  // picked it up yet. Catches the issue on `npm run dev` / Railway boot logs.
  console.warn(
    "⚠️  [ai] OPENROUTER_API_KEY not set.\n" +
      "    /check and /mcp will return HTTP 500 on tool calls (no continuity check possible).\n" +
      "    Get a key at https://openrouter.ai/keys (card, PayPal, or crypto from $1)."
  );
}

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
          const parsed = lenientParseJson(canon);
          if (!parsed.ok) {
            throw new Error(
              JSON.stringify({ kind: "invalid_canon", detail: parsed.error })
            );
          }
          if (
            typeof parsed.value !== "object" ||
            parsed.value === null ||
            Array.isArray(parsed.value)
          ) {
            throw new Error(
              JSON.stringify({ kind: "invalid_canon", detail: "canon must be a JSON object" })
            );
          }
          canonOverride = parsed.value as CanonDoc;
        }

        const img = normalizeImageBase64(page_image_base64);
        const mime = normalizeMime(mime_type, img.mime) ?? mime_type;

        const result = await runCheck(
          img.base64,
          mime,
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
        const message = err instanceof Error ? err.message : String(err);
        const isQuota = /quota|429|too many requests|rate limit/i.test(message);
        console.error(`[check-continuity error${isQuota ? " (quota)" : ""}]`, message);
        throw new Error(JSON.stringify({ kind: isQuota ? "quota_exceeded" : "continuity_check_failed", detail: message }));
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
// Dual-mode POST /mcp body adapter
//
// OKX buyer / marketplace flows often send flat tool params as plain JSON after
// paying, while real MCP clients send JSON-RPC 2.0. Accept both so paid replays
// don't 400 with "Request body must be a JSON-RPC 2.0 message".
// ─────────────────────────────────────────────────────────────────────────────

const ALLOWED_MIME = new Set(["image/png", "image/jpeg", "image/webp"]);

const CHECK_CONTINUITY_INPUT_SCHEMA = {
  page_image_base64: {
    type: "string",
    required: true,
    description: "Base64-encoded page image (PNG, JPEG, or WebP)",
  },
  mime_type: {
    type: "string",
    required: true,
    enum: ["image/png", "image/jpeg", "image/webp"],
    description: "MIME type of the image",
  },
  series_id: {
    type: "string",
    required: false,
    description: "Load canon from data/series/<id>/canon.json",
  },
  canon: {
    type: "string",
    required: false,
    description: "JSON string of CanonDoc (overrides series_id)",
  },
  dialogue: {
    type: "string",
    required: false,
    description: "Optional raw dialogue / script text from the page",
  },
  ep_number: {
    type: "number",
    required: false,
    description: "Optional episode number",
  },
  panel_number: {
    type: "number",
    required: false,
    description: "Optional panel number",
  },
} as const;

/** Example bodies exposed in 402 description, GET discovery, and 400 errors. */
const BODY_SCHEMA_HINT = {
  accepted_shapes: [
    "jsonrpc_tools_call",
    "simple_json_check_continuity",
    "named_tool_call",
  ],
  jsonrpc_example: {
    jsonrpc: "2.0",
    id: 1,
    method: "tools/call",
    params: {
      name: "check-continuity",
      arguments: {
        page_image_base64: "<base64 PNG/JPEG/WebP>",
        mime_type: "image/png",
      },
    },
  },
  simple_json_example: {
    page_image_base64: "<base64 PNG/JPEG/WebP>",
    mime_type: "image/png",
    series_id: "lore-olympus",
  },
  named_tool_example: {
    name: "check-continuity",
    arguments: {
      page_image_base64: "<base64 PNG/JPEG/WebP>",
      mime_type: "image/png",
    },
  },
  check_continuity_input_schema: CHECK_CONTINUITY_INPUT_SCHEMA,
  note:
    "POST /mcp accepts MCP JSON-RPC 2.0 (tools/list, tools/call, …) OR simple JSON tool params. Simple JSON with page_image_base64 runs check-continuity and returns plain ContinuityCheckResult JSON (not a JSON-RPC envelope).",
};

/** x402 resource.description — shown to buyers in the PaymentRequired challenge. */
const X402_POST_DESCRIPTION =
  "Continuity check ($0.10 USDT, X Layer) — charged only on tools/call (or simple JSON tool body). " +
  "initialize and tools/list are free. Body: MCP JSON-RPC tools/call " +
  '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"check-continuity",' +
  '"arguments":{"page_image_base64":"<b64>","mime_type":"image/png"}}} ' +
  "OR simple JSON {page_image_base64, mime_type, series_id?, canon?, dialogue?}. " +
  "Returns flags + canon_additions.";

interface SimpleCheckArgs {
  page_image_base64: string;
  mime_type: "image/png" | "image/jpeg" | "image/webp";
  series_id?: string;
  /** Canon as object or JSON string — normalized before runCheck. */
  canon?: unknown;
  dialogue?: string;
  ep_number?: number;
  panel_number?: number;
}

type AdaptedPostBody =
  | { mode: "jsonrpc"; body: Record<string, unknown> }
  | {
      mode: "simple-check";
      args: SimpleCheckArgs;
      /** When set, wrap ContinuityCheckResult in a JSON-RPC tools/call result. */
      jsonrpcId?: unknown;
      asJsonRpc?: boolean;
    }
  | { mode: "discovery"; id: unknown }
  | { mode: "invalid"; detail: string };

/** Lenient JSON parse for marketplace bodies (single quotes, unquoted keys, empty). */
export function lenientParseJson(
  raw: string
): { ok: true; value: unknown } | { ok: false; error: string; preview: string } {
  const text = raw.replace(/^\uFEFF/, "").trim();
  if (!text) return { ok: true, value: {} };

  const preview = text.length > 160 ? `${text.slice(0, 160)}…` : text;

  // Fast path: valid JSON (all production tool bodies with base64 images).
  // Must run BEFORE any whole-string scans/replaces — those are O(n) over multi-MB
  // payloads and delay the 402 / paid path enough for marketplace clients to time out.
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch {
    /* fall through to lenient transforms */
  }

  // Large non-JSON bodies: do not run expensive regex rewrites over multi-MB base64.
  // Callers that send well-formed JSON already returned above.
  if (text.length > 256_000) {
    return {
      ok: false,
      error: "Invalid JSON (large body; only strict JSON accepted over 256KB)",
      preview,
    };
  }

  const attempts: string[] = [text];

  // Double-encoded JSON string: "\"{...}\"" or "\"{'a':1}\""
  if (
    (text.startsWith('"') && text.endsWith('"')) ||
    (text.startsWith("'") && text.endsWith("'"))
  ) {
    attempts.push(text.slice(1, -1));
  }

  // Single-quoted object/array → double quotes (OKX/Python-style dict strings).
  if (
    (text.startsWith("{") || text.startsWith("[")) &&
    text.includes("'") &&
    !text.includes('"')
  ) {
    attempts.push(text.replace(/'/g, '"'));
  }

  // Unquoted keys: {jsonrpc: "2.0", method: "tools/list"}
  if (text.startsWith("{") && /[{,]\s*[A-Za-z_][A-Za-z0-9_]*\s*:/.test(text)) {
    attempts.push(
      text.replace(/([{,]\s*)([A-Za-z_][A-Za-z0-9_]*)\s*:/g, '$1"$2":')
    );
  }

  // Trailing commas before } or ]
  for (const base of [...attempts]) {
    if (/,\s*[}\]]/.test(base)) {
      attempts.push(base.replace(/,(\s*[}\]])/g, "$1"));
    }
  }

  let lastErr = "Invalid JSON";
  for (const candidate of attempts) {
    try {
      return { ok: true, value: JSON.parse(candidate) };
    } catch (e: unknown) {
      lastErr = e instanceof Error ? e.message : String(e);
    }
  }

  // form-urlencoded: page_image_base64=...&mime_type=image%2Fpng
  if (text.includes("=") && !text.trimStart().startsWith("{") && !text.trimStart().startsWith("[")) {
    try {
      const params = new URLSearchParams(text);
      const obj: Record<string, string> = {};
      for (const [k, v] of params.entries()) obj[k] = v;
      if (Object.keys(obj).length > 0) return { ok: true, value: obj };
    } catch {
      /* ignore */
    }
  }

  return { ok: false, error: lastErr, preview };
}

/** Coerce a value that may be an object or a JSON/stringified object into a plain object. */
export function coerceObject(value: unknown): Record<string, unknown> | null {
  if (value == null) return null;
  if (typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  if (typeof value === "string") {
    const parsed = lenientParseJson(value);
    if (
      parsed.ok &&
      typeof parsed.value === "object" &&
      parsed.value !== null &&
      !Array.isArray(parsed.value)
    ) {
      return parsed.value as Record<string, unknown>;
    }
  }
  return null;
}

function pickNonEmptyString(
  obj: Record<string, unknown>,
  keys: string[]
): string | undefined {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "string" && v.trim().length > 0) return v.trim();
    // Some clients send numbers/booleans for ids — coerce to string.
    if (typeof v === "number" && Number.isFinite(v)) return String(v);
  }
  return undefined;
}

function pickOptionalNumber(
  obj: Record<string, unknown>,
  keys: string[]
): number | undefined {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string" && v.trim() !== "" && !Number.isNaN(Number(v))) {
      return Number(v);
    }
  }
  return undefined;
}

/** Strip data-URI prefix and whitespace from base64 image payloads. */
export function normalizeImageBase64(raw: string): {
  base64: string;
  mime?: "image/png" | "image/jpeg" | "image/webp";
} {
  let s = raw.trim().replace(/\s+/g, "");
  const dataUri = /^data:(image\/(?:png|jpeg|jpg|webp));base64,(.+)$/i.exec(s);
  if (dataUri) {
    let mime = dataUri[1].toLowerCase();
    if (mime === "image/jpg") mime = "image/jpeg";
    return {
      base64: dataUri[2],
      mime: mime as "image/png" | "image/jpeg" | "image/webp",
    };
  }
  // Bare prefix without data: scheme
  const bare = /^image\/(?:png|jpeg|jpg|webp);base64,(.+)$/i.exec(s);
  if (bare) return { base64: bare[1] };
  return { base64: s };
}

function normalizeMime(
  raw: string | undefined,
  fallback?: string
): "image/png" | "image/jpeg" | "image/webp" | null {
  const m = (raw ?? fallback ?? "image/png").trim().toLowerCase();
  if (m === "image/jpg") return "image/jpeg";
  if (m === "png") return "image/png";
  if (m === "jpeg" || m === "jpg") return "image/jpeg";
  if (m === "webp") return "image/webp";
  if (ALLOWED_MIME.has(m)) return m as "image/png" | "image/jpeg" | "image/webp";
  return null;
}

/** Pull check-continuity args from a flat object; null if no image field present. */
export function extractCheckArgs(obj: Record<string, unknown>): SimpleCheckArgs | null {
  // Nested bags some gateways use
  const nested =
    coerceObject(obj.arguments) ??
    coerceObject(obj.params) ??
    coerceObject(obj.input) ??
    coerceObject(obj.data) ??
    coerceObject(obj.payload) ??
    null;
  const src: Record<string, unknown> = nested ? { ...nested, ...obj } : obj;

  const imageRaw = pickNonEmptyString(src, [
    "page_image_base64",
    "page_image",
    "image_base64",
    "image",
    "imageBase64",
    "pageImageBase64",
    "file_base64",
    "file",
  ]);
  if (!imageRaw) return null;

  const { base64, mime: mimeFromUri } = normalizeImageBase64(imageRaw);
  if (!base64 || base64.length < 8) return null;

  const mime = normalizeMime(
    pickNonEmptyString(src, ["mime_type", "mimeType", "content_type", "contentType", "mime"]),
    mimeFromUri
  );
  if (!mime) return null;

  const canonVal =
    src.canon !== undefined && src.canon !== null
      ? src.canon
      : src.canon_doc !== undefined
        ? src.canon_doc
        : src.canonDoc;

  const dialogue = pickNonEmptyString(src, ["dialogue", "dialogue_text", "script", "text"]);

  return {
    page_image_base64: base64,
    mime_type: mime,
    series_id: pickNonEmptyString(src, ["series_id", "seriesId", "series"]),
    canon: canonVal,
    dialogue,
    ep_number: pickOptionalNumber(src, ["ep_number", "epNumber", "episode", "ep"]),
    panel_number: pickOptionalNumber(src, ["panel_number", "panelNumber", "panel"]),
  };
}

function isCheckContinuityName(name: unknown): boolean {
  if (typeof name !== "string") return false;
  const n = name.trim().toLowerCase().replace(/_/g, "-");
  return n === "check-continuity" || n === "checkcontinuity" || n === "continuity-check";
}

function isDiscoveryMethod(method: unknown): boolean {
  if (typeof method !== "string") return false;
  const m = method.trim().toLowerCase();
  return (
    m === "tools/list" ||
    m === "initialize" ||
    m === "ping" ||
    m === "notifications/initialized" ||
    m === "resources/list" ||
    m === "prompts/list"
  );
}

function isToolsCallMethod(method: unknown): boolean {
  if (typeof method !== "string") return false;
  const m = method.trim().toLowerCase();
  return m === "tools/call" || m === "tools.call";
}

/**
 * Whether this POST /mcp body should hit the x402 payment gate.
 *
 * Charged: tools/call (any tool) and simple-JSON / named-tool bodies that
 * invoke a tool. Free: initialize, tools/list, other discovery methods,
 * empty/discovery bodies, and invalid bodies (400 without facilitator).
 *
 * Exported so payment tests can assert the gate classification.
 */
export function requiresX402Payment(body: unknown): boolean {
  const adapted = adaptMcpPostBody(body);
  if (adapted.mode === "simple-check") return true;
  if (adapted.mode === "jsonrpc") {
    return isToolsCallMethod(adapted.body.method);
  }
  // discovery | invalid → never charge
  return false;
}

/**
 * Normalize a POST /mcp body into either JSON-RPC (for the MCP transport) or a
 * simple check-continuity invocation (plain JSON in/out for marketplace buyers).
 * Exported for unit tests / probes.
 */
export function adaptMcpPostBody(body: unknown): AdaptedPostBody {
  // Empty / null body → free discovery deliverable (never 500).
  if (body == null || body === "") {
    return { mode: "discovery", id: null };
  }

  // Body arrived as a JSON string (double-encoded or raw text after lenient parse miss).
  if (typeof body === "string") {
    const parsed = lenientParseJson(body);
    if (!parsed.ok) {
      return {
        mode: "invalid",
        detail: `Request body is not valid JSON (${parsed.error}). Preview: ${parsed.preview}`,
      };
    }
    return adaptMcpPostBody(parsed.value);
  }

  if (typeof body !== "object" || Array.isArray(body)) {
    return {
      mode: "invalid",
      detail: "Request body must be a JSON object (JSON-RPC 2.0 or simple tool params).",
    };
  }

  const o = body as Record<string, unknown>;

  // Empty object → free discovery (common when buyer omits tool args).
  if (Object.keys(o).length === 0) {
    return { mode: "discovery", id: null };
  }

  // ── JSON-RPC envelope ────────────────────────────────────────────────────
  if ("jsonrpc" in o || typeof o.method === "string") {
    const method = typeof o.method === "string" ? o.method : "";
    const id = o.id ?? null;

    if (!method || isDiscoveryMethod(method)) {
      return { mode: "discovery", id };
    }

    if (method === "tools/call" || method === "tools.call") {
      const params =
        coerceObject(o.params) ??
        coerceObject(o.arguments) ??
        // Some clients put tool fields at the top level beside method
        o;
      const toolName =
        (typeof params.name === "string" && params.name) ||
        (typeof params.tool === "string" && params.tool) ||
        (typeof o.name === "string" && o.name) ||
        "check-continuity";

      const argsObj =
        coerceObject(params.arguments) ??
        coerceObject(params.args) ??
        coerceObject(params.input) ??
        // Flat params: { name, page_image_base64, mime_type }
        params;

      if (isCheckContinuityName(toolName) || extractCheckArgs(argsObj)) {
        const args = extractCheckArgs(argsObj);
        if (args) {
          // One normalization pipeline for both marketplace + MCP paid replays.
          // Respond as JSON-RPC so MCP buyers still get a result envelope.
          return {
            mode: "simple-check",
            args,
            jsonrpcId: id,
            asJsonRpc: true,
          };
        }
        return {
          mode: "invalid",
          detail:
            "tools/call check-continuity requires page_image_base64 (or page_image / image) and mime_type image/png|image/jpeg|image/webp. Nested params.arguments may be an object or JSON string.",
        };
      }

      // Other tools → pass through MCP after ensuring arguments is an object.
      const normalized: Record<string, unknown> = {
        jsonrpc: "2.0",
        id: id ?? 1,
        method: "tools/call",
        params: {
          name: toolName,
          arguments: argsObj && typeof argsObj === "object" ? argsObj : {},
        },
      };
      return { mode: "jsonrpc", body: normalized };
    }

    // Other JSON-RPC methods → MCP transport
    return {
      mode: "jsonrpc",
      body: {
        jsonrpc: "2.0",
        id: id ?? 1,
        method,
        params: coerceObject(o.params) ?? o.params ?? {},
      },
    };
  }

  // ── Named tool call without JSON-RPC ─────────────────────────────────────
  const toolName =
    (typeof o.name === "string" && o.name) ||
    (typeof o.tool === "string" && o.tool) ||
    undefined;
  const toolArgsRaw =
    coerceObject(o.arguments) ??
    coerceObject(o.params) ??
    coerceObject(o.input) ??
    null;

  if (toolName && toolArgsRaw) {
    if (isCheckContinuityName(toolName)) {
      const args = extractCheckArgs(toolArgsRaw);
      if (args) return { mode: "simple-check", args };
      return {
        mode: "invalid",
        detail:
          "check-continuity requires page_image_base64 (or page_image) and mime_type image/png|image/jpeg|image/webp.",
      };
    }
    return {
      mode: "jsonrpc",
      body: {
        jsonrpc: "2.0",
        id: o.id ?? 1,
        method: "tools/call",
        params: { name: toolName, arguments: toolArgsRaw },
      },
    };
  }

  // ── Flat simple JSON ─────────────────────────────────────────────────────
  const flat = extractCheckArgs(o);
  if (flat) return { mode: "simple-check", args: flat };

  if (
    pickNonEmptyString(o, [
      "page_image_base64",
      "page_image",
      "image_base64",
      "image",
      "imageBase64",
    ])
  ) {
    return {
      mode: "invalid",
      detail:
        "Found an image field but mime_type is missing or invalid. Use mime_type: image/png | image/jpeg | image/webp (or a data:image/...;base64, URI).",
    };
  }

  return {
    mode: "invalid",
    detail:
      "Unrecognized body. Send JSON-RPC 2.0 tools/call or simple JSON with page_image_base64 + mime_type. Empty body returns tool discovery.",
  };
}

function discoveryResult() {
  return {
    service: "mnemo",
    protocolVersion: "2025-03-26",
    capabilities: { tools: {} },
    tools: [
      {
        name: "check-continuity",
        description:
          "Check a webtoon page image against series canon for continuity errors. Returns flags + canon_additions.",
        inputSchema: {
          type: "object",
          required: ["page_image_base64", "mime_type"],
          properties: CHECK_CONTINUITY_INPUT_SCHEMA,
        },
      },
      {
        name: "register-series",
        description: "Register a series for continuity monitoring.",
        inputSchema: {
          type: "object",
          required: ["series_id"],
          properties: {
            series_id: { type: "string", description: "Series identifier (e.g. lore-olympus)" },
            url: { type: "string", description: "Optional webtoon URL" },
          },
        },
      },
      {
        name: "get-alerts",
        description: "Retrieve continuity alerts for a registered series.",
        inputSchema: {
          type: "object",
          required: ["series_id"],
          properties: {
            series_id: { type: "string" },
            since_episode: { type: "number" },
            limit: { type: "number" },
          },
        },
      },
    ],
    request_body: BODY_SCHEMA_HINT,
    instructions:
      "initialize and tools/list are free (no payment). Only tools/call (or simple JSON with page_image_base64) requires $0.10 USDT x402. Prefer JSON-RPC tools/call for MCP clients. Marketplace / simple buyers may POST flat JSON {page_image_base64, mime_type} and receive a plain ContinuityCheckResult (not a JSON-RPC envelope).",
  };
}

function sendDiscovery(res: Response, id: unknown = null): void {
  res.json({
    jsonrpc: "2.0",
    id,
    result: discoveryResult(),
  });
}

/** Run check-continuity for simple-JSON / normalized tools/call buyers. */
async function handleSimpleCheck(
  args: SimpleCheckArgs,
  res: Response,
  opts?: { jsonrpcId?: unknown; asJsonRpc?: boolean }
): Promise<void> {
  let canonOverride: CanonDoc | undefined;
  if (args.canon !== undefined && args.canon !== null && args.canon !== "") {
    if (typeof args.canon === "object" && !Array.isArray(args.canon)) {
      canonOverride = args.canon as CanonDoc;
    } else if (typeof args.canon === "string") {
      const parsed = lenientParseJson(args.canon);
      if (!parsed.ok) {
        res.status(400).json({
          error: "invalid_canon",
          detail: parsed.error,
          body_schema: BODY_SCHEMA_HINT,
        });
        return;
      }
      if (typeof parsed.value !== "object" || parsed.value === null || Array.isArray(parsed.value)) {
        res.status(400).json({
          error: "invalid_canon",
          detail: "canon must be a JSON object (CanonDoc)",
          body_schema: BODY_SCHEMA_HINT,
        });
        return;
      }
      canonOverride = parsed.value as CanonDoc;
    } else {
      res.status(400).json({
        error: "invalid_canon",
        detail: "canon must be an object or JSON string",
        body_schema: BODY_SCHEMA_HINT,
      });
      return;
    }
  }

  const result = await runCheck(
    args.page_image_base64,
    args.mime_type,
    canonOverride,
    args.dialogue,
    args.series_id,
    args.ep_number,
    args.panel_number
  );

  if (opts?.asJsonRpc) {
    res.json({
      jsonrpc: "2.0",
      id: opts.jsonrpcId ?? 1,
      result: {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      },
    });
    return;
  }
  res.json(result);
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

/**
 * POST /mcp body parser — MUST run before express.json so we can:
 *  1. Accept empty bodies (→ discovery)
 *  2. Lenient-parse single-quoted / unquoted-key JSON (marketplace clients)
 *  3. Never let body-parser SyntaxError become an opaque HTTP 500
 *
 * Other routes still use express.json below.
 */
// Continuity tool bodies carry base64 images. Cap at 12mb so we fail fast with
// 413 instead of buffering unbounded input (Railway edge / slow clients otherwise
// look like "endpoint unreachable" when the request hangs).
const MCP_BODY_MAX_BYTES = 12 * 1024 * 1024;

app.use((req: Request, res: Response, next) => {
  if (!(req.method === "POST" && (req.path === "/mcp" || req.path === "/mcp/"))) {
    return next();
  }

  const contentLength = Number(req.headers["content-length"] ?? 0);
  if (Number.isFinite(contentLength) && contentLength > MCP_BODY_MAX_BYTES) {
    res.status(413).json({
      error: "payload_too_large",
      message: `Request body exceeds ${MCP_BODY_MAX_BYTES} bytes. Compress or resize the page image (JPEG/WebP, max edge ~1536px) before base64 encoding.`,
      body_schema: BODY_SCHEMA_HINT,
    });
    return;
  }

  const chunks: Buffer[] = [];
  let total = 0;
  let settled = false;
  const finish = (err?: Error) => {
    if (settled) return;
    settled = true;
    if (err) return next(err);
    const raw = Buffer.concat(chunks).toString("utf8");
    (req as Request & { rawBody?: string }).rawBody = raw;

    if (!raw || !raw.trim()) {
      req.body = {};
      return next();
    }

    const parsed = lenientParseJson(raw);
    if (!parsed.ok) {
      console.error(
        `[/mcp POST] body parse failed: ${parsed.error} preview=${parsed.preview}`
      );
      // 400 (not 500) so x402 skips settlement; include schema for the buyer.
      res.status(400).json({
        error: "invalid_json_body",
        message: parsed.error,
        preview: parsed.preview,
        body_schema: BODY_SCHEMA_HINT,
        hint:
          "Body must be valid JSON. Use double-quoted keys/strings. " +
          'Example simple: {"page_image_base64":"...","mime_type":"image/png"}. ' +
          'Example JSON-RPC: {"jsonrpc":"2.0","id":1,"method":"tools/call",' +
          '"params":{"name":"check-continuity","arguments":{"page_image_base64":"...","mime_type":"image/png"}}}.',
      });
      return;
    }
    req.body = parsed.value;
    next();
  };

  req.on("data", (c: Buffer) => {
    total += c.length;
    if (total > MCP_BODY_MAX_BYTES) {
      if (!settled) {
        settled = true;
        res.status(413).json({
          error: "payload_too_large",
          message: `Request body exceeds ${MCP_BODY_MAX_BYTES} bytes. Compress or resize the page image before sending.`,
          body_schema: BODY_SCHEMA_HINT,
        });
        req.destroy();
      }
      return;
    }
    chunks.push(c);
  });
  req.on("end", () => finish());
  req.on("error", (e: Error) => finish(e));
});

// Continuity checks send base64 page images — default 100kb is too small.
// Skip when body was already filled by the /mcp raw parser above.
app.use((req: Request, res: Response, next) => {
  if (req.method === "POST" && (req.path === "/mcp" || req.path === "/mcp/")) {
    return next();
  }
  return express.json({ limit: "15mb" })(req, res, next);
});

// ponytail: installed OKX core's extractPayment ignores the legacy X-PAYMENT header.
// Alias it to the canonical PAYMENT-SIGNATURE so paid GET /mcp discovery works.
app.use("/mcp", (req: Request, _res: Response, next) => {
  const legacyPayment = req.get("x-payment");
  if (!req.get("payment-signature") && legacyPayment) {
    req.headers["payment-signature"] = legacyPayment;
  }
  next();
});

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

    // ponytail: no outer timeout — the SDK owns the full lifecycle (verify → execute → settle). Race-wrapping skipped settlement mid-flight, see OKX rejection.
    return mwPromise;
  };
}

/**
 * Conditional x402 gate for POST /mcp.
 *
 * Body is already parsed (express.json / raw /mcp parser). We classify the
 * JSON-RPC method (or simple-JSON tool shape) FIRST, then only invoke the
 * OKX payment middleware for tools/call. initialize / tools/list / discovery
 * call next() with zero 402, zero facilitator verify/settle.
 */
function x402OnlyForToolsCall(mw: express.RequestHandler): express.RequestHandler {
  const paid = with402Body(mw);
  return (req, res, next) => {
    if (!requiresX402Payment(req.body)) {
      return next();
    }
    return paid(req, res, next);
  };
}


const upload = multer({ storage: multer.memoryStorage() });

// x402 route config (constant regardless of which facilitator is used).
// tokenAddress is the USDT contract on X Layer (eip155:196).
const USDT_X_LAYER = "0x779ded0c9e1022225f8e0630b35a9b54be713736" as const;

// Only POST /mcp is registered with the SDK — and even then the Express
// chain only invokes paymentMiddleware when requiresX402Payment(body) is true
// (tools/call / simple-JSON tool). GET discovery is free and is not listed.
const x402Routes = {
  "POST /mcp": {
    accepts: {
      scheme: "exact" as const,
      price: "$0.10",
      network: "eip155:196" as const,
      payTo: AGENTIC_WALLET_ADDRESS,
      tokenAddress: USDT_X_LAYER,
    },
    // Shown in PaymentRequired.resource.description — must document both body shapes
    // so marketplace buyers that send flat JSON (not JSON-RPC) know the contract.
    description: X402_POST_DESCRIPTION,
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

// ─── POST /moderation/check  (ungated, demo) ─────────────────────────────────
// Body: { comment: string, reader_episode: number, series_id?: string }
// Returns: { verdict, spoils_episode?, reason } — the Mind judges the comment
// against its own canon memory, relative to the reader's progress.
const moderationBodySchema = z.object({
  comment: z.string().min(1).max(2000),
  reader_episode: z.number().int().min(1),
  series_id: z.string().regex(/^[a-z0-9_-]+$/).optional(),
});
app.post("/moderation/check", async (req: Request, res: Response) => {
  const parsed = moderationBodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues.map((i) => i.message) });
    return;
  }
  const { comment, reader_episode: readerEpisode } = parsed.data;
  try {
    const result = await moderate(comment, readerEpisode);
    res.json({ comment, reader_episode: readerEpisode, ...result });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[/moderation/check error]", message);
    res.status(502).json({ error: message });
  }
});

// ─── GET /community/feed  (ungated, demo) ────────────────────────────────────
// Returns the seeded comments each merged with the verdict effective for the
// given reader_episode (instant — reads the cached Mind verdicts, no live call).
// This is the beat-4/beat-8 surface: a comment blurs iff its verdict is
// "spoiler" for this reader.
app.get("/community/feed", (req: Request, res: Response) => {
  const seriesId = (req.query.series_id as string) || "lore-olympus";
  if (!/^[a-z0-9_-]+$/.test(seriesId)) {
    res.status(400).json({ error: "invalid series_id" });
    return;
  }
  const readerEpisode = Math.max(1, Number(req.query.reader_episode) || 1);
  const dir = resolveCanonDir(seriesId);
  const commentsPath = path.join(dir, "seed-comments.json");
  const verdictsPath = path.join(dir, "verdicts.json");
  if (!fs.existsSync(commentsPath) || !fs.existsSync(verdictsPath)) {
    res.status(404).json({ error: `No seeded feed for series "${seriesId}"` });
    return;
  }
  const comments = JSON.parse(fs.readFileSync(commentsPath, "utf-8")).comments as {
    id: string;
    [key: string]: unknown;
  }[];
  const verdicts = JSON.parse(fs.readFileSync(verdictsPath, "utf-8")).verdicts as CachedVerdict[];
  const feed = comments.map((c) => {
    const cached = verdicts.find((v) => v.comment_id === c.id);
    const moderation: ModerationResult = cached
      ? effectiveVerdict(cached, readerEpisode)
      : { verdict: "safe", reason: "uncached" };
    return { ...c, moderation, spoils_episode: moderation.spoils_episode ?? null };
  });
  res.json({ series_id: seriesId, reader_episode: readerEpisode, comments: feed });
});

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

  // ─── POST /mcp  (Accept-header fix → method-aware x402 → handler) ──────────
  //
  // Accept-header fix: x402 discovery probes may send any Accept value;
  // MCP's handlePostRequest requires BOTH "application/json" AND
  // "text/event-stream" — force both so the MCP transport never 406s before
  // the x402 middleware can return 402 for unpaid tools/call.
  //
  // Payment order (critical for OKX.AI A2MCP):
  //   1. Body already parsed (upstream raw parser / express.json)
  //   2. x402OnlyForToolsCall classifies method via requiresX402Payment(body)
  //   3. ONLY tools/call (or simple-JSON tool body) enters paymentMiddleware
  //   4. initialize / tools/list / discovery skip payment entirely → next()
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
    x402OnlyForToolsCall(x402Mw),
    async (req: Request, res: Response) => {

    try {
      // Dual-mode body: JSON-RPC 2.0 (MCP clients) OR simple JSON tool params
      // (OKX marketplace buyers). Empty / tools/list / initialize → free
      // discovery deliverable. tools/call check-continuity → paid simple-check
      // (payment already verified by x402OnlyForToolsCall above).
      // Never 500 on body shape issues — 400 + body_schema instead.
      const adapted = adaptMcpPostBody(req.body);
      if (adapted.mode === "invalid") {
        console.error(
          `[/mcp POST] invalid body: ${adapted.detail} raw=${JSON.stringify(req.body).slice(0, 160)}`
        );
        res.status(400).json({
          error: "invalid_request_body",
          message: adapted.detail,
          body_schema: BODY_SCHEMA_HINT,
        });
        return;
      }
      if (adapted.mode === "discovery") {
        console.log("[/mcp POST] discovery deliverable (free — no x402)");
        sendDiscovery(res, adapted.id);
        return;
      }
      if (adapted.mode === "simple-check") {
        console.log(
          `[/mcp POST] check-continuity paid path (asJsonRpc=${Boolean(adapted.asJsonRpc)})`
        );
        await handleSimpleCheck(adapted.args, res, {
          jsonrpcId: adapted.jsonrpcId,
          asJsonRpc: adapted.asJsonRpc,
        });
        return;
      }
      await handleMcpHttp(req, res, adapted.body);
    // ponytail: tool errors must not charge — throw instead of returning isError so the x402 middleware sees statusCode>=400 and skips settlement.
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      const stack = err instanceof Error ? err.stack : undefined;
      const isQuota = /quota|429|too many requests|rate limit/i.test(message);
      const isBodyParse =
        err instanceof SyntaxError ||
        /JSON|Unexpected token|Expected property name/i.test(message);
      const status = isQuota ? 429 : isBodyParse ? 400 : 500;
      console.error(`[/mcp POST error ${status}]`, message);
      if (stack) console.error(stack);
      if (!res.headersSent) {
        if (isBodyParse) {
          res.status(400).json({
            error: "invalid_json_body",
            message,
            body_schema: BODY_SCHEMA_HINT,
          });
        } else {
          res.status(status).json({
            jsonrpc: "2.0",
            error: {
              code: isQuota ? -32029 : -32603,
              message: isQuota ? "quota_exceeded" : "internal_error",
              data: message,
            },
            id: null,
          });
        }
      }
    }
  });

  // ─── GET /mcp  (free discovery — JSON-RPC, no SSE, no x402) ────────────────
  //
  // OKX.AI requires charging only at tools/call. GET discovery (tool list +
  // body schema) is free: no paymentMiddleware, no 402, no facilitator call.
  // Synchronous res.json so the response ends immediately (no SSE hang).
  app.get(
    "/mcp",
    (_req: Request, res: Response) => {
      sendDiscovery(res, null);
    },
  );

  // ─── DELETE /mcp  (Accept-header fix → MCP transport; no payment) ──────────
  // Session teardown is free — no x402 middleware on this route.
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
    // express.json / body-parser SyntaxError → 400 with schema, never 500
    const isBodyParse =
      err instanceof SyntaxError ||
      (err as { type?: string }).type === "entity.parse.failed" ||
      /JSON|Unexpected token|Expected property name|body/i.test(message);
    const status = isQuota ? 429 : isBodyParse ? 400 : 500;
    console.error(`[/mcp global error ${status}] ${req.method} ${req.path}:`, message);
    if (err instanceof Error && err.stack) console.error(err.stack);
    if (isBodyParse) {
      res.status(400).json({
        error: "invalid_json_body",
        message,
        body_schema: BODY_SCHEMA_HINT,
      });
      return;
    }
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
      console.log(`     POST /mcp          — MCP; x402 only on tools/call ($0.10 USDT, eip155:196)`);
      console.log(`     GET  /mcp          — free discovery (JSON-RPC tools list)`);
      console.log(`     DELETE /mcp        — MCP session teardown (free)\n`);
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
