// scrape-webtoon.ts — fetch episode metadata and page images from WEBTOON
//
// Usage:
//   npx tsx scripts/scrape-webtoon.ts <url> [--episodes 1-5] [--no-images] [--out <id>]
//
// Examples:
//   npx tsx scripts/scrape-webtoon.ts "https://www.webtoons.com/en/fantasy/tower-of-god/list?title_no=95"
//   npx tsx scripts/scrape-webtoon.ts "https://www.webtoons.com/en/fantasy/tower-of-god/list?title_no=95" --episodes 1-3
//   npx tsx scripts/scrape-webtoon.ts "https://www.webtoons.com/en/fantasy/tower-of-god/list?title_no=95" --no-images
//
// Output lands in: data/series/<series_id>/
//   series.json      — series metadata
//   episodes.json    — episode list with metadata
//   pages/           — downloaded page images (ep<num>_p<num>.jpg)

import * as fs from "fs";
import * as path from "path";

const SERIES_ROOT = path.resolve(__dirname, "..", "data", "series");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function parseEpRange(raw: string): { start: number; end: number } | null {
  const m = raw.match(/^(\d+)(?:-(\d+))?$/);
  if (!m) return null;
  const start = Number(m[1]);
  const end = m[2] ? Number(m[2]) : start;
  return { start, end };
}

async function fetchJSON(url: string): Promise<any> {
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      Referer: "https://www.webtoons.com/",
    },
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} fetching ${url}`);
  }
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      Referer: "https://www.webtoons.com/",
    },
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} fetching ${url}`);
  }
  return res.text();
}

function extractImageUrls(html: string): string[] {
  const urls = new Set<string>();
  // CDN image URLs
  const re =
    /https:\/\/webtoon-phinf\.pstatic\.net\/[^"'\\s<>&]+\.(?:jpg|png|jpeg)/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    urls.add(m[0].replace(/\\u0026/g, "&"));
  }
  return [...urls];
}

async function downloadImage(
  url: string,
  dest: string
): Promise<boolean> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        Referer: "https://www.webtoons.com/",
      },
    });
    if (!res.ok) return false;
    const buf = Buffer.from(await res.arrayBuffer());
    fs.writeFileSync(dest, buf);
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

interface SeriesMeta {
  title: string;
  genre: string;
  author: string;
  summary: string;
  thumbnail: string;
  episodeCount: number;
}

interface EpMeta {
  no: number;
  title: string;
  subtitle: string;
  thumbnail: string;
  date: string;
  likes: number;
}

interface ScrapedEp {
  meta: EpMeta;
  images: string[];
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  const urlIdx = args.findIndex((a) => a.startsWith("http"));
  if (urlIdx === -1) {
    console.error("Usage: npx tsx scripts/scrape-webtoon.ts <webtoon-url> [--episodes 1-5] [--no-images] [--out <id>]");
    process.exit(1);
  }

  const url = args[urlIdx];
  const epArgIdx = args.indexOf("--episodes");
  const epArg = epArgIdx !== -1 ? args[epArgIdx + 1] : null;
  const skipImages = args.includes("--no-images");
  const outIdx = args.indexOf("--out");
  const seriesId = outIdx !== -1 ? args[outIdx + 1] : null;
  const epRange = epArg ? parseEpRange(epArg) : null;

  // Extract title_no from URL
  const titleMatch = url.match(/title_no=(\d+)/);
  if (!titleMatch) {
    console.error("Could not extract title_no from URL. URL should contain ?title_no=NUM");
    process.exit(1);
  }
  const titleNo = titleMatch[1];

  // Extract language from URL
  const langMatch = url.match(/webtoons\.com\/([a-z]{2})\//);
  const lang = langMatch ? langMatch[1] : "en";

  console.log(`\n🔍  Scraping WEBTOON — title_no=${titleNo}, lang=${lang}\n`);

  // ── Step 1: series metadata ──
  console.log("📋  Fetching series info...");
  const seriesData = await fetchJSON(
    `https://www.webtoons.com/api/v1/titleCard?titleNo=${titleNo}&language=${lang}`
  );
  // titleCard structure varies by language endpoint, normalize below

  const rawTitle = seriesData?.title ?? seriesData?.titleName ?? "Unknown";
  const genre =
    seriesData?.genre ?? seriesData?.categoryName ?? seriesData?.genreName ?? "";
  const author =
    seriesData?.author ??
    seriesData?.writer ??
    (seriesData?.authors ? seriesData.authors.join(", ") : "");
  const summary = seriesData?.synopsis ?? seriesData?.summary ?? "";
  const thumbnail = seriesData?.thumbnailUrl ?? seriesData?.imageUrl ?? "";
  const episodeCount = seriesData?.episodeCount ?? seriesData?.totalEpisode ?? 0;

  const seriesMeta: SeriesMeta = {
    title: rawTitle,
    genre,
    author,
    summary,
    thumbnail,
    episodeCount,
  };

  const sid = seriesId ?? slugify(rawTitle);
  const outDir = path.join(SERIES_ROOT, sid);

  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  fs.writeFileSync(
    path.join(outDir, "series.json"),
    JSON.stringify(seriesMeta, null, 2),
    "utf-8"
  );
  console.log(`   Title: "${rawTitle}" by ${author || "N/A"}`);
  console.log(`   Episodes: ${episodeCount}, Genre: ${genre || "N/A"}`);
  console.log(`   Series ID: ${sid}`);
  console.log(`   Saved: data/series/${sid}/series.json\n`);

  // ── Step 2: episode list ──
  console.log("📚  Fetching episode list...");

  // Try two known API patterns
  let episodes: any[] = [];
  try {
    const epData = await fetchJSON(
      `https://www.webtoons.com/api/v1/title/${titleNo}/episodes?page=1&size=100&sort=asc&language=${lang}`
    );
    episodes = epData?.episodes ?? epData?.data ?? epData ?? [];
  } catch {
    try {
      // fallback: older API
      const epData = await fetchJSON(
        `https://www.webtoons.com/api/v1/episodeList?titleNo=${titleNo}&language=${lang}`
      );
      episodes =
        epData?.episodeList ?? epData?.data ?? epData?.result ?? [];
    } catch {
      console.warn("   ⚠  Could not fetch episode list via API. Trying HTML scraping fallback...");
      episodes = [];
    }
  }

  if (!Array.isArray(episodes) || episodes.length === 0) {
    console.log("   No episodes found (private/age-gated series?). Metadata-only scrape complete.");
    console.log(`   Saved: data/series/${sid}/series.json`);
    return;
  }

  // Normalize episodes
  const epMetas: EpMeta[] = episodes
    .map((ep: any) => ({
      no: ep.no ?? ep.episodeNo ?? ep.id ?? 0,
      title: ep.title ?? ep.subtitle ?? "",
      subtitle: ep.subtitle ?? ep.title ?? "",
      thumbnail: ep.thumbnailUrl ?? ep.imageUrl ?? "",
      date: ep.date ?? ep.publishDate ?? "",
      likes: ep.likeItCount ?? ep.likes ?? 0,
    }))
    .filter((ep: EpMeta) => ep.no > 0)
    .sort((a: EpMeta, b: EpMeta) => a.no - b.no);

  console.log(`   Found ${epMetas.length} episodes`);

  // Filter by episode range if provided
  const targets = epRange
    ? epMetas.filter((e) => e.no >= epRange!.start && e.no <= epRange!.end)
    : epMetas;

  if (epRange) {
    console.log(`   Scraping episodes ${epRange.start}-${epRange.end} (${targets.length} found)`);
  }

  // Save episode metadata
  fs.writeFileSync(
    path.join(outDir, "episodes.json"),
    JSON.stringify(epMetas, null, 2),
    "utf-8"
  );

  if (skipImages) {
    console.log("   ⏭️   Skipping image download (--no-images)\n");
    console.log(`✅  Done. Series ID: ${sid}`);
    console.log(`   data/series/${sid}/series.json`);
    console.log(`   data/series/${sid}/episodes.json`);
    return;
  }

  // ── Step 3: extract and download page images ──
  console.log(`\n🖼️   Downloading page images for ${targets.length} episodes...\n`);

  const pagesDir = path.join(outDir, "pages");
  if (!fs.existsSync(pagesDir)) {
    fs.mkdirSync(pagesDir, { recursive: true });
  }

  let totalPages = 0;
  const scrapedEps: ScrapedEp[] = [];

  for (const ep of targets) {
    process.stdout.write(`   Ep ${ep.no}: "${ep.title}" ... `);

    // Build viewer URL — we need the series slug from the original URL
    const urlParts = url.split("/");
    const slugIdx = urlParts.findIndex(
      (p) => p === "list" || p === "viewer"
    );
    const seriesSlug = slugIdx > 0 ? urlParts[slugIdx - 1] : "";

    let viewerUrl = "";
    if (seriesSlug) {
      const epSlug = slugify(ep.title || `episode-${ep.no}`);
      viewerUrl = `https://www.webtoons.com/${lang}/viewer?title_no=${titleNo}&episode_no=${ep.no}`;
    } else {
      viewerUrl = `https://www.webtoons.com/${lang}/viewer?title_no=${titleNo}&episode_no=${ep.no}`;
    }

    try {
      const viewerHtml = await fetchText(viewerUrl);
      const imageUrls = extractImageUrls(viewerHtml);

      if (imageUrls.length === 0) {
        console.log(`0 images extracted (no CDN URLs found in HTML)`);
        scrapedEps.push({ meta: ep, images: [] });
        continue;
      }

      let downloaded = 0;
      for (let i = 0; i < imageUrls.length; i++) {
        const imgUrl = imageUrls[i];
        const ext = imgUrl.match(/\.(jpg|png|jpeg)/i)?.[1] ?? "jpg";
        const filename = `ep${String(ep.no).padStart(3, "0")}_p${String(i + 1).padStart(2, "0")}.${ext}`;
        const dest = path.join(pagesDir, filename);

        const ok = await downloadImage(imgUrl, dest);
        if (ok) downloaded++;
        // small delay between images
        await new Promise((r) => setTimeout(r, 200));
      }

      console.log(`${downloaded}/${imageUrls.length} downloaded`);
      totalPages += downloaded;
      scrapedEps.push({ meta: ep, images: imageUrls });
    } catch (err: any) {
      console.log(`ERROR: ${err.message}`);
      scrapedEps.push({ meta: ep, images: [] });
    }

    // delay between episodes
    await new Promise((r) => setTimeout(r, 500));
  }

  // Save scraped episode data
  fs.writeFileSync(
    path.join(outDir, "scraped.json"),
    JSON.stringify(scrapedEps, null, 2),
    "utf-8"
  );

  console.log(`\n✅  Done. ${totalPages} pages downloaded.`);
  console.log(`   Series ID: ${sid}`);
  console.log(`   data/series/${sid}/series.json`);
  console.log(`   data/series/${sid}/episodes.json`);
  console.log(`   data/series/${sid}/scraped.json`);
  console.log(`   data/series/${sid}/pages/  (${totalPages} files)\n`);
  console.log(`   Next: npx tsx scripts/build-canon.ts ${sid}\n`);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
