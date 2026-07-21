// local-check-ep3.ts — free local continuity check on a scraped ep 3 panel.
// Usage: npx tsx scripts/local-check-ep3.ts <panel-file>
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";
import { runCheck } from "../src/check-handler.js";
import type { CanonDoc } from "../src/types.js";

dotenv.config();

async function main(): Promise<void> {
  const panel = process.argv[2];
  if (!panel) { console.error("Usage: npx tsx scripts/local-check-ep3.ts <panel-file>"); process.exit(1); }

  const canon = JSON.parse(
    fs.readFileSync(path.resolve(__dirname, "..", "data", "series", "lore-olympus", "canon.json"), "utf-8")
  ) as CanonDoc;

  const img = fs.readFileSync(panel);
  const mime = panel.endsWith(".png") ? "image/png" : "image/jpeg";
  const result = await runCheck(img.toString("base64"), mime, canon, undefined, undefined, 3, 35);
  console.log(JSON.stringify(result, null, 2));
}

main().catch((err) => { console.error("Fatal:", err); process.exit(1); });
