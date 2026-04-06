# Multi-User Auth + Apple Glass UI Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform Payment Tracker from single-user/terminal aesthetic into a multi-user app with magic link + GitHub OAuth auth, per-user API tokens, Apple Shortcut auto-setup, and an Apple Glass UI built with Tailwind CSS v4.

**Architecture:** Database gains `users` and `magic_links` tables; transactions scoped by `user_id`. Auth middleware looks up per-user tokens instead of shared env var. SvelteKit frontend gets Tailwind v4, glassmorphic design system, and new pages (login, onboarding, setup). Stats endpoint extended with daily totals and card breakdown for charts.

**Tech Stack:** Bun, Hono, SvelteKit 5, bun:sqlite, Tailwind CSS v4, nodemailer, qrcode, Zod

**Spec:** `docs/superpowers/specs/2026-04-06-multiuser-glass-redesign.md`

---

## File Map

### API — New Files
- `packages/api/src/routes/auth.ts` — Magic link + GitHub OAuth endpoints
- `packages/api/src/routes/shortcut.ts` — Shortcut download endpoint
- `packages/api/src/mail.ts` — SMTP/nodemailer setup + send magic link email

### API — Modified Files
- `packages/api/src/db.ts` — Add `users` + `magic_links` tables, migration logic
- `packages/api/src/middleware/auth.ts` — Look up per-user `api_token` instead of env var
- `packages/api/src/routes/transactions.ts` — Scope all queries by `user_id`
- `packages/api/src/schemas.ts` — Add auth schemas (magic link, register, etc.)
- `packages/api/src/types.ts` — Add `User`, `MagicLink` interfaces
- `packages/api/src/index.ts` — Mount auth + shortcut routes, adjust public/protected paths

### Web — New Files
- `packages/web/src/app.css` — Tailwind import + glass design tokens
- `packages/web/src/routes/auth/verify/+page.server.ts` — Magic link callback
- `packages/web/src/routes/auth/verify/+page.svelte` — Verify status page
- `packages/web/src/routes/auth/github/callback/+page.server.ts` — GitHub OAuth callback
- `packages/web/src/routes/onboarding/+page.svelte` — First-time name prompt
- `packages/web/src/routes/onboarding/+page.server.ts` — Name update action
- `packages/web/src/routes/setup/+page.svelte` — Shortcut setup page
- `packages/web/src/routes/setup/+page.server.ts` — Load user token + API URL
- `packages/web/src/lib/components/Navbar.svelte` — Floating glass navbar with avatar dropdown
- `packages/web/src/lib/components/BarChart.svelte` — Daily spending bar chart
- `packages/web/src/lib/components/DonutChart.svelte` — Card breakdown donut chart
- `packages/web/src/lib/components/DayGroup.svelte` — Day-grouped transaction section

### Web — Modified Files
- `packages/web/vite.config.ts` — Add `@tailwindcss/vite` plugin
- `packages/web/src/routes/+layout.svelte` — Import app.css, add Navbar, remove old styles
- `packages/web/src/routes/+page.svelte` — Replace with glass design, add charts, day groups
- `packages/web/src/routes/+page.server.ts` — Use user token from locals, increase page size
- `packages/web/src/routes/login/+page.svelte` — Magic link + GitHub OAuth UI
- `packages/web/src/routes/login/+page.server.ts` — Magic link send action
- `packages/web/src/hooks.server.ts` — Look up session cookie as api_token in API
- `packages/web/src/lib/api.ts` — No changes needed (already takes token param)
- `packages/web/src/lib/components/FilterBar.svelte` — Rewrite with Tailwind glass
- `packages/web/src/lib/components/TransactionCard.svelte` — Rewrite with Tailwind glass
- `packages/web/src/lib/components/Pagination.svelte` — Rewrite with Tailwind glass
- `packages/web/src/lib/components/Stats.svelte` — Remove (replaced by BarChart + DonutChart)
- `packages/web/src/lib/components/TransactionList.svelte` — Remove (replaced by DayGroup)

---

## Task 1: Database Schema — Users + Magic Links + Migration

**Files:**
- Modify: `packages/api/src/db.ts`
- Modify: `packages/api/src/types.ts`

- [ ] **Step 1: Add User and MagicLink types**

In `packages/api/src/types.ts`, add:

```typescript
export interface User {
  id: number;
  email: string;
  name: string;
  github_id: string | null;
  api_token: string;
  created_at: string;
}

export interface MagicLink {
  id: number;
  email: string;
  token: string;
  expires_at: string;
  used: number;
}
```

- [ ] **Step 2: Add users and magic_links tables + migration**

Replace the content of `packages/api/src/db.ts` with:

```typescript
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
```

- [ ] **Step 3: Verify database initializes correctly**

Run: `bun packages/api/src/db.ts`

Expected: No errors, logs show "database initialized". If existing transactions exist, logs show migration message.

- [ ] **Step 4: Commit**

```bash
git add packages/api/src/db.ts packages/api/src/types.ts
git commit -m "feat: add users and magic_links tables with migration"
```

---

## Task 2: Auth Middleware — Per-User Token Lookup

**Files:**
- Modify: `packages/api/src/middleware/auth.ts`

- [ ] **Step 1: Rewrite auth middleware to look up per-user tokens**

Replace `packages/api/src/middleware/auth.ts` with:

```typescript
import { createMiddleware } from "hono/factory";
import { logger } from "../logger";
import db from "../db";
import type { User } from "../types";

export const authMiddleware = createMiddleware(async (c, next) => {
  const header = c.req.header("Authorization");
  if (!header) {
    logger.warn({ path: c.req.path, method: c.req.method }, "missing Authorization header");
    return c.json({ error: "Unauthorized" }, 401);
  }

  // Accept both "Bearer <token>" and raw "<token>" (iOS Shortcuts sends raw)
  const isBearerFormat = header.startsWith("Bearer ");
  const token = isBearerFormat ? header.slice(7) : header;

  const user = db.prepare("SELECT * FROM users WHERE api_token = ?").get(token) as User | null;
  if (!user) {
    logger.warn({ path: c.req.path, isBearerFormat, tokenLength: token.length }, "invalid auth token");
    return c.json({ error: "Unauthorized" }, 401);
  }

  logger.debug({ userId: user.id, email: user.email }, "authenticated");
  c.set("user", user);
  c.set("userId", user.id);

  await next();
});
```

- [ ] **Step 2: Verify API starts without errors**

Run: `bun packages/api/src/index.ts`

Expected: Server starts on port 3010. Requests without valid user token return 401.

- [ ] **Step 3: Commit**

```bash
git add packages/api/src/middleware/auth.ts
git commit -m "feat: auth middleware looks up per-user api_token"
```

---

## Task 3: Scope Transactions by User

**Files:**
- Modify: `packages/api/src/routes/transactions.ts`

- [ ] **Step 1: Add user_id to all transaction queries**

Replace `packages/api/src/routes/transactions.ts` with:

```typescript
import { Hono } from "hono";
import db from "../db";
import { logger } from "../logger";
import type { Transaction } from "../types";
import {
  createTransactionSchema,
  listTransactionsSchema,
  statsQuerySchema,
  idParamSchema,
} from "../schemas";

const transactions = new Hono();

// POST /api/transactions — create
transactions.post("/", async (c) => {
  const userId = c.get("userId") as number;

  let body: unknown;
  try {
    body = await c.req.json();
  } catch (e) {
    const raw = await c.req.text();
    logger.error({ raw, error: String(e) }, "failed to parse JSON body");
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const contentType = c.req.header("Content-Type");
  logger.info({ contentType, body }, "incoming transaction");

  const result = createTransactionSchema.safeParse(body);
  if (!result.success) {
    logger.warn({ errors: result.error.flatten() }, "validation failed");
    return c.json({ error: result.error.flatten() }, 400);
  }

  const { amount, seller, card, title } = result.data;
  logger.info({ amount, seller, card, title, userId }, "parsed transaction");

  const stmt = db.prepare(`
    INSERT INTO transactions (amount, seller, card, title, user_id)
    VALUES (?, ?, ?, ?, ?)
  `);
  const insertResult = stmt.run(amount, seller, card, title, userId);

  const created = db
    .prepare("SELECT * FROM transactions WHERE id = ?")
    .get(insertResult.lastInsertRowid) as Transaction;

  logger.info({ id: created.id, amount, seller, userId }, "transaction created");
  return c.json(created, 201);
});

// GET /api/transactions/stats
transactions.get("/stats", (c) => {
  const userId = c.get("userId") as number;
  const result = statsQuerySchema.safeParse(c.req.query());
  if (!result.success) {
    return c.json({ error: result.error.flatten() }, 400);
  }

  const { from, to } = result.data;
  logger.debug({ from, to, userId }, "stats request");

  let dateFilter = "";
  const params: (string | number)[] = [userId];
  if (from) {
    dateFilter += " AND timestamp >= ?";
    params.push(from);
  }
  if (to) {
    dateFilter += " AND timestamp <= ?";
    params.push(to + " 23:59:59");
  }

  const summary = db.prepare(
    `SELECT COALESCE(SUM(amount), 0) as total_spent, COUNT(*) as transaction_count, COALESCE(AVG(amount), 0) as avg_transaction
     FROM transactions WHERE user_id = ?${dateFilter}`
  ).get(...params) as { total_spent: number; transaction_count: number; avg_transaction: number };

  const topSellers = db.prepare(
    `SELECT seller, COUNT(*) as count, SUM(amount) as total
     FROM transactions WHERE user_id = ?${dateFilter}
     GROUP BY seller ORDER BY total DESC LIMIT 10`
  ).all(...params) as { seller: string; count: number; total: number }[];

  const dailyTotals = db.prepare(
    `SELECT DATE(timestamp) as date, SUM(amount) as total
     FROM transactions WHERE user_id = ?${dateFilter}
     GROUP BY DATE(timestamp) ORDER BY date DESC LIMIT 30`
  ).all(...params) as { date: string; total: number }[];

  const cardBreakdown = db.prepare(
    `SELECT COALESCE(card, 'Unknown') as card, SUM(amount) as total
     FROM transactions WHERE user_id = ?${dateFilter}
     GROUP BY card ORDER BY total DESC`
  ).all(...params) as { card: string; total: number }[];

  // Calculate percentages for card breakdown
  const cardTotal = cardBreakdown.reduce((sum, c) => sum + c.total, 0);
  const cardWithPct = cardBreakdown.map((c) => ({
    card: c.card,
    total: c.total,
    percentage: cardTotal > 0 ? Math.round((c.total / cardTotal) * 100) : 0,
  }));

  logger.info({ transaction_count: summary.transaction_count, userId }, "stats computed");

  return c.json({
    total_spent: summary.total_spent,
    transaction_count: summary.transaction_count,
    avg_transaction: Math.round(summary.avg_transaction * 100) / 100,
    top_sellers: topSellers,
    daily_totals: dailyTotals,
    card_breakdown: cardWithPct,
  });
});

// GET /api/transactions — list
transactions.get("/", (c) => {
  const userId = c.get("userId") as number;
  const result = listTransactionsSchema.safeParse(c.req.query());
  if (!result.success) {
    return c.json({ error: result.error.flatten() }, 400);
  }

  const { limit, offset, from, to } = result.data;
  logger.debug({ limit, offset, from, to, userId }, "list transactions request");

  let dateFilter = "";
  const params: (string | number)[] = [userId];
  if (from) {
    dateFilter += " AND timestamp >= ?";
    params.push(from);
  }
  if (to) {
    dateFilter += " AND timestamp <= ?";
    params.push(to + " 23:59:59");
  }

  const countParams = [...params];
  const totalRow = db.prepare(
    `SELECT COUNT(*) as count FROM transactions WHERE user_id = ?${dateFilter}`
  ).get(...countParams) as { count: number };

  params.push(limit, offset);
  const rows = db.prepare(
    `SELECT * FROM transactions WHERE user_id = ?${dateFilter} ORDER BY timestamp DESC LIMIT ? OFFSET ?`
  ).all(...params) as Transaction[];

  logger.info({ total: totalRow.count, returned: rows.length, userId }, "list transactions response");
  return c.json({ transactions: rows, total: totalRow.count });
});

// DELETE /api/transactions/:id
transactions.delete("/:id", (c) => {
  const userId = c.get("userId") as number;
  const result = idParamSchema.safeParse({ id: c.req.param("id") });
  if (!result.success) {
    return c.json({ error: "Invalid transaction ID" }, 400);
  }

  const { id } = result.data;
  const existing = db.prepare("SELECT id FROM transactions WHERE id = ? AND user_id = ?").get(id, userId);
  if (!existing) {
    logger.warn({ id, userId }, "transaction not found for deletion");
    return c.json({ error: "Transaction not found" }, 404);
  }
  db.prepare("DELETE FROM transactions WHERE id = ? AND user_id = ?").run(id, userId);
  logger.info({ id, userId }, "transaction deleted");
  return c.json({ success: true });
});

export default transactions;
```

- [ ] **Step 2: Commit**

```bash
git add packages/api/src/routes/transactions.ts
git commit -m "feat: scope all transaction queries by user_id"
```

---

## Task 4: SMTP Mail Service

**Files:**
- Create: `packages/api/src/mail.ts`

- [ ] **Step 1: Install nodemailer**

Run: `cd /Users/me/Development/ios-budget-fn && bun add nodemailer --cwd packages/api && bun add -d @types/nodemailer --cwd packages/api`

- [ ] **Step 2: Create mail service**

Create `packages/api/src/mail.ts`:

```typescript
import nodemailer from "nodemailer";
import { logger } from "./logger";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT ?? "587"),
  secure: process.env.SMTP_PORT === "465",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const from = process.env.SMTP_FROM ?? "Payment Tracker <noreply@localhost>";

export async function sendMagicLinkEmail(email: string, token: string): Promise<void> {
  const baseUrl = process.env.BASE_URL ?? "http://localhost:5173";
  const url = `${baseUrl}/auth/verify?token=${token}`;

  logger.info({ email, url }, "sending magic link email");

  await transporter.sendMail({
    from,
    to: email,
    subject: "Sign in to Payment Tracker",
    text: `Click this link to sign in:\n\n${url}\n\nThis link expires in 15 minutes.`,
    html: `
      <div style="font-family: -apple-system, system-ui, sans-serif; max-width: 400px; margin: 0 auto; padding: 2rem;">
        <h2 style="color: #e2e8f0; margin: 0 0 1rem;">Payment Tracker</h2>
        <p style="color: #94a3b8; margin: 0 0 1.5rem;">Click the button below to sign in. This link expires in 15 minutes.</p>
        <a href="${url}" style="display: inline-block; background: #6366f1; color: #fff; padding: 0.75rem 1.5rem; border-radius: 8px; text-decoration: none; font-weight: 500;">Sign in</a>
      </div>
    `,
  });

  logger.info({ email }, "magic link email sent");
}
```

- [ ] **Step 3: Commit**

```bash
git add packages/api/src/mail.ts packages/api/package.json bun.lock
git commit -m "feat: add nodemailer SMTP service for magic links"
```

---

## Task 5: Auth API Routes — Magic Link + GitHub OAuth

**Files:**
- Create: `packages/api/src/routes/auth.ts`
- Modify: `packages/api/src/schemas.ts`
- Modify: `packages/api/src/index.ts`

- [ ] **Step 1: Add auth schemas**

Add to the end of `packages/api/src/schemas.ts`:

```typescript
export const magicLinkSchema = z.object({
  email: z.string().email("Invalid email address"),
});

export const verifyTokenSchema = z.object({
  token: z.string().min(1, "Token is required"),
});

export const updateNameSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
});
```

- [ ] **Step 2: Create auth routes**

Create `packages/api/src/routes/auth.ts`:

```typescript
import { Hono } from "hono";
import db from "../db";
import { logger } from "../logger";
import { sendMagicLinkEmail } from "../mail";
import { magicLinkSchema, verifyTokenSchema, updateNameSchema } from "../schemas";
import type { User } from "../types";

const auth = new Hono();

// POST /api/auth/magic-link — send magic link email
auth.post("/magic-link", async (c) => {
  const body = await c.req.json();
  const result = magicLinkSchema.safeParse(body);
  if (!result.success) {
    return c.json({ error: result.error.flatten() }, 400);
  }

  const { email } = result.data;
  const token = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

  db.prepare("INSERT INTO magic_links (email, token, expires_at) VALUES (?, ?, ?)").run(email, token, expiresAt);

  try {
    await sendMagicLinkEmail(email, token);
  } catch (err) {
    logger.error({ email, error: String(err) }, "failed to send magic link email");
    return c.json({ error: "Failed to send email" }, 500);
  }

  logger.info({ email }, "magic link sent");
  return c.json({ success: true });
});

// GET /api/auth/verify — verify magic link token
auth.get("/verify", (c) => {
  const token = c.req.query("token");
  if (!token) {
    return c.json({ error: "Token is required" }, 400);
  }

  const link = db.prepare(
    "SELECT * FROM magic_links WHERE token = ? AND used = 0"
  ).get(token) as { email: string; expires_at: string; id: number } | null;

  if (!link) {
    return c.json({ error: "Invalid or expired link" }, 400);
  }

  if (new Date(link.expires_at) < new Date()) {
    return c.json({ error: "Link has expired" }, 400);
  }

  // Mark as used
  db.prepare("UPDATE magic_links SET used = 1 WHERE id = ?").run(link.id);

  // Find or create user
  let user = db.prepare("SELECT * FROM users WHERE email = ?").get(link.email) as User | null;

  if (!user) {
    const apiToken = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
    db.prepare("INSERT INTO users (email, name, api_token) VALUES (?, ?, ?)").run(link.email, "", apiToken);
    user = db.prepare("SELECT * FROM users WHERE email = ?").get(link.email) as User;
    logger.info({ email: link.email, userId: user.id }, "new user created via magic link");
  } else {
    logger.info({ email: link.email, userId: user.id }, "existing user logged in via magic link");
  }

  return c.json({ api_token: user.api_token, is_new: user.name === "" });
});

// GET /api/auth/github — redirect to GitHub OAuth
auth.get("/github", (c) => {
  const clientId = process.env.GITHUB_CLIENT_ID;
  if (!clientId) {
    return c.json({ error: "GitHub OAuth not configured" }, 500);
  }

  const baseUrl = process.env.BASE_URL ?? "http://localhost:5173";
  const redirectUri = `${baseUrl}/auth/github/callback`;
  const url = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=user:email`;

  return c.redirect(url);
});

// POST /api/auth/github/callback — exchange code for token
auth.post("/github/callback", async (c) => {
  const { code } = await c.req.json();
  if (!code) {
    return c.json({ error: "Code is required" }, 400);
  }

  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return c.json({ error: "GitHub OAuth not configured" }, 500);
  }

  // Exchange code for access token
  const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code }),
  });
  const tokenData = (await tokenRes.json()) as { access_token?: string; error?: string };

  if (!tokenData.access_token) {
    logger.warn({ error: tokenData.error }, "GitHub OAuth token exchange failed");
    return c.json({ error: "GitHub authentication failed" }, 400);
  }

  // Fetch user profile
  const userRes = await fetch("https://api.github.com/user", {
    headers: { Authorization: `Bearer ${tokenData.access_token}`, Accept: "application/json" },
  });
  const ghUser = (await userRes.json()) as { id: number; login: string; name: string | null; email: string | null };

  // Fetch email if not public
  let email = ghUser.email;
  if (!email) {
    const emailsRes = await fetch("https://api.github.com/user/emails", {
      headers: { Authorization: `Bearer ${tokenData.access_token}`, Accept: "application/json" },
    });
    const emails = (await emailsRes.json()) as { email: string; primary: boolean }[];
    email = emails.find((e) => e.primary)?.email ?? emails[0]?.email ?? null;
  }

  if (!email) {
    return c.json({ error: "Could not retrieve email from GitHub" }, 400);
  }

  const ghIdStr = String(ghUser.id);
  const name = ghUser.name ?? ghUser.login;

  // Find existing user by github_id or email
  let user = db.prepare("SELECT * FROM users WHERE github_id = ?").get(ghIdStr) as User | null;
  if (!user) {
    user = db.prepare("SELECT * FROM users WHERE email = ?").get(email) as User | null;
    if (user) {
      // Link GitHub to existing account
      db.prepare("UPDATE users SET github_id = ?, name = CASE WHEN name = '' THEN ? ELSE name END WHERE id = ?")
        .run(ghIdStr, name, user.id);
    }
  }

  if (!user) {
    const apiToken = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
    db.prepare("INSERT INTO users (email, name, github_id, api_token) VALUES (?, ?, ?, ?)")
      .run(email, name, ghIdStr, apiToken);
    user = db.prepare("SELECT * FROM users WHERE github_id = ?").get(ghIdStr) as User;
    logger.info({ email, githubId: ghIdStr, userId: user.id }, "new user created via GitHub");
  } else {
    logger.info({ email, githubId: ghIdStr, userId: user.id }, "existing user logged in via GitHub");
  }

  return c.json({ api_token: user.api_token, is_new: false });
});

// PATCH /api/auth/me — update user name (for onboarding)
auth.patch("/me", async (c) => {
  const token = c.req.header("Authorization")?.replace("Bearer ", "");
  const user = db.prepare("SELECT * FROM users WHERE api_token = ?").get(token) as User | null;
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const body = await c.req.json();
  const result = updateNameSchema.safeParse(body);
  if (!result.success) {
    return c.json({ error: result.error.flatten() }, 400);
  }

  db.prepare("UPDATE users SET name = ? WHERE id = ?").run(result.data.name, user.id);
  logger.info({ userId: user.id, name: result.data.name }, "user name updated");
  return c.json({ success: true });
});

// GET /api/auth/me — get current user info
auth.get("/me", (c) => {
  const token = c.req.header("Authorization")?.replace("Bearer ", "");
  const user = db.prepare("SELECT id, email, name, api_token, created_at FROM users WHERE api_token = ?").get(token) as Omit<User, "github_id"> | null;
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  return c.json(user);
});

export default auth;
```

- [ ] **Step 3: Mount auth routes in index.ts (public, no authMiddleware)**

Replace `packages/api/src/index.ts` with:

```typescript
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger as honoLogger } from "hono/logger";
import { logger } from "./logger";
import { authMiddleware } from "./middleware/auth";
import transactions from "./routes/transactions";
import auth from "./routes/auth";

const app = new Hono();

app.use(honoLogger((msg) => logger.info(msg)));

const corsOrigin = process.env.WEB_ORIGIN ?? "http://localhost:5173";
logger.info({ corsOrigin }, "CORS configured");

app.use(
  "/api/*",
  cors({
    origin: corsOrigin,
    credentials: true,
  })
);

// Public routes (no auth)
app.route("/api/auth", auth);

// Protected routes
app.use("/api/transactions/*", authMiddleware);
app.use("/api/transactions", authMiddleware);
app.route("/api/transactions", transactions);

app.get("/health", (c) => {
  logger.debug("health check");
  return c.json({ status: "ok" });
});

const port = parseInt(process.env.PORT ?? "3010");
logger.info({ port }, "server starting");

export default {
  fetch: app.fetch,
  port,
};
```

- [ ] **Step 4: Verify API starts and auth routes respond**

Run: `bun packages/api/src/index.ts`

Test: `curl -s http://localhost:3010/api/auth/me | head` should return 401.

- [ ] **Step 5: Commit**

```bash
git add packages/api/src/routes/auth.ts packages/api/src/schemas.ts packages/api/src/index.ts
git commit -m "feat: add magic link and GitHub OAuth auth routes"
```

---

## Task 6: Shortcut Download Endpoint

**Files:**
- Create: `packages/api/src/routes/shortcut.ts`
- Modify: `packages/api/src/index.ts`

- [ ] **Step 1: Create shortcut route**

Create `packages/api/src/routes/shortcut.ts`:

```typescript
import { Hono } from "hono";
import db from "../db";
import type { User } from "../types";
import { logger } from "../logger";

const shortcut = new Hono();

// GET /api/shortcut/download — download .shortcut file with user's token
shortcut.get("/download", (c) => {
  const token = c.req.header("Authorization")?.replace("Bearer ", "");
  const user = db.prepare("SELECT * FROM users WHERE api_token = ?").get(token) as User | null;
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const baseUrl = process.env.BASE_URL ?? "http://localhost:3010";
  const apiUrl = `${baseUrl}/api/transactions`;

  // Generate a minimal Apple Shortcut plist
  const plist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>WFWorkflowActions</key>
  <array>
    <dict>
      <key>WFWorkflowActionIdentifier</key>
      <string>is.workflow.actions.ask</string>
      <key>WFWorkflowActionParameters</key>
      <dict>
        <key>WFAskActionPrompt</key>
        <string>Amount</string>
        <key>WFAskActionDefaultAnswer</key>
        <string></string>
      </dict>
    </dict>
    <dict>
      <key>WFWorkflowActionIdentifier</key>
      <string>is.workflow.actions.setvariable</string>
      <key>WFWorkflowActionParameters</key>
      <dict>
        <key>WFVariableName</key>
        <string>amount</string>
      </dict>
    </dict>
    <dict>
      <key>WFWorkflowActionIdentifier</key>
      <string>is.workflow.actions.ask</string>
      <key>WFWorkflowActionParameters</key>
      <dict>
        <key>WFAskActionPrompt</key>
        <string>Seller</string>
        <key>WFAskActionDefaultAnswer</key>
        <string></string>
      </dict>
    </dict>
    <dict>
      <key>WFWorkflowActionIdentifier</key>
      <string>is.workflow.actions.setvariable</string>
      <key>WFWorkflowActionParameters</key>
      <dict>
        <key>WFVariableName</key>
        <string>seller</string>
      </dict>
    </dict>
    <dict>
      <key>WFWorkflowActionIdentifier</key>
      <string>is.workflow.actions.ask</string>
      <key>WFWorkflowActionParameters</key>
      <dict>
        <key>WFAskActionPrompt</key>
        <string>Card (optional)</string>
        <key>WFAskActionDefaultAnswer</key>
        <string></string>
      </dict>
    </dict>
    <dict>
      <key>WFWorkflowActionIdentifier</key>
      <string>is.workflow.actions.setvariable</string>
      <key>WFWorkflowActionParameters</key>
      <dict>
        <key>WFVariableName</key>
        <string>card</string>
      </dict>
    </dict>
    <dict>
      <key>WFWorkflowActionIdentifier</key>
      <string>is.workflow.actions.ask</string>
      <key>WFWorkflowActionParameters</key>
      <dict>
        <key>WFAskActionPrompt</key>
        <string>Title (optional)</string>
        <key>WFAskActionDefaultAnswer</key>
        <string></string>
      </dict>
    </dict>
    <dict>
      <key>WFWorkflowActionIdentifier</key>
      <string>is.workflow.actions.setvariable</string>
      <key>WFWorkflowActionParameters</key>
      <dict>
        <key>WFVariableName</key>
        <string>title</string>
      </dict>
    </dict>
    <dict>
      <key>WFWorkflowActionIdentifier</key>
      <string>is.workflow.actions.downloadurl</string>
      <key>WFWorkflowActionParameters</key>
      <dict>
        <key>WFURL</key>
        <string>${apiUrl}</string>
        <key>WFHTTPMethod</key>
        <string>POST</string>
        <key>WFHTTPHeaders</key>
        <dict>
          <key>Value</key>
          <dict>
            <key>WFDictionaryFieldValueItems</key>
            <array>
              <dict>
                <key>WFItemType</key>
                <integer>0</integer>
                <key>WFKey</key>
                <string>Authorization</string>
                <key>WFValue</key>
                <string>Bearer ${user.api_token}</string>
              </dict>
              <dict>
                <key>WFItemType</key>
                <integer>0</integer>
                <key>WFKey</key>
                <string>Content-Type</string>
                <key>WFValue</key>
                <string>application/json</string>
              </dict>
            </array>
          </dict>
        </dict>
        <key>WFHTTPBodyType</key>
        <string>Json</string>
      </dict>
    </dict>
  </array>
  <key>WFWorkflowName</key>
  <string>Add Payment</string>
  <key>WFWorkflowMinimumClientVersion</key>
  <string>900</string>
</dict>
</plist>`;

  logger.info({ userId: user.id }, "shortcut file downloaded");

  return new Response(plist, {
    headers: {
      "Content-Type": "application/x-apple-shortcut",
      "Content-Disposition": 'attachment; filename="Add Payment.shortcut"',
    },
  });
});

export default shortcut;
```

- [ ] **Step 2: Mount shortcut route (protected)**

In `packages/api/src/index.ts`, add after the transactions route mounting:

```typescript
import shortcut from "./routes/shortcut";
```

And add after `app.route("/api/transactions", transactions);`:

```typescript
app.use("/api/shortcut/*", authMiddleware);
app.route("/api/shortcut", shortcut);
```

- [ ] **Step 3: Commit**

```bash
git add packages/api/src/routes/shortcut.ts packages/api/src/index.ts
git commit -m "feat: add Apple Shortcut .shortcut file download endpoint"
```

---

## Task 7: Install Tailwind CSS v4 + Glass Design Tokens

**Files:**
- Modify: `packages/web/vite.config.ts`
- Create: `packages/web/src/app.css`
- Modify: `packages/web/src/routes/+layout.svelte`

- [ ] **Step 1: Install Tailwind CSS v4**

Run: `cd /Users/me/Development/ios-budget-fn && bun add -d tailwindcss @tailwindcss/vite --cwd packages/web`

- [ ] **Step 2: Add Tailwind plugin to Vite config**

Replace `packages/web/vite.config.ts` with:

```typescript
import { sveltekit } from "@sveltejs/kit/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [tailwindcss(), sveltekit()],
  envDir: "../..",
});
```

- [ ] **Step 3: Create app.css with Tailwind + glass design tokens**

Create `packages/web/src/app.css`:

```css
@import "tailwindcss";

@theme {
  --color-glass-bg: rgba(255, 255, 255, 0.025);
  --color-glass-bg-strong: rgba(255, 255, 255, 0.04);
  --color-glass-border: rgba(255, 255, 255, 0.06);
  --color-glass-border-strong: rgba(255, 255, 255, 0.08);
  --color-glass-inset: rgba(255, 255, 255, 0.05);
  --color-glass-inset-strong: rgba(255, 255, 255, 0.08);

  --color-bg-base: #080a10;
  --color-text-primary: #e2e8f0;
  --color-text-secondary: #64748b;
  --color-text-muted: #475569;
  --color-text-dim: #334155;
  --color-accent: #a5b4fc;
  --color-expense: #fca5a5;

  --color-badge-indigo-bg: rgba(99, 102, 241, 0.1);
  --color-badge-indigo-text: #a5b4fc;
  --color-badge-emerald-bg: rgba(52, 211, 153, 0.1);
  --color-badge-emerald-text: #6ee7b7;
  --color-badge-amber-bg: rgba(251, 191, 36, 0.1);
  --color-badge-amber-text: #fcd34d;

  --font-sans: -apple-system, "SF Pro Display", "SF Pro Text", system-ui, sans-serif;
}

/* Glass utility classes */
@utility glass {
  background: var(--color-glass-bg);
  backdrop-filter: blur(24px) saturate(1.4);
  -webkit-backdrop-filter: blur(24px) saturate(1.4);
  border: 1px solid var(--color-glass-border);
  box-shadow: inset 0 0.5px 0 var(--color-glass-inset), 0 4px 20px rgba(0, 0, 0, 0.15);
  border-radius: 16px;
}

@utility glass-strong {
  background: var(--color-glass-bg-strong);
  backdrop-filter: blur(30px) saturate(1.6);
  -webkit-backdrop-filter: blur(30px) saturate(1.6);
  border: 1px solid var(--color-glass-border-strong);
  box-shadow: inset 0 0.5px 0 var(--color-glass-inset-strong), 0 8px 32px rgba(0, 0, 0, 0.2);
  border-radius: 16px;
}

/* Global body styles */
body {
  margin: 0;
  background: var(--color-bg-base);
  color: var(--color-text-primary);
  font-family: var(--font-sans);
  -webkit-font-smoothing: antialiased;
}

*, *::before, *::after {
  box-sizing: border-box;
}

/* Ambient background */
@utility bg-ambient {
  background:
    radial-gradient(ellipse 80% 60% at 50% -10%, rgba(99, 102, 241, 0.12), transparent 60%),
    radial-gradient(ellipse 60% 50% at 80% 80%, rgba(59, 130, 246, 0.07), transparent 50%),
    radial-gradient(ellipse 50% 40% at 10% 60%, rgba(139, 92, 246, 0.06), transparent 50%),
    linear-gradient(180deg, #080a10 0%, #0c1020 50%, #080a10 100%);
}
```

- [ ] **Step 4: Update root layout to import app.css and remove old styles**

Replace `packages/web/src/routes/+layout.svelte` with:

```svelte
<script>
  import "../app.css";
  let { children } = $props();
</script>

{@render children()}
```

- [ ] **Step 5: Verify Tailwind works**

Run: `cd /Users/me/Development/ios-budget-fn && bun run dev:web`

Expected: Dev server starts without errors. Page renders with the new font and dark background.

- [ ] **Step 6: Commit**

```bash
git add packages/web/vite.config.ts packages/web/src/app.css packages/web/src/routes/+layout.svelte packages/web/package.json bun.lock
git commit -m "feat: add Tailwind CSS v4 with glass design tokens"
```

---

## Task 8: Web Auth — hooks.server.ts + Login Page

**Files:**
- Modify: `packages/web/src/hooks.server.ts`
- Modify: `packages/web/src/routes/login/+page.server.ts`
- Modify: `packages/web/src/routes/login/+page.svelte`

- [ ] **Step 1: Rewrite hooks.server.ts for per-user auth**

Replace `packages/web/src/hooks.server.ts` with:

```typescript
import { redirect, type Handle } from "@sveltejs/kit";
import { logger } from "$lib/logger";

const API_URL = process.env.API_URL ?? "http://localhost:3010";
const PUBLIC_PATHS = ["/login", "/auth/verify", "/auth/github/callback"];

export const handle: Handle = async ({ event, resolve }) => {
  const start = Date.now();
  const { pathname, search } = event.url;
  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));

  const token = event.cookies.get("session_token");

  if (!isPublic) {
    if (!token) {
      logger.debug({ pathname }, "no session cookie, redirecting to login");
      redirect(303, "/login");
    }

    // Validate token against API
    const res = await fetch(`${API_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      logger.warn({ pathname }, "invalid session token");
      event.cookies.delete("session_token", { path: "/" });
      redirect(303, "/login");
    }

    const user = await res.json();
    event.locals.authToken = token;
    event.locals.user = user;

    // Redirect to onboarding if name not set
    if (user.name === "" && pathname !== "/onboarding") {
      redirect(303, "/onboarding");
    }
  }

  const response = await resolve(event);

  logger.info({
    method: event.request.method,
    path: `${pathname}${search}`,
    status: response.status,
    duration: `${Date.now() - start}ms`,
  }, `${event.request.method} ${pathname} ${response.status}`);

  return response;
};
```

- [ ] **Step 2: Rewrite login page server (magic link + GitHub redirect)**

Replace `packages/web/src/routes/login/+page.server.ts` with:

```typescript
import { fail, redirect, type Actions } from "@sveltejs/kit";
import { logger } from "$lib/logger";

const API_URL = process.env.API_URL ?? "http://localhost:3010";

export const actions: Actions = {
  "magic-link": async ({ request }) => {
    const data = await request.formData();
    const email = data.get("email") as string;

    if (!email) {
      return fail(400, { error: "Email is required", email: "" });
    }

    logger.info({ email }, "magic link request");

    const res = await fetch(`${API_URL}/api/auth/magic-link`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });

    if (!res.ok) {
      const err = await res.json();
      return fail(res.status, { error: err.error ?? "Failed to send email", email });
    }

    return { success: true, email };
  },

  github: async () => {
    const clientId = process.env.GITHUB_CLIENT_ID;
    if (!clientId) {
      return fail(500, { error: "GitHub OAuth not configured" });
    }
    const baseUrl = process.env.BASE_URL ?? "http://localhost:5173";
    const redirectUri = `${baseUrl}/auth/github/callback`;
    redirect(303, `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=user:email`);
  },

  logout: async ({ cookies }) => {
    logger.info("user logged out");
    cookies.delete("session_token", { path: "/" });
    redirect(303, "/login");
  },
};
```

- [ ] **Step 3: Rewrite login page UI with Tailwind glass**

Replace `packages/web/src/routes/login/+page.svelte` with:

```svelte
<script lang="ts">
  import { enhance } from "$app/forms";

  let { form }: { form: any } = $props();
</script>

<div class="fixed inset-0 bg-ambient -z-10"></div>

<div class="min-h-screen flex items-center justify-center px-4">
  <div class="w-full max-w-sm">
    <h1 class="text-2xl font-bold text-text-primary tracking-tight mb-1">Payment Tracker</h1>
    <p class="text-sm text-text-secondary mb-8">Sign in to continue</p>

    {#if form?.success}
      <div class="glass-strong p-6 text-center">
        <p class="text-accent text-lg font-semibold mb-2">Check your email</p>
        <p class="text-text-secondary text-sm">We sent a sign-in link to <strong class="text-text-primary">{form.email}</strong></p>
      </div>
    {:else}
      {#if form?.error}
        <div class="rounded-xl border border-red-500/30 bg-red-500/10 p-3 mb-4 text-sm text-red-300">
          {form.error}
        </div>
      {/if}

      <!-- Magic Link -->
      <form method="POST" action="?/magic-link" use:enhance class="mb-6">
        <input
          type="email"
          name="email"
          placeholder="you@example.com"
          value={form?.email ?? ""}
          autocomplete="email"
          required
          class="w-full px-4 py-3 rounded-xl bg-glass-bg border border-glass-border text-text-primary placeholder-text-muted text-sm focus:outline-none focus:border-accent/40 mb-3 font-sans"
        />
        <button
          type="submit"
          class="w-full py-3 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white text-sm font-semibold transition-colors cursor-pointer"
        >
          Send magic link
        </button>
      </form>

      <!-- Divider -->
      <div class="flex items-center gap-3 mb-6">
        <div class="flex-1 h-px bg-glass-border"></div>
        <span class="text-text-dim text-xs uppercase tracking-wide">or</span>
        <div class="flex-1 h-px bg-glass-border"></div>
      </div>

      <!-- GitHub -->
      <form method="POST" action="?/github" use:enhance>
        <button
          type="submit"
          class="w-full py-3 rounded-xl bg-white/5 border border-glass-border-strong hover:bg-white/8 text-text-primary text-sm font-medium transition-colors flex items-center justify-center gap-2 cursor-pointer"
        >
          <svg class="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
          </svg>
          Sign in with GitHub
        </button>
      </form>
    {/if}
  </div>
</div>
```

- [ ] **Step 4: Commit**

```bash
git add packages/web/src/hooks.server.ts packages/web/src/routes/login/+page.server.ts packages/web/src/routes/login/+page.svelte
git commit -m "feat: magic link + GitHub OAuth login with glass UI"
```

---

## Task 9: Auth Callback Pages

**Files:**
- Create: `packages/web/src/routes/auth/verify/+page.server.ts`
- Create: `packages/web/src/routes/auth/verify/+page.svelte`
- Create: `packages/web/src/routes/auth/github/callback/+page.server.ts`
- Create: `packages/web/src/routes/auth/github/callback/+page.svelte`

- [ ] **Step 1: Create magic link verify page**

Create `packages/web/src/routes/auth/verify/+page.server.ts`:

```typescript
import { redirect, type ServerLoad } from "@sveltejs/kit";
import { logger } from "$lib/logger";

const API_URL = process.env.API_URL ?? "http://localhost:3010";

export const load: ServerLoad = async ({ url, cookies }) => {
  const token = url.searchParams.get("token");
  if (!token) {
    return { error: "Missing token" };
  }

  const res = await fetch(`${API_URL}/api/auth/verify?token=${token}`);
  const data = await res.json();

  if (!res.ok) {
    logger.warn({ error: data.error }, "magic link verification failed");
    return { error: data.error ?? "Invalid or expired link" };
  }

  const isSecure = process.env.NODE_ENV === "production";
  cookies.set("session_token", data.api_token, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: isSecure,
    maxAge: 60 * 60 * 24 * 365,
  });

  logger.info({ isNew: data.is_new }, "magic link verified");
  redirect(303, data.is_new ? "/onboarding" : "/");
};
```

Create `packages/web/src/routes/auth/verify/+page.svelte`:

```svelte
<script lang="ts">
  let { data }: { data: any } = $props();
</script>

<div class="fixed inset-0 bg-ambient -z-10"></div>

<div class="min-h-screen flex items-center justify-center px-4">
  <div class="glass-strong p-8 max-w-sm w-full text-center">
    {#if data.error}
      <p class="text-red-300 text-lg font-semibold mb-2">Link invalid</p>
      <p class="text-text-secondary text-sm mb-4">{data.error}</p>
      <a href="/login" class="text-accent text-sm hover:underline">Back to login</a>
    {:else}
      <p class="text-text-secondary text-sm">Verifying...</p>
    {/if}
  </div>
</div>
```

- [ ] **Step 2: Create GitHub callback page**

Create `packages/web/src/routes/auth/github/callback/+page.server.ts`:

```typescript
import { redirect, type ServerLoad } from "@sveltejs/kit";
import { logger } from "$lib/logger";

const API_URL = process.env.API_URL ?? "http://localhost:3010";

export const load: ServerLoad = async ({ url, cookies }) => {
  const code = url.searchParams.get("code");
  if (!code) {
    return { error: "Missing authorization code" };
  }

  const res = await fetch(`${API_URL}/api/auth/github/callback`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code }),
  });

  const data = await res.json();

  if (!res.ok) {
    logger.warn({ error: data.error }, "GitHub OAuth failed");
    return { error: data.error ?? "GitHub authentication failed" };
  }

  const isSecure = process.env.NODE_ENV === "production";
  cookies.set("session_token", data.api_token, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: isSecure,
    maxAge: 60 * 60 * 24 * 365,
  });

  logger.info("GitHub OAuth successful");
  redirect(303, data.is_new ? "/setup" : "/");
};
```

Create `packages/web/src/routes/auth/github/callback/+page.svelte`:

```svelte
<script lang="ts">
  let { data }: { data: any } = $props();
</script>

<div class="fixed inset-0 bg-ambient -z-10"></div>

<div class="min-h-screen flex items-center justify-center px-4">
  <div class="glass-strong p-8 max-w-sm w-full text-center">
    {#if data.error}
      <p class="text-red-300 text-lg font-semibold mb-2">Authentication failed</p>
      <p class="text-text-secondary text-sm mb-4">{data.error}</p>
      <a href="/login" class="text-accent text-sm hover:underline">Back to login</a>
    {:else}
      <p class="text-text-secondary text-sm">Authenticating with GitHub...</p>
    {/if}
  </div>
</div>
```

- [ ] **Step 3: Commit**

```bash
git add packages/web/src/routes/auth/
git commit -m "feat: add magic link verify and GitHub OAuth callback pages"
```

---

## Task 10: Onboarding Page

**Files:**
- Create: `packages/web/src/routes/onboarding/+page.server.ts`
- Create: `packages/web/src/routes/onboarding/+page.svelte`

- [ ] **Step 1: Create onboarding server**

Create `packages/web/src/routes/onboarding/+page.server.ts`:

```typescript
import { fail, redirect, type Actions } from "@sveltejs/kit";
import { apiFetch } from "$lib/api";

export const actions: Actions = {
  default: async ({ request, locals }) => {
    const data = await request.formData();
    const name = (data.get("name") as string)?.trim();

    if (!name) {
      return fail(400, { error: "Name is required" });
    }

    const res = await apiFetch("/api/auth/me", locals.authToken, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });

    if (!res.ok) {
      return fail(res.status, { error: "Failed to update name" });
    }

    redirect(303, "/setup");
  },
};
```

- [ ] **Step 2: Create onboarding page**

Create `packages/web/src/routes/onboarding/+page.svelte`:

```svelte
<script lang="ts">
  import { enhance } from "$app/forms";

  let { form }: { form: any } = $props();
</script>

<div class="fixed inset-0 bg-ambient -z-10"></div>

<div class="min-h-screen flex items-center justify-center px-4">
  <div class="w-full max-w-sm">
    <h1 class="text-2xl font-bold text-text-primary tracking-tight mb-1">Welcome!</h1>
    <p class="text-sm text-text-secondary mb-8">What should we call you?</p>

    {#if form?.error}
      <div class="rounded-xl border border-red-500/30 bg-red-500/10 p-3 mb-4 text-sm text-red-300">
        {form.error}
      </div>
    {/if}

    <form method="POST" use:enhance>
      <input
        type="text"
        name="name"
        placeholder="Your name"
        required
        autofocus
        class="w-full px-4 py-3 rounded-xl bg-glass-bg border border-glass-border text-text-primary placeholder-text-muted text-sm focus:outline-none focus:border-accent/40 mb-3 font-sans"
      />
      <button
        type="submit"
        class="w-full py-3 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white text-sm font-semibold transition-colors cursor-pointer"
      >
        Continue
      </button>
    </form>
  </div>
</div>
```

- [ ] **Step 3: Commit**

```bash
git add packages/web/src/routes/onboarding/
git commit -m "feat: add onboarding page for first-time name prompt"
```

---

## Task 11: Setup Page — API Token + QR Code + Shortcut Download

**Files:**
- Create: `packages/web/src/routes/setup/+page.server.ts`
- Create: `packages/web/src/routes/setup/+page.svelte`

- [ ] **Step 1: Install qrcode package**

Run: `cd /Users/me/Development/ios-budget-fn && bun add qrcode --cwd packages/web && bun add -d @types/qrcode --cwd packages/web`

- [ ] **Step 2: Create setup page server**

Create `packages/web/src/routes/setup/+page.server.ts`:

```typescript
import type { ServerLoad } from "@sveltejs/kit";
import QRCode from "qrcode";

const API_URL = process.env.API_URL ?? "http://localhost:3010";
const BASE_URL = process.env.BASE_URL ?? "http://localhost:5173";

export const load: ServerLoad = async ({ locals }) => {
  const apiEndpoint = `${API_URL}/api/transactions`;
  const token = locals.authToken;
  const downloadUrl = `${API_URL}/api/shortcut/download`;

  const qrData = `${BASE_URL}/setup`;
  const qrSvg = await QRCode.toString(qrData, { type: "svg", margin: 1, color: { dark: "#a5b4fc", light: "#00000000" } });

  return {
    apiEndpoint,
    token,
    downloadUrl,
    qrSvg,
    user: locals.user,
  };
};
```

- [ ] **Step 3: Create setup page**

Create `packages/web/src/routes/setup/+page.svelte`:

```svelte
<script lang="ts">
  let { data }: { data: any } = $props();
  let copiedField = $state<string | null>(null);

  async function copyToClipboard(text: string, field: string) {
    await navigator.clipboard.writeText(text);
    copiedField = field;
    setTimeout(() => { copiedField = null; }, 2000);
  }
</script>

<div class="fixed inset-0 bg-ambient -z-10"></div>

<div class="max-w-2xl mx-auto px-5 py-12">
  <h1 class="text-2xl font-bold text-text-primary tracking-tight mb-1">Setup Apple Shortcut</h1>
  <p class="text-sm text-text-secondary mb-8">Connect your iPhone to start tracking payments</p>

  <!-- API Endpoint -->
  <div class="glass-strong p-6 mb-4">
    <h2 class="text-xs font-semibold uppercase tracking-widest text-text-muted mb-4">Your API Endpoint</h2>

    <div class="mb-3">
      <label class="text-xs text-text-dim mb-1 block">URL</label>
      <div class="flex gap-2">
        <code class="flex-1 px-3 py-2 rounded-lg bg-black/30 border border-glass-border text-text-secondary text-xs font-mono truncate">{data.apiEndpoint}</code>
        <button
          onclick={() => copyToClipboard(data.apiEndpoint, 'url')}
          class="px-3 py-2 rounded-lg bg-glass-bg border border-glass-border text-text-secondary text-xs hover:text-accent hover:border-accent/30 transition-colors cursor-pointer shrink-0"
        >
          {copiedField === 'url' ? 'Copied!' : 'Copy'}
        </button>
      </div>
    </div>

    <div>
      <label class="text-xs text-text-dim mb-1 block">API Token</label>
      <div class="flex gap-2">
        <code class="flex-1 px-3 py-2 rounded-lg bg-black/30 border border-glass-border text-text-secondary text-xs font-mono truncate">{data.token}</code>
        <button
          onclick={() => copyToClipboard(data.token, 'token')}
          class="px-3 py-2 rounded-lg bg-glass-bg border border-glass-border text-text-secondary text-xs hover:text-accent hover:border-accent/30 transition-colors cursor-pointer shrink-0"
        >
          {copiedField === 'token' ? 'Copied!' : 'Copy'}
        </button>
      </div>
    </div>
  </div>

  <!-- One-Tap Setup -->
  <div class="glass p-6 mb-4">
    <h2 class="text-xs font-semibold uppercase tracking-widest text-text-muted mb-4">One-Tap Setup</h2>
    <a
      href={data.downloadUrl}
      class="block w-full py-3 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white text-sm font-semibold transition-colors text-center"
    >
      Add to Shortcuts
    </a>
    <p class="text-xs text-text-dim mt-3 text-center">Downloads a pre-configured Shortcut with your token</p>
  </div>

  <!-- QR Code -->
  <div class="glass p-6">
    <h2 class="text-xs font-semibold uppercase tracking-widest text-text-muted mb-4">QR Code</h2>
    <div class="flex justify-center">
      <div class="w-40 h-40">
        {@html data.qrSvg}
      </div>
    </div>
    <p class="text-xs text-text-dim mt-3 text-center">Scan from your phone to open this setup page</p>
  </div>

  <div class="mt-8 text-center">
    <a href="/" class="text-accent text-sm hover:underline">Go to dashboard</a>
  </div>
</div>
```

- [ ] **Step 4: Commit**

```bash
git add packages/web/src/routes/setup/ packages/web/package.json bun.lock
git commit -m "feat: add Shortcut setup page with token, download, and QR code"
```

---

## Task 12: Navbar Component

**Files:**
- Create: `packages/web/src/lib/components/Navbar.svelte`
- Modify: `packages/web/src/routes/+layout.svelte`

- [ ] **Step 1: Create Navbar component**

Create `packages/web/src/lib/components/Navbar.svelte`:

```svelte
<script lang="ts">
  import { enhance } from "$app/forms";

  let { user }: { user: { name: string; email: string } | null } = $props();
  let dropdownOpen = $state(false);

  function initials(name: string): string {
    return name
      .split(" ")
      .map((w) => w[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  }

  function handleClickOutside(e: MouseEvent) {
    const target = e.target as HTMLElement;
    if (!target.closest(".nav-dropdown-area")) {
      dropdownOpen = false;
    }
  }
</script>

<svelte:window onclick={handleClickOutside} />

{#if user}
  <div class="sticky top-0 z-50 flex justify-center px-5 py-4" style="background: linear-gradient(180deg, rgba(8,10,16,0.9) 0%, transparent 100%);">
    <nav class="glass-strong flex items-center justify-end w-full max-w-[800px] px-2 py-1.5">
      <div class="nav-dropdown-area relative">
        <button
          onclick={() => dropdownOpen = !dropdownOpen}
          class="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500/40 to-purple-500/40 border-[1.5px] border-white/10 flex items-center justify-center text-xs text-indigo-200 font-semibold cursor-pointer hover:border-white/20 hover:shadow-[0_0_16px_rgba(99,102,241,0.2)] transition-all relative"
        >
          {initials(user.name || user.email)}
          <span class="absolute -bottom-px -right-px w-2 h-2 rounded-full bg-green-500 border-[1.5px] border-bg-base"></span>
        </button>

        {#if dropdownOpen}
          <div class="absolute right-0 top-11 glass-strong min-w-[180px] py-1.5 z-50">
            <div class="px-4 py-2 border-b border-glass-border">
              <div class="text-sm text-text-primary font-medium truncate">{user.name || 'User'}</div>
              <div class="text-xs text-text-dim truncate">{user.email}</div>
            </div>
            <a href="/setup" class="block px-4 py-2 text-sm text-text-secondary hover:text-accent hover:bg-white/5 transition-colors">
              Shortcut Setup
            </a>
            <form method="POST" action="/login?/logout" use:enhance>
              <button type="submit" class="w-full text-left px-4 py-2 text-sm text-text-secondary hover:text-red-300 hover:bg-white/5 transition-colors cursor-pointer">
                Logout
              </button>
            </form>
          </div>
        {/if}
      </div>
    </nav>
  </div>
{/if}
```

- [ ] **Step 2: Add Navbar to layout**

Replace `packages/web/src/routes/+layout.svelte` with:

```svelte
<script>
  import "../app.css";
  import Navbar from "$lib/components/Navbar.svelte";

  let { children, data } = $props();
</script>

<Navbar user={data?.user ?? null} />
{@render children()}
```

- [ ] **Step 3: Create layout server to pass user data**

Create `packages/web/src/routes/+layout.server.ts`:

```typescript
import type { ServerLoad } from "@sveltejs/kit";

export const load: ServerLoad = async ({ locals }) => {
  return {
    user: locals.user ?? null,
  };
};
```

- [ ] **Step 4: Commit**

```bash
git add packages/web/src/lib/components/Navbar.svelte packages/web/src/routes/+layout.svelte packages/web/src/routes/+layout.server.ts
git commit -m "feat: add floating glass navbar with avatar dropdown"
```

---

## Task 13: Chart Components — BarChart + DonutChart

**Files:**
- Create: `packages/web/src/lib/components/BarChart.svelte`
- Create: `packages/web/src/lib/components/DonutChart.svelte`

- [ ] **Step 1: Create BarChart**

Create `packages/web/src/lib/components/BarChart.svelte`:

```svelte
<script lang="ts">
  let { dailyTotals }: { dailyTotals: Array<{ date: string; total: number }> } = $props();

  function formatPLN(amount: number) {
    return new Intl.NumberFormat("pl-PL", { style: "currency", currency: "PLN" }).format(amount);
  }

  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  // Take last 7 days, fill missing
  const last7 = (() => {
    const map = new Map(dailyTotals.map((d) => [d.date, d.total]));
    const result: Array<{ date: string; day: string; total: number }> = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().slice(0, 10);
      result.push({ date: dateStr, day: days[d.getDay()], total: map.get(dateStr) ?? 0 });
    }
    return result;
  })();

  const maxTotal = Math.max(...last7.map((d) => d.total), 1);
  const weekTotal = last7.reduce((sum, d) => sum + d.total, 0);
</script>

<div class="glass-strong p-5">
  <div class="text-[0.65rem] font-semibold uppercase tracking-widest text-text-muted mb-1">Last 7 Days</div>
  <div class="text-2xl font-bold text-text-primary tracking-tight mb-5">{formatPLN(weekTotal)}</div>
  <div class="flex items-end gap-1 h-20">
    {#each last7 as bar}
      <div class="flex-1 flex flex-col items-center gap-1 h-full justify-end">
        <div
          class="w-full rounded-t min-h-[3px] transition-opacity hover:opacity-80"
          style="height: {Math.max((bar.total / maxTotal) * 100, 4)}%; background: linear-gradient(180deg, rgba(165,180,252,0.8), rgba(99,102,241,0.2));"
        ></div>
        <span class="text-[0.55rem] text-text-dim uppercase tracking-tight">{bar.day}</span>
      </div>
    {/each}
  </div>
</div>
```

- [ ] **Step 2: Create DonutChart**

Create `packages/web/src/lib/components/DonutChart.svelte`:

```svelte
<script lang="ts">
  let { cardBreakdown }: { cardBreakdown: Array<{ card: string; total: number; percentage: number }> } = $props();

  const colors = [
    { stroke: "rgba(99,102,241,0.6)", dot: "rgba(99,102,241,0.7)" },
    { stroke: "rgba(52,211,153,0.5)", dot: "rgba(52,211,153,0.6)" },
    { stroke: "rgba(251,191,36,0.5)", dot: "rgba(251,191,36,0.6)" },
    { stroke: "rgba(244,114,182,0.5)", dot: "rgba(244,114,182,0.6)" },
    { stroke: "rgba(148,163,184,0.4)", dot: "rgba(148,163,184,0.5)" },
  ];

  // Compute SVG circle segments
  const segments = (() => {
    let offset = 25; // Start at top (25 = 12 o'clock for stroke-dashoffset)
    return cardBreakdown.map((c, i) => {
      const seg = { ...c, color: colors[i % colors.length], dashArray: `${c.percentage} ${100 - c.percentage}`, dashOffset: offset };
      offset -= c.percentage;
      return seg;
    });
  })();
</script>

<div class="glass-strong p-5">
  <div class="text-[0.65rem] font-semibold uppercase tracking-widest text-text-muted mb-1">By Card</div>
  <div class="text-2xl font-bold text-text-primary tracking-tight mb-5">{cardBreakdown.length} <span class="text-sm font-medium text-text-secondary">cards</span></div>

  {#if cardBreakdown.length > 0}
    <div class="flex items-center gap-5">
      <svg class="shrink-0" width="80" height="80" viewBox="0 0 36 36">
        <circle cx="18" cy="18" r="14" fill="none" stroke="rgba(255,255,255,0.03)" stroke-width="4"/>
        {#each segments as seg}
          <circle
            cx="18" cy="18" r="14" fill="none"
            stroke={seg.color.stroke}
            stroke-width="4"
            stroke-dasharray={seg.dashArray}
            stroke-dashoffset={seg.dashOffset}
            stroke-linecap="round"
          />
        {/each}
      </svg>
      <div class="flex flex-col gap-2">
        {#each segments as seg}
          <div class="flex items-center gap-2">
            <div class="w-2 h-2 rounded-full shrink-0" style="background: {seg.color.dot};"></div>
            <span class="text-xs text-text-secondary"><strong class="text-slate-300 font-semibold">{seg.card}</strong> {seg.percentage}%</span>
          </div>
        {/each}
      </div>
    </div>
  {:else}
    <p class="text-text-dim text-sm">No transactions yet</p>
  {/if}
</div>
```

- [ ] **Step 3: Commit**

```bash
git add packages/web/src/lib/components/BarChart.svelte packages/web/src/lib/components/DonutChart.svelte
git commit -m "feat: add BarChart and DonutChart glass components"
```

---

## Task 14: DayGroup + TransactionCard Rewrite

**Files:**
- Create: `packages/web/src/lib/components/DayGroup.svelte`
- Modify: `packages/web/src/lib/components/TransactionCard.svelte`

- [ ] **Step 1: Create DayGroup component**

Create `packages/web/src/lib/components/DayGroup.svelte`:

```svelte
<script lang="ts">
  import TransactionCard from "./TransactionCard.svelte";

  let { date, transactions }: {
    date: string;
    transactions: Array<Record<string, any>>;
  } = $props();

  function formatPLN(amount: number) {
    return new Intl.NumberFormat("pl-PL", { style: "currency", currency: "PLN" }).format(amount);
  }

  function formatDayHeader(dateStr: string): string {
    const d = new Date(dateStr + "T00:00:00");
    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    const yesterday = new Date(now.setDate(now.getDate() - 1)).toISOString().slice(0, 10);

    const monthDay = d.toLocaleDateString("en-US", { month: "long", day: "numeric" });

    if (dateStr === today) return `Today — ${monthDay}`;
    if (dateStr === yesterday) return `Yesterday — ${monthDay}`;

    const dayName = d.toLocaleDateString("en-US", { weekday: "long" });
    return `${dayName} — ${monthDay}`;
  }

  const dayTotal = transactions.reduce((sum, t) => sum + t.amount, 0);
</script>

<div class="mb-2">
  <div class="flex items-center gap-3 py-3">
    <span class="text-xs font-semibold text-text-secondary whitespace-nowrap">{formatDayHeader(date)}</span>
    <div class="flex-1 h-px bg-glass-border"></div>
    <span class="text-[0.7rem] text-text-dim whitespace-nowrap">{formatPLN(dayTotal)}</span>
  </div>
  <div class="flex flex-col gap-1.5">
    {#each transactions as transaction (transaction.id)}
      <TransactionCard {transaction} />
    {/each}
  </div>
</div>
```

- [ ] **Step 2: Rewrite TransactionCard with Tailwind**

Replace `packages/web/src/lib/components/TransactionCard.svelte` with:

```svelte
<script lang="ts">
  let { transaction }: { transaction: Record<string, any> } = $props();

  function formatPLN(amount: number) {
    return new Intl.NumberFormat("pl-PL", { style: "currency", currency: "PLN" }).format(amount);
  }

  function formatTime(timestamp: string): string {
    const d = new Date(timestamp + "Z");
    const now = Date.now();
    const diff = now - d.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return mins <= 1 ? "just now" : `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  }

  const badgeColors: Record<string, string> = {};
  const colorPool = [
    "bg-badge-indigo-bg text-badge-indigo-text",
    "bg-badge-emerald-bg text-badge-emerald-text",
    "bg-badge-amber-bg text-badge-amber-text",
  ];

  function getBadgeClass(card: string): string {
    if (!badgeColors[card]) {
      const idx = Object.keys(badgeColors).length % colorPool.length;
      badgeColors[card] = colorPool[idx];
    }
    return badgeColors[card];
  }
</script>

<div class="glass flex justify-between items-center px-5 py-3.5 rounded-[14px] hover:bg-white/[0.04] hover:border-white/[0.08] hover:shadow-[0_2px_16px_rgba(0,0,0,0.1)] transition-all">
  <div>
    <div class="text-[0.95rem] font-medium text-text-primary">{transaction.seller}</div>
    <div class="flex gap-2 items-center mt-1">
      {#if transaction.card}
        <span class="px-2 py-0.5 rounded-md text-[0.65rem] font-medium {getBadgeClass(transaction.card)}">{transaction.card}</span>
      {/if}
      {#if transaction.title}
        <span class="text-[0.78rem] text-text-muted">{transaction.title}</span>
      {/if}
    </div>
  </div>
  <div class="text-right">
    <div class="text-[1.05rem] font-semibold text-expense tracking-tight">{formatPLN(transaction.amount)}</div>
    <div class="text-[0.68rem] text-text-dim mt-0.5">{formatTime(transaction.timestamp)}</div>
  </div>
</div>
```

- [ ] **Step 3: Commit**

```bash
git add packages/web/src/lib/components/DayGroup.svelte packages/web/src/lib/components/TransactionCard.svelte
git commit -m "feat: add DayGroup and rewrite TransactionCard with Tailwind glass"
```

---

## Task 15: FilterBar + Pagination Rewrite

**Files:**
- Modify: `packages/web/src/lib/components/FilterBar.svelte`
- Modify: `packages/web/src/lib/components/Pagination.svelte`

- [ ] **Step 1: Rewrite FilterBar with Tailwind**

Replace `packages/web/src/lib/components/FilterBar.svelte` with:

```svelte
<script lang="ts">
  import { goto } from "$app/navigation";

  interface Filters { from: string; to: string; }
  interface Preset { label: string; from: () => string; to: () => string; }

  let { filters }: { filters: Filters } = $props();

  function today() { return new Date().toISOString().slice(0, 10); }
  function daysAgo(n: number) { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); }
  function firstOfMonth() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`; }
  function firstOfYear() { return `${new Date().getFullYear()}-01-01`; }

  const presets: Preset[] = [
    { label: "7d", from: () => daysAgo(7), to: () => today() },
    { label: "30d", from: () => daysAgo(30), to: () => today() },
    { label: "This month", from: () => firstOfMonth(), to: () => today() },
    { label: "This year", from: () => firstOfYear(), to: () => today() },
    { label: "All", from: () => "", to: () => "" },
  ];

  function activePreset() {
    for (const p of presets) {
      if (filters.from === p.from() && filters.to === p.to()) return p.label;
    }
    return null;
  }

  function applyFilters(f: Filters) {
    const params = new URLSearchParams();
    if (f.from) params.set("from", f.from);
    if (f.to) params.set("to", f.to);
    const qs = params.toString();
    goto(`/${qs ? "?" + qs : ""}`, { replaceState: true });
  }

  function selectPreset(p: Preset) { applyFilters({ from: p.from(), to: p.to() }); }

  function onDateChange(e: Event, field: string) {
    const val = (e.target as HTMLInputElement).value;
    applyFilters({ from: field === "from" ? val : filters.from, to: field === "to" ? val : filters.to });
  }
</script>

<div class="glass flex items-center gap-2 px-4 py-2.5 mb-6 flex-nowrap">
  {#each presets as preset}
    <button
      class="px-3.5 py-1.5 rounded-full text-[0.8rem] font-medium transition-all cursor-pointer
        {activePreset() === preset.label
          ? 'bg-indigo-500/15 border border-indigo-500/30 text-accent shadow-[0_0_12px_rgba(99,102,241,0.1)]'
          : 'bg-white/[0.03] border border-glass-border text-text-muted hover:bg-indigo-500/8 hover:border-indigo-500/15 hover:text-indigo-300'
        }"
      onclick={() => selectPreset(preset)}
    >
      {preset.label}
    </button>
  {/each}
  <div class="ml-auto flex items-center gap-1.5">
    <input
      type="date"
      value={filters.from}
      onchange={(e) => onDateChange(e, "from")}
      class="bg-white/[0.03] border border-glass-border rounded-lg px-2.5 py-1.5 text-text-muted text-xs font-sans focus:outline-none focus:border-accent/40 focus:text-accent"
    />
    <span class="text-text-dim text-xs">→</span>
    <input
      type="date"
      value={filters.to}
      onchange={(e) => onDateChange(e, "to")}
      class="bg-white/[0.03] border border-glass-border rounded-lg px-2.5 py-1.5 text-text-muted text-xs font-sans focus:outline-none focus:border-accent/40 focus:text-accent"
    />
  </div>
</div>
```

- [ ] **Step 2: Rewrite Pagination with Tailwind**

Replace `packages/web/src/lib/components/Pagination.svelte` with:

```svelte
<script lang="ts">
  let { page, totalPages, baseParams }: { page: number; totalPages: number; baseParams: string } = $props();

  function pageUrl(p: number) {
    const params = new URLSearchParams(baseParams);
    if (p > 1) params.set("page", String(p));
    else params.delete("page");
    const qs = params.toString();
    return `/${qs ? "?" + qs : ""}`;
  }
</script>

{#if totalPages > 1}
  <nav class="flex justify-center items-center gap-4 mt-8">
    {#if page > 1}
      <a href={pageUrl(page - 1)} class="px-4 py-2 rounded-lg bg-white/[0.03] border border-glass-border text-text-secondary text-sm hover:bg-white/[0.06] hover:text-accent transition-colors">← prev</a>
    {:else}
      <span class="px-4 py-2 rounded-lg bg-white/[0.03] border border-glass-border text-text-dim text-sm opacity-25">← prev</span>
    {/if}

    <span class="text-text-dim text-sm">page {page} of {totalPages}</span>

    {#if page < totalPages}
      <a href={pageUrl(page + 1)} class="px-4 py-2 rounded-lg bg-white/[0.03] border border-glass-border text-text-secondary text-sm hover:bg-white/[0.06] hover:text-accent transition-colors">next →</a>
    {:else}
      <span class="px-4 py-2 rounded-lg bg-white/[0.03] border border-glass-border text-text-dim text-sm opacity-25">next →</span>
    {/if}
  </nav>
{/if}
```

- [ ] **Step 3: Commit**

```bash
git add packages/web/src/lib/components/FilterBar.svelte packages/web/src/lib/components/Pagination.svelte
git commit -m "feat: rewrite FilterBar and Pagination with Tailwind glass"
```

---

## Task 16: Dashboard Page Rewrite

**Files:**
- Modify: `packages/web/src/routes/+page.svelte`
- Modify: `packages/web/src/routes/+page.server.ts`
- Delete: `packages/web/src/lib/components/Stats.svelte`
- Delete: `packages/web/src/lib/components/TransactionList.svelte`

- [ ] **Step 1: Update page server — increase page size, pass chart data**

Replace `packages/web/src/routes/+page.server.ts` with:

```typescript
import type { ServerLoad } from "@sveltejs/kit";
import { apiFetch } from "$lib/api";
import { logger } from "$lib/logger";

const PAGE_SIZE = 25;

export const load: ServerLoad = async ({ locals, url }) => {
  const from = url.searchParams.get("from") ?? "";
  const to = url.searchParams.get("to") ?? "";
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1"));
  const offset = (page - 1) * PAGE_SIZE;

  logger.debug({ page, from, to, offset }, "dashboard load");

  const filterParams = new URLSearchParams();
  if (from) filterParams.set("from", from);
  if (to) filterParams.set("to", to);

  const listParams = new URLSearchParams(filterParams);
  listParams.set("limit", String(PAGE_SIZE));
  listParams.set("offset", String(offset));

  const start = Date.now();
  const [transactionsRes, statsRes] = await Promise.all([
    apiFetch(`/api/transactions?${listParams}`, locals.authToken),
    apiFetch(`/api/transactions/stats?${filterParams}`, locals.authToken),
  ]);

  const { transactions, total } = await transactionsRes.json();
  const stats = await statsRes.json();
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  logger.info({
    transactionCount: transactions.length,
    total,
    totalPages,
    duration: `${Date.now() - start}ms`,
  }, "dashboard data loaded");

  // Group transactions by date
  const dayGroups: Array<{ date: string; transactions: any[] }> = [];
  const groupMap = new Map<string, any[]>();
  for (const tx of transactions) {
    const date = tx.timestamp.slice(0, 10);
    if (!groupMap.has(date)) {
      groupMap.set(date, []);
      dayGroups.push({ date, transactions: groupMap.get(date)! });
    }
    groupMap.get(date)!.push(tx);
  }

  return {
    dayGroups,
    stats,
    page,
    totalPages,
    filters: { from, to },
  };
};
```

- [ ] **Step 2: Rewrite dashboard page**

Replace `packages/web/src/routes/+page.svelte` with:

```svelte
<script lang="ts">
  import BarChart from "$lib/components/BarChart.svelte";
  import DonutChart from "$lib/components/DonutChart.svelte";
  import FilterBar from "$lib/components/FilterBar.svelte";
  import DayGroup from "$lib/components/DayGroup.svelte";
  import Pagination from "$lib/components/Pagination.svelte";

  let { data }: { data: any } = $props();

  function baseParams() {
    const params = new URLSearchParams();
    if (data.filters.from) params.set("from", data.filters.from);
    if (data.filters.to) params.set("to", data.filters.to);
    return params.toString();
  }
</script>

<div class="fixed inset-0 bg-ambient -z-10"></div>

<div class="max-w-[800px] mx-auto px-5 pb-12">
  <!-- Charts -->
  <div class="grid grid-cols-2 gap-3 mb-6">
    <BarChart dailyTotals={data.stats.daily_totals ?? []} />
    <DonutChart cardBreakdown={data.stats.card_breakdown ?? []} />
  </div>

  <!-- Filters -->
  <FilterBar filters={data.filters} />

  <!-- Transactions by day -->
  {#if data.dayGroups.length === 0}
    <div class="text-center py-12 text-text-muted text-sm">No transactions yet</div>
  {:else}
    {#each data.dayGroups as group (group.date)}
      <DayGroup date={group.date} transactions={group.transactions} />
    {/each}
  {/if}

  <Pagination page={data.page} totalPages={data.totalPages} baseParams={baseParams()} />
</div>
```

- [ ] **Step 3: Delete old components**

Run:

```bash
rm packages/web/src/lib/components/Stats.svelte packages/web/src/lib/components/TransactionList.svelte
```

- [ ] **Step 4: Commit**

```bash
git add packages/web/src/routes/+page.svelte packages/web/src/routes/+page.server.ts
git add -u packages/web/src/lib/components/Stats.svelte packages/web/src/lib/components/TransactionList.svelte
git commit -m "feat: rewrite dashboard with charts, day groups, and glass design"
```

---

## Task 17: Update Environment Config

**Files:**
- Modify: `.env.example`

- [ ] **Step 1: Update .env.example**

Replace `.env.example` with:

```env
# SMTP (for magic link emails)
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=noreply@example.com
SMTP_PASS=your-smtp-password
SMTP_FROM=Payment Tracker <noreply@example.com>

# GitHub OAuth
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret

# App
BASE_URL=http://localhost:5173
API_URL=http://localhost:3010
LOG_LEVEL=debug
```

- [ ] **Step 2: Commit**

```bash
git add .env.example
git commit -m "chore: update .env.example with SMTP and GitHub OAuth vars"
```

---

## Task 18: Update TypeScript Declarations

**Files:**
- Modify: `packages/web/src/app.d.ts`

- [ ] **Step 1: Update app.d.ts with user type on locals**

Replace `packages/web/src/app.d.ts` with:

```typescript
declare global {
  namespace App {
    interface Locals {
      authToken: string;
      user: {
        id: number;
        email: string;
        name: string;
        api_token: string;
        created_at: string;
      } | null;
    }
  }
}

export {};
```

- [ ] **Step 2: Commit**

```bash
git add packages/web/src/app.d.ts
git commit -m "chore: update app.d.ts with user type on locals"
```

---

## Task 19: Smoke Test

- [ ] **Step 1: Start API and verify it boots**

Run: `bun packages/api/src/index.ts`

Expected: "server starting" log, no errors. Database tables created.

- [ ] **Step 2: Start web and verify it boots**

Run: `cd /Users/me/Development/ios-budget-fn && bun run dev:web`

Expected: Vite dev server starts, Tailwind CSS compiles without errors.

- [ ] **Step 3: Run svelte-check**

Run: `cd /Users/me/Development/ios-budget-fn/packages/web && bunx svelte-check`

Expected: 0 errors. Fix any type issues found.

- [ ] **Step 4: Test login flow in browser**

Using Playwright or manual browser testing:
1. Navigate to `http://localhost:5173` — should redirect to `/login`
2. Login page shows magic link form + GitHub button
3. Submit email → "Check your email" confirmation shown

- [ ] **Step 5: Test dashboard renders**

After logging in (create a test user in DB manually if needed):
1. Dashboard shows charts, filter bar, day-grouped transactions
2. Navbar shows avatar with dropdown
3. Filter presets work
4. Pagination works

- [ ] **Step 6: Commit any fixes**

```bash
git add -A
git commit -m "fix: resolve smoke test issues"
```
