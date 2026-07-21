# Mnemo — Webtoon Continuity Checker

> **OKX.AI Hackathon ASP** — Core continuity detection proof-of-concept

Mnemo receives a **canon document** (accumulated series memory) and a **new page image**, then uses Gemini 2.5 Flash to detect continuity contradictions and propose canon additions — all as structured JSON.

---

## Quick start

```bash
# 1. Clone / open
cd mnemo

# 2. Install
npm install

# 3. Set your API key (get it free at https://aistudio.google.com/apikey)
cp .env.example .env
# → edit .env and paste your GEMINI_API_KEY

# 4. Run the proof-of-concept tests
npm run test:continuity

# 5. (Optional) Start the Express API server
npm run dev
```

---

## Project structure

```
mnemo/
├── src/
│   ├── checker.ts         # Core checkContinuity() function (Gemini 2.5 Flash)
│   ├── check-handler.ts   # runCheck() — loads canon, calls checker
│   ├── resolve-canon.ts   # File-per-series canon storage
│   ├── server.ts          # Express API — POST /check, POST /mcp (x402-gated)
│   ├── test.ts            # Proof-of-concept test runner
│   ├── test-server.ts     # Payment gate integration tests
│   └── types.ts           # Shared TypeScript types
├── scripts/
│   ├── scrape-webtoon.ts  # Scrape Webtoon series metadata + page images
│   └── build-canon.ts     # Generate canon.json from scraped data via Gemini
├── data/
│   ├── canon.json          # Legacy test series canon doc ("Echoes of Aria")
│   └── series/             # File-per-series storage (one folder per series)
├── test-images/
│   ├── page_clean.png
│   └── page_contradiction.png
├── .env.example
└── tsconfig.json
```

---

## API

### `POST /check`

Multipart form data:

| Field        | Type   | Required | Description                                        |
|--------------|--------|----------|----------------------------------------------------|
| `page_image` | file   | ✅       | PNG/JPEG of the new webtoon page                   |
| `canon`      | text   | ❌       | JSON string of the canon doc (uses default if omitted) |
| `series_id`  | text   | ❌       | Load canon from `data/series/<id>/canon.json`      |
| `dialogue`   | text   | ❌       | Raw script/dialogue text for this page             |

**Response** (`application/json`):
```json
{
  "flags": [
    {
      "severity": "high",
      "character": "Aria Voss",
      "field": "eye_color",
      "canon_value": "blue",
      "new_value": "green",
      "ep_ref": 1,
      "panel_ref": 2,
      "explanation": "Aria's eyes appear green on this page but were established as ice-blue in Episode 1, Panel 2."
    }
  ],
  "canon_additions": []
}
```

### `GET /health`
Returns `{ "status": "ok", "model": "gemini-2.5-flash", "series": [...] }`.

---

## Canon document schema

See [`data/canon.json`](data/canon.json) for the full example. Key sections:

- **`characters[]`** — physical attributes (eye color, hair, scars…) with establishing episode/panel
- **`events[]`** — named story events and participants
- **`locations[]`** — named locations and their current status

---

## Scraping a real Webtoon

```bash
# 1. Scrape series metadata + page images
npx tsx scripts/scrape-webtoon.ts "https://www.webtoons.com/en/fantasy/tower-of-god/list?title_no=95"

# 2. Generate canon.json from scraped data (uses Gemini)
npx tsx scripts/build-canon.ts tower-of-god

# 3. Review & edit the canon (fill any gaps Gemini missed)
#    → edit data/series/tower-of-god/canon.json

# 4. Test continuity with a new page
npx tsx src/test.ts tower-of-god

# 5. Run the API against this series
npm run dev
# → POST /check with series_id=tower-of-god
```

**Scraper options:**
```
--episodes 1-5    Only scrape specific episodes
--no-images       Skip image download (metadata only)
--out <id>        Custom series_id (default: auto-generated from title)
```

## File-per-series storage

```
data/series/<series_id>/
├── series.json      # Series metadata (title, author, genre, summary)
├── episodes.json     # Episode list with titles and dates
├── scraped.json      # Per-episode image URLs extracted during scraping
├── pages/            # Downloaded page images (ep001_p01.jpg, ...)
└── canon.json        # Generated canon document (the AI memory)
```

The API loads canon from `data/series/<series_id>/canon.json` when you pass `series_id`.
The legacy `data/canon.json` still works as the default when no `series_id` is provided.

---

## Model choice

`gemini-2.5-flash` — best balance of vision capability, reasoning, and cost-efficiency at the free tier (upgraded from the `gemini-2.0-flash` template). Gemini 2.0 Flash was deprecated June 2026.
