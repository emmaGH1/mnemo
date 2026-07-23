# Mnemo — 3-Loop Recording Script

Short, mute-friendly, autoplay-on-scroll loops for the `VideoCards` section.
Target: 3 clips × ~22s raw → trimmed to 20s for clean loop seam.

---

## Tool recommendation

**Use ShareX** (free, open source, all-in-one record + trim + export).
- `getsharex.com` — install, set `Task settings → Screen recorder → Capture → Window` to the specific window you want
- Format: `.mp4` directly (skip the `.gif` path)
- After recording, use ShareX's `Video editor` task to trim head/tail
- Hardware cursor is fine — it reads on screen and won't be a hard cut

**Alternative:** OBS Studio if you already know it. Settings that matter here:
- Output: `.mkv` (remux to `.mp4` after — `.mkv` survives crashes, `.mp4` doesn't)
- Resolution: native window or 1920×1080
- 30 fps, CRF 18–20
- Audio: **disabled** (these are muted autoplay loops, no audio)

**Skip:** Windows Game Bar (no crop, no trim), ScreenToGif (overkill), ffmpeg CLI (too much setup for 3 clips).

---

## Setup (do once, before any recording)

```bash
# Terminal 1 — Express API (must start first)
cd mnemo
npm run dev
# → http://localhost:3000

# Terminal 2 — Demo site
cd mnemo/frontend
npm run dev
# → http://localhost:3001
```

- Open Chrome at `http://localhost:3001`
- Zoom to 100% (not 125% — text size will look weird in the loop)
- Close every other tab, dock, notification
- Set Chrome to a dark theme to match the rest of the site
- Use a monospaced font in your terminal (Cascadia Code / JetBrains Mono at 14–16pt)

---

## Recording strategy — quota + replay

Your Gemini API key (any tier) gives you limited calls per day. With 3 segments × multiple takes, you can blow through quota fast. Plan the session like this:

**Path A (recommended for first 2 takes of every segment):** `--replay` mode
- Uses cached responses from `scripts/demo-replay.json` (edit the file to change the story)
- No API calls, no quota hit
- Reproducible — every take is identical
- Good for nailing the recording pipeline (window size, trim points, loop seam)
- Demo-replay.json has 4 pages: p01 clean, p05 2 breaks caught, p08 clean, p12 1 break caught

**Path B (use for the final "hero" take of each segment):** live `/check`
- Real product, real flags, real timing
- Limited takes — Pro account = 20/day, free new account = 5/min + 20/day
- If you're using the free account, add `--delay 15000` (15s between pages) to stay under the per-minute limit

**Suggested session:**
1. Take 1–2 of each segment using `--replay` (no quota cost) — get the trim and loop seam right
2. Take 3 of each segment using the live CLI (one final clean run per segment, ~12 calls total)
3. Save the rest of the day's quota for testing the actual product

---

## Segment 01 — "Watch the agent" (terminal loop)

**Target:** 20s loop. Terminal session that shows pages being checked one after another.

**Capture target:** A terminal window running the `mnemo` CLI with green ✓ or red ✗ lines per page.

**CLI command** (preferred — clean output, no curl mess):

```powershell
# First take — replay mode (no API call, no quota cost)
npm run mnemo -- watch --series lore-olympus --pages p01,p05,p08,p12 --replay scripts/demo-replay.json --delay 4000

# Final take — live API (real product, uses ~1 quota per page)
npm run mnemo -- watch --series lore-olympus --pages p01,p05,p08,p12 --delay 4000
```

`--delay 4000` paces the output to ~20s total for 4 pages. Drop to `--delay 3000` for a 16s loop, raise to `--delay 5000` for a 24s loop.

**Available flags:** `--series` (required), `--pages` (required, comma-separated), `--episode` (default ep003), `--delay` (ms between pages, default 0), `--retries` (HTTP 5xx retries, default 1), `--replay` (path to cached JSON), `--endpoint` (default localhost:3000).

**Prep (before pressing record):**
- Resize terminal window to roughly 720×440
- Place the terminal on a dark desktop, ideally with a faint border for definition
- Run the command once. The block is now in your shell history — `↑ Enter` re-runs it during recording

**Record (~22s raw):**
1. Press record, wait 1s
2. `↑ Enter` — re-runs the CLI from history
3. End on the final `✓` or `✗` line — that's the loop seam

**Trim for seam:**
- Cut the first ~1s (terminal prompt + `> tsx` echo) — start on the first `--- p01 ---` line
- Cut the last ~1s (cursor drift) — end exactly on the final `✓` or `✗` line
- Final length: ~20s

**Save as:** `frontend/public/videos/watch.mp4`
**Optional poster:** `frontend/public/videos/watch-poster.jpg` — a single frame of the terminal mid-loop (Win+Shift+S)

---

## Segment 02 — "See the report" / "Catch every break" (browser loop)

**Target:** 20s loop. The demo site showing a flagged page with the error list.

**Capture target:** Chrome on `localhost:3001`, scrolled to a view that shows the page + the error list together.

**Important:** Gemini is non-deterministic — the `try a Lore Olympus page` button may return 0, 1, or 2 flags. **Run it 2–3 times before recording** until you get a result with 2+ flags. If you can't get flags after 5 tries, record the result with whatever flags you have (1 flag is fine — still tells the story).

**Prep:**
- Scroll to the Showcase section manually (or wherever your checker interaction lives)
- Have the cursor pre-positioned near the button
- Make sure the result card will be visible below the page image — the loop reads best when the error list is on screen

**Record (~22s raw):**
1. Press record, wait 1s
2. Click the `try a Lore Olympus page` button
3. Hold the shot during the 3–8s loading state — that's the "real work" beat
4. When results render, **don't scroll** — let the flags fade in
5. Hold on the final state (page image + flag list visible) for ~6s — that's the loop's "money frame"

**Trim for seam:**
- Start the loop on the click (or 0.5s before, so the click registers visually)
- End on the static "results visible" frame, after the user has had time to read one flag
- The transition from "before click" → "after result" is the loop's only jarring beat; trim so the *result* is visible for at least 12s of the 20s

**Save as:** `frontend/public/videos/check.mp4`
**Optional poster:** single frame of the result card

---

## Segment 03 — "Tell your agent" (agent + payment loop)

**Target:** 20s loop. The user pasting the "Tell your agent" prompt into an AI agent, and the agent paying + calling Agent 6211's `check_continuity` tool to flag a page.

**Why this segment:** the demo site (`frontend/`) already has a "How to use" section with the exact prompt + a Copy button. This loop is that section in motion — it shows the product as an OKX.AI ASP, not just a CLI.

**Capture target:** A terminal running any agent that supports x402 (Claude Code, Hermes, OpenClaw). The agent's response should show:
1. Recognizing the prompt and routing to Agent 6211
2. The x402 402 → 200 cycle (you can stub this if your agent doesn't have a funded wallet yet)
3. A few flags returned inline

**Prep (before pressing record):**
- Open Chrome at `http://localhost:3001` and scroll to the **How to use** section
- Click the **Copy prompt** button once (just to populate clipboard) — you don't need to record this
- Open your agent in a separate terminal. Make sure it's logged in and (ideally) has a funded test wallet
- Resize the agent terminal to roughly 900×500 — wide enough to read, fits in a 1080p frame next to the demo site
- Side-by-side layout: demo site on the left (How to use section visible), agent terminal on the right

**The prompt** (already in `frontend/src/components/HowToUse.tsx:8-14`):
```
I'd like to use the service provided by Agent 6211:

Service title: Continuity Check
Service type: A2MCP
Endpoint: https://mnemo-production-c4f1.up.railway.app/mcp

Please use OKX Agent Payments Protocol to send a request to this endpoint.
```

You'll also want to attach a page image so the agent has something to check. Either:
- Have the agent pick a page from a series directory you provide in the prompt, or
- Pre-paste the page path: `Image: data/series/lore-olympus/pages/ep003_p30.jpg`

**Record (~22s raw):**
1. Press record, wait 1s
2. Switch to the agent terminal
3. `↑ Enter` to re-send the prompt from history (have it preloaded)
4. Let the agent think and stream its response — the "I'll route this to Agent 6211..." beat is the story
5. When the response ends on a flag count (e.g. `2 flags found`), hold for ~3s — that's the loop seam
6. End on the flag summary line

**If your agent doesn't have a working x402 wallet yet:**
- Capture the agent *recognizing* the prompt and *attempting* the call. The 402 + retry cycle is still legible even if the final settle fails — viewers get the "agent paying for a tool call" story
- Or: do one successful dry run to capture the flag output as a screenshot, then loop that screenshot while the prompt is re-pasted

**Trim for seam:**
- Start on the prompt being pasted (or 0.3s before, so the first character registers)
- End on the static flag summary line, after the reader has time to see the count
- The transition from "pasted prompt" → "agent working" → "flag summary" is the whole story; trim so the *flag summary* is visible for at least 8s of the 20s

**Save as:** `frontend/public/videos/agent.mp4`
**Optional poster:** single frame of the agent's flag summary

---

## After all 3 are recorded

1. Drop the 3 files into `frontend/public/videos/`:
   - `watch.mp4` (Segment 01)
   - `check.mp4` (Segment 02)
   - `agent.mp4` (Segment 03)
2. (Optional) drop poster JPGs in the same folder: `watch-poster.jpg`, `check-poster.jpg`, `agent-poster.jpg`
3. Edit `frontend/src/components/VideoCards.tsx` and flip each `ready: false` to `ready: true`
4. `cd frontend && npm run build` to verify
5. Reload `http://localhost:3001` — videos should autoplay, mute, loop, and pause when scrolled out of view (40% threshold)

**File-size budget:** keep each clip under ~2 MB. 20s at 1080p30, CRF 20, lands around 1–2 MB. Anything larger and the homepage's total payload gets heavy.

**If a clip looks bad on loop:** the seam is where the first and last frames meet. Trim more off whichever side has the visible "join" — usually the start (mouse cursor entering) or the end (mouse leaving). A perfectly trimmed loop has no visible seam at all.

---

## Recording tips (carry over from full demo script)

- **Resolution:** 1920×1080, fullscreen app/window — not the desktop
- **Window:** Close other tabs, hide the taskbar on the recorded side if possible
- **Cursor:** Default cursor reads fine on dark backgrounds; no need for a highlight tool
- **Timing:** Real output > fast cuts. The 3–8s Gemini call is a feature, not a bug — it proves the product is live
- **Takes:** If a take is bad, just re-record that one segment. Don't try to fix in post.

---

## CLI reference (quick)

```powershell
# Help
npm run mnemo -- help

# Live API — 4 pages, paced for ~20s
npm run mnemo -- watch --series lore-olympus --pages p01,p05,p08,p12 --delay 4000

# Replay (cached, no API) — same 4 pages
npm run mnemo -- watch --series lore-olympus --pages p01,p05,p08,p12 --replay scripts/demo-replay.json --delay 4000

# Live API with retry + slower pacing (free-tier safe)
npm run mnemo -- watch --series lore-olympus --pages p01,p05,p08,p12 --retries 3 --delay 15000

# Single page sanity check
npm run mnemo -- watch --series lore-olympus --pages p01
```
