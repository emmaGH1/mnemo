// ─────────────────────────────────────────────────────────────────────────────
// re-push-listing.ts — Update OKX.AI listing #6211 with Render endpoint.
//
// Spawns onchainos.exe from Node so the --service JSON survives intact
// (PowerShell mangles JSON args on Windows).
// ─────────────────────────────────────────────────────────────────────────────

import { spawnSync } from "node:child_process";

const service = JSON.stringify([
  {
    operation: "update",
    id: "34794",
    serviceName: "Continuity Check",
    serviceDescription:
      "Drop a page image; get continuity flags vs series canon. POST body (either): (1) MCP JSON-RPC tools/call name=check-continuity args={page_image_base64,mime_type} OR (2) simple JSON {page_image_base64,mime_type,series_id?,canon?,dialogue?}. Returns flags + canon_additions. 0.1 USDT via x402 on X Layer.",
    serviceType: "A2MCP",
    fee: "0.1",
    endpoint: "https://mnemo-9vze.onrender.com/mcp",
  },
]);

console.log(`service payload: ${service} (${service.length} chars)`);

const result = spawnSync(
  "onchainos",
  [
    "agent",
    "update",
    "--agent-id",
    "6211",
    "--service",
    service,
  ],
  { encoding: "utf-8", stdio: "inherit" }
);

process.exit(result.status ?? 1);
