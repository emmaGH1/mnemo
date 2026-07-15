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
│   ├── checker.ts      # Core checkContinuity() function (Gemini 2.5 Flash)
│   ├── server.ts       # Express API — POST /check, GET /health
│   ├── test.ts         # Proof-of-concept test runner
│   └── types.ts        # Shared TypeScript types
├── data/
│   └── canon.json      # Test series canon doc ("Echoes of Aria")
├── test-images/
│   ├── page_clean.png          # Page with no contradictions
│   └── page_contradiction.png  # Page with seeded eye-color contradiction
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
Returns `{ "status": "ok", "model": "gemini-2.5-flash" }`.

---

## Canon document schema

See [`data/canon.json`](data/canon.json) for the full example. Key sections:

- **`characters[]`** — physical attributes (eye color, hair, scars…) with establishing episode/panel
- **`events[]`** — named story events and participants
- **`locations[]`** — named locations and their current status

---

## Model choice

`gemini-2.5-flash` — best balance of vision capability, reasoning, and cost-efficiency at the free tier (upgraded from the `gemini-2.0-flash` template). Gemini 2.0 Flash was deprecated June 2026.
