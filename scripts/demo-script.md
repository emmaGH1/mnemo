# Mnemo — Demo Video Script

## Setup (before recording)

```bash
# Terminal 1 — Express API (must start first)
cd mnemo
npm run dev
# → http://localhost:3000

# Terminal 2 — Demo site
cd mnemo/demo-site
npm run dev
# → http://localhost:3001
```

Open Chrome to `http://localhost:3001`. Ensure a fresh page load before recording.

---

## Script — ~130 seconds

### [0:00–0:10] — Hook
> **Visual:** Hero section — "Mnemo remembers. You create."
> **Narrator:** "Every webtoon artist knows the nightmare. You draw 500 panels and in episode 12, someone's eyes are the wrong color. Mnemo is a second brain for your comic — it watches every page so you never break your own story."

**Action:** Scroll slowly as you speak. Let the ambient glows and floating artifacts pan through frame.

### [0:10–0:30] — Site tour
> **Visual:** Scroll through Checker section
> **Narrator:** "This is the demo site. It's powered by Mnemo's ASP — an agent service that any AI agent can pay and use. But first, let's see what it actually does."

### [0:30–0:50] — Live checker: upload sample
> **Visual:** Click "try a Lore Olympus page" button. Wait 3–5 seconds for Gemini response.
### ⚠️ TIMING NOTE: Hold the shot. The loading spinner plus the result animation takes ~5–8 seconds. Let it breathe.
> **Narrator:** "I'll click this sample button — it's a page from Lore Olympus Episode 3. Mnemo has never seen this page. It will compare it against everything it knows from Episode 1 and 2."

**Action:** When results appear, pan down slowly to reveal the flag cards.

### [0:50–1:10] — Results
> **Visual:** The flag card: "HADES — eye_color (canon: gold; turns red when angry → page: white/light grey)" and "HADES — usual_attire (canon: dark formal suit → page: light-colored jacket/suit)"
> **Narrator:** "Two high-severity flags. Hades' eyes are canonically gold — but on this page they render as grey-white. His suit is dark in the canon — here it's light. These may be intentional stylistic choices, or they may be errors. The artist decides. Mnemo just raises the signal."

**Action:** Scroll down further to canon additions.

> **Narrator:** "And it's also learning. It noted new attributes — Hades' hair style, a new jacket — things the canon didn't have yet. Every check grows the memory."

### [1:10–1:30] — Watcher log
> **Visual:** Click "Watcher" in nav or scroll to Watcher section
> **Narrator:** "Now here's the real story. While the artist was drawing Episode 3, Mnemo was silently watching in the background. Nobody asked it to check. It just remembered."

**Action:** Scroll through the timeline. Point to the stats: "7 pages checked, 4 flags raised, 13 canon additions."

> **Narrator:** "7 pages from Episode 3 were automatically checked against the Episode 1–2 canon. It caught 4 issues. It learned 13 new facts. The artist never opened a dashboard. Mnemo just remembered."

### [1:30–1:45] — How it works / ASP pitch
> **Visual:** Scroll to "How it works" section. The 3 steps: Register → Watch → Alert
> **Narrator:** "Here's the model. You register your series. Mnemo builds a canon. Every new page is checked. Your agent pulls the alerts whenever you want."

**Action:** Scroll down to the MCP tools list.

> **Narrator:** "It's exposed as three MCP tools — check-continuity, register-series, get-alerts — all on one service. Each call costs $0.10 USDT via x402 on OKX.AI's ASP. Agents pay per thought."

### [1:45–1:55] — Close
> **Visual:** Back to hero ("Mnemo remembers. You create.")
> **Narrator:** "Mnemo is built on OKX.AI's Agentic Service Protocol — an MCP server with x402 payment gating, powered by Gemini 2.5 Flash. It remembers so you can create. OKX.AI Hackathon."

**Action:** Hold frame on hero for 2–3 seconds, then fade.

---

## Recording tips

- **Resolution:** 1920×1080, fullscreen browser
- **Window:** Close other tabs. Only the demo site visible
- **Cursor:** Use large cursor or cursor-highlight tool for clicks
- **Audio:** Clear voice, no background music over speech
- **Timing:** The Gemini API call during the checker demo takes 3–8 seconds. Let the loading state sit — it proves it's real and not pre-recorded
- **Fallback:** If the sample page doesn't return flags on a given day (Gemini is non-deterministic), try clicking it again. The sample is ep003_p30.jpg — 90% of runs produce flags
- **Takes:** Record the checker segment separately from the watcher log segment. Cut them together

## What to show if the API is down

If the checker returns an error (Gemini overloaded, 503):
- Skip the live demo section
- Focus on the watcher log (it's pre-populated, no API call needed)
- Show the code: open server.ts to show the MCP tool definition and x402 middleware
- Show the alert log JSON: `data/alerts/lore-olympus.json`

## Minimum viable 60-second cut

If you need a shorter version:
1. [0:00] Hero + hook (5s)
2. [0:05] Upload sample → loading (5s)
3. [0:10] Results — show flags (10s)
4. [0:20] Watcher log — stats + one flagged entry (10s)
5. [0:30] MCP tools — list them (8s)
6. [0:38] Close with tagline + "Built on OKX.AI ASP" (7s)
