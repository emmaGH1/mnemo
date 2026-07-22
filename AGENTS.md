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

## Demo site

The demo-site/ directory is a separate Next.js project for the premium demo website.

```bash
cd demo-site
npm run dev          # Start Next.js on port 3001
npm run build        # Production build
```

The API rewrites to localhost:3000 (the Express server). Start both: 
npm run dev in both root and demo-site/.

