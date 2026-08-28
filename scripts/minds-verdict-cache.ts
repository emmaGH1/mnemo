// minds-verdict-cache.ts — cache REAL Mind verdicts for the seeded feed.
//
// Runs the Mind over every comment in seed-comments.json at reader_episode=1
// (the strictest baseline — any revealed fact counts) and writes the result to
// verdicts.json. Progress-relative blur is derived at render time via
// effectiveVerdict() (C5/b eat-8). Resumable: already-cached comment_ids are
// skipped, so an interrupted run can just be restarted.
import * as fs from "fs";
import * as path from "path";
import { moderate, type CachedVerdict, type ModerationVerdict } from "../src/moderation.js";

const DIR = path.resolve(__dirname, "..", "data", "series", "lore-olympus");
const SEED_PATH = path.join(DIR, "seed-comments.json");
const VERDICTS_PATH = path.join(DIR, "verdicts.json");
const BASELINE = 1;

interface SeedComment {
  id: string;
  text: string;
}

async function main(): Promise<void> {
  const seeds = (JSON.parse(fs.readFileSync(SEED_PATH, "utf-8")).comments as SeedComment[]);
  const existing: CachedVerdict[] = fs.existsSync(VERDICTS_PATH)
    ? (JSON.parse(fs.readFileSync(VERDICTS_PATH, "utf-8")).verdicts as CachedVerdict[])
    : [];
  const done = new Set(existing.map((v) => v.comment_id));
  const pending = seeds.filter((c) => !done.has(c.id));

  console.log(`seeded comments: ${seeds.length} | cached: ${done.size} | pending: ${pending.length}`);
  if (pending.length === 0) {
    console.log("nothing to do — all comments already cached");
    return;
  }

  const verdicts = [...existing];
  for (const c of pending) {
    const t0 = Date.now();
    try {
      const r = await moderate(c.text, BASELINE);
      const record: CachedVerdict = {
        comment_id: c.id,
        computed_at_reader_episode: BASELINE,
        verdict: r.verdict,
        reason: r.reason,
      };
      if (r.spoils_episode != null) record.spoils_episode = r.spoils_episode;
      verdicts.push(record);
      fs.writeFileSync(VERDICTS_PATH, JSON.stringify({ series_id: "lore-olympus", computed_at_reader_episode: BASELINE, verdicts }, null, 2) + "\n");
      console.log(`cached ${c.id} → ${record.verdict}${record.spoils_episode != null ? " spoils_ep=" + record.spoils_episode : ""} (${Date.now() - t0}ms)`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.log(`ERROR ${c.id}: ${msg} — left uncached, rerun to retry`);
    }
  }

  const counts: Record<string, number> = {};
  for (const v of verdicts) counts[v.verdict] = (counts[v.verdict] ?? 0) + 1;
  const verdictLabels = Object.entries(counts).map(([k, n]) => `${k}:${n}`).join("  ");
  console.log(`\nverdicts.json now has ${verdicts.length} records — ${verdictLabels}`);
}

main();
