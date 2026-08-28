import { strict as assert } from "node:assert";
import * as fs from "node:fs";
import * as path from "node:path";
import { answerFromCanon } from "../src/canon-answer.js";
import { effectiveVerdict, type CachedVerdict } from "../src/moderation.js";
import { loadCanon } from "../src/resolve-canon.js";

const seriesDir = path.join(process.cwd(), "data", "series", "lore-olympus");
const verdicts = JSON.parse(
  fs.readFileSync(path.join(seriesDir, "verdicts.json"), "utf8")
).verdicts as CachedVerdict[];
const byId = new Map(verdicts.map((verdict) => [verdict.comment_id, verdict]));

const c18 = byId.get("c18");
const c19 = byId.get("c19");
assert(c18 && c19, "contradiction fixtures must exist");
assert.equal(effectiveVerdict(c18, 1).verdict, "safe");
assert.equal(effectiveVerdict(c18, 30).verdict, "contradiction");
assert.equal(effectiveVerdict(c19, 1).verdict, "safe");
assert.equal(effectiveVerdict(c19, 11).verdict, "contradiction");

const canon = loadCanon("lore-olympus");
const earlyAnswer = answerFromCanon(
  canon,
  "wait who is hecate exactly, is she related to hades?",
  1
);
assert.equal(earlyAnswer.facts.length, 0);
assert.equal(earlyAnswer.blocked_until_episode, 9);
assert(!/best.friend|intern/i.test(earlyAnswer.answer));

const unlockedAnswer = answerFromCanon(
  canon,
  "wait who is hecate exactly, is she related to hades?",
  9
);
assert(unlockedAnswer.facts.length > 0);
assert(unlockedAnswer.facts.every((fact) => fact.established_episode! <= 9));

console.log("SPOILER SAFETY CHECK PASSED");
