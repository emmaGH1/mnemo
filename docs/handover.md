# Handover — live session state

> **Read this first, then [`AGENTS.md`](../AGENTS.md).** Those two files should
> be enough to resume cold. If they aren't, this doc is under-written — fix it
> before ending your session.

**Last updated**: 2026-08-28, post-review hardening complete
**Branch**: `jam/spoiler-guard` (do **not** commit jam work to `master`)
**Last tag**: `jam-c9`
**Latest product commit**: `b6a9d3e` (`fix: harden spoiler guard and refocus jam UI`)

---

## NEXT ACTION

**Goal: complete a focused four-hour judge-story pass.** The core product and
spoiler-safety boundary are working. Do not add infrastructure, restore the
legacy OKX/MCP service to the primary navigation, or attempt a broad redesign.

**Locked framing:** Mnemo began as a serialized-fiction continuity engine. Its
episode-proven canon now powers a Minds-based, reader-relative moderation
layer. The continuity/OKX lineage is credibility and foundation proof — not a
second product, headline, navigation item, or competing call to action.

**Implement next, in this order:**
1. Add a compact **“Try the proof”** guide above the reader-progress control:
   set episode 30 → reveal one protected comment deliberately → move to episode
   50 and watch the boundary clear. A first-time judge should know what to do
   within 10 seconds.
2. Add a small architecture strip explaining the real flow:
   **continuity engine → episode-proven canon → Minds semantic classifier →
   reader-relative protection → creator digest**.
3. Add one restrained foundation section near the bottom, such as **“Built on
   Mnemo’s canon engine.”** Explain that the original continuity checker
   supplied the provenance layer. Do not add an OKX button or restore its nav
   entry; `/mcp-service` remains direct-link only.
4. Tighten the narrative from **Reader Feed → Creator Digest** so the second
   page reads as the creator payoff of the same moderation run, not a separate
   dashboard.
5. Run the root and frontend production builds plus spoiler-safety checks,
   inspect the complete flow in the browser, then record the demo and submit.

**Success criteria:**
- The promise and first interaction are obvious in under 10 seconds.
- A judge understands what Minds contributes and what the provenance engine
  contributes in under 20 seconds.
- Episode 30 → explicit reveal → episode 50 is the hero proof.
- The continuity origin reads as technical credibility, not product confusion.
- Cached and metered behavior remain labeled honestly; there are no fake-live
  or autonomous-worker claims.

**Scope guardrail:** no auth, database migration, multi-series system, Discord
bot, full visual revamp, new OKX work, or legacy-service cleanup before the
demo. Those are post-hackathon tasks.

**After the UI pass (user):**
1. Record the video around the episode 30 → reveal → episode 50 journey, then
   show the creator digest and architecture/foundation proof.
2. Top up cognition (balance was −16.3 at last check) only if an honestly live
   classification shot is worth the risk; the cached proof path is complete.
3. Create the **draft BUIDL** with the form text below, then submit the
   **branch URL**: `https://github.com/emmaGH1/mnemo/tree/jam/spoiler-guard`
   — **do not merge to `master`** while the legacy Render deployment remains
   tied to `master`.

### Also owed by the user (not code)

- [x] Registered on DoraHacks
- [x] Render auto-deploy confirmed: **ON, deploys on commit** → see landmines
- [ ] Create the **draft BUIDL** with the form text below (editable until the
      deadline — removes deadline risk)
- [ ] **Top up Mind cognition** (balance −16.3) — only needed for live beats

---

## What just happened (this session)

**Post-review hardening — product refocus and real spoiler boundary.** Commit
`b6a9d3e` hides OKX/MCP from the jam desktop/mobile navigation and footer while
retaining `/mcp-service` as a direct legacy route. The reader feed and creator
digest were reframed as one editorial control room, with cached versus metered
behavior labeled explicitly. Protected spoiler text is no longer shipped in
the initial `/community/feed` response; the client fetches it from
`/community/reveal` only after deliberate consent. `/canon/answer` now requires
`reader_episode` and filters future canon, contradiction evidence is gated by
episode, and model-supplied episode fields are validated. Mind calls are
serialized per alias, `series_id` is forwarded, and live moderation is limited
to 5 requests per 10 minutes per IP. The fake digest SSE worker was removed.
Added `scripts/check-spoiler-safety.ts` and `npm run test:spoiler-safety`.

Verification completed: root build, frontend production build, cache check,
spoiler-safety check, continuity tests, and payment-gate tests passed (the paid
external path was skipped because OKX was unreachable). Runtime checks showed
episode 1: five protected/zero contradictions; episode 30: three protected and
protected text absent from the feed payload; episode 50: zero protected;
Hecate lore remains locked until episode 9; the sixth live moderation request
returns 429. Browser testing completed without console errors. At the time of
handover, the branch is at least one local commit ahead of origin because the
hardening commit has not been pushed.

**C5 — verdict cache, real Mind output.** Authored
`data/series/lore-olympus/seed-comments.json` — 20 authored fan comments with
feed metadata (avatars, relative timestamps, likes, one typo c05 "eres").
Ran the **real Mind** over all 20 at `reader_episode=1` (strictest baseline)
→ `verdicts.json`: **10 safe / 5 spoiler / 3 lore_question / 2 contradiction**.
Spoiler spread: c11[47] ⭐ anchor, c12[42] Apollo, c13[49] act of wrath,
c14[25] first kiss, c05[13] makeover. Added `effectiveVerdict(cached, reader)`:
the ONLY progress-dependent branch is spoiler (blur iff
`spoils_episode > reader_episode`) — the beat-8 machinery. Two fixes during
the run: (1) **stale-reply corruption found + fixed at the root** — c20 was
cached with a verbatim copy of c19's reply. `tell()` now uses the max of (last
consumed reply fingerprint per alias, history snapshot) as `afterFingerprint`;
a history-only snapshot misses a reply that arrived via SSE but isn't in
history yet, and the SSE stream re-delivers that stale event on the next wait.
(2) c20 regenerated → `safe`. `npm run moderation:check-cache` asserts all 20
cached + 10 progress transitions (c11 blurs@30 → safe@50). New
`GET /community/feed?reader_episode=N` merges comments + effective verdicts
(instant, no live call) — verified: 20 comments, 3 blurred@30, 0 blurred@50.
Killed a stale `dist/server.js` leftover hogging port 3000.

**C4 — moderation engine, HARD GATE PASSED.** `src/moderation.ts`:
`moderate(comment, readerEpisode, seriesId?)` → the Mind classifies each
comment as `safe` / `spoiler` / `lore_question` / `contradiction`; spoiler
carries `spoils_episode`. Wired as `POST /moderation/check` in `server.ts`
(zod-validated, 400 on bad input, 502 on Mind failure). Two reliability fixes
landed during the gate: (1) `afterFingerprint` snapshot in `tell()` —
prevents `waitForReply` matching a stale previous-turn reply (one proof run
returned a verbatim copy of the prior answer); (2) canon-digest grounding
after pure-memory recall flaked on exact episode attribution. `npm run
moderation:prove` = 7 live cases → **all four verdicts PASS**, including the
beat-8 logic: the ep-47 spoiler comment is `spoiler` for a reader on 30 and
`safe` for a reader on 50. HTTP route verified: 30→spoiler/47, 50→safe,
bad input→400. Latency 11–130s/call (minimax-m3) → C5 cache is required for
the seeded feed. Tagged `jam-c4`, pushed.

**C3 — demo canon, wide.** Hand-authored `data/series/lore-olympus/canon.json`
v2: 77 facts — 12 characters (role/species fields added to `CharacterRecord` in
`types.ts`), 18 events, 6 locations — spanning **episodes 1–50**.
`episodes.json` expanded to 50. Re-seeded the Mind with the wide canon
(architecture A) — fresh-process recall confirmed "Episode 47, panel 3, Hades"
for the evt_017 spoiler anchor. `npm run build` + `test:continuity` green.

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
| Landing page | Demo is `/`; legacy service is direct-link only and absent from jam navigation |
| UI | **Editorial control room** — keep the AMOLED grid, focus on reader boundary + creator review |
| Video | Screen recording + CapCut + own voice. **No motion graphics** |
| Genre breadth | A README/pitch line only. **Not a build** |
| Branch | `jam/spoiler-guard`; merge to master at C12 after `probe:okx` |
| Canon architecture | Provenance-tracked canon is server-side; cross-session Mind recall was proven but is not relied on for exact episode math |
| Moderation grounding | **Hybrid** — each live check sends a compact canon digest and the Mind performs semantic classification. Cached verdicts power the deterministic seeded demo. No autonomous-worker claim in the no-credit build |
| `.opencode/` | Gitignored |

---

## Submission form text (revised — verify in the form's counter)

> Serialized fiction lives on reveals — but fan communities have no memory of
> what was revealed when. New readers get spoiled, creators drown in the same
> lore questions, and fan theories quietly contradict canon.
>
> Mnemo combines a Minds semantic classifier with a provenance-tracked canon:
> every character fact, event and location carries the exact episode that
> established it.
>
> That memory powers a spoiler-aware community moderator. It reads each comment
> against canon and against the reader's own progress, so it can tell that a
> line spoils episode 47 for someone on episode 30 — then blurs it, answers lore
> questions without exposing later facts, flags contradictions only after the
> supporting canon is visible, and gives creators a moderation digest.
>
> The Mind supplies semantic judgment beyond keyword filters; the provenance
> layer supplies exact episode math. The seeded demo caches genuine Mind
> verdicts so the reader-progress interaction stays fast and reproducible.

**About You / Your Team:**

> Solo builder and student. Built Mnemo's structured canon engine, Minds
> moderation integration, reader-aware feed, episode-gated lore answers, and
> creator digest end to end.

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
- **C3 canon is a seeded demo fixture**, not a transcript of the comic. Facts
  are recognizably Lore Olympus but episode/panel numbers are hand-assigned for
  the demo (e.g. the assault at ep 42, evt_017 at ep 47). Fine for the jam —
  do not present it as page-accurate canon.
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
