// ─────────────────────────────────────────────────────────────────────────────
// test-server.ts  — Integration tests for the payment gate and continuity handler
//
// Test A: POST /mcp with no PAYMENT-SIGNATURE header → HTTP 402 (structural,
//         no OKX credentials required).
//
// Test B: runCheck() called directly (bypasses payment gate) with the
//         contradiction test image and real data/canon.json → flags.length > 0
//         (requires GEMINI_API_KEY, same as existing test.ts).
//
// Does NOT touch checker.ts, test.ts, types.ts, or canon.json.
// ─────────────────────────────────────────────────────────────────────────────

import * as http from "http";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

dotenv.config();

// ─── helpers ──────────────────────────────────────────────────────────────────

function pass(label: string): void {
  console.log(`  ✅  PASS  ${label}`);
}

function fail(label: string, detail: string): void {
  console.error(`  ❌  FAIL  ${label}`);
  console.error(`           ${detail}`);
  process.exitCode = 1;
}

/**
 * Send a raw HTTP request and return { statusCode, body }.
 */
function httpRequest(options: http.RequestOptions, body?: string): Promise<{ statusCode: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = "";
      res.on("data", (chunk: Buffer) => { data += chunk.toString(); });
      res.on("end", () => resolve({ statusCode: res.statusCode ?? 0, body: data }));
    });
    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

// ─── Test A — 402 gate ────────────────────────────────────────────────────────

async function testA_402Gate(port: number): Promise<void> {
  const label = "POST /mcp with no payment header returns HTTP 402";

  // Minimal JSON-RPC MCP request — tools/list is the lightest valid call.
  const body = JSON.stringify({
    jsonrpc: "2.0",
    method: "tools/list",
    id: 1,
  });

  const res = await httpRequest(
    {
      hostname: "127.0.0.1",
      port,
      path: "/mcp",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body),
        // Deliberately omit PAYMENT-SIGNATURE header.
      },
    },
    body
  );

  if (res.statusCode === 402) {
    pass(label);
  } else {
    fail(
      label,
      `Expected status 402 but got ${res.statusCode}. Body: ${res.body.slice(0, 200)}`
    );
  }
}

// ─── Test B — handler reaches checkContinuity and returns flags ───────────────

async function testB_HandlerResult(): Promise<void> {
  const label =
    "runCheck() with contradiction image returns flags.length > 0";

  // This import is intentionally deferred so Test A (which only needs the
  // HTTP server) does not pay the Gemini startup cost unnecessarily.
  const { runCheck } = await import("./check-handler.js");

  // Use the same contradiction image that already passes in test.ts.
  const testImagePath = path.resolve(
    __dirname,
    "..",
    "test-images",
    "page_contradiction.png"
  );

  if (!fs.existsSync(testImagePath)) {
    fail(label, `Test image not found at ${testImagePath}`);
    return;
  }

  const imageBase64 = fs.readFileSync(testImagePath).toString("base64");

  const result = await runCheck(imageBase64, "image/png");

  if (result.flags.length > 0) {
    pass(label);
    console.log(
      `           (${result.flags.length} flag(s) returned, first: ${result.flags[0].field} — ${result.flags[0].severity})`
    );
  } else {
    fail(
      label,
      `Expected at least one flag from contradiction image but got 0. ` +
        `canon_additions: ${result.canon_additions.length}`
    );
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log("\n🧪  Mnemo — Payment + Handler Tests\n");

  // ── Spin up the server on a random available port ──────────────────────────
  // We import `app` (the Express instance) and let Node pick a free port by
  // passing 0. This avoids collisions with any running dev server on :3000.
  const { default: app } = await import("./server.js");

  const server = await new Promise<http.Server>((resolve) => {
    const s = (app as import("express").Express).listen(0, "127.0.0.1", () =>
      resolve(s)
    );
  });

  const address = server.address() as { port: number };
  const port = address.port;
  console.log(`  Server started on port ${port} (ephemeral)\n`);

  try {
    // ── Test A ────────────────────────────────────────────────────────────────
    console.log("── Test A: Payment Gate ─────────────────────────────────");
    await testA_402Gate(port);

    // ── Test B ────────────────────────────────────────────────────────────────
    console.log("\n── Test B: Handler Result ───────────────────────────────");
    await testB_HandlerResult();
  } finally {
    server.close();
  }

  const exitCode = process.exitCode ?? 0;
  console.log(
    `\n${exitCode === 0 ? "✅  All tests passed." : "❌  One or more tests failed."}\n`
  );
  // Set the exit code and let the event loop drain naturally rather than calling
  // process.exit() directly. This allows the MCP transport's internal async
  // handles (Hono adapter) to release cleanly, preventing the Windows
  // UV_HANDLE_CLOSING assertion that fires when open handles are killed abruptly.
  process.exitCode = exitCode;
}

main().catch((err: unknown) => {
  console.error("Unhandled error in test runner:", err);
  process.exit(1);
});
