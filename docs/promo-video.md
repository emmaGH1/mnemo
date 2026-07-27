# Mnemo social promo video — production kit

**Goal:** ~50–55s SaaS-style brand/demo video for X, LinkedIn, YouTube.  
**Style target:** Supahub-class *edit grammar* (kinetic type, snappy beats, framed UI) — not a frame-for-frame copy.  
**Editor:** CapCut Desktop (primary). Optional: Jitter.video for floating title cards.  
**Reference (structure only):** `frontend/public/Best SaaS Marketing Video _ Promotional Brand Video _ Supahub.mp4` (~57s, 1280×720).

Do **not** re-upload or re-brand the Supahub file. Imitate pacing and layout language only.

---

## 1. Locked beat sheet (master, 0:52)

| # | Time | Beat | On-screen text (primary) | Picture | Audio cue |
|---|------|------|--------------------------|---------|-----------|
| 1 | 0:00–0:04 | Hook | **Eyes change. Outfits drift.** | Black field + hard type; optional micro-crop of broken continuity | Music hit on first word |
| 2 | 0:04–0:08 | Agitate | **Canon forgets.** | Before/after or split panels (`before-and-after-reference.png`, `sample-page`) | Whoosh into still |
| 3 | 0:08–0:14 | Intro | **Mnemo** · *Continuity, kept.* | Logo (`logo-with-name.jpg` / `listing-avatar.jpg`) on black | Soft drop; logo settle |
| 4 | 0:14–0:24 | Demo A | **Catch every break.** | Browser-framed crop of `check.mp4` (flag moment only) | Tick / soft riser |
| 5 | 0:24–0:28 | Label A | **Severity · field · panel ref** | Freeze or slow push on a single flag line | Stinger |
| 6 | 0:28–0:38 | Demo B | **Tell your agent.** | Browser-framed crop of `agent.mp4` (pay / tools call) | Steady bed |
| 7 | 0:38–0:42 | Label B | **0.1 USDT · x402 · no API key** | Kinetic chips over black or dimmed UI | Three ticks |
| 8 | 0:42–0:48 | Demo C | **Memory that ships.** | Crop of `watch.mp4` or live-log aesthetic | Light whoosh |
| 9 | 0:48–0:52 | CTA | **Try Agent 6211** · okx.ai/agents/6211 | Logo end card + URL | Music resolve |

**Total:** 52s. Stretch any demo beat +1–2s if music needs a bar; never stretch the hook.

### Social rules

- First **2 seconds work muted** (big type only).
- Prefer **on-screen type over voiceover** for X/LinkedIn.
- Safe margins: keep titles ~8% in from edges (X UI chrome).
- Export master **1920×1080**; optional vertical remaster later.

---

## 2. On-screen copy pack (paste into CapCut)

### Primary set (use this)

| Slot | Line | Notes |
|------|------|--------|
| Hook 1 | Eyes change. Outfits drift. | Two short sentences; line break after period |
| Hook 2 | Canon forgets. | One punch line, larger type |
| Brand | Mnemo | Wordmark or logo lockup |
| Tagline | Continuity, kept. | Matches site / listing |
| Feature A | Catch every break. | Over check demo |
| Feature A sub | Eye color · hair · outfit · props | Optional second line, smaller |
| Feature B | Tell your agent. | Over agent demo |
| Feature B sub | 0.1 USDT · x402 · no API key | Chip style works well |
| Feature C | Memory that ships. | Over watch / live log |
| Stack | OKX.AI · MCP · structured JSON | Optional 0:46–0:48 insert if you need proof |
| CTA | Try Agent 6211 | Primary CTA |
| URL | okx.ai/agents/6211 | Same card as CTA |

### Alternate hooks (A/B)

1. Serialized art forgets. Mnemo doesn’t.  
2. 200 episodes. One continuity source of truth.  
3. Your agent pays. You get the flags.

### Optional VO (only if you want voice)

~80 words · ~50s · ~140 wpm:

> Serialized webtoons forget. Eyes drift. Outfits mutate. Props vanish between episodes.  
> Mnemo is the memory layer for comic and webtoon art. Drop a page — get every continuity break back as structured JSON.  
> Any agent that speaks x402 can pay one tenth of a USDT and call Agent 6211. No account. No API key.  
> Continuity, kept. Try Agent 6211.

Generate with ElevenLabs → export WAV → drop under music at −12 to −18 dB under the bed.

---

## 3. Shot list & source assets

### Already in repo

| Asset | Path | Use in beat |
|-------|------|-------------|
| Check demo | `frontend/public/videos/check.mp4` | #4–5 |
| Agent demo | `frontend/public/videos/agent.mp4` | #6–7 |
| Watch demo | `frontend/public/videos/watch.mp4` | #8 |
| Before/after still | `frontend/public/before-and-after-reference.png` | #2 |
| Sample page | `frontend/public/sample-page.jpg` (or `.png`) | #2 |
| Logo + name | `frontend/public/logo-with-name.jpg` | #3, #9 |
| Square logo | `frontend/public/listing-avatar.jpg` | #9 end card |

### How to use product clips (critical)

Do **not** play full-length demos. In CapCut:

1. Import clip → **split** to the single moment of truth (flag appears / payment settles / log updates).  
2. Keep **4–8s max** per demo beat.  
3. **Crop** tight on the UI region that sells the idea (report list, flag text, prompt).  
4. Drop into a **browser frame** template (search CapCut: “browser mockup”, “Safari window”, “dark UI frame”).  
5. Background under the frame: pure black or subtle noise — match the marketing site.

### Optional re-records (if current clips feel soft)

| Shot | Spec | Why |
|------|------|-----|
| Flag pop | 1080p, 5s, cursor still, one HIGH severity flag entering | Cleaner than scrolling noise |
| Agent pay | 1080p, 6s, x402 success / JSON-RPC result visible | Trust for crypto-native audience |
| Before/after still | Same character, eye or hair wrong vs right, side-by-side | Stronger mute hook |

No faces of real people required. No secrets, keys, or wallet seed material on screen.

---

## 4. CapCut assembly (step-by-step)

### Project setup

1. CapCut Desktop → New project → **16:9 · 1920×1080 · 30 fps**.  
2. Import music first (100–120 BPM tech/electronic).  
3. Use **Beat sync / mark beats** on downbeats for cuts.  
4. Create 9 empty **text placeholder** clips matching the beat table times.

### Template search keywords (CapCut library)

Use these exact-ish searches:

- `kinetic typography dark`  
- `SaaS promo` / `app promo` / `product promo`  
- `browser mockup` / `website showcase`  
- `logo reveal black`  
- `modern tech intro`  
- `lower third minimal`  
- `glitch text` (hook only — use sparingly)

If free templates feel weak: one month of **Envato Elements** or **Motion Array** → “SaaS explainer” / “product demo after effects” packs (export preview MP4s into CapCut if you don’t run AE).

### Jitter hybrid (optional polish)

In [Jitter](https://jitter.video):

- Build beats **#1, #3, #7, #9** as floating type + logo cards (soft shadow, springy ease).  
- Export transparent or black-bg MP4 → place in CapCut timeline.  
- Keep product demos in CapCut only.

### Audio levels (starting point)

| Layer | Level |
|-------|--------|
| Music bed | 0 dB reference, dip −3 to −6 under dense type |
| VO (if any) | Peaks ~−6 dB; duck music under speech |
| Whooshes / ticks | Short; never louder than music peak |

### Export

- Format: MP4 · H.264 · 1080p · high bitrate  
- Filename suggestion: `mnemo-promo-v1-52s.mp4`  
- Also export a **0:00–0:15 cutdown** for X feed tests: hook → logo → one demo → CTA

### Platform cutdowns

| Platform | Length | Notes |
|----------|--------|--------|
| X | 15–30s + full | Captions burned in; muted-first hook |
| LinkedIn | Full 52s | Captions; slightly slower if needed |
| YouTube | Full | Description: Agent 6211 + endpoint blurb |

---

## 5. Scene-by-scene storyboard

### Scene 1 — Hook (0:00–0:04)

```
┌──────────────────────────────────────────┐
│  BLACK                                   │
│                                          │
│     Eyes change.                         │
│     Outfits drift.                       │
│                                          │
│  (type snaps on beat; white, huge)       │
└──────────────────────────────────────────┘
```

### Scene 2 — Agitate (0:04–0:08)

```
┌────────────────────┬─────────────────────┐
│  BEFORE            │  AFTER / WRONG      │
│  (canon-correct    │  (eye/hair drift    │
│   panel crop)      │   panel crop)       │
├────────────────────┴─────────────────────┤
│           Canon forgets.                 │
└──────────────────────────────────────────┘
```

### Scene 3 — Intro (0:08–0:14)

```
┌──────────────────────────────────────────┐
│              [ MNEMO LOGO ]              │
│                                          │
│          Continuity, kept.               │
└──────────────────────────────────────────┘
```

### Scene 4–5 — Check demo (0:14–0:28)

```
┌──────────────────────────────────────────┐
│  ┌─ browser chrome ───────────────────┐  │
│  │   check.mp4  (cropped flag list)   │  │
│  └────────────────────────────────────┘  │
│  Catch every break.                      │
│  Severity · field · panel ref            │
└──────────────────────────────────────────┘
```

### Scene 6–7 — Agent demo (0:28–0:42)

```
┌──────────────────────────────────────────┐
│  ┌─ browser chrome ───────────────────┐  │
│  │   agent.mp4  (pay / tools call)    │  │
│  └────────────────────────────────────┘  │
│  Tell your agent.                        │
│  [ 0.1 USDT ] [ x402 ] [ no API key ]    │
└──────────────────────────────────────────┘
```

### Scene 8 — Watch / memory (0:42–0:48)

```
┌──────────────────────────────────────────┐
│  watch.mp4 crop or live-log lines        │
│  Memory that ships.                      │
└──────────────────────────────────────────┘
```

### Scene 9 — CTA (0:48–0:52)

```
┌──────────────────────────────────────────┐
│              [ LOGO ]                    │
│         Try Agent 6211                   │
│       okx.ai/agents/6211                 │
└──────────────────────────────────────────┘
```

---

## 6. Success checklist

- [ ] Master is 45–60s (target ~52s) at 1080p  
- [ ] 0:00–0:02 readable with sound off  
- [ ] At least two real product moments (check + agent)  
- [ ] One CTA + one URL, readable on mobile  
- [ ] Music cleared for commercial social use  
- [ ] No Supahub branding, copy, or footage  
- [ ] Type system consistent (one sans family, white on black)

---

## 7. After v1 ships (optional)

1. Cut **15s** and **30s** variants from the same timeline.  
2. A/B hook lines from §2.  
3. If you want code-driven re-renders later: scaffold Remotion with the same 9 beats — not required for first ship.

---

## Quick start (today)

1. Install **CapCut Desktop**.  
2. Import music + the three demo mp4s + logo + before/after still.  
3. Lay **9 text cards** at the times in §1.  
4. Drop product crops into browser frames for beats 4 and 6.  
5. Export `mnemo-promo-v1-52s.mp4` and a 15s cutdown.

If you want help next: re-record tight UI takes (shot list in §3), refine VO in ElevenLabs, or scaffold a Remotion re-render project from this beat sheet.
