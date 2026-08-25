# Handover — live session state

> **Read this first, then [`AGENTS.md`](../AGENTS.md).** Those two files should
> be enough to resume cold. If they aren't, this doc is under-written — fix it
> before ending your session.

**Last updated**: 2026-08-25, end of C2
**Branch**: `jam/spoiler-guard` (do **not** commit jam work to `master`)
**Last tag**: `jam-c2`

---

## NEXT ACTION

**Checkpoint C3 — demo canon.** Hand-author the Lore Olympus canon across
**episodes 1–50**, ~40 facts. The current `data/series/lore-olympus/canon.json`
is a 3-episode fixture and cannot express "spoils ep 47 while you're on 30".

- Author fan comments yourself (never scrape real ones — third-party IP)
- Canon is a *seeded demo fixture* — label it in the README
- Output: `data/series/lore-olympus/canon.json` wide enough for C4's four
  verdicts (`safe` / `spoiler` / `lore_question` / `contradiction`)
- Don't sink 6–10h into scraping 50 episodes — hand-author

Then C4 (moderation engine, **HARD GATE**) — see `jam-roadmap.md`.

### Also owed by the user (not code)

- [x] Registered on DoraHacks
- [x] Render auto-deploy confirmed: **ON, deploys on commit** → see landmines
- [ ] Create the **draft BUIDL** with the form text below (editable until the
      deadline — removes deadline risk)

---

## What just happened (this session)

**C2 — Minds handshake, gate passed.** Doctor green, mind `mnemo`
(`5470503e-f36b-1410-8466-00039ce7df11`, minimax-m3, cognition ~160).
Installed `@animocabrands/minds-client-lib@0.1.4`. Created `src/minds.ts` (lazy
dynamic import — the lib is ESM-only and this repo is CJS) exporting `getMinds`
(singleton) and `tell` (ensureConversation + sendMessage + waitForReply).
Gate script `scripts/minds-gate.ts seed|recall`: seeded the Lore Olympus canon
into the conversation in one process, then recalled in a **fresh process** —
the Mind answered "Green, established in episode 1, panel 1" → **architecture A
(Mind owns memory) won**. Recorded above. Tagged `jam-c2`, pushed.

**Earlier this session:** C0 + C1 (see below).

**The pivot.** Mnemo was a webtoon continuity checker with zero Minds
integration and no fit to any of the three jam tracks — scoring ~31/50 on the
rubric, with the two heaviest criteria (Minds Integration Depth,
Creator-Economy Problem Fit) both failing. Decision: keep the canon-memory
engine, replace the surface, land in **Track 3** as a spoiler-aware community
moderator. Projected ~42/50.

Explicitly rejected: multi-genre pipelines, continuity-QA-as-headline,
Discord bot, any further x402 work. See the scope guardrail in the roadmap.

**C0** — committed the loose 5.04 Render-migration state, gitignored
`.opencode/` (it contained a vendored `node_modules`), fixed four classes of
README rot: wrong GitHub org (`emma0x` → `emmaGH1`), eight dead Railway URLs →
Render, stale `GEMINI_API_KEY` → `OPENROUTER_API_KEY`, stale
`@google/generative-ai` → OpenRouter client. Tagged `jam-c0`, pushed to
`master`, branched.

**C1** — AGENTS.md gained a jam header, a Minds command reference, a git
discipline section, and a **context-overload protocol**. Created
`docs/jam-roadmap.md` (the full plan) and this file.

---

## Decisions locked (do not re-litigate)

| Decision | Choice |
|---|---|
| Track | **3 — Moderation & Community** |
| Product | Spoiler-aware community moderator on a canon memory |
| Community surface | **In-app feed** in the Next.js frontend — no Discord |
| Demo series | **Lore Olympus**, canon **hand-authored** across ep 1–50 |
| Landing page | Demo becomes `/`; marketing moves to `/mcp-service` |
| UI | **Add, don't revamp** — keep the AMOLED design system |
| Video | Screen recording + CapCut + own voice. **No motion graphics** |
| Genre breadth | A README/pitch line only. **Not a build** |
| Branch | `jam/spoiler-guard`; merge to master at C12 after `probe:okx` |
| Canon memory architecture | **A — Mind owns memory** (cross-session recall proven at C2). Server sends full canon once; subsequent calls rely on conversation history |
| `.opencode/` | Gitignored |

---

## Submission form text (926 chars — verify in the form's counter)

> Serialized fiction lives on reveals — but fan communities have no memory of
> what was revealed when. New readers get spoiled, creators drown in the same
> lore questions, and fan theories quietly contradict canon.
>
> Mnemo is a Minds agent holding a persistent, provenance-tracked canon memory
> for any serialized IP: every character fact, event and location, plus the
> exact episode that established it. It updates its own memory as new chapters
> drop.
>
> That memory powers a spoiler-aware community moderator. It reads each comment
> against canon and against the reader's own progress, so it can tell that a
> line spoils episode 47 for someone on episode 30 — then blurs it, answers lore
> questions from canon, flags contradictions, and sends the creator an
> unprompted daily digest.
>
> Remove the Mind and the product is impossible: episode-aware spoiler detection
> is pure memory. The canon engine already ships live as OKX.AI Agent 6211.

**About You / Your Team:**

> Solo builder, student. Built Mnemo — a paid MCP agent for serialized-fiction
> continuity, listed on OKX.AI as Agent 6211 with a live x402 payment rail on X
> Layer. Includes a structured canon-memory engine with per-episode provenance,
> self-updating memory, and a vision consistency pipeline — shipped and live.

---

## Known landmines

- **`master` auto-deploys to Render on every commit.** Confirmed 2026-08-25.
  Render serves the `/mcp` endpoint the OKX reviewer is testing (listing #6211,
  `approvalDisplayStatus: 2`, under review since 2026-08-21). A merge does not
  just redeploy — it **rebuilds**. C2+ adds `@animocabrands/minds-client-lib`
  and new TS files; if `tsc` fails on Render the deploy fails and `/mcp` goes
  **down** mid-review. **Therefore: do not merge to `master` before the
  submission deadline.** Submit the `jam/spoiler-guard` branch URL — DoraHacks
  accepts any repo/branch link, and a judge reading a feature branch is a
  non-issue. Merge after the OKX review closes, with `npm run probe:okx` green.
- **Render cold start ≈ 23s**, warm ≈ 0.7s. Free tier spins down after ~15min
  idle. Irrelevant for the jam demo (local), relevant for the OKX reviewer.
- **Existing canon is too thin for the demo.** `data/canon.json` is a
  3-episode, 2-character Aria fixture. It **cannot** express "spoils ep 47
  while you're on 30". C3 must hand-author a wide canon — do not sink 6–10h
  into scraping 50 episodes.
- **Lore Olympus is third-party IP.** Label the canon a *seeded demo fixture*
  in the README, and **author the fan comments yourself** — never scrape real
  user comments.
- **Cognition is metered** and consumed by autonomous work too. Check balance
  before recording.
- `data/series/*/pages/` is gitignored (large scraped images).

---

## Model strategy for this build

| Phase | Model | Why |
|---|---|---|
| Planning, architecture, rubric calls | Opus-class | Judgement-heavy, low token volume |
| Implementation (C3–C9) | Cheaper strong coder (e.g. DeepSeek-class) | High token volume, well-specified tasks |
| Visual/copy polish (C10) | Whatever you design fastest in | Taste, not reasoning |

This works **because the spec is written down**. Hand a cheap model
`jam-roadmap.md` + this file + one checkpoint's scope. Do not hand it an
open-ended "build the thing".

Escalate back to the expensive model when: the C2 gate fails, a checkpoint's
approach needs redesign, or you're deciding what to cut.
