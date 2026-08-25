# Mnemo

> **Continuity, kept.** The memory layer for serialized webtoon and comic art.

[![OKX.AI Agent 6211](https://img.shields.io/badge/OKX.AI-Agent_6211-000?style=flat-square&logo=okx&logoColor=white)](https://www.okx.ai/agents/6211)
[![x402 $0.10/check](https://img.shields.io/badge/x402-0.1_USDT_per_check-000?style=flat-square)](https://github.com/emmaGH1/mnemo#api)
[![MCP Live](https://img.shields.io/badge/MCP-mnemo--9vze.onrender.com-000?style=flat-square)](https://mnemo-9vze.onrender.com/mcp)
[![License ISC](https://img.shields.io/badge/license-ISC-000?style=flat-square)](LICENSE)

Mnemo is a paid MCP agent that checks webtoon / comic pages for character
continuity drift. Send a page image; get back a JSON of every flag (severity,
field, episode + panel refs, explanation) plus proposed canon additions.

- **One paid MCP tool**: `check-continuity` at **$0.10 USDT per call** via
  [x402](https://www.x402.org/) on X Layer (eip155:196)
- **No account, no API key** — just a signed EIP-3009 payment
- **Listed on the OKX.AI Agent Service Platform** as Agent 6211
- **Endpoint**: `https://mnemo-9vze.onrender.com/mcp`
- **Built for**: webtoon artists, studios, and the AI agents that work for them

---

## For AI agents

Paste this into Claude Code, Codex, Hermes, OpenClaw, or any x402-capable
agent — it's what the demo site's "How to use" section copies to the
clipboard:

```
I'd like to use the service provided by Agent 6211:

Service title: Continuity Check
Service type: A2MCP
Endpoint: https://mnemo-9vze.onrender.com/mcp

Please use OKX Agent Payments Protocol to send a request to this endpoint.
```

Attach a page image. The agent will sign a $0.10 USDT payment, call
`tools/call` with `name: "check-continuity"`, and return the continuity report.

---

## Quick start (humans)

```bash
git clone https://github.com/emmaGH1/mnemo.git
cd mnemo
npm install
cp .env.example .env
# edit .env — set OPENROUTER_API_KEY (from https://openrouter.ai/keys)
npm run dev                          # Express on http://localhost:3000
```

In another terminal — the demo site:

```bash
cd frontend
npm install
npm run dev                          # Next.js on http://localhost:3001
```

Open `http://localhost:3001` for the marketing site, or
`curl http://localhost:3000/health` to confirm the API is up.

---

## API

All routes respond JSON. The paid entry point is `POST /mcp`.

### `POST /mcp` — x402-gated, $0.10 USDT per call

The only public paid endpoint. Accepts **two body shapes**:

| Shape | Body | Response |
|-------|------|----------|
| **MCP JSON-RPC 2.0** | `{ "jsonrpc":"2.0", "id":1, "method":"tools/call", "params":{ "name":"check-continuity", "arguments":{...} } }` | JSON-RPC envelope |
| **Simple JSON** (marketplace / buyer flows) | `{ "page_image_base64":"...", "mime_type":"image/png", "series_id?":"...", "canon?":"...", "dialogue?":"..." }` | Plain `ContinuityCheckResult` JSON |

`check-continuity` arguments: `page_image_base64` (required), `mime_type` (`image/png` \| `image/jpeg` \| `image/webp`, required), optional `series_id`, `canon`, `dialogue`, `ep_number`, `panel_number`.

The 402 challenge's `resource.description` and paid `GET /mcp` discovery both document this contract.

**Unpaid → HTTP 402** (challenge):

```bash
curl -X POST https://mnemo-9vze.onrender.com/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

```json
{
  "x402Version": 2,
  "error": "Payment required",
  "resource": {
    "url": "https://mnemo-9vze.onrender.com/mcp",
    "description": "Continuity check ($0.10 USDT, X Layer). Body: MCP JSON-RPC tools/call ... OR simple JSON {page_image_base64, mime_type, ...}",
    "mimeType": "application/json"
  },
  "accepts": [{
    "scheme": "exact",
    "network": "eip155:196",
    "amount": "100000",
    "asset": "0x779ded0c9e1022225f8e0630b35a9b54be713736",
    "payTo": "0x4dbfa1e240f921a72a4b47fa534269ce20a47c99",
    "maxTimeoutSeconds": 300,
    "extra": { "name": "USDT", "version": "1" }
  }]
}
```

**Paid → HTTP 200** (signed EIP-3009 retry) — JSON-RPC shape:

```bash
# 1. decode the 402 challenge
# 2. sign an EIP-3009 transferWithAuthorization
# 3. retry with the signed payment in PAYMENT-SIGNATURE
curl -X POST https://mnemo-9vze.onrender.com/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "PAYMENT-SIGNATURE: <signed-payment-base64>" \
  -d '{
    "jsonrpc":"2.0","id":1,"method":"tools/call",
    "params":{
      "name":"check-continuity",
      "arguments":{
        "page_image_base64":"<base64 PNG/JPEG/WebP>",
        "mime_type":"image/png"
      }
    }
  }'
```

**Paid → HTTP 200** — simple JSON shape (same payment header):

```bash
curl -X POST https://mnemo-9vze.onrender.com/mcp \
  -H "Content-Type: application/json" \
  -H "PAYMENT-SIGNATURE: <signed-payment-base64>" \
  -d '{
    "page_image_base64":"<base64 PNG/JPEG/WebP>",
    "mime_type":"image/png",
    "series_id":"lore-olympus"
  }'
```

### `POST /check` — ungated local dev

Same tool, no payment. Multipart form:

| Field        | Type | Required | Description                                                |
|--------------|------|----------|------------------------------------------------------------|
| `page_image` | file | yes      | PNG / JPEG / WebP page image                               |
| `series_id`  | text | no       | Load canon from `data/series/<id>/canon.json`              |
| `canon`      | text | no       | JSON string of the canon doc (overrides `series_id`)       |
| `dialogue`   | text | no       | Raw script / dialogue text for dialogue-level checks       |

### `GET /health`

Liveness probe. Returns `{ status, model, series[] }`.

### `GET /demo/alert-log?series_id=<id>`

Returns the watch-mode alert log for a series (consumed by the demo site).
`series_id` must match `[a-z0-9_-]+`; any other value returns `400`.

---

## The `check-continuity` tool

**Input arguments:**

| Field               | Type      | Required | Description                                                              |
|---------------------|-----------|----------|--------------------------------------------------------------------------|
| `page_image_base64` | string    | yes      | Base64-encoded page image                                                |
| `mime_type`         | string    | yes      | `image/png` \| `image/jpeg` \| `image/webp`                              |
| `canon`             | CanonDoc  | no       | Inline canon — otherwise loaded from `data/series/<series_id>/canon.json` |
| `series_id`         | string    | no       | Series to load canon for (defaults to the Aria fixture)                  |
| `dialogue`          | string    | no       | Page script / dialogue for dialogue-level checks                         |

**Output (`ContinuityCheckResult`):**

```json
{
  "flags": [
    {
      "severity": "high",
      "character": "Persephone",
      "field": "eye_color",
      "canon_value": "green",
      "new_value": "blue",
      "ep_ref": 1,
      "panel_ref": 8,
      "explanation": "Persephone's eyes appear blue on this page but were established as vivid green in Episode 1, Panel 8."
    }
  ],
  "canon_additions": [
    { "kind": "character_fact", "character": "Persephone", "field": "freckles",
      "value": "across nose bridge", "ep_ref": 3, "panel_ref": 1 }
  ]
}
```

Flag severities: `low | medium | high | critical`. Flag fields: `hair`,
`eye_color`, `outfit`, `scar`, `prop`, `mark`, `body`, `age`, `location`,
`relationship`, `status`.

The full CanonDoc schema (characters, events, locations) is in
[`data/canon.json`](data/canon.json) — a worked example with two characters,
four events, and three locations.

---

## Project structure

```
mnemo/
├── src/
│   ├── server.ts            # Express + x402 middleware + MCP transport
│   ├── checker.ts           # checkContinuity() — Gemini call + 100-line prompt
│   ├── check-handler.ts     # runCheck() — bridges canon resolution + checker
│   ├── resolve-canon.ts     # loadCanon / listSeries / seriesDir
│   ├── types.ts             # Shared TypeScript types
│   ├── test.ts              # Continuity PoC test (Aria fixture)
│   └── test-server.ts       # x402 gate tests (A: unpaid, B: direct, C: paid)
├── scripts/
│   ├── scrape-webtoon.ts    # Webtoon EN scraper
│   ├── scrape-webtoon-id.ts # Webtoon ID scraper (geo-block workaround)
│   ├── build-canon.ts       # Generate canon.json from scraped data
│   ├── mnemo.ts             # Watch-mode CLI (`npm run mnemo`)
│   ├── listing-assets.js    # Regenerate the OKX square avatar
│   ├── probe-tools-call.ts  # End-to-end paid-path smoke test (the canary)
│   ├── probe-paid-replay.ts # 402 → sign → 200 replay test
│   ├── e2e-test.ts          # Production smoke test
│   └── record-loops.md      # Script for the 3 demo video segments
├── data/
│   ├── canon.json           # Legacy Aria fixture (used when no series_id)
│   ├── alerts/<id>.json     # Watch-mode results
│   └── series/<id>/         # Per-series canon, episodes, scraped pages
├── frontend/                # Next.js 15 marketing / demo site (port 3001)
├── docs/okx-listing.md      # Live OKX.AI listing state + re-push commands
├── .env.example             # Required env vars
├── .progress/checkpoint.json  # Session resume anchor
└── tsconfig.json
```

---

## Frontend

A separate Next.js 15 app at [`frontend/`](frontend/), runs on port 3001, and
rewrites `/api/*` to the Express server on `:3000`.

Sections: **Nav** · **Hero** · **Showcase** (Lore Olympus annotated page) ·
**VideoCards** (3 demo loops) · **HowToUse** (prompt template with Copy
button + price callout) · **Footer**.

x.ai-inspired: AMOLED black + white only, Inter + Bricolage Grotesque + Rubik
Mono + Oi fonts, mobile-responsive, `prefers-reduced-motion` respected.

```bash
cd frontend
npm install
npm run dev          # http://localhost:3001
```

---

## Testing

```bash
npm run test:continuity                                    # Aria fixture — checker logic
npm run test:payment                                       # x402 gate: A, B, C
npx tsx scripts/probe-tools-call.ts                        # Full paid path on Render
npx tsx scripts/probe-paid-replay.ts                       # 402 → sign → 200 replay
npx tsx scripts/e2e-test.ts                                # Production smoke
```

`probe-tools-call.ts` is the canary — run it before any resubmit. It sends a
real `tools/call` with a real test image and asserts the full
`unpaid → 402 → sign → 200 with JSON-RPC result` path.

---

## OKX.AI listing (Agent 6211)

Mnemo is listed on the OKX.AI Agent Service Platform.

| Field             | Value                                                                       |
|-------------------|-----------------------------------------------------------------------------|
| Listing page      | https://www.okx.ai/agents/6211                                              |
| Service id        | `34794`                                                                     |
| Service type      | A2MCP                                                                        |
| Fee               | `0.1` USDT per call                                                          |
| Endpoint          | https://mnemo-9vze.onrender.com/mcp                            |
| Profile picture   | `frontend/public/listing-avatar.jpg` (1408×1408, full logo, black bg)       |

Live state, re-push commands, and the canonical copy live in
[`docs/okx-listing.md`](docs/okx-listing.md).

### Re-pushing the listing

If you change the avatar, copy, or endpoint, push again via the `onchainos`
CLI:

```bash
# 1. Upload a new avatar
onchainos agent upload --file frontend/public/listing-avatar.jpg

# 2. Update the agent identity
onchainos agent update --agent-id 6211 \
  --name "Mnemo" \
  --description "Continuity, kept. The memory layer for serialized webtoon and comic art." \
  --picture "<cdn-url-from-step-1>"

# 3. Update the service
onchainos agent update --agent-id 6211 --service '[{
  "operation": "update",
  "id": "34794",
  "serviceName": "Continuity Check",
  "serviceDescription": "Drop a page image; get a JSON of every continuity flag vs your series canon. Per-character inconsistencies (severity, field, episode + panel refs, explanation) plus proposed canon additions. Inputs: page image (base64), MIME type, optional canon JSON, optional dialogue. 0.1 USDT per check via x402.",
  "serviceType": "A2MCP",
  "fee": "0.1",
  "endpoint": "https://mnemo-9vze.onrender.com/mcp"
}]'
```

> **Gotchas (learned the hard way):**
> - **PowerShell mangles JSON** in `--service` on Windows. Spawn `onchainos.exe`
>   from Node so the JSON survives intact.
> - **`serviceDescription` is hard-capped at 500 chars** by the OKX API.
> - **`operation: "delete"` still requires all the other service fields.**
> - **Any update re-triggers the listing QA review** (status flips to "Listing
>   under review" for ~24h).

---

## Tech stack

**Backend** — Express 5, MCP SDK 1.29, `@okxweb3/x402-express` 0.1.1,
`openai` (OpenRouter-compatible client), viem 2.55, zod 4, multer 2,
TypeScript 7.

**Frontend** — Next.js 15, React 19, Tailwind v4, framer-motion 12, TypeScript
5.8.

**AI** — Gemini 2.5 Flash via [OpenRouter](https://openrouter.ai) (with a
fallback model list). Routed through OpenRouter because Google AI Studio's free
tier rate-limits aggressively and rejects virtual cards for paid billing.

**Blockchain** — X Layer (eip155:196), USDT contract
`0x779d…3736`, EIP-3009 `transferWithAuthorization`.

---

## License

ISC.
