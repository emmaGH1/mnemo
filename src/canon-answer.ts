// canon-answer.ts — deterministic answerer for lore questions.
//
// This is the no-credit beat-7 path: it answers a lore question directly from
// the series canon file (the same canon the Mind is grounded on) and labels
// itself source:"canon". It is NOT a Mind call — no fabricated output, the
// answer is a quoted canon fact with its establishing episode.

import type { CanonDoc } from "./types.js";

export interface CanonFact {
  label: string;
  fact: string;
  established_episode?: number;
}

export interface CanonAnswer {
  question: string;
  answer: string;
  source: "canon";
  facts: CanonFact[];
}

interface ScoredFact extends CanonFact {
  search: string;
  score: number;
}

const STOPWORDS = new Set([
  "what", "which", "who", "whom", "when", "where", "why", "how",
  "is", "are", "was", "were", "does", "do", "did", "has", "have", "had",
  "the", "a", "an", "and", "or", "in", "at", "to", "of", "for", "with",
  "about", "on", "you", "your", "she", "her", "he", "his", "their", "they",
  "it", "its", "i", "me", "my", "we", "our", "that", "this", "these",
  "them", "from", "as", "by", "so", "can", "could", "would", "should",
  "just", "really", "forgot", "remember", "someone", "anyone", "everyone",
  "exactly", "wait", "also", "still", "then", "there", "here", "been",
  "being", "get", "got", "make", "made", "know", "think", "feel", "like",
  "because", "but", "if", "nor", "not", "no", "yes", "please", "guess",
]);

// "colour" → "color", plural "eyes" → "eye" — widen the net cheaply.
const TOKEN_MAP: Record<string, string> = {
  colour: "color",
  colours: "color",
  eyes: "eye",
  colors: "color",
};

function questionTokens(question: string): string[] {
  return question
    .toLowerCase()
    .split(/[^a-z]+/)
    .map((t) => t.replace(/^'|'s$/g, ""))
    .filter((t) => t.length >= 3 && !STOPWORDS.has(t))
    .map((t) => TOKEN_MAP[t] ?? t);
}

function factHasToken(search: string, token: string): boolean {
  if (search.includes(token)) return true;
  if (token.endsWith("s") && token.length > 3 && search.includes(token.slice(0, -1)))
    return true;
  if (token.length > 3 && search.includes(token + "s")) return true;
  return false;
}

/** Flatten every dated canon fact into a searchable record. */
function flattenCanonFacts(canon: CanonDoc): ScoredFact[] {
  const out: ScoredFact[] = [];
  const push = (label: string, fact: string, search: string, established_episode?: number) =>
    out.push({ label, fact, search, established_episode, score: 0 });

  for (const ch of canon.characters) {
    const base = ch.name.toLowerCase();
    for (const [key, attr] of Object.entries(ch.physical ?? {})) {
      const human = key.replace(/_/g, " ");
      push(
        `${ch.name} ${human}`,
        `${ch.name}'s ${human} is ${attr.value} (established ep ${attr.established_episode}).`,
        `${base} ${human} ${attr.value} ${attr.established_episode}`,
        attr.established_episode
      );
    }
    if (ch.species) {
      push(
        `${ch.name} species`,
        `${ch.name}'s species: ${ch.species}.`,
        `${base} species ${ch.species}`
      );
    }
    if (ch.role) {
      push(`${ch.name} role`, `${ch.name}: ${ch.role}.`, `${base} role ${ch.role}`);
    }
    for (const a of ch.abilities ?? []) {
      push(
        `${ch.name} ${a.name}`,
        `${ch.name} can ${a.name} — ${a.description} (established ep ${a.established_episode}).`,
        `${base} ${a.name} ${a.description} ${a.established_episode}`,
        a.established_episode
      );
    }
    for (const r of ch.relationships ?? []) {
      push(
        `${ch.name} — ${r.type} of ${r.with}`,
        `${ch.name}'s relationship with ${r.with}: ${r.type} (established ep ${r.established_episode}).`,
        `${base} ${r.type} ${r.with} ${r.notes ?? ""} ${r.established_episode}`,
        r.established_episode
      );
    }
  }
  for (const ev of canon.events) {
    const search = `${ev.title} ${ev.summary} ${ev.participants.join(" ")} ${ev.episode}`;
    push(ev.title, `${ev.title} — ${ev.summary} (episode ${ev.episode}).`, search, ev.episode);
  }
  for (const loc of canon.locations) {
    const search = `${loc.name} ${loc.notes ?? ""} ${loc.first_appearance_episode}`;
    push(
      loc.name,
      `${loc.name} — ${loc.notes ?? "first appears here"}.`,
      search,
      loc.first_appearance_episode
    );
  }
  return out;
}

/** Answer a lore question deterministically from canon. */
export function answerFromCanon(canon: CanonDoc, question: string): CanonAnswer {
  const tokens = questionTokens(question);
  const charNames = new Set(canon.characters.map((c) => c.name.toLowerCase()));
  const facts = flattenCanonFacts(canon);

  for (const f of facts) {
    for (const t of tokens) {
      if (charNames.has(t)) {
        if (f.search.includes(t)) f.score += 2;
      } else if (factHasToken(f.search, t)) {
        f.score += 1;
      }
    }
  }

  const hits = facts.filter((f) => f.score > 0).sort((a, b) => b.score - a.score);
  if (hits.length === 0) {
    return {
      question,
      answer: "No canon fact answers that yet — Mnemo's memory doesn't hold it.",
      source: "canon",
      facts: [],
    };
  }

  const top = hits.slice(0, 3);
  return {
    question,
    answer: top.map((f) => f.fact).join(" "),
    source: "canon",
    facts: top.map(({ label, fact, established_episode }) => ({
      label,
      fact,
      ...(established_episode != null ? { established_episode } : {}),
    })),
  };
}
