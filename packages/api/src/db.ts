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

// Add encryption_key column if not exists (migration)
const userColumns = db.prepare("PRAGMA table_info(users)").all() as { name: string }[];
if (!userColumns.some((c) => c.name === "encryption_key")) {
  db.run("ALTER TABLE users ADD COLUMN encryption_key TEXT");
}

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
// For existing databases: amount was REAL, now stores encrypted TEXT.
// SQLite is dynamically typed so no ALTER needed — existing REAL column accepts TEXT values.

db.run(`
  CREATE TABLE IF NOT EXISTS webhooks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    url TEXT NOT NULL,
    events TEXT NOT NULL DEFAULT 'transaction.created',
    secret TEXT,
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`);

logger.info("database initialized");

export default db;
