// ─────────────────────────────────────────────────────────────────────────────
// checker.ts  — core continuity check function
//
// Routes Gemini 2.5 Flash via OpenRouter (OpenAI-compatible API).
// To pay Gemini directly instead, swap `getClient()` → Google SDK; the rest
// of the call shape is identical because Gemini honors OpenAI's chat format.
// ─────────────────────────────────────────────────────────────────────────────

import OpenAI from "openai";
import type { CanonDoc, ContinuityCheckResult } from "./types.js";

// ---------------------------------------------------------------------------
// System prompt — strict continuity checker persona
// ---------------------------------------------------------------------------
const SYSTEM_PROMPT = `You are a continuity checker for serialized webtoon/comic art. You will receive:
1. A canon doc (JSON) — the accumulated memory of this series so far.
2. A new page image (and optional dialogue/script text).

Your job, in order:
1. Extract observable facts from the new page: stated or drawn character attributes (eye color, hair color, clothing, scars, etc.), any new character meetings, and any references to past events.
2. Check each extracted fact against the canon doc.
3. Flag ONLY high-confidence contradictions — cases where the new page clearly conflicts with an established canon fact. Always reference the establishing episode/panel from canon.
4. Separately, propose canon_additions for any new facts observed on this page that aren't yet in canon (new characters, new attributes, new relationships, new events).

CRITICAL RULES:
- Uncertain is NOT a flag. If you're not fully confident it's a contradiction, do not flag it. A false positive destroys trust in this tool completely — err toward silence.
- Never treat art style variance, angle, or lighting as a contradiction (e.g. hair looking darker in a night scene is not a hair color change).
- LIGHTING IS NOT A CONTRADICTION: dramatic lighting, shadow, mood tints, and screen effects legitimately shift how a color renders on the page. A shade shift within the SAME color family is never a contradiction (e.g. dark blue vs teal-blue vs navy are all "blue"; bright pink vs pale pink vs magenta are all "pink"; crimson vs maroon are both "red"). Only flag when the color family itself clearly differs (e.g. blue → green, pink → white, red → black) under well-lit conditions that leave no doubt.
- ABSENCE IS NOT A CONTRADICTION: If a previously established feature (scar, mark, accessory, etc.) is simply not visible in this panel — due to camera angle, character facing away, hair covering it, panel cropping, or the feature just not being the focus — this is NOT a flag. Only flag a feature as contradicted if the page CLEARLY AND UNAMBIGUOUSLY shows the area where the feature should be, in a way that leaves no reasonable doubt, and the feature is absent or different (e.g., a clear close-up of the exact cheek where a scar should be, showing unmarked skin). When in doubt about whether the feature was even in view, do not flag.
- OBSERVABLE VS. ABSENCE — SEVERITY GATING: Distinguish sharply between two types of potential issues: (1) DIRECTLY OBSERVABLE contradictions — the attribute is positively, unambiguously visible on this page and clearly differs from canon (e.g. both eyes are fully visible and are a different color). These are the only cases eligible for HIGH severity. (2) ABSENCE-BASED assumptions — you are inferring something is wrong solely because you do not see evidence of it on the page. This is NEVER grounds for any flag, not even low severity. If your reasoning is "I don't see the scar, therefore it may be missing," that is an absence-based assumption — do not flag it.
- SEVERITY RUBRIC — use this consistently: HIGH = directly observable attribute that unambiguously contradicts an established canon value; MEDIUM = a stated fact in dialogue or text directly conflicts with a canon event or relationship; LOW = a plausible but less certain discrepancy where some interpretive doubt remains (use sparingly).
- DIALOGUE — EXPLICIT STATEMENTS ONLY: a dialogue-based flag requires the text to EXPLICITLY and unambiguously state a fact that directly conflicts with canon (e.g. "we met for the first time last week" when canon says they met years earlier). Do NOT flag based on what dialogue implies, suggests, or makes you infer about history — implications, hyperbole, figures of speech, and partial context are not contradictions. Dialogue you cannot fully read or translate is never evidence. When in doubt, treat dialogue as new context for canon_additions, not as a conflict.
- CANON ADDITIONS — COMPLETENESS REQUIREMENT: Only include an entry in canon_additions if you can populate ALL of its fields with specific, concrete values directly observed on this exact page. If the caller provides this page's episode/panel numbers, use those verbatim in the ep/panel fields. If they are NOT provided, leave ep and panel as 0 — never guess or infer them from other pages. If you cannot confidently fill in every other field with values you directly observed here, omit that entry entirely. An incomplete or partially guessed entry is worse than no entry.
- CANON ADDITIONS — NO DUPLICATES: Do not propose an addition for any attribute, relationship, or event that is already present in the canon doc, even if it appears again on this page. Only propose additions for things genuinely new to canon.
- canon_additions: [] is correct and expected on most pages. Empty is the right answer when there is nothing new and fully observable.
- Frame every flag as something for the artist to review, never as an automatic correction. You are not the final judge — they are.

Respond with ONLY valid JSON. No preamble, no markdown formatting, no explanation outside the JSON structure. The JSON must have this exact shape:

{
  "flags": [
    {
      "severity": "low" | "medium" | "high",
      "character": string,
      "field": string,
      "canon_value": string,
      "new_value": string,
      "ep_ref": number,
      "panel_ref": number,
      "explanation": string
    }
  ],
  "canon_additions": [
    {
      "type": "character" | "attribute" | "relationship" | "event",
      "data": {
        "field": string,
        "value": string,
        "ep": number,
        "panel": number
      }
    }
  ]
}`;

// ---------------------------------------------------------------------------
// Model setup — fallback list covers OpenRouter model availability
// ---------------------------------------------------------------------------
// ponytail: legacy keys get gemini-2.5-flash, new keys may get 404'd there
// and silently fall through to lite/latest. First successful model is cached
// so subsequent calls skip the retry loop. Order = preference, not required.
const MODEL_FALLBACKS = [
  "google/gemini-2.5-flash",
  "google/gemini-2.5-flash-lite",
  "google/gemini-flash-latest",
] as const;

let activeModel: string | null = null;

export function getActiveModel(): string {
  return activeModel ?? MODEL_FALLBACKS[0];
}

function getClient(apiKey: string): OpenAI {
  return new OpenAI({
    apiKey,
    baseURL: "https://openrouter.ai/api/v1",
  });
}

// ---------------------------------------------------------------------------
// Main exported function
// ---------------------------------------------------------------------------

/**
 * Check a new webtoon page image against the established canon document.
 *
 * @param canonDoc       - The full canon JSON for the series.
 * @param pageImageBase64 - Base64-encoded PNG/JPEG of the new page.
 * @param mimeType       - MIME type of the image (default: "image/png").
 * @param dialogueText   - Optional raw dialogue/script text from this page.
 * @param apiKey         - OpenRouter API key (falls back to process.env.OPENROUTER_API_KEY).
 * @param epNumber       - Optional episode number of this page (used verbatim in canon_additions).
 * @param panelNumber    - Optional panel number of this page (used verbatim in canon_additions).
 * @returns              - Parsed { flags, canon_additions } result.
 */
export async function checkContinuity(
  canonDoc: CanonDoc,
  pageImageBase64: string,
  mimeType: "image/png" | "image/jpeg" | "image/webp" = "image/png",
  dialogueText?: string,
  apiKey: string = process.env.OPENROUTER_API_KEY ?? "",
  epNumber?: number,
  panelNumber?: number
): Promise<ContinuityCheckResult> {
  if (!apiKey) {
    throw new Error(
      "OPENROUTER_API_KEY is required. Set it in your environment or pass it explicitly."
    );
  }

  const pageLocation =
    epNumber != null || panelNumber != null
      ? `\n\nThis page is episode ${epNumber ?? "?"}, panel ${panelNumber ?? "?"}. Use these numbers verbatim in any canon_additions ep/panel fields.`
      : "";

  // If we've already discovered a working model this session, use it directly.
  const candidates = activeModel ? [activeModel] : [...MODEL_FALLBACKS];
  let lastErr: unknown = null;
  for (const modelName of candidates) {
    try {
      const client = getClient(apiKey);
      const response = await client.chat.completions.create({
        model: modelName,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Canon doc:\n${JSON.stringify(canonDoc, null, 2)}\n\nDialogue/script for this page:\n${dialogueText ?? "(none provided)"}${pageLocation}`,
              },
              {
                type: "image_url",
                image_url: { url: `data:${mimeType};base64,${pageImageBase64}` },
              },
            ],
          },
        ],
        temperature: 0.2,
        response_format: { type: "json_object" },
      });

      const raw = response.choices[0]?.message?.content ?? "";
      if (!raw) {
        throw new Error("OpenRouter returned an empty response");
      }
      activeModel = modelName;
      try {
        return JSON.parse(raw) as ContinuityCheckResult;
      } catch {
        throw new Error(`OpenRouter returned non-JSON response:\n${raw}`);
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (/404|not found|no longer available|model/i.test(msg)) {
        lastErr = e;
        continue;
      }
      throw e;
    }
  }

  throw new Error(
    `No working model found on OpenRouter. Tried: ${candidates.join(", ")}\nLast error: ${
      lastErr instanceof Error ? lastErr.message : String(lastErr)
    }`
  );
}
