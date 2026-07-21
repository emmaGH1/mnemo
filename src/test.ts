// ─────────────────────────────────────────────────────────────────────────────
// test.ts  — run both test images through checkContinuity and print results
// ─────────────────────────────────────────────────────────────────────────────

import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";
import { checkContinuity } from "./checker.js";
import { loadCanon } from "./resolve-canon.js";
import type { CanonDoc, ContinuityCheckResult } from "./types.js";

dotenv.config();

// ─── Paths ────────────────────────────────────────────────────────────────────
const ROOT = path.resolve(__dirname, "..");

// Load canon — uses data/canon.json (legacy) or pass a series_id arg to use file-per-series
const seriesId = process.argv[2] || undefined;

// The two test images (copied into test-images/ by the setup step below)
const CLEAN_IMAGE_PATH = path.join(ROOT, "test-images", "page_clean.png");
const CONTRADICTION_IMAGE_PATH = path.join(
  ROOT,
  "test-images",
  "page_contradiction.png"
);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function loadBase64(filePath: string): string {
  const buf = fs.readFileSync(filePath);
  return buf.toString("base64");
}

function printResult(label: string, result: ContinuityCheckResult): void {
  console.log("\n" + "═".repeat(70));
  console.log(`  TEST: ${label}`);
  console.log("═".repeat(70));

  if (result.flags.length === 0) {
    console.log("  ✅  flags: [] — No contradictions detected");
  } else {
    console.log(`  🚩  flags (${result.flags.length}):`);
    result.flags.forEach((f, i) => {
      console.log(`\n  [${i + 1}] ${f.severity.toUpperCase()} severity`);
      console.log(`      character  : ${f.character}`);
      console.log(`      field      : ${f.field}`);
      console.log(`      canon_value: ${f.canon_value}`);
      console.log(`      new_value  : ${f.new_value}`);
      if (f.ep_ref != null)
        console.log(`      established: Episode ${f.ep_ref}, Panel ${f.panel_ref ?? "?"}`);
      console.log(`      explanation: ${f.explanation}`);
    });
  }

  if (result.canon_additions.length === 0) {
    console.log("\n  ➕  canon_additions: [] — Nothing new to add");
  } else {
    console.log(`\n  ➕  canon_additions (${result.canon_additions.length}):`);
    result.canon_additions.forEach((a, i) => {
      console.log(`  [${i + 1}] type: ${a.type}`);
      console.log(`      data: ${JSON.stringify(a.data, null, 6).replace(/\n/g, "\n      ")}`);
    });
  }

  console.log();
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log("\n🎨  Mnemo — Webtoon Continuity Checker  (Gemini 2.5 Flash)");
  console.log("─".repeat(70));

  // Load canon
  const canonDoc: CanonDoc = loadCanon(seriesId);
  console.log(`\n📖  Loaded canon: "${canonDoc.series}" (last ep: ${canonDoc.last_updated_episode})${seriesId ? ` [series: ${seriesId}]` : " [legacy]"}`);

  // ── Test 1: Clean page (no contradiction expected) ──────────────────────
  console.log("\n⏳  Running TEST 1 — Clean page (expect empty flags)...");
  const cleanB64 = loadBase64(CLEAN_IMAGE_PATH);
  const cleanResult = await checkContinuity(
    canonDoc,
    cleanB64,
    "image/png",
    "I remember this place..."
  );
  printResult("CLEAN PAGE — no contradiction seeded", cleanResult);

  // Assertion
  if (cleanResult.flags.length === 0) {
    console.log("  ✔  PASS: Clean page correctly returned 0 flags.\n");
  } else {
    console.error(
      `  ✘  FAIL: Clean page returned ${cleanResult.flags.length} unexpected flag(s).\n`
    );
    process.exitCode = 1;
  }

  // ── Test 2: Contradiction page (eye color change expected) ───────────────
  console.log("⏳  Running TEST 2 — Contradiction page (expect 1 eye-color flag)...");
  const contraB64 = loadBase64(CONTRADICTION_IMAGE_PATH);
  const contraResult = await checkContinuity(
    canonDoc,
    contraB64,
    "image/png",
    "The signal... it's coming from here."
  );
  printResult("CONTRADICTION PAGE — Aria's eyes green instead of blue", contraResult);

  // Assertion: exactly one flag, for eye_color, referencing episode 1
  const eyeFlags = contraResult.flags.filter(
    (f) =>
      f.character.toLowerCase().includes("aria") &&
      f.field.toLowerCase().includes("eye")
  );

  if (eyeFlags.length >= 1 && eyeFlags[0].ep_ref === 1) {
    console.log(
      "  ✔  PASS: Contradiction page flagged Aria eye_color change (ep 1 reference).\n"
    );
  } else if (contraResult.flags.length >= 1) {
    console.warn(
      `  ⚠  PARTIAL: Got ${contraResult.flags.length} flag(s), but didn't match expected eye+aria+ep1 exactly. Review output above.\n`
    );
  } else {
    console.error("  ✘  FAIL: Contradiction page returned 0 flags — missed the eye color change.\n");
    process.exitCode = 1;
  }

  console.log("─".repeat(70));
  console.log("🏁  Tests complete.\n");
}

main().catch((err) => {
  console.error("\n💥  Fatal error:", err);
  process.exit(1);
});
