# Creative Minds Jam #1 — Roadmap

**Event**: Creative Minds Jam #1: Hong Kong (Animoca Brands / Minds)
**Deadline**: 2026-08-28 **15:59 UTC** (23:59 HKT) — *submit by ~09:00 UTC*
**Track**: 3 — Moderation & Community Assistance
**Branch**: `jam/spoiler-guard`
**Prize pool**: $10,000 · Track winner $1,200 · Grand $2,300 · **Student $1,300**
**Entrant**: solo, student

---

## The pitch (locked)

**Mnemo: spoiler-aware canon intelligence for serialized fiction communities.**

A Minds agent holds a persistent, provenance-tracked canon memory for a
serialized IP — every character fact, event, and location, *plus the exact
episode that established it*. That memory powers a community moderator that
computes **spoiler risk relative to each reader's own progress**.

The core defensible claim: *episode-aware spoiler detection is pure memory.*
Remove the Mind and the product is impossible.

### Submission form text (926 chars, already drafted)

See the "Tell us about your idea" block in `docs/handover.md`.

---

## Judging criteria (5 × 1–10, equal weight)

| Criterion | Our play |
|---|---|
| **Minds Integration Depth** | The Mind's memory *is* the product; spoiler math is impossible without it |
| **Creator-Economy Problem Fit** | Direct hit on Track 3; spoilers + lore load are real creator pain |
| **Innovation & Creativity** | Episode-aware, progress-relative spoiler detection does not exist |
| **Execution & Completeness** | Reuse a shipped canon engine; demo one series deeply |
| **Viability & Scalability** | Any serialized IP; canon engine already live as OKX.AI Agent 6211 |

---

## The demo path — the spine

**Nine beats. If a feature does not serve one of these, do not build it.**

1. Canon overview — "Mnemo knows N facts across 50 episodes"
2. Community feed, seeded with authored fan comments
3. Reader-progress selector set to **Episode 30**
4. A seeded comment sits blurred: **"Spoils Episode 47 · you're on 30"**
5. Click to reveal → unblurs (consent, not censorship)
6. **Type a new spoiler comment live** → the Mind catches it on camera
7. **Ask a lore question live** → Mind answers, citing the episode
8. **Switch progress to Episode 50 → the same comment un-blurs** ⭐
9. Creator digest — "Overnight: 6 spoilers, 3 questions, 1 contradiction"

> **Beat 8 is the most important shot in the submission.** It is the proof this
> is memory and not a keyword blocklist. Every skeptical judge is thinking
> "this is just regex on character names" — beat 8 kills that in three seconds.
> Give it the zoom and the voiceover line. If only one shot lands, it's this one.

---

## Checkpoints

Each checkpoint = one commit. Tagged ones are session boundaries and revert points.

| CP | Work | Tag | Status |
|----|------|-----|--------|
| **C0** | Baseline: commit 5.04, gitignore `.opencode/`, fix README URLs, branch | `jam-c0` | ✅ done |
| **C1** | Docs: AGENTS.md jam section + context protocol, this roadmap, handover | — | ✅ done |
| **C2** | Minds handshake: client lib, `src/minds.ts`, **prove cross-session recall** | `jam-c2` | ⬜ |
| **C3** | Demo canon: ~40 facts hand-authored across **episodes 1–50** | — | ⬜ |
| **C4** | Moderation engine: `POST /moderation/check` → 4 verdicts. **HARD GATE** | `jam-c4` | ⬜ |
| **C5** | Verdict cache for the ~20 seeded comments (real Mind output, cached) | — | ⬜ |
| **C6** | `/community` page: seeded feed + blur/reveal | — | ⬜ |
| **C7** | Progress selector → re-evaluation. **Beat 8 works** | `jam-c7` | ⬜ |
| **C8** | Live comment box (beat 6) + lore-question path (beat 7) | — | ⬜ |
| **C9** | Autonomy: background worker + SSE + unprompted digest, `/digest` | `jam-c9` | ⬜ |
| **C10** | Copy/IA pass: demo to `/`, marketing to `/mcp-service` | — | ⬜ |
| **C11** | Video: script → VO → capture → CapCut → captions | `jam-c11` | ⬜ |
| **C12** | README + diagram, **submit branch URL** (no master merge) | `jam-submit` | ⬜ |

### Day allocation (realistic solo hours ≈ 35–40, not 84)

| When | Checkpoints | Hours |
|---|---|---|
| Tonight (Aug 25) | C0, C1, C2 | ~3 |
| Aug 26 | C3, C4, C5 | ~10 |
| Aug 27 AM | C6, C7, C8 | ~10 |
| Aug 27 PM → Aug 28 early | C9, C10, C11 | ~10 |
| Aug 28 by 09:00 UTC | C12 + buffer | ~4 |

---

## Gates and cut lines

- **C2 gate** — send canon, then in a **fresh process** ask a recall question.
  If recall is unreliable: canon lives server-side, pass the relevant slice per
  call. Decide at C2, not on day 3.
- **C4 gate** — four verdicts (`safe` / `spoiler` / `lore_question` /
  `contradiction`) proven in a terminal by end of Aug 26. If not, **drop
  `contradiction`** and ship three.
- **End of Aug 27 AM** — beats 1–8 clickable. Ugly is acceptable, broken is not.
- **Build gate, every checkpoint touching `src/`** — `npm run build` (tsc) must
  pass before committing. A broken build is what would kill the Render deploy
  later, and it's cheapest to catch immediately.
- **C12** — **do not merge to `master`.** Render auto-deploys `master` on every
  commit and a failed rebuild takes `/mcp` down while OKX listing #6211 is under
  review. Submit the branch URL:
  `https://github.com/emmaGH1/mnemo/tree/jam/spoiler-guard`.
  Merge after the OKX review closes, with `probe:okx` green.
  **Zero commits to `master` until after the deadline** — even a README-only
  commit triggers a rebuild.

---

## Fallbacks

| Breaks | Do |
|---|---|
| Minds latency >5s | Cached verdicts for the seeded feed; live calls only on beats 6–7 |
| Cognition low | Check `minds cognition balance` before every recording session; caching cuts usage ~90% |
| Cross-session memory flaky | Canon server-side, slice per call — still a legitimate Minds memory story via conversation history |
| Contradiction detection fuzzy | Cut it; three verdicts demo fine |
| Feed looks fake | Timestamps, avatars, varied lengths, one comment with a typo |
| Video overruns | Cut beats 5 and 9 detail. **Never cut beat 8** |

> **Never hardcode fake Mind output.** Caching *real* verdicts is legitimate and
> documented; fabricated output is fraud and judges read the repo.

---

## Scope guardrail — rejected ideas

These were considered and rejected. If work drifts toward any of them, stop.

- **Multi-genre pipelines** (manga + novels + comics as separate builds) —
  costs 8–15h, moves zero rubric points, lowers Execution. Breadth is a
  *positioning* line in the README, not a build.
- **Continuity QA as the headline** — matches no track; Minds becomes a model
  swap and fails the sponsor-centrality test.
- **Discord / Telegram bot** — OAuth + hosting risk. The in-app feed demos
  better and is fully controlled.
- **x402 / payments work** — not in this rubric. Cite the live listing as a
  viability signal; build nothing.

---

## Website: add, don't revamp

The AMOLED design system (`globals.css`, grid, grain, mesh drift, `ui/*`,
`Cursor`) is an asset and reads premium on video. What's wrong is **copy and
information architecture**, not visuals.

| Component | Action |
|---|---|
| `globals.css`, `layout.tsx`, `ui/*`, `Cursor` | Keep verbatim |
| `Nav`, `Footer` | Keep, retitle links |
| `Hero` | Rewrite copy only — same layout, same motion |
| `Showcase` | Repurpose → canon-memory panel (beat 1) |
| `Pricing`, `HowToUse` | Move to `/mcp-service`; **do not delete** |
| `/` (page.tsx) | Becomes the community feed — judges land on the graded thing |
| `/digest` | New — beat 9 |

Total ≈ 11h additive, vs ≈ 25h for a revamp that scores the same or worse.

---

## Demo video

**No motion graphics.** For a 2-minute hackathon demo, a clean screen recording
beats amateur motion graphics every time. Budget **8–10h**, not 18.

Stack: **OBS** (or Win+G) → **CapCut** → own voice for VO.

Only four effects needed: one text-overlay preset, a zoom on beat 8
(two scale keyframes), auto-captions, hard cuts every 2–4s.

Craft rules:
- 1920×1080, clean desktop, notifications off, bookmarks hidden
- The AMOLED site reads premium on video for free
- Move the cursor slowly and deliberately
- Pre-seed all data so nothing loads on camera
- Record in segments (see `scripts/record-loops.md` for the existing pattern)
- Shoot beat 8 five-plus times, keep the best
- **Write script → record audio → cut picture to audio.** Never the reverse.

Beat sheet (1:30–2:00, required range):

| Time | Content |
|---|---|
| 0:00–0:15 | Hook — "Every fan community spoils new readers." |
| 0:15–0:30 | The problem — a comment spoiling a major reveal |
| 0:30–1:00 | Mind in action — feed, live comment caught, spoiler blurred |
| 1:00–1:30 | **Beat 8** (progress switch → un-blur) + digest + canon memory |
| 1:30–2:00 | Impact — any serialized IP, any community |

`docs/promo-video.md` holds the older 52s x402 beat sheet — **superseded for
the jam**, kept for the OKX listing.

---

## Reference links

| Purpose | URL |
|---|---|
| Repo | https://github.com/emmaGH1/mnemo |
| Event page / Submit BUIDL | https://dorahacks.io/hackathon/creativeminds/detail |
| Minds docs hub | https://build.hellominds.ai/en/docs |
| Account setup / API key | https://build.hellominds.ai/en/docs/get-started/account-setup |
| Minds CLI | https://build.hellominds.ai/en/docs/get-started/cli |
| Minds client library | https://build.hellominds.ai/en/docs/get-started/client-library |
| Minds API reference | https://build.hellominds.ai/docs/api |
| Etsy Strategist (best reference build) | https://build.hellominds.ai/en/inspirations/etsy-shop-strategist |
| Investment Programme | https://build.hellominds.ai/en/program |
| Live `/mcp` endpoint (do not break) | https://mnemo-9vze.onrender.com/mcp |
| OKX listing #6211 | https://www.okx.ai/agents/6211 |

Packages: `@animocabrands/minds-cli`, `@animocabrands/minds-client-lib`
Env: `MINDS_BUILDER_API_KEY`
