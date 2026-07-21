// ─────────────────────────────────────────────────────────────────────────────
// check-handler.ts  — shared continuity-check logic
//
// Used by:
//   • src/server.ts  — the MCP tool handler (POST /mcp)
//   • src/test-server.ts — Test B (direct handler call, bypasses payment gate)
//
// Does NOT touch checker.ts, test.ts, types.ts, or canon.json.
// ─────────────────────────────────────────────────────────────────────────────

import { checkContinuity } from "./checker.js";
import { loadCanon } from "./resolve-canon.js";
import type { CanonDoc, ContinuityCheckResult } from "./types.js";

export async function runCheck(
  imageBase64: string,
  mimeType: "image/png" | "image/jpeg" | "image/webp",
  canonOverride?: CanonDoc,
  dialogue?: string,
  seriesId?: string,
  epNumber?: number,
  panelNumber?: number
): Promise<ContinuityCheckResult> {
  const canonDoc = canonOverride ?? loadCanon(seriesId);
  return checkContinuity(canonDoc, imageBase64, mimeType, dialogue, undefined, epNumber, panelNumber);
}
