// minds.ts — thin wrapper over @animocabrands/minds-client-lib.
// The lib ships ESM-only, so it is loaded via a lazy dynamic import (works
// from CommonJS server code and tsx scripts alike).
import * as dotenv from "dotenv";
import type { MindsClient } from "@animocabrands/minds-client-lib" with {
  "resolution-mode": "import"
};

dotenv.config();

const builderApiKey = process.env["MINDS_BUILDER_API_KEY"];
if (!builderApiKey) {
  throw new Error("MINDS_BUILDER_API_KEY is not set — add it to .env");
}

let _client: MindsClient | undefined;

/** The jam demo Mind + its conversation alias. */
export const MNEMO_MIND_ID = "5470503e-f36b-1410-8466-00039ce7df11";
export const MNEMO_ALIAS = "mnemo";

/** Singleton Minds client. Also reachable for getHistory / subscribeEvents. */
export async function getMinds(): Promise<MindsClient> {
  if (!_client) {
    const { createMindsClient } = await import("@animocabrands/minds-client-lib");
    _client = createMindsClient({ builderApiKey });
  }
  return _client;
}

/** Fingerprint of the last reply consumed per alias — baseline for the next wait. */
const lastReplyFingerprint = new Map<string, string>();

/** Max of two fingerprints by their leading timestamp. */
function newerFingerprint(a: string | undefined, b: string | undefined): string | undefined {
  if (!a) return b;
  if (!b) return a;
  const na = Number(a.split("_")[0]);
  const nb = Number(b.split("_")[0]);
  return na >= nb ? a : b;
}

/**
 * Ensure a conversation, send a message, wait for the Mind's reply text.
 *
 * Reply-matching baseline: the max of (a) the last reply we consumed on this
 * alias and (b) the latest history fingerprint. A history-only snapshot misses
 * a reply that arrived via SSE but hasn't been committed to history yet, and
 * the SSE stream can re-deliver that stale event on the next wait — which
 * produced cross-turn replies during the C5 cache run. Using the last consumed
 * reply's own fingerprint rejects those re-deliveries.
 */
export async function tell(
  alias: string,
  mindId: string,
  message: string,
  timeoutMs = 120_000
): Promise<string> {
  const minds = await getMinds();
  await minds.ensureConversation(alias, mindId);
  const historyBaseline = await minds.getLatestHistoryFingerprint(alias);
  const afterFingerprint = newerFingerprint(lastReplyFingerprint.get(alias), historyBaseline);
  await minds.sendMessage({ alias, messageText: message });
  const outcome = await minds.waitForReply({
    alias,
    timeoutMs,
    afterFingerprint,
    sentMessageText: message,
  });
  if (outcome.timedOut) {
    throw new Error(`Minds reply timed out after ${timeoutMs}ms (alias "${alias}")`);
  }
  if (outcome.reply.fingerprint) {
    lastReplyFingerprint.set(alias, outcome.reply.fingerprint);
  }
  return outcome.reply.messageText ?? "";
}
