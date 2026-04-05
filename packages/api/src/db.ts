import { Database } from "bun:sqlite";
import { join } from "path";

const dbPath = join(import.meta.dir, "..", "data", "data.db");
const db = new Database(dbPath, { create: true });

db.run("PRAGMA journal_mode = WAL");
db.run("PRAGMA foreign_keys = ON");

db.run(`
  CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    amount REAL NOT NULL,
    currency TEXT NOT NULL DEFAULT 'PLN',
    merchant TEXT NOT NULL,
    category TEXT,
    note TEXT,
    card_last4 TEXT,
    timestamp TEXT NOT NULL DEFAULT (datetime('now')),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`);

export default db;
