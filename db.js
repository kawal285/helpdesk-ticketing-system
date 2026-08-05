const Database = require("better-sqlite3");
const db = new Database("helpdesk.db");

db.exec(`
  CREATE TABLE IF NOT EXISTS notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
`);

module.exports = db;