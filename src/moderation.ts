// moderation.ts — spoiler-aware comment moderation.
//
// The C4 gate proved that pure conversation-memory recall of EXACT
// establishing episodes is too unreliable for progress-relative spoiler math
// (the Mind misattributed ep-47 facts as "pre-30 canon" on a re-run). So each
// check is grounded with a compact canon digest (server-side canon, the same
// source the shipped OKX.AI continuity engine uses) while the Mind still does
// every judgment — the thesis holds: the spoiler math is impossible without
// the canon memory, and the Mind owns the narrative memory (conversation
// history, autonomy digest in C9).
import { MNEMO_ALIAS, MNEMO_MIND_ID, tell } from "./minds.js";
import { loadCanon } from "./resolve-canon.js";
import type { CanonDoc } from "./types.js";

export type ModerationVerdict =
  | "safe"
  | "spoiler"
  | "lore_question"
  | "contradiction";

export interface ModerationResult {
  verdict: ModerationVerdict;
  /** The establishing episode of the latest revealed fact (spoiler only). */
  spoils_episode?: number;
  reason: string;
}

/** One cached verdict record — real Mind output, computed at a fixed baseline reader episode. */
export interface CachedVerdict {
  comment_id: string;
  computed_at_reader_episode: number;
  verdict: ModerationVerdict;
  spoils_episode?: number;
  reason: string;
}

/**
 * Derive the verdict for a reader at ANY episode from a cached verdict.
 *
 * The Mind classified the comment at `computed_at_reader_episode` (baseline 1,
 * the strictest case). The only progress-dependent branch is spoiler: a comment
 * is a spoiler for this reader iff the latest revealed episode is AFTER where
 * the reader is. Everything else (safe / lore_question / contradiction) is
 * reader-independent. This is the beat-8 machinery: the SAME cached comment
 * blurs at episode 30 and un-blurs at 50.
 */
export function effectiveVerdict(
  cached: CachedVerdict,
  readerEpisode: number
): ModerationResult {
  if (
    cached.verdict === "spoiler" &&
    cached.spoils_episode != null &&
    cached.spoils_episode > readerEpisode
  ) {
    return {
      verdict: "spoiler",
      spoils_episode: cached.spoils_episode,
      reason: cached.reason,
    };
  }
  if (cached.verdict === "spoiler") {
    return { verdict: "safe", reason: cached.reason };
  }
  const result: ModerationResult = { verdict: cached.verdict, reason: cached.reason };
  if (cached.spoils_episode != null) {
    result.spoils_episode = cached.spoils_episode;
  }
  return result;
}

const VERDICTS: ModerationVerdict[] = [
  "safe",
  "spoiler",
  "lore_question",
  "contradiction",
];

function canonDigest(canon: CanonDoc): string {
  const parts: string[] = [];
  for (const ch of canon.characters) {
    const facts = [
      ch.role,
      ch.species,
      ...Object.entries(ch.physical ?? {}).map(
        ([k, v]) => `${k}=${v.value} (established ep ${v.established_episode})`
      ),
      ...(ch.abilities ?? []).map(
        (a) => `${a.name}: ${a.description} (established ep ${a.established_episode})`
      ),
      ...(ch.relationships ?? []).map(
        (r) => `${r.type} with ${r.with} (established ep ${r.established_episode})`
      ),
    ].filter((f): f is string => !!f);
    parts.push(`- ${ch.name}: ${facts.join("; ")}`);
  }
  parts.push("EVENTS:");
  for (const ev of canon.events) {
    parts.push(`- [ep ${ev.episode}] ${ev.title}: ${ev.summary}`);
  }
  parts.push("LOCATIONS:");
  for (const loc of canon.locations) {
    parts.push(`- ${loc.name} (first appears ep ${loc.first_appearance_episode})`);
  }
  return parts.join("\n");
}

function classifyPrompt(canon: CanonDoc, comment: string, readerEpisode: number): string {
  return [
    "You are Mnemo, the spoiler-aware moderator for the webtoon 'Lore Olympus'.",
    "Below is the series canon — every fact and the episode that established it.",
    "",
    "=== CANON ===",
    canonDigest(canon),
    "",
    "=== TASK ===",
    `A reader is currently on episode ${readerEpisode}.`,
    "A fan posted this comment:",
    `"${comment}"`,
    "",
    "Classify the comment into exactly one verdict:",
    '- "safe" — no canon spoiler for THIS reader, not a lore question, not a contradiction',
    '- "spoiler" — the comment reveals a canon fact/event whose establishing episode is AFTER the reader\'s current episode. Among all facts revealed, use the LATEST establishing episode.',
    '- "lore_question" — the comment asks a factual question about the series that the canon can answer',
    '- "contradiction" — the comment states something that clearly conflicts with the canon above',
    "",
    "Rules:",
    "- Spoiler is relative to the reader. A fact established at or before the reader's episode is NOT a spoiler for them.",
    "- Use the canon's establishing episodes exactly. Do not guess or infer different episodes.",
    "- If a comment is both a spoiler and a question, prefer \"spoiler\".",
    "- If a comment is both a spoiler and a contradiction, prefer \"spoiler\".",
    '- "contradiction" only for clear, unambiguous conflicts with the canon above. Speculation, opinions, and "I wish" are not contradictions.',
    "- Never invent facts. If unsure, pick the most defensible verdict.",
    "",
    'Reply with ONLY this JSON (no markdown, no prose):',
    '{"verdict":"safe|spoiler|lore_question|contradiction","spoils_episode":<number or null>,"reason":"<short reason>"}',
  ].join("\n");
}

function parseVerdict(reply: string): ModerationResult {
  const start = reply.indexOf("{");
  const end = reply.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error(`No JSON object in Mind reply: ${reply.slice(0, 200)}`);
  }
  const parsed = JSON.parse(reply.slice(start, end + 1)) as Partial<ModerationResult> & {
    verdict?: unknown;
  };
  if (!VERDICTS.includes(parsed.verdict as ModerationVerdict)) {
    throw new Error(`Unexpected verdict "${parsed.verdict}" in reply: ${reply.slice(0, 200)}`);
  }
  const result: ModerationResult = {
    verdict: parsed.verdict as ModerationVerdict,
    reason: parsed.reason ?? "",
  };
  if (parsed.spoils_episode != null) {
    result.spoils_episode = parsed.spoils_episode;
  }
  return result;
}

/**
 * Moderate one comment for a reader at a given episode. Grounds the check with
 * the series canon (server-side), hands the judgment to the Mind.
 */
export async function moderate(
  comment: string,
  readerEpisode: number,
  seriesId = "lore-olympus",
  timeoutMs = 120_000
): Promise<ModerationResult> {
  const canon = loadCanon(seriesId);
  const reply = await tell(
    MNEMO_ALIAS,
    MNEMO_MIND_ID,
    classifyPrompt(canon, comment, readerEpisode),
    timeoutMs
  );
  return parseVerdict(reply);
}
