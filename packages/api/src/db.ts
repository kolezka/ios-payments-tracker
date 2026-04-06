import { Database } from "bun:sqlite";
import { join } from "path";
import { logger } from "./logger";

const dbPath = process.env.DB_PATH ?? join(import.meta.dir, "..", "data", "data.db");
logger.info({ dbPath }, "opening database");

const db = new Database(dbPath, { create: true });

db.run("PRAGMA journal_mode = WAL");
db.run("PRAGMA foreign_keys = ON");
logger.debug("database pragmas set (WAL mode, foreign keys ON)");

// Create tables
db.run(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL DEFAULT '',
    github_id TEXT UNIQUE,
    api_token TEXT UNIQUE NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  )
`);

db.run(`
  CREATE TABLE IF NOT EXISTS magic_links (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL,
    token TEXT UNIQUE NOT NULL,
    expires_at TEXT NOT NULL,
    used INTEGER DEFAULT 0
  )
`);

db.run(`
  CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    amount REAL NOT NULL,
    card TEXT,
    seller TEXT NOT NULL,
    title TEXT,
    user_id INTEGER REFERENCES users(id),
    timestamp TEXT NOT NULL DEFAULT (datetime('now')),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`);

// Migration: if transactions exist without user_id, create default user and assign
const hasOrphanedTx = db.prepare(
  "SELECT COUNT(*) as count FROM transactions WHERE user_id IS NULL"
).get() as { count: number };

if (hasOrphanedTx.count > 0) {
  logger.info({ count: hasOrphanedTx.count }, "migrating orphaned transactions to default user");
  const token = crypto.randomUUID();
  db.run(
    "INSERT OR IGNORE INTO users (email, name, api_token) VALUES (?, ?, ?)",
    ["admin@local", "Admin", token]
  );
  const adminUser = db.prepare("SELECT id FROM users WHERE email = ?").get("admin@local") as { id: number };
  db.run("UPDATE transactions SET user_id = ? WHERE user_id IS NULL", [adminUser.id]);
  logger.info({ userId: adminUser.id, token }, "migration complete — admin token printed above");
}

logger.info("database initialized");

export default db;
