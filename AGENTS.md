# Mnemo — Agent Instructions

## Build commands

```bash
npm run dev              # Start Express API (src/server.ts)
npm run test:continuity  # Run continuity check tests
npm run test:payment     # Run payment gate tests
npm run build            # TypeScript compile
npm start                # Start compiled server
```

## Key scripts

```bash
npx tsx scripts/scrape-webtoon-id.ts <base> <title_no> <series_id> --episodes 1-3
npx tsx scripts/build-canon.ts <series_id> [--episodes 1-3]
npx tsx src/test.ts [series_id]
node scripts/listing-assets.js   # regenerate frontend/public/listing-avatar.jpg (OKX square avatar)
```

## Project structure

```
src/                    # Server + checker source
scripts/                # Scraping + canon building
data/series/<id>/       # Per-series data (pages/, canons)
.progress/checkpoint.json  # Session resume anchor
```

## Session resume

Always read `.progress/checkpoint.json` first to know exactly where we stopped.

## AGENTS.md conventions

- Keep this file updated with new build/test commands as they're added
- Update checkpoint.json after each completed step

## OKX.AI listing re-push (gotchas)

When re-pushing the OKX.AI listing via the `onchainos` CLI, these four things
bite every time — read them before touching the listing:

- **PowerShell mangles JSON in `--service`** on Windows. Spawn `onchainos.exe`
  from Node (or `cmd /c` with a here-doc) so the JSON survives intact.
- **`serviceDescription` is hard-capped at 500 chars** by the OKX API.
- **`operation: "delete"` still requires all the other service fields.**
- **Any update re-triggers the listing QA review** (status flips to "Listing
  under review" for ~24h) — even cosmetic changes.

Live state, full re-push commands, and the canonical marketing copy:
[`docs/okx-listing.md`](docs/okx-listing.md). Compliance cross-check:
[`docs/okx-compliance-check.md`](docs/okx-compliance-check.md).

## Probes (re-verify before any resubmit)

```bash
npm run probe:paid      # Full paid tools/call path on Railway — THE canary
npm run probe:replay    # 402 → sign → 200 replay (no Gemini call)
npm run test:payment    # x402 gate tests (A: unpaid→402, B: direct, C: real paid)
```

`probe:paid` is the gate — if it doesn't hit `200 + JSON-RPC result`, don't
re-push the listing. It needs a funded test wallet (see `.env` for the address
and `scripts/check-balances.ts` to verify balance).

## Frontend

The frontend/ directory is a separate Next.js project for the premium marketing/demo website.

```bash
cd frontend
npm run dev          # Start Next.js on port 3001
npm run build        # Production build
```

The API rewrites to localhost:3000 (the Express server). Start both: 
npm run dev in both root and frontend/.

