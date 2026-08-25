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

/** Singleton Minds client. Also reachable for getHistory / subscribeEvents. */
export async function getMinds(): Promise<MindsClient> {
  if (!_client) {
    const { createMindsClient } = await import("@animocabrands/minds-client-lib");
    _client = createMindsClient({ builderApiKey });
  }
  return _client;
}

/** Ensure a conversation, send a message, wait for the Mind's reply text. */
export async function tell(
  alias: string,
  mindId: string,
  message: string,
  timeoutMs = 120_000
): Promise<string> {
  const minds = await getMinds();
  await minds.ensureConversation(alias, mindId);
  await minds.sendMessage({ alias, messageText: message });
  const outcome = await minds.waitForReply({ alias, timeoutMs });
  if (outcome.timedOut) {
    throw new Error(`Minds reply timed out after ${timeoutMs}ms (alias "${alias}")`);
  }
  return outcome.reply.messageText ?? "";
}
