// check-moderation-cache.ts — runnable check for the C5 verdict cache and the
// progress-relative derivation that drives beat 8. Fails (exit 1) if any
// cached record is missing or any expected progress transition is wrong.
import * as fs from "fs";
import * as path from "path";
import { effectiveVerdict, type CachedVerdict } from "../src/moderation.js";

const DIR = path.resolve(__dirname, "..", "data", "series", "lore-olympus");
const seeds = JSON.parse(fs.readFileSync(path.join(DIR, "seed-comments.json"), "utf-8")).comments as {
  id: string;
  text: string;
}[];
const verdicts = JSON.parse(fs.readFileSync(path.join(DIR, "verdicts.json"), "utf-8")).verdicts as CachedVerdict[];

let failed = 0;

// 1. Every seeded comment has a cached verdict
for (const c of seeds) {
  if (!verdicts.some((v) => v.comment_id === c.id)) {
    console.log(`FAIL  missing cached verdict for ${c.id}`);
    failed++;
  }
}
console.log(`complete: ${verdicts.length}/${seeds.length} comments cached`);

// 2. Key progress transitions (the beat-8 machinery)
const expect = (commentId: string, reader: number, verdict: string, spoils?: number) => {
  const cached = verdicts.find((v) => v.comment_id === commentId);
  if (!cached) return;
  const r = effectiveVerdict(cached, reader);
  const ok = r.verdict === verdict && (spoils == null || r.spoils_episode === spoils);
  const got = `${r.verdict}${r.spoils_episode != null ? "[" + r.spoils_episode + "]" : ""}`;
  const want = `${verdict}${spoils != null ? "[" + spoils + "]" : ""}`;
  if (!ok) {
    console.log(`FAIL  ${commentId} @ep${reader}: got ${got}, want ${want}`);
    failed++;
  } else {
    console.log(`pass  ${commentId} @ep${reader} → ${got}`);
  }
};

console.log("\nbeat-8 transitions:");
expect("c11", 30, "spoiler", 47); // the anchor — blurs for a reader on 30
expect("c11", 50, "safe");        // SAME comment — un-blurs at 50
expect("c12", 30, "spoiler", 42);
expect("c13", 30, "spoiler", 49);
expect("c14", 10, "spoiler", 25); // first kiss blurs for a reader on 10
expect("c14", 30, "safe");        // ...but not for a reader on 30
expect("c05", 30, "safe");        // makeover (ep13) safe at 30
expect("c01", 30, "safe");        // benign stays safe
expect("c15", 30, "lore_question");
expect("c18", 30, "contradiction");

console.log(failed === 0 ? "\nCACHE CHECK PASSED" : `\nCACHE CHECK FAILED — ${failed} failure(s)`);
process.exit(failed === 0 ? 0 : 1);
