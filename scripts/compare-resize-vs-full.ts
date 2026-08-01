// Read-only A/B: resized (normal checkContinuity) vs full-res model call.
// Does NOT modify checker.ts — full-res path reuses the same prompt/model
// by extracting SYSTEM_PROMPT from source and calling OpenRouter directly.

import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";
import OpenAI from "openai";
import type { CanonDoc, ContinuityCheckResult } from "../src/types.js";

dotenv.config();

const IMG = path.resolve(__dirname, "..", "test-images", "page_contradiction.png");
const CHECKER_SRC = path.resolve(__dirname, "..", "src", "checker.ts");

function loadSystemPromptFromCheckerSource(): string {
  const src = fs.readFileSync(CHECKER_SRC, "utf-8");
  const m = src.match(
    /const SYSTEM_PROMPT = `([\s\S]*?)`;\r?\n\r?\n\/\/ -{5,}/
  );
  if (!m) {
    throw new Error("Could not extract SYSTEM_PROMPT from src/checker.ts");
  }
  return m[1];
}

/** Full-res path: same OpenRouter call shape as checkContinuity, no prepareImageForModel. */
async function checkContinuityFullRes(
  canonDoc: CanonDoc,
  pageImageBase64: string,
  mimeType: "image/png" | "image/jpeg" | "image/webp",
  systemPrompt: string,
  modelName: string,
  apiKey: string
): Promise<ContinuityCheckResult> {
  const client = new OpenAI({
    apiKey,
    baseURL: "https://openrouter.ai/api/v1",
    // Full-res may exceed 60s; allow headroom for a fair quality comparison
    timeout: 180_000,
    maxRetries: 0,
  });

  const response = await client.chat.completions.create({
    model: modelName,
    messages: [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: [
          {
            type: "text",
            text:
              `Canon doc:\n${JSON.stringify(canonDoc, null, 2)}\n\n` +
              `Dialogue/script for this page:\n(none provided)`,
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
  if (!raw) throw new Error("OpenRouter returned an empty response (full-res)");
  return JSON.parse(raw) as ContinuityCheckResult;
}

function printResult(label: string, ms: number, result: ContinuityCheckResult | null, err?: string): void {
  console.log("\n" + "=".repeat(72));
  console.log(label);
  console.log("=".repeat(72));
  console.log(`timing_ms: ${ms}`);
  if (err) {
    console.log(`ERROR: ${err}`);
    return;
  }
  if (!result) {
    console.log("(no result)");
    return;
  }
  console.log(`flags.length: ${result.flags?.length ?? 0}`);
  console.log(`canon_additions.length: ${result.canon_additions?.length ?? 0}`);
  console.log("\n--- flags (full JSON) ---");
  console.log(JSON.stringify(result.flags ?? [], null, 2));
  console.log("\n--- canon_additions (full JSON) ---");
  console.log(JSON.stringify(result.canon_additions ?? [], null, 2));
}

async function main(): Promise<void> {
  if (!fs.existsSync(IMG)) {
    console.error("Missing image:", IMG);
    process.exit(1);
  }
  const apiKey = process.env.OPENROUTER_API_KEY ?? "";
  if (!apiKey) {
    console.error("OPENROUTER_API_KEY not set");
    process.exit(1);
  }

  const b64 = fs.readFileSync(IMG).toString("base64");
  const systemPrompt = loadSystemPromptFromCheckerSource();

  const { checkContinuity, getActiveModel } = await import("../src/checker.js");
  const { loadCanon } = await import("../src/resolve-canon.js");
  const canon = loadCanon("lore-olympus");

  console.log("image:", IMG);
  console.log("file_bytes:", fs.statSync(IMG).size);
  console.log("base64_chars:", b64.length);
  console.log("canon series:", (canon as { series?: string }).series ?? "(unknown)");

  // ── A: normal path (includes prepareImageForModel) ─────────────────────────
  let resized: ContinuityCheckResult | null = null;
  let resizedMs = 0;
  let resizedErr: string | undefined;
  const tA = Date.now();
  try {
    resized = await checkContinuity(canon, b64, "image/png");
    resizedMs = Date.now() - tA;
  } catch (e: unknown) {
    resizedMs = Date.now() - tA;
    resizedErr = e instanceof Error ? e.message : String(e);
  }
  const modelUsed = getActiveModel();
  printResult(
    `A) RESIZED path — checkContinuity (prepareImageForModel ON)  model=${modelUsed}`,
    resizedMs,
    resized,
    resizedErr
  );

  // ── B: full-res path (bypass prepareImageForModel) ─────────────────────────
  let full: ContinuityCheckResult | null = null;
  let fullMs = 0;
  let fullErr: string | undefined;
  const tB = Date.now();
  try {
    full = await checkContinuityFullRes(
      canon,
      b64,
      "image/png",
      systemPrompt,
      modelUsed,
      apiKey
    );
    fullMs = Date.now() - tB;
  } catch (e: unknown) {
    fullMs = Date.now() - tB;
    fullErr = e instanceof Error ? e.message : String(e);
  }
  printResult(
    `B) FULL-RES path — raw PNG to OpenRouter (prepareImageForModel OFF)  model=${modelUsed}`,
    fullMs,
    full,
    fullErr
  );

  // ── Side-by-side summary ───────────────────────────────────────────────────
  console.log("\n" + "=".repeat(72));
  console.log("SIDE-BY-SIDE SUMMARY");
  console.log("=".repeat(72));
  console.log(
    JSON.stringify(
      {
        resized: {
          timing_ms: resizedMs,
          error: resizedErr ?? null,
          flags: resized?.flags ?? null,
          canon_additions: resized?.canon_additions ?? null,
        },
        full_res: {
          timing_ms: fullMs,
          error: fullErr ?? null,
          flags: full?.flags ?? null,
          canon_additions: full?.canon_additions ?? null,
        },
      },
      null,
      2
    )
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
