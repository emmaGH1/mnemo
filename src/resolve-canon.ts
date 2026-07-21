import * as fs from "fs";
import * as path from "path";
import type { CanonDoc } from "./types.js";

const BASE = path.resolve(__dirname, "..", "data");
const LEGACY = path.join(BASE, "canon.json");

export function seriesDir(id: string): string {
  return path.join(BASE, "series", id);
}

export function canonPath(id: string): string {
  return path.join(seriesDir(id), "canon.json");
}

export function listSeries(): string[] {
  const seriesRoot = path.join(BASE, "series");
  if (!fs.existsSync(seriesRoot)) return [];
  return fs
    .readdirSync(seriesRoot, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name);
}

export function loadCanon(seriesId?: string): CanonDoc {
  if (seriesId) {
    const p = canonPath(seriesId);
    if (!fs.existsSync(p)) {
      throw new Error(
        `Canon not found for series "${seriesId}" at ${p}. Create it first with: npx tsx scripts/build-canon.ts`
      );
    }
    return JSON.parse(fs.readFileSync(p, "utf-8")) as CanonDoc;
  }

  if (fs.existsSync(LEGACY)) {
    return JSON.parse(fs.readFileSync(LEGACY, "utf-8")) as CanonDoc;
  }

  throw new Error(
    "No canon doc found. Either create data/canon.json (legacy) or use series_ with data/series/<id>/canon.json."
  );
}

export function saveCanon(seriesId: string, doc: CanonDoc): void {
  const dir = seriesDir(seriesId);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(canonPath(seriesId), JSON.stringify(doc, null, 2), "utf-8");
}
