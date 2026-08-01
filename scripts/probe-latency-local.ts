// Local latency breakdown for checkContinuity (OpenRouter only — no x402).
// Uses the same image as production probe-tools-call.ts.

import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

dotenv.config();

const IMG = path.resolve(__dirname, "..", "test-images", "page_contradiction.png");

async function main(): Promise<void> {
  const tAll = Date.now();
  const buf = fs.readFileSync(IMG);
  const b64 = buf.toString("base64");
  console.log("image_path", IMG);
  console.log("file_bytes", buf.length);
  console.log("base64_chars", b64.length);
  console.log("approx_image_payload_mb", (b64.length / 1e6).toFixed(2));

  const t0 = Date.now();
  const { checkContinuity, getActiveModel } = await import("../src/checker.js");
  const { loadCanon } = await import("../src/resolve-canon.js");
  console.log("import_ms", Date.now() - t0);

  const tCanon = Date.now();
  const canon = loadCanon("lore-olympus");
  console.log("loadCanon_ms", Date.now() - tCanon);
  console.log("canon_json_chars", JSON.stringify(canon).length);
  console.log("active_model_before", getActiveModel());
  console.log("OPENROUTER_API_KEY set?", Boolean(process.env.OPENROUTER_API_KEY));

  const tModel = Date.now();
  try {
    const result = await checkContinuity(canon, b64, "image/png");
    console.log("checkContinuity_ms", Date.now() - tModel);
    console.log("active_model_after", getActiveModel());
    console.log("flags", result.flags?.length ?? 0);
    console.log("canon_additions", result.canon_additions?.length ?? 0);
    console.log("result_preview", JSON.stringify(result).slice(0, 500));
  } catch (e: unknown) {
    console.log("checkContinuity_FAILED_ms", Date.now() - tModel);
    console.log("error", e instanceof Error ? e.message : String(e));
    if (e instanceof Error && e.stack) console.log(e.stack.split("\n").slice(0, 8).join("\n"));
  }
  console.log("total_local_ms", Date.now() - tAll);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
