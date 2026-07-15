// ─────────────────────────────────────────────────────────────────────────────
// check-handler.ts  — shared continuity-check logic
//
// Used by:
//   • src/server.ts  — the MCP tool handler (POST /mcp)
//   • src/test-server.ts — Test B (direct handler call, bypasses payment gate)
//
// Does NOT touch checker.ts, test.ts, types.ts, or canon.json.
// ─────────────────────────────────────────────────────────────────────────────

import * as fs from "fs";
import * as path from "path";
import { checkContinuity } from "./checker.js";
import type { CanonDoc, ContinuityCheckResult } from "./types.js";

/** Absolute path to the default canon document */
export const DEFAULT_CANON_PATH = path.resolve(
  __dirname,
  "..",
  "data",
  "canon.json"
);

/**
 * Run a continuity check against the Gemini model.
 *
 * @param imageBase64   - Base64-encoded page image
 * @param mimeType      - MIME type of the image
 * @param canonOverride - Parsed canon doc; if omitted, loads data/canon.json
 * @param dialogue      - Optional raw dialogue/script text from the page
 * @returns ContinuityCheckResult with flags and canon_additions
 */
export async function runCheck(
  imageBase64: string,
  mimeType: "image/png" | "image/jpeg" | "image/webp",
  canonOverride?: CanonDoc,
  dialogue?: string
): Promise<ContinuityCheckResult> {
  let canonDoc: CanonDoc;

  if (canonOverride) {
    canonDoc = canonOverride;
  } else if (fs.existsSync(DEFAULT_CANON_PATH)) {
    canonDoc = JSON.parse(
      fs.readFileSync(DEFAULT_CANON_PATH, "utf-8")
    ) as CanonDoc;
  } else {
    throw new Error(
      `No canon doc provided and default canon.json not found at ${DEFAULT_CANON_PATH}`
    );
  }

  return checkContinuity(canonDoc, imageBase64, mimeType, dialogue);
}
