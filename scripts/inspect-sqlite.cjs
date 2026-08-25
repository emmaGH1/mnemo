// Inspect command-store schema
const { DatabaseSync } = require("node:sqlite");
const db = new DatabaseSync("C:/Users/Emma0/.okx-agent-task/command-store.sqlite", { readOnly: false });
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
console.log("TABLES:", tables.map(t => t.name).join(", "));
for (const t of tables) {
  console.log(`\n=== ${t.name} ===`);
  console.log(db.prepare(`SELECT sql FROM sqlite_master WHERE name = ?`).get(t.name).sql);
}
