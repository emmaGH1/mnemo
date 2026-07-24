// scripts/demo-3-flags-check.ts
//
// Runs checkContinuity 3 times on test-images/page_contradiction.png (the
// Aria eye-color fixture that the probe canary already proved returns a
// flag) and prints each result. Designed to be called by
// scripts/demo-3-flags.ps1.
//
// One command, 3 panels, 3 inconsistencies caught — enough for the second
// segment of the demo recording.

import * as dotenv from "dotenv";
import { checkContinuity } from "../src/checker.js";
import { loadCanon } from "../src/resolve-canon.js";
import * as fs from "node:fs";

dotenv.config();

const FIXTURE = "test-images/page_contradiction.png";

async function main() {
  const buf = fs.readFileSync(FIXTURE);
  const b64 = buf.toString("base64");
  const canon = loadCanon(undefined);

  let totalFlags = 0;

  for (let i = 1; i <= 3; i++) {
    console.log("");
    console.log("=".repeat(72));
    console.log(`  PANEL ${i} of 3   (fixture: ${FIXTURE})`);
    console.log("=".repeat(72));

    try {
      const result = await checkContinuity(canon, b64, "image/png");
      totalFlags += result.flags.length;

      if (result.flags.length === 0) {
        console.log("  (no flags — clean page)");
      } else {
        for (const f of result.flags) {
          const ep  = f.ep_ref  != null ? `ep ${f.ep_ref}`  : "ep ?";
          const pnl = f.panel_ref != null ? `panel ${f.panel_ref}` : "panel ?";
          console.log(
            `  [${f.severity.toUpperCase().padEnd(6)}] ${f.character} / ${f.field}`
          );
          console.log(
            `           canon: ${f.canon_value}  ->  page: ${f.new_value}`
          );
          console.log(
            `           ref:   ${ep}, ${pnl}`
          );
          console.log(
            `           why:   ${f.explanation}`
          );
        }
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("  ERROR:", msg);
    }
  }

  console.log("");
  console.log("=".repeat(72));
  console.log(`TOTAL FLAGS: ${totalFlags} across 3 panels`);
  console.log("=".repeat(72));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
