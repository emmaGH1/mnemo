// ─────────────────────────────────────────────────────────────────────────────
// types.ts  — shared TypeScript types for Mnemo
// ─────────────────────────────────────────────────────────────────────────────

/** A single continuity flag raised against the new page */
export interface ContinuityFlag {
  severity: "low" | "medium" | "high";
  /** The character whose attribute conflicts */
  character: string;
  /** The attribute field that conflicts (e.g. "eye_color") */
  field: string;
  /** The value established in canon */
  canon_value: string;
  /** The value observed on the new page */
  new_value: string;
  /** Episode where canon was established */
  ep_ref?: number;
  /** Panel where canon was established */
  panel_ref?: number;
  /** Human-readable explanation for the artist */
  explanation: string;
}

/** A new fact to add to canon (not a contradiction — just new info) */
export interface CanonAddition {
  type: "character" | "attribute" | "relationship" | "event";
  data: Record<string, unknown>;
}

/** Full Gemini response */
export interface ContinuityCheckResult {
  flags: ContinuityFlag[];
  canon_additions: CanonAddition[];
}

/** Shape of the canon document */
export interface CanonDoc {
  series: string;
  version: number;
  last_updated_episode: number;
  characters: CharacterRecord[];
  events: EventRecord[];
  locations: LocationRecord[];
}

export interface CharacterRecord {
  id: string;
  name: string;
  status: string;
  role?: string;
  species?: string;
  physical?: Record<string, AttributeRecord>;
  clothing_defaults?: Record<string, AttributeRecord>;
  abilities?: { name: string; description: string; established_episode: number; established_panel: number }[];
  relationships?: {
    with: string;
    type: string;
    established_episode: number;
    established_panel: number;
    notes?: string;
  }[];
}

export interface AttributeRecord {
  value: string;
  established_episode: number;
  established_panel: number;
  notes?: string;
}

export interface EventRecord {
  id: string;
  title: string;
  episode: number;
  panel_start: number;
  summary: string;
  participants: string[];
  significance: string;
}

export interface LocationRecord {
  id: string;
  name: string;
  status: string;
  first_appearance_episode: number;
  notes?: string;
}
