// scrape-webtoon-id.ts — downloader for the ID-edition URL pattern.
// The English-edition APIs (titleCard/episodeList) are geo-blocked on this network;
// the ID-edition viewer pages work. This skips metadata APIs entirely.
//
// Usage:
//   npx tsx scripts/scrape-webtoon-id.ts <base> <title_no> <series_id> --episodes 1-3
// Example:
//   npx tsx scripts/scrape-webtoon-id.ts https://www.webtoons.com/id/romance/lore-olympus 2667 lore-olympus --episodes 1-3

import * as fs from "fs";
import * as path from "path";

const SERIES_ROOT = path.resolve(__dirname, "..", "data", "series");
const UA = { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" };

function parseEpRange(raw: string): { start: number; end: number } {
  const m = raw.match(/^(\d+)(?:-(\d+))?$/);
  if (!m) throw new Error(`bad --episodes range: ${raw}`);
  return { start: Number(m[1]), end: m[2] ? Number(m[2]) : Number(m[1]) };
}

function extractImageUrls(html: string): string[] {
  const urls = new Set<string>();
  const re = /https:\/\/webtoon-phinf\.pstatic\.net\/[^"'\s<>&]+\.(?:jpg|png|jpeg)/gi;
  let m;
  while ((m = re.exec(html)) !== null) urls.add(m[0].replace(/\\u0026/g, "&"));
  // drop thumbnails/profile icons — page panels come from the episode image path
  return [...urls].filter((u) => !/\/(thumb|profile|icooon)\//i.test(u));
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main(): Promise<void> {
  const [base, titleNo, seriesId] = process.argv.slice(2);
  const epIdx = process.argv.indexOf("--episodes");
  if (!base || !titleNo || !seriesId || epIdx === -1) {
    console.error("Usage: npx tsx scripts/scrape-webtoon-id.ts <base> <title_no> <series_id> --episodes 1-3");
    process.exit(1);
  }
  const range = parseEpRange(process.argv[epIdx + 1]);

  const outDir = path.join(SERIES_ROOT, seriesId);
  const pagesDir = path.join(outDir, "pages");
  fs.mkdirSync(pagesDir, { recursive: true });

  const epMetas: { no: number; title: string }[] = [];
  let totalPages = 0;

  for (let ep = range.start; ep <= range.end; ep++) {
    const viewerUrl = `${base}/episode-${ep}/viewer?title_no=${titleNo}&episode_no=${ep}`;
    process.stdout.write(`   Ep ${ep}: fetching viewer ... `);
    const res = await fetch(viewerUrl, { headers: { ...UA, Referer: `${base}/list?title_no=${titleNo}` } });
    if (!res.ok) { console.log(`HTTP ${res.status} — skipped`); continue; }
    const html = await res.text();

    const titleMatch = html.match(/<title>([^<|]+)/);
    epMetas.push({ no: ep, title: titleMatch ? titleMatch[1].trim() : `Episode ${ep}` });

    const imageUrls = extractImageUrls(html);
    process.stdout.write(`${imageUrls.length} panels ... `);

    let downloaded = 0;
    for (let i = 0; i < imageUrls.length; i++) {
      const ext = imageUrls[i].match(/\.(jpg|png|jpeg)/i)?.[1] ?? "jpg";
      const dest = path.join(pagesDir, `ep${String(ep).padStart(3, "0")}_p${String(i + 1).padStart(2, "0")}.${ext}`);
      try {
        const img = await fetch(imageUrls[i], { headers: { ...UA, Referer: viewerUrl } });
        if (!img.ok) continue;
        fs.writeFileSync(dest, Buffer.from(await img.arrayBuffer()));
        downloaded++;
      } catch { /* skip failed panel */ }
      await sleep(150);
    }
    console.log(`${downloaded} saved`);
    totalPages += downloaded;
    await sleep(400);
  }

  fs.writeFileSync(path.join(outDir, "episodes.json"), JSON.stringify(epMetas, null, 2), "utf-8");
  if (!fs.existsSync(path.join(outDir, "series.json"))) {
    fs.writeFileSync(
      path.join(outDir, "series.json"),
      JSON.stringify({ title: seriesId, genre: "", author: "", summary: "", thumbnail: "", episodeCount: epMetas.length }, null, 2),
      "utf-8"
    );
  }

  console.log(`\n✅  Done. ${totalPages} pages in data/series/${seriesId}/pages/`);
  console.log(`   Next: npx tsx scripts/build-canon.ts ${seriesId}\n`);
}

main().catch((err) => { console.error("Fatal:", err); process.exit(1); });
