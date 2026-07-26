// Re-push Continuity Check serviceDescription for agent 6211.
// Spawn onchainos from Node so PowerShell cannot mangle the JSON --service arg.
const { spawnSync } = require("child_process");
const path = require("path");
const os = require("os");

const onchainos = path.join(os.homedir(), ".local", "bin", "onchainos.exe");

const serviceDescription =
  "Drop a page image; get continuity flags vs series canon. POST body (either): (1) MCP JSON-RPC tools/call name=check-continuity args={page_image_base64,mime_type} OR (2) simple JSON {page_image_base64,mime_type,series_id?,canon?,dialogue?}. Returns flags + canon_additions. 0.1 USDT via x402 on X Layer.";

if (serviceDescription.length > 500) {
  console.error(`serviceDescription too long: ${serviceDescription.length} chars (max 500)`);
  process.exit(1);
}

const service = [
  {
    operation: "update",
    id: "34794",
    serviceName: "Continuity Check",
    serviceDescription,
    serviceType: "A2MCP",
    fee: "0.1",
    endpoint: "https://mnemo-production-c4f1.up.railway.app/mcp",
  },
];

console.log(`serviceDescription length: ${serviceDescription.length}`);
console.log("Spawning onchainos agent update…");

const result = spawnSync(
  onchainos,
  ["agent", "update", "--agent-id", "6211", "--service", JSON.stringify(service)],
  { encoding: "utf8", windowsHide: true }
);

if (result.stdout) process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
process.exit(result.status ?? 1);
