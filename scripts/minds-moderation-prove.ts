// minds-moderation-prove.ts — C4 HARD GATE: prove all four moderation verdicts
// live against the Mind in a terminal. Requires the canon to have been seeded
// (npm run minds:gate seed). Exits non-zero if any verdict is wrong.
import { moderate } from "../src/moderation.js";

interface Case {
  label: string;
  comment: string;
  readerEpisode: number;
  expect: "safe" | "spoiler" | "lore_question" | "contradiction";
  expectSpoilsEpisode?: number;
}

const CASES: Case[] = [
  {
    label: "safe (no canon content)",
    comment: "the art this chapter was gorgeous, especially the lighting in the last panel",
    readerEpisode: 30,
    expect: "safe",
  },
  {
    label: "spoiler — ep 47 reveal, reader on 30",
    comment: "hades literally vowed to protect persephone from apollo when she moved into the underworld, i'm crying",
    readerEpisode: 30,
    expect: "spoiler",
    expectSpoilsEpisode: 47,
  },
  {
    label: "SAME spoiler comment, reader on 50 → must be safe (beat 8 logic)",
    comment: "hades literally vowed to protect persephone from apollo when she moved into the underworld, i'm crying",
    readerEpisode: 50,
    expect: "safe",
  },
  {
    label: "early fact (kiss ep 25), reader on 30 → safe",
    comment: "finally!! their first kiss, this ship is real",
    readerEpisode: 30,
    expect: "safe",
  },
  {
    label: "lore_question",
    comment: "what colour are persephone's eyes and which episode established that?",
    readerEpisode: 30,
    expect: "lore_question",
  },
  {
    label: "contradiction — Minthe & Hades married",
    comment: "i love that minthe and hades are happily married, true endgame",
    readerEpisode: 30,
    expect: "contradiction",
  },
  {
    label: "contradiction — Demeter approves of the Underworld",
    comment: "demeter is totally fine with persephone living in the underworld, she supports it",
    readerEpisode: 30,
    expect: "contradiction",
  },
];

async function main(): Promise<void> {
  let failures = 0;
  for (const c of CASES) {
    const t0 = Date.now();
    try {
      const r = await moderate(c.comment, c.readerEpisode);
      const ms = Date.now() - t0;
      const ok =
        r.verdict === c.expect &&
        (c.expectSpoilsEpisode == null ||
          (r.spoils_episode != null && r.spoils_episode === c.expectSpoilsEpisode));
      const spoils = r.spoils_episode != null ? ` spoils_ep=${r.spoils_episode}` : "";
      console.log(
        `${ok ? "PASS" : "FAIL"}  [${c.label}] → ${r.verdict}${spoils} (${ms}ms)\n      reason: ${r.reason}`
      );
      if (!ok) {
        console.log(
          `      expected: ${c.expect}${c.expectSpoilsEpisode ? " spoils_ep=" + c.expectSpoilsEpisode : ""}`
        );
        failures++;
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.log(`ERROR [${c.label}] → ${msg}`);
      failures++;
    }
  }
  console.log(failures === 0 ? "\nGATE PASSED — all four verdicts proven" : `\nGATE FAILED — ${failures} case(s) wrong`);
  process.exit(failures === 0 ? 0 : 1);
}

main();
