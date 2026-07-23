// scripts/mnemo.ts
// usage: npm run mnemo -- watch --series lore-olympus --pages p01,p05,p08,p12

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { existsSync } from "node:fs";

const ANSI = {
  reset: "\x1b[0m",
  cyan: "\x1b[36m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  dim: "\x1b[2m",
} as const;
const useColor = process.stdout.isTTY;
const c = (color: keyof typeof ANSI, s: string) =>
  useColor ? `${ANSI[color]}${s}${ANSI.reset}` : s;

type Flags = Record<string, string>;
function parseArgs(argv: string[]) {
  const [, , cmd, ...rest] = argv;
  const flags: Flags = {};
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const val = rest[i + 1] && !rest[i + 1].startsWith("--") ? rest[++i] : "true";
      flags[key] = val;
    }
  }
  return { cmd: cmd ?? "", flags };
}

async function checkPage(
  endpoint: string,
  series: string,
  pageFile: string
): Promise<{ flags?: unknown[]; canon_additions?: unknown[] }> {
  let buf: Buffer;
  try {
    buf = readFileSync(resolve(`data/series/${series}/pages/${pageFile}.png`));
  } catch (e: any) {
    if (e.code === "ENOENT") throw new Error(`page not found: ${pageFile}.png`);
    throw e;
  }
  const file = new File([new Uint8Array(buf)], `${pageFile}.png`, {
    type: "image/png",
  });
  const form = new FormData();
  form.append("page_image", file);
  form.append("series_id", series);

  let res: Response;
  try {
    res = await fetch(`${endpoint}/check`, { method: "POST", body: form });
  } catch {
    throw new Error(`API unreachable at ${endpoint} — is the server running?`);
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function checkPageWithRetry(
  endpoint: string,
  series: string,
  pageFile: string,
  maxRetries: number
): Promise<{ flags?: unknown[]; canon_additions?: unknown[] }> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await checkPage(endpoint, series, pageFile);
    } catch (e: any) {
      const msg: string = e.message ?? "";
      const retryable = /HTTP 5/.test(msg) || /unreachable/i.test(msg);
      if (!retryable || attempt === maxRetries) throw e;
      const wait = 1000 * attempt;
      console.log(
        c("yellow", `  … retrying (${attempt}/${maxRetries - 1}) in ${wait / 1000}s`)
      );
      await new Promise<void>((r) => setTimeout(r, wait));
    }
  }
  throw new Error("unreachable");
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

type CachedEntry = {
  page: string;
  flags: unknown[];
  canon_additions: unknown[];
};

function loadReplay(path: string): Map<string, CachedEntry> {
  const raw = readFileSync(path, "utf8");
  const arr = JSON.parse(raw) as CachedEntry[];
  return new Map(arr.map((e) => [e.page, e]));
}

async function watch(flags: Flags) {
  const series = flags.series;
  const pages = (flags.pages ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const episode = flags.episode ?? "ep003";
  const endpoint = flags.endpoint ?? "http://localhost:3000";
  const delayMs = Number(flags.delay ?? 0);
  const retries = Number(flags.retries ?? 1);
  const replayPath = flags.replay;
  const mockPacing = delayMs === 0 && !replayPath ? 2500 : delayMs; // default 2.5s in replay if not set, to simulate real pacing

  if (!series || pages.length === 0) {
    console.error(
      c("red", "usage:") +
        " mnemo watch --series <id> --pages p01,p05,p08 [--retries 3] [--delay 500] [--replay file.json]"
    );
    process.exit(1);
  }

  const replay = replayPath ? loadReplay(replayPath) : null;

  for (let i = 0; i < pages.length; i++) {
    const p = pages[i];
    const pageFile = p.startsWith("ep") ? p : `${episode}_${p}`;
    console.log(c("cyan", `--- ${pageFile} ---`));
    try {
      let r: { flags?: unknown[]; canon_additions?: unknown[] };
      if (replay) {
        const cached = replay.get(pageFile);
        if (!cached) throw new Error(`no cached entry for ${pageFile}`);
        await sleep(mockPacing);
        r = cached;
      } else {
        r = await checkPageWithRetry(endpoint, series, pageFile, retries);
      }
      const flagCount = r.flags?.length ?? 0;
      const addCount = r.canon_additions?.length ?? 0;
      const icon = flagCount > 0 ? "✗" : "✓";
      const color: keyof typeof ANSI = flagCount > 0 ? "red" : "green";
      console.log(
        c(color as keyof typeof ANSI, `  ${icon} ${flagCount} breaks, ${addCount} canon additions`)
      );
    } catch (e: any) {
      console.log(c("red", `  ✗ ${e.message}`));
    }
    if (i < pages.length - 1 && (delayMs > 0 || replay)) await sleep(delayMs > 0 ? delayMs : 500);
  }
}

const { cmd, flags } = parseArgs(process.argv);
switch (cmd) {
  case "watch":
    watch(flags);
    break;
  case "help":
  case "--help":
  case "-h":
  case "":
    console.log(
      `mnemo — webtoon continuity CLI

  mnemo watch --series <id> --pages p01,p05,p08

Flags:
  --series     series id (e.g. lore-olympus)
  --pages      comma-separated page refs (p01,p05 or full ep003_p01)
  --episode    episode prefix when using short page refs (default: ep003)
  --endpoint   API base URL (default: http://localhost:3000)
  --delay      ms to wait between pages (default: 0; in --replay mode default 500)
  --retries    retry count on HTTP 5xx (default: 1)
  --replay     path to a JSON file of cached {page,flags,canon_additions} entries
`
    );
    break;
  default:
    console.error(c("red", `unknown command: ${cmd}`));
    console.error(`run "mnemo help" for usage`);
    process.exit(1);
}
