// C2 gate — prove the Mind holds canon across processes.
//   seed   → load canon, send it to the Mind in this process
//   recall → fresh process, ask a recall question, PASS/FAIL on the answer
import * as fs from "fs";
import * as path from "path";
import { tell } from "../src/minds.js";

const MIND_ID = "5470503e-f36b-1410-8466-00039ce7df11"; // mnemo
const ALIAS = "mnemo";
const CANON_PATH = path.resolve(
  __dirname,
  "..",
  "data",
  "series",
  "lore-olympus",
  "canon.json"
);

async function seed(): Promise<void> {
  const canon = fs.readFileSync(CANON_PATH, "utf-8");
  const prompt = [
    "You are Mnemo, the canon memory for the webtoon 'Lore Olympus'.",
    "Below is the current canon document. Remember every fact together with the",
    "episode and panel that established it. You will be asked recall questions",
    "about it later.",
    "Reply with a single short confirmation.",
    "",
    "=== CANON ===",
    canon,
  ].join("\n");
  const reply = await tell(ALIAS, MIND_ID, prompt, 180_000);
  console.log("[seed] Mind reply:", reply);
}

async function recall(): Promise<void> {
  const question =
    "What colour are Persephone's eyes and which episode established that?";
  const reply = await tell(ALIAS, MIND_ID, question, 180_000);
  console.log("[recall] Mind answer:", reply);
  const lower = reply.toLowerCase();
  const ok =
    /green/.test(lower) && /(episode|ep)\s*1|episode one|chapter\s*1/.test(lower);
  console.log(
    ok
      ? "PASS: cross-session memory holds → architecture A (Mind owns memory)"
      : "FAIL: no cross-session recall → architecture B (canon server-side, slice per call)"
  );
  process.exit(ok ? 0 : 1);
}

const cmd = process.argv[2];
if (cmd === "seed") {
  seed().catch((e) => {
    console.error(e);
    process.exit(1);
  });
} else if (cmd === "recall") {
  recall().catch((e) => {
    console.error(e);
    process.exit(1);
  });
} else {
  console.error("usage: npx tsx scripts/minds-gate.ts <seed|recall>");
  process.exit(2);
}
