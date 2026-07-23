// ponytail: one-shot helper to produce a square avatar from the landscape logo
// run from repo root:  node scripts/listing-assets.js
const path = require("path");
const sharp = require(path.join(__dirname, "..", "frontend", "node_modules", "sharp"));

const root = path.resolve(__dirname, "..");
const src = path.join(root, "frontend/public/logo-with-name.jpg");
const out = path.join(root, "frontend/public/listing-avatar.jpg");

(async () => {
  const m = await sharp(src).metadata();
  const size = Math.max(m.width, m.height); // 1408
  // Pad the landscape image into a square with the existing black background.
  // No scaling — preserves full logo fidelity.
  await sharp(src)
    .resize({
      width: size,
      height: size,
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 1 },
    })
    .jpeg({ quality: 92, mozjpeg: true })
    .toFile(out);
  console.log("wrote", out, "->", size, "x", size);
})();
