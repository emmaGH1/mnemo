import * as fs from "fs";
import * as path from "path";
import sharp from "sharp";
import { prepareImageForModel } from "../src/checker.js";

async function main(): Promise<void> {
  const imgPath = path.resolve(__dirname, "..", "test-images", "page_contradiction.png");
  const b64 = fs.readFileSync(imgPath).toString("base64");
  const inMeta = await sharp(Buffer.from(b64, "base64")).metadata();
  console.log("in", inMeta.width, "x", inMeta.height, "b64", b64.length);

  const t0 = Date.now();
  const r = await prepareImageForModel(b64, "image/png");
  console.log("prep_ms", Date.now() - t0);
  console.log("out_b64", r.base64.length, "mime", r.mimeType);
  const outMeta = await sharp(Buffer.from(r.base64, "base64")).metadata();
  console.log("out", outMeta.width, "x", outMeta.height, "format", outMeta.format);
  const longest = Math.max(outMeta.width ?? 0, outMeta.height ?? 0);
  if (longest > 1536) {
    console.error("FAIL: longest edge still > 1536");
    process.exit(1);
  }
  if (r.mimeType !== "image/jpeg" && r.mimeType !== "image/webp") {
    console.error("FAIL: expected image/jpeg or image/webp after re-encode, got " + r.mimeType);
    process.exit(1);
  }
  if (r.base64.length >= b64.length) {
    console.error("FAIL: expected smaller payload");
    process.exit(1);
  }
  console.log("PASS");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
