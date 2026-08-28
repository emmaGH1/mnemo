# Mnemo — Agent Instructions

> **ACTIVE WORK: Creative Minds Jam #1 (Animoca Minds).**
> Deadline **2026-08-28 15:59 UTC** (23:59 HKT). Track 3 — Moderation &
> Community. Branch `jam/spoiler-guard`. **Read
> [`docs/handover.md`](docs/handover.md) first**, then
> [`docs/jam-roadmap.md`](docs/jam-roadmap.md) for the checkpoint plan.
> `master` must stay deployable — the OKX listing is under review against it.

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
During the jam, read [`docs/handover.md`](docs/handover.md) as well — it holds
the live "what's next" state that checkpoint.json only logs after the fact.

## Context-overload protocol

Long sessions get expensive and start making mistakes. **Watch for these
signals and start a fresh session when two or more appear:**

- You re-read a file you already read this session (context has fallen out)
- You reintroduce a bug that was already fixed
- You contradict a decision recorded in `docs/handover.md`
- Tool output gets truncated to files repeatedly
- Responses slow noticeably or you start hedging on facts you established earlier
- More than ~2 hours of wall-clock work in one thread

**Hard rule: hand off at every tagged checkpoint.** The tags in
`docs/jam-roadmap.md` (`jam-c2`, `jam-c4`, `jam-c7`, `jam-c9`) are natural
session boundaries — one checkpoint per session keeps context small and cost
low.

**Before ending a session, always:**

1. Commit and push all work (never hand off a dirty tree)
2. Append a `6.xx` entry to `.progress/checkpoint.json`
3. Update the "NEXT ACTION" block at the top of `docs/handover.md`
4. Tag if the checkpoint calls for it

A fresh session should need only `docs/handover.md` + `AGENTS.md` to resume.
If it needs more than that, the handover doc is under-written — fix it.

## AGENTS.md conventions

- Keep this file updated with new build/test commands as they're added
- Update checkpoint.json after each completed step

## Minds by Animoca (jam work)

Env: `MINDS_BUILDER_API_KEY` in `.env` (never commit it). Requires Node 22+
(currently on v24.16.0). Auth header is `X-Api-Key`; `X-Access-Key` is
deprecated.

```bash
npx @animocabrands/minds-cli@latest doctor --pretty   # verify key + connectivity
minds list --pretty                                   # mindId, name, model, species
minds chat create --mind "<mindId>" --alias mnemo      # idempotent
minds send mnemo "..." --wait --timeout 180000
minds history mnemo --limit 20                         # senderType 1=human, 0=Mind
minds cognition balance --mind "<mindId>"              # check before recording sessions
minds bazaar search "<term>" --max 20                  # no API key needed
```

Server-side embedding uses `@animocabrands/minds-client-lib`
(`createMindsClient`, `ensureConversation`, `sendMessage`, `waitForReply`,
`getHistory`, `subscribeEvents`). Docs:
<https://build.hellominds.ai/en/docs>.

**Cognition is metered** — it is consumed by reasoning, tool use, *and*
autonomous work. Cache Mind verdicts for seeded demo data; spend live calls
only on the parts of the demo that must be live.

## Git discipline (jam)

- All jam work lands on `jam/spoiler-guard`, **never directly on `master`**.
  Render **auto-deploys `master` on every commit** — and a merge rebuilds, so a
  `tsc` failure takes the OKX reviewer's `/mcp` endpoint down. Zero commits to
  `master` until after the jam deadline.
- One commit per checkpoint; tag the majors (`git tag jam-c4`).
- `npm run build` must pass before any commit that touches `src/`.
- Panic button: `git reset --hard jam-c7`.
- Submit the branch URL, not a merge. Merge to `master` only after the OKX
  review closes and `npm run probe:okx` is green.

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
npm run probe:paid      # Full paid tools/call path on Render — THE canary
npm run probe:okx       # Reviewer-identical 2-phase GET+POST replay
npm run probe:replay    # 402 → sign → 200 replay (no AI call)
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

