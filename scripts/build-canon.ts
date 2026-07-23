// build-canon.ts — generate canon.json from scraped Webtoon data using Gemini
//
// Usage:
//   npx tsx scripts/build-canon.ts <series_id> [--episodes 1-5]
//
// Reads:  data/series/<id>/series.json
//         data/series/<id>/episodes.json
//         data/series/<id>/pages/  (optional, for visual extraction)
//
// Writes: data/series/<id>/canon.json
//
// Strategy:
//   1. Send series metadata + episode list to Gemini
//   2. Optionally send key page images for visual character/attribute extraction
//   3. Gemini returns structured CanonDoc JSON
//   4. Human reviews and fills in gaps manually

import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";
import { spawnSync } from "node:child_process";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { saveCanon } from "../src/resolve-canon.js";
import type { CanonDoc } from "../src/types.js";

dotenv.config();

const SERIES_ROOT = path.resolve(__dirname, "..", "data", "series");

const SYSTEM_PROMPT = `You are a canon document builder for webtoon/comic series. You will receive:
1. Series metadata (title, author, genre, summary)
2. Episode list (numbers, titles)
3. Optionally, a few key page images for visual analysis

Your job: produce a complete canon.json document for this series.

This canon will be used by a continuity checker to detect art/writing errors in new episodes. It must be ACCURATE and BASED ONLY ON WHAT YOU CAN OBSERVE.

Rules:
- ONLY include facts you can observe or infer confidently from the provided data.
- If you can see page images, extract character physical attributes (eye color, hair color, clothing, scars, tattoos, etc.) with their establishing episode/panel.
- If you CANNOT see images, still list characters by name (from episode titles/summary) but do NOT guess physical attributes — just mark those characters as discovered but pending visual extraction.
- Events should reference real episode numbers from the episode list.
- Locations should be named places mentioned in the summary or episode titles.
- If you're unsure about ANY value, do NOT include it. An incomplete canon is better than a wrong one.

Respond with ONLY valid JSON matching this schema (no markdown, no explanation):

{
  "series": "string",
  "version": 1,
  "last_updated_episode": number,
  "characters": [
    {
      "id": "slug",
      "name": "Full Name",
      "status": "main|supporting|antagonist|cameo",
      "physical": {
        "eye_color": { "value": "blue", "established_episode": 1, "established_panel": 2 },
        "hair_color": { "value": "black", "established_episode": 1, "established_panel": 1 }
      },
      "clothing_defaults": {
        "outfit_name": { "value": "description", "established_episode": 1, "established_panel": 1 }
      },
      "abilities": [
        { "name": "string", "description": "string", "established_episode": 1, "established_panel": 1 }
      ],
      "relationships": [
        { "with": "other_character_id", "type": "string", "established_episode": 1, "established_panel": 1, "notes": "string" }
      ]
    }
  ],
  "events": [
    {
      "id": "evt_001",
      "title": "string",
      "episode": 1,
      "panel_start": 1,
      "summary": "string",
      "participants": ["character_id"],
      "significance": "inciting_incident|major|minor|character_intro"
    }
  ],
  "locations": [
    {
      "id": "loc_001",
      "name": "string",
      "status": "standing|destroyed|unknown",
      "first_appearance_episode": 1,
      "notes": "string"
    }
  ]
}`;

function loadJSON(filePath: string): any {
  return JSON.parse(fs.readFileSync(filePath, "utf-8"));
}

function imageToBase64(filePath: string): string {
  return fs.readFileSync(filePath).toString("base64");
}

async function main(): Promise<void> {
  const seriesId = process.argv[2];
  if (!seriesId) {
    console.error("Usage: npx tsx scripts/build-canon.ts <series_id> [--episodes 1-3]");
    process.exit(1);
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("GEMINI_API_KEY not set in .env");
    process.exit(1);
  }

  const seriesDir = path.join(SERIES_ROOT, seriesId);
  if (!fs.existsSync(seriesDir)) {
    console.error(`Series directory not found: ${seriesDir}`);
    console.error("Run scrape-webtoon.ts first.");
    process.exit(1);
  }

  const seriesJSON = path.join(seriesDir, "series.json");
  const episodesJSON = path.join(seriesDir, "episodes.json");
  const pagesDir = path.join(seriesDir, "pages");

  if (!fs.existsSync(seriesJSON)) {
    console.error("series.json not found — run scrape-webtoon.ts first.");
    process.exit(1);
  }

  const seriesMeta = loadJSON(seriesJSON);
  const episodes = fs.existsSync(episodesJSON) ? loadJSON(episodesJSON) : [];

  console.log(`\n🧠  Building canon doc for "${seriesMeta.title}" [${seriesId}]`);
  console.log(`   Episodes available: ${episodes.length}`);
  console.log(`   Pages available: ${fs.existsSync(pagesDir) ? fs.readdirSync(pagesDir).length : 0}\n`);

  // ── Build the analysis prompt ──
  let analysisPrompt = "Build a canon.json for this webtoon series:\n\n";
  analysisPrompt += `## Series Metadata\n${JSON.stringify(seriesMeta, null, 2)}\n\n`;

  if (episodes.length > 0) {
    // Filter episodes if range specified
    const epArgIdx = process.argv.indexOf("--episodes");
    let epRange: { start: number; end: number } | null = null;
    if (epArgIdx !== -1) {
      const raw = process.argv[epArgIdx + 1];
      const m = raw?.match(/^(\d+)(?:-(\d+))?$/);
      if (m) {
        epRange = { start: Number(m[1]), end: Number(m[2]) || Number(m[1]) };
      }
    }

    const filtered = epRange
      ? episodes.filter(
          (e: any) => e.no >= epRange!.start && e.no <= epRange!.end
        )
      : episodes;

    analysisPrompt += `## Episode List (${filtered.length} episodes)\n`;
    for (const ep of filtered) {
      analysisPrompt += `- Ep ${ep.no}: "${ep.title}" (${ep.date})\n`;
    }
  }

  analysisPrompt += `\nLast updated episode: ${episodes.length > 0 ? episodes[episodes.length - 1].no : 1}`;

  // Load up to 3 key page images for visual extraction
  const imageParts: any[] = [{ text: analysisPrompt }];

  if (fs.existsSync(pagesDir)) {
    const pageFiles = fs
      .readdirSync(pagesDir)
      .filter((f) => /\.(jpg|png|jpeg)$/i.test(f))
      .sort()
      .slice(0, 9); // limit to 9 images

    if (pageFiles.length > 0) {
      console.log(`   Sending ${pageFiles.length} page images for visual analysis...\n`);
      for (const file of pageFiles) {
        const b64 = imageToBase64(path.join(pagesDir, file));
        const mime = file.endsWith(".png") ? "image/png" : "image/jpeg";
        imageParts.push({
          inlineData: { mimeType: mime, data: b64 },
        });
      }
    }
  }

  // ── Call Gemini (with model fallback for legacy/new API-key compatibility) ──
  console.log("⏳  Generating canon...\n");

  // ponytail: same fallback list as checker.ts — legacy keys get 2.5-flash,
  // new keys may 404 there and silently fall through to lite/latest.
  const MODEL_FALLBACKS = [
    "gemini-2.5-flash",
    "gemini-2.5-flash-lite",
    "gemini-flash-latest",
  ];

  const generationConfig = {
    responseMimeType: "application/json",
    responseSchema: {
      type: "object",
      properties: {
        series: { type: "string" },
        version: { type: "integer" },
        last_updated_episode: { type: "integer" },
        characters: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              name: { type: "string" },
              status: { type: "string", enum: ["main", "supporting", "antagonist", "cameo"] },
              physical: { type: "object" },
              clothing_defaults: { type: "object" },
              abilities: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    name: { type: "string" },
                    description: { type: "string" },
                    established_episode: { type: "integer" },
                    established_panel: { type: "integer" },
                  },
                },
              },
              relationships: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    with: { type: "string" },
                    type: { type: "string" },
                    established_episode: { type: "integer" },
                    established_panel: { type: "integer" },
                    notes: { type: "string" },
                  },
                },
              },
            },
          },
        },
        events: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              title: { type: "string" },
              episode: { type: "integer" },
              panel_start: { type: "integer" },
              summary: { type: "string" },
              participants: { type: "array", items: { type: "string" } },
              significance: {
                type: "string",
                enum: ["inciting_incident", "major", "minor", "character_intro"],
              },
            },
          },
        },
        locations: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              name: { type: "string" },
              status: { type: "string", enum: ["standing", "destroyed", "unknown"] },
              first_appearance_episode: { type: "integer" },
              notes: { type: "string" },
            },
          },
        },
      },
      required: ["series", "version", "last_updated_episode", "characters", "events", "locations"],
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;

  const genAI = new GoogleGenerativeAI(apiKey);
  let raw: string | undefined;
  let lastErr: unknown = null;
  for (const modelName of MODEL_FALLBACKS) {
    try {
      const model = genAI.getGenerativeModel({
        model: modelName,
        systemInstruction: SYSTEM_PROMPT,
        generationConfig,
      });
      const result = await model.generateContent(imageParts);
      raw = result.response.text();
      break;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (/404|not found|no longer available/i.test(msg)) {
        lastErr = e;
        continue;
      }
      throw e;
    }
  }
  if (raw == null) {
    const finalMsg = lastErr instanceof Error ? lastErr.message : String(lastErr);
    throw new Error(
      `No working Gemini model found. Tried: ${MODEL_FALLBACKS.join(", ")}\nLast error: ${finalMsg}`
    );
  }

  let canonDoc: CanonDoc;
  try {
    canonDoc = JSON.parse(raw) as CanonDoc;
    canonDoc.version = 1;
  } catch {
    console.error("Gemini returned non-JSON. Raw output:");
    console.error(raw.slice(0, 2000));
    process.exit(1);
  }

  // Save to file-per-series
  saveCanon(seriesId, canonDoc);

  console.log(`📖  Canon doc generated for "${canonDoc.series}"`);
  console.log(`   Characters: ${canonDoc.characters.length}`);
  console.log(`   Events:     ${canonDoc.events.length}`);
  console.log(`   Locations:  ${canonDoc.locations.length}`);
  console.log(`\n   Saved: data/series/${seriesId}/canon.json`);

  // ── Optional: run the test harness (src/test.ts) against the just-saved canon ──
  // ponytail: --test makes build-canon a single command for the recording:
  // "build canon → run tests → see results" all in one terminal scroll.
  if (process.argv.includes("--test")) {
    console.log(`\n🧪  Running continuity tests...\n`);
    // ponytail: --test runs against the Aria fixture in data/canon.json
    // (not the just-built series) — the test images are of Aria, not of the
    // scraped series. The series we built here is independent of the fixture.
    const result = spawnSync("npx", ["tsx", "src/test.ts"], {
      stdio: "inherit",
      shell: true,
    });
    if (result.status !== 0) {
      console.error(`\n   test harness exited with code ${result.status}`);
    }
  } else {
    console.log(`\n   Review & fill gaps manually, then test:`);
    console.log(`   npx tsx scripts/scrape-webtoon.ts <url> --episodes 2-2   (get more pages)`);
    console.log(`   npx tsx scripts/build-canon.ts ${seriesId}               (rebuild after more pages)`);
    console.log(`   npx tsx src/test.ts ${seriesId}                         (run continuity test)`);
    console.log(`   npx tsx scripts/build-canon.ts ${seriesId} --test       (build + test in one go)\n`);
  }
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
