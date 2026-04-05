# Payment Tracker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a full-stack payment tracking app that accepts transactions from Apple Shortcuts via Hono API and displays them in a SvelteKit dashboard.

**Architecture:** Bun monorepo with two packages: `packages/api` (Hono + bun:sqlite) and `packages/web` (SvelteKit + node adapter). Both share a single `AUTH_TOKEN` for bearer auth. The API handles all data; the frontend SSR-fetches from it using a session cookie that stores the token.

**Tech Stack:** Bun (runtime + workspaces), Hono (API), bun:sqlite (database), SvelteKit (frontend), @sveltejs/adapter-node (deployment), Docker Compose (deployment)

---

## File Map

```
payment-tracker/
├── package.json                          # Root workspace: scripts for dev/dev:api/dev:web
├── docker-compose.yml                    # API + Web services, api-data volume
├── .env.example                          # AUTH_TOKEN placeholder
├── .gitignore                            # node_modules, .svelte-kit, build, data/*.db, .env
├── README.md                             # Setup + Apple Shortcut instructions
├── packages/
│   ├── api/
│   │   ├── package.json                  # deps: hono
│   │   ├── Dockerfile
│   │   ├── tsconfig.json
│   │   ├── data/                         # SQLite DB mount point (gitignored)
│   │   │   └── .gitkeep
│   │   └── src/
│   │       ├── index.ts                  # Hono app entry, CORS, mount routes
│   │       ├── db.ts                     # bun:sqlite Database setup + migration
│   │       ├── types.ts                  # Transaction type
│   │       ├── middleware/
│   │       │   └── auth.ts               # Bearer token middleware
│   │       └── routes/
│   │           └── transactions.ts       # CRUD + stats routes
│   └── web/
│       ├── package.json                  # deps: svelte, @sveltejs/kit, @sveltejs/adapter-node
│       ├── Dockerfile
│       ├── svelte.config.js              # node adapter config
│       ├── vite.config.ts
│       ├── tsconfig.json
│       └── src/
│           ├── app.html                  # HTML shell
│           ├── app.d.ts                  # Type augmentation for locals
│           ├── hooks.server.ts           # Auth guard: cookie check, redirect to /login
│           ├── lib/
│           │   ├── api.ts                # fetch wrapper for API calls
│           │   ├── time.ts               # Relative time helper
│           │   └── components/
│           │       ├── TransactionList.svelte
│           │       ├── TransactionCard.svelte
│           │       └── Stats.svelte
│           └── routes/
│               ├── +layout.svelte        # Global layout with dark theme styles
│               ├── +page.server.ts       # SSR: fetch transactions + stats
│               ├── +page.svelte          # Dashboard
│               └── login/
│                   ├── +page.server.ts   # Form actions: login + logout
│                   └── +page.svelte      # Token input form
```

---

### Task 1: Root workspace + project scaffolding

**Files:**
- Create: `package.json` (overwrite existing)
- Create: `.gitignore` (overwrite existing)
- Create: `.env.example`
- Create: `packages/api/package.json`
- Create: `packages/api/tsconfig.json`
- Create: `packages/api/data/.gitkeep`
- Create: `packages/web/package.json`

- [ ] **Step 1: Create root package.json with workspace config**

```json
{
  "name": "payment-tracker",
  "private": true,
  "workspaces": ["packages/*"],
  "scripts": {
    "dev": "bun run dev:api & bun run dev:web",
    "dev:api": "cd packages/api && bun --hot src/index.ts",
    "dev:web": "cd packages/web && bun run dev"
  }
}
```

- [ ] **Step 2: Create .gitignore**

```
node_modules/
.svelte-kit/
build/
data/*.db
.env
.DS_Store
```

- [ ] **Step 3: Create .env.example**

```
AUTH_TOKEN=change-me-to-a-secure-random-string
```

- [ ] **Step 4: Create packages/api/package.json**

```json
{
  "name": "@payment-tracker/api",
  "private": true,
  "scripts": {
    "dev": "bun --hot src/index.ts"
  },
  "dependencies": {
    "hono": "^4"
  }
}
```

- [ ] **Step 5: Create packages/api/tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "types": ["bun-types"],
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["src"]
}
```

- [ ] **Step 6: Create packages/api/data/.gitkeep**

Empty file.

- [ ] **Step 7: Create packages/web/package.json**

```json
{
  "name": "@payment-tracker/web",
  "private": true,
  "scripts": {
    "dev": "vite dev",
    "build": "vite build",
    "preview": "vite preview"
  },
  "devDependencies": {
    "@sveltejs/adapter-node": "^5",
    "@sveltejs/kit": "^2",
    "@sveltejs/vite-plugin-svelte": "^5",
    "svelte": "^5",
    "vite": "^6"
  }
}
```

- [ ] **Step 8: Run bun install at root**

Run: `cd /Users/me/Development/ios-budget-fn && bun install`
Expected: All dependencies installed, bun.lock created.

- [ ] **Step 9: Commit**

```bash
git init
git add -A
git commit -m "feat: scaffold payment-tracker monorepo with bun workspaces"
```

---

### Task 2: API — Database + Types

**Files:**
- Create: `packages/api/src/types.ts`
- Create: `packages/api/src/db.ts`

- [ ] **Step 1: Create types.ts**

```typescript
export interface Transaction {
  id: number;
  amount: number;
  currency: string;
  merchant: string;
  category: string | null;
  note: string | null;
  card_last4: string | null;
  timestamp: string;
  created_at: string;
}

export interface CreateTransactionInput {
  amount: number;
  currency?: string;
  merchant: string;
  category?: string;
  note?: string;
  card_last4?: string;
}
```

- [ ] **Step 2: Create db.ts**

```typescript
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
```

- [ ] **Step 3: Verify DB initializes**

Run: `cd /Users/me/Development/ios-budget-fn && bun packages/api/src/db.ts`
Expected: No errors, `packages/api/data/data.db` file created.

- [ ] **Step 4: Commit**

```bash
git add packages/api/src/types.ts packages/api/src/db.ts
git commit -m "feat(api): add SQLite database setup and transaction types"
```

---

### Task 3: API — Auth middleware

**Files:**
- Create: `packages/api/src/middleware/auth.ts`

- [ ] **Step 1: Create auth.ts**

```typescript
import { createMiddleware } from "hono/factory";

export const authMiddleware = createMiddleware(async (c, next) => {
  const authToken = process.env.AUTH_TOKEN;
  if (!authToken) {
    return c.json({ error: "Server misconfigured: AUTH_TOKEN not set" }, 500);
  }

  const header = c.req.header("Authorization");
  if (!header || !header.startsWith("Bearer ")) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const token = header.slice(7);
  if (token !== authToken) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  await next();
});
```

- [ ] **Step 2: Commit**

```bash
git add packages/api/src/middleware/auth.ts
git commit -m "feat(api): add bearer token auth middleware"
```

---

### Task 4: API — Transaction routes

**Files:**
- Create: `packages/api/src/routes/transactions.ts`

- [ ] **Step 1: Create transactions.ts**

```typescript
import { Hono } from "hono";
import db from "../db";
import type { Transaction, CreateTransactionInput } from "../types";

const transactions = new Hono();

// POST /api/transactions — create
transactions.post("/", async (c) => {
  const body = await c.req.json<CreateTransactionInput>();

  if (!body.amount || !body.merchant) {
    return c.json({ error: "amount and merchant are required" }, 400);
  }

  const stmt = db.prepare(`
    INSERT INTO transactions (amount, currency, merchant, category, note, card_last4)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const result = stmt.run(
    body.amount,
    body.currency ?? "PLN",
    body.merchant,
    body.category ?? null,
    body.note ?? null,
    body.card_last4 ?? null
  );

  const created = db
    .prepare("SELECT * FROM transactions WHERE id = ?")
    .get(result.lastInsertRowid) as Transaction;

  return c.json(created, 201);
});

// GET /api/transactions/stats — must be before /:id
transactions.get("/stats", (c) => {
  const from = c.req.query("from");
  const to = c.req.query("to");

  let dateFilter = "";
  const params: string[] = [];
  if (from) {
    dateFilter += " AND timestamp >= ?";
    params.push(from);
  }
  if (to) {
    dateFilter += " AND timestamp <= ?";
    params.push(to + " 23:59:59");
  }

  const summary = db
    .prepare(
      `SELECT COALESCE(SUM(amount), 0) as total_spent, COUNT(*) as transaction_count, COALESCE(AVG(amount), 0) as avg_transaction FROM transactions WHERE 1=1${dateFilter}`
    )
    .get(...params) as { total_spent: number; transaction_count: number; avg_transaction: number };

  const topMerchants = db
    .prepare(
      `SELECT merchant, COUNT(*) as count, SUM(amount) as total FROM transactions WHERE 1=1${dateFilter} GROUP BY merchant ORDER BY total DESC LIMIT 10`
    )
    .all(...params) as { merchant: string; count: number; total: number }[];

  const spendingByCategory = db
    .prepare(
      `SELECT COALESCE(category, 'uncategorized') as category, SUM(amount) as total FROM transactions WHERE 1=1${dateFilter} GROUP BY category ORDER BY total DESC`
    )
    .all(...params) as { category: string; total: number }[];

  const dailySpending = db
    .prepare(
      `SELECT DATE(timestamp) as date, SUM(amount) as total FROM transactions WHERE 1=1${dateFilter} GROUP BY DATE(timestamp) ORDER BY date DESC LIMIT 30`
    )
    .all(...params) as { date: string; total: number }[];

  return c.json({
    total_spent: summary.total_spent,
    transaction_count: summary.transaction_count,
    avg_transaction: Math.round(summary.avg_transaction * 100) / 100,
    top_merchants: topMerchants,
    spending_by_category: spendingByCategory,
    daily_spending: dailySpending,
  });
});

// GET /api/transactions — list
transactions.get("/", (c) => {
  const limit = parseInt(c.req.query("limit") ?? "50");
  const offset = parseInt(c.req.query("offset") ?? "0");
  const from = c.req.query("from");
  const to = c.req.query("to");

  let dateFilter = "";
  const params: (string | number)[] = [];
  if (from) {
    dateFilter += " AND timestamp >= ?";
    params.push(from);
  }
  if (to) {
    dateFilter += " AND timestamp <= ?";
    params.push(to + " 23:59:59");
  }

  params.push(limit, offset);

  const rows = db
    .prepare(
      `SELECT * FROM transactions WHERE 1=1${dateFilter} ORDER BY timestamp DESC LIMIT ? OFFSET ?`
    )
    .all(...params) as Transaction[];

  return c.json(rows);
});

// DELETE /api/transactions/:id
transactions.delete("/:id", (c) => {
  const id = parseInt(c.req.param("id"));
  const existing = db.prepare("SELECT id FROM transactions WHERE id = ?").get(id);
  if (!existing) {
    return c.json({ error: "Transaction not found" }, 404);
  }
  db.prepare("DELETE FROM transactions WHERE id = ?").run(id);
  return c.json({ success: true });
});

export default transactions;
```

- [ ] **Step 2: Commit**

```bash
git add packages/api/src/routes/transactions.ts
git commit -m "feat(api): add transaction CRUD and stats routes"
```

---

### Task 5: API — Entry point

**Files:**
- Create: `packages/api/src/index.ts`

- [ ] **Step 1: Create index.ts**

```typescript
import { Hono } from "hono";
import { cors } from "hono/cors";
import { authMiddleware } from "./middleware/auth";
import transactions from "./routes/transactions";

const app = new Hono();

app.use(
  "/api/*",
  cors({
    origin: process.env.WEB_ORIGIN ?? "http://localhost:5173",
    credentials: true,
  })
);

app.use("/api/*", authMiddleware);

app.route("/api/transactions", transactions);

app.get("/health", (c) => c.json({ status: "ok" }));

export default {
  fetch: app.fetch,
  port: parseInt(process.env.PORT ?? "3000"),
};
```

- [ ] **Step 2: Smoke-test the API**

Run:
```bash
cd /Users/me/Development/ios-budget-fn
AUTH_TOKEN=test-token-123 bun packages/api/src/index.ts &
sleep 1

# 401 without token
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/transactions

# Create transaction
curl -s -X POST http://localhost:3000/api/transactions \
  -H "Authorization: Bearer test-token-123" \
  -H "Content-Type: application/json" \
  -d '{"amount": 42.50, "merchant": "Zabka", "category": "groceries"}'

# List
curl -s http://localhost:3000/api/transactions \
  -H "Authorization: Bearer test-token-123"

# Stats
curl -s http://localhost:3000/api/transactions/stats \
  -H "Authorization: Bearer test-token-123"

kill %1
```

Expected: 401 for unauthenticated, 201 for create, valid JSON for list and stats.

- [ ] **Step 3: Commit**

```bash
git add packages/api/src/index.ts
git commit -m "feat(api): add Hono entry point with CORS and auth"
```

---

### Task 6: SvelteKit — Project scaffolding

**Files:**
- Create: `packages/web/svelte.config.js`
- Create: `packages/web/vite.config.ts`
- Create: `packages/web/tsconfig.json`
- Create: `packages/web/src/app.html`
- Create: `packages/web/src/app.d.ts`

- [ ] **Step 1: Create svelte.config.js**

```javascript
import adapter from "@sveltejs/adapter-node";

/** @type {import('@sveltejs/kit').Config} */
const config = {
  kit: {
    adapter: adapter(),
  },
};

export default config;
```

- [ ] **Step 2: Create vite.config.ts**

```typescript
import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [sveltekit()],
});
```

- [ ] **Step 3: Create tsconfig.json**

```json
{
  "extends": "./.svelte-kit/tsconfig.json",
  "compilerOptions": {
    "allowJs": true,
    "checkJs": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "skipLibCheck": true,
    "sourceMap": true,
    "strict": true,
    "moduleResolution": "bundler"
  }
}
```

- [ ] **Step 4: Create src/app.html**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Payment Tracker</title>
    %sveltekit.head%
  </head>
  <body data-sveltekit-prerender="false">
    <div style="display: contents">%sveltekit.body%</div>
  </body>
</html>
```

- [ ] **Step 5: Create src/app.d.ts**

```typescript
declare global {
  namespace App {
    interface Locals {
      authToken: string;
    }
  }
}

export {};
```

- [ ] **Step 6: Commit**

```bash
git add packages/web/
git commit -m "feat(web): scaffold SvelteKit project with node adapter"
```

---

### Task 7: SvelteKit — Auth hooks + API helper + time helper

**Files:**
- Create: `packages/web/src/hooks.server.ts`
- Create: `packages/web/src/lib/api.ts`
- Create: `packages/web/src/lib/time.ts`

- [ ] **Step 1: Create hooks.server.ts**

```typescript
import { redirect, type Handle } from "@sveltejs/kit";

const AUTH_TOKEN = process.env.AUTH_TOKEN ?? "";
const PUBLIC_PATHS = ["/login"];

export const handle: Handle = async ({ event, resolve }) => {
  const isPublic = PUBLIC_PATHS.some((p) => event.url.pathname.startsWith(p));

  const token = event.cookies.get("session_token");

  if (!isPublic) {
    if (!token || token !== AUTH_TOKEN) {
      redirect(303, "/login");
    }
  }

  event.locals.authToken = token ?? "";

  return resolve(event);
};
```

- [ ] **Step 2: Create lib/api.ts**

```typescript
import { redirect } from "@sveltejs/kit";

const API_URL = process.env.API_URL ?? "http://localhost:3000";

export async function apiFetch(path: string, token: string, init?: RequestInit) {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      ...init?.headers,
      Authorization: `Bearer ${token}`,
    },
  });

  if (res.status === 401) {
    redirect(303, "/login");
  }

  return res;
}
```

- [ ] **Step 3: Create lib/time.ts**

```typescript
export function relativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr + "Z").getTime();
  const diff = now - then;

  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return "just now";

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;

  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}
```

- [ ] **Step 4: Commit**

```bash
git add packages/web/src/hooks.server.ts packages/web/src/lib/
git commit -m "feat(web): add auth hooks, API fetch helper, relative time util"
```

---

### Task 8: SvelteKit — Login page

**Files:**
- Create: `packages/web/src/routes/login/+page.server.ts`
- Create: `packages/web/src/routes/login/+page.svelte`

- [ ] **Step 1: Create login/+page.server.ts**

```typescript
import { fail, redirect } from "@sveltejs/kit";
import type { Actions } from "./$types";

const API_URL = process.env.API_URL ?? "http://localhost:3000";

export const actions: Actions = {
  default: async ({ request, cookies }) => {
    const data = await request.formData();
    const token = data.get("token") as string;

    if (!token) {
      return fail(400, { error: "Token is required" });
    }

    // Validate token against the API
    const res = await fetch(`${API_URL}/api/transactions?limit=1`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      return fail(401, { error: "Invalid token" });
    }

    cookies.set("session_token", token, {
      path: "/",
      httpOnly: true,
      sameSite: "strict",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 365, // 1 year
    });

    redirect(303, "/");
  },

  logout: async ({ cookies }) => {
    cookies.delete("session_token", { path: "/" });
    redirect(303, "/login");
  },
};
```

- [ ] **Step 2: Create login/+page.svelte**

```svelte
<script>
  import { enhance } from "$app/forms";

  let { form } = $props();
</script>

<div class="container">
  <div class="login-box">
    <h1>$ payment-tracker</h1>
    <p class="subtitle">authenticate to continue</p>

    {#if form?.error}
      <div class="error">{form.error}</div>
    {/if}

    <form method="POST" use:enhance>
      <input
        type="password"
        name="token"
        placeholder="enter access token"
        autocomplete="off"
        required
      />
      <button type="submit">login</button>
    </form>
  </div>
</div>

<style>
  :global(body) {
    margin: 0;
    background: #0a0a0a;
    color: #e0e0e0;
    font-family: "SF Mono", "Fira Code", "Cascadia Code", monospace;
  }

  .container {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .login-box {
    width: 100%;
    max-width: 400px;
    padding: 2rem;
  }

  h1 {
    color: #00ff88;
    font-size: 1.5rem;
    margin: 0 0 0.5rem;
  }

  .subtitle {
    color: #666;
    margin: 0 0 2rem;
    font-size: 0.875rem;
  }

  .error {
    background: #ff000020;
    border: 1px solid #ff0000;
    color: #ff6666;
    padding: 0.75rem;
    margin-bottom: 1rem;
    font-size: 0.875rem;
  }

  input {
    width: 100%;
    padding: 0.75rem;
    background: #1a1a1a;
    border: 1px solid #333;
    color: #e0e0e0;
    font-family: inherit;
    font-size: 0.875rem;
    margin-bottom: 1rem;
    box-sizing: border-box;
  }

  input:focus {
    outline: none;
    border-color: #00ff88;
  }

  button {
    width: 100%;
    padding: 0.75rem;
    background: #00ff88;
    color: #0a0a0a;
    border: none;
    font-family: inherit;
    font-size: 0.875rem;
    font-weight: bold;
    cursor: pointer;
  }

  button:hover {
    background: #00cc6a;
  }
</style>
```

- [ ] **Step 3: Commit**

```bash
git add packages/web/src/routes/login/
git commit -m "feat(web): add login page with token authentication"
```

---

### Task 9: SvelteKit — Dashboard components

**Files:**
- Create: `packages/web/src/lib/components/TransactionCard.svelte`
- Create: `packages/web/src/lib/components/TransactionList.svelte`
- Create: `packages/web/src/lib/components/Stats.svelte`

- [ ] **Step 1: Create TransactionCard.svelte**

```svelte
<script>
  import { relativeTime } from "$lib/time";

  let { transaction } = $props();

  function formatAmount(amount, currency) {
    return new Intl.NumberFormat("pl-PL", {
      style: "currency",
      currency: currency || "PLN",
    }).format(amount);
  }
</script>

<div class="card">
  <div class="row">
    <span class="amount">{formatAmount(transaction.amount, transaction.currency)}</span>
    <span class="time">{relativeTime(transaction.timestamp)}</span>
  </div>
  <div class="row">
    <span class="merchant">{transaction.merchant}</span>
    {#if transaction.category}
      <span class="category">{transaction.category}</span>
    {/if}
  </div>
  {#if transaction.note || transaction.card_last4}
    <div class="row meta">
      {#if transaction.note}
        <span class="note">{transaction.note}</span>
      {/if}
      {#if transaction.card_last4}
        <span class="card-digits">*{transaction.card_last4}</span>
      {/if}
    </div>
  {/if}
</div>

<style>
  .card {
    background: #1a1a1a;
    border: 1px solid #222;
    padding: 1rem;
    margin-bottom: 0.5rem;
  }

  .row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 1rem;
  }

  .row + .row {
    margin-top: 0.5rem;
  }

  .amount {
    color: #ff6b6b;
    font-weight: bold;
    font-size: 1.1rem;
  }

  .time {
    color: #555;
    font-size: 0.8rem;
  }

  .merchant {
    color: #ccc;
  }

  .category {
    background: #00ff8820;
    color: #00ff88;
    padding: 0.15rem 0.5rem;
    font-size: 0.75rem;
  }

  .meta {
    color: #555;
    font-size: 0.8rem;
  }

  .note {
    font-style: italic;
  }

  .card-digits {
    color: #444;
  }
</style>
```

- [ ] **Step 2: Create TransactionList.svelte**

```svelte
<script>
  import TransactionCard from "./TransactionCard.svelte";

  let { transactions } = $props();
</script>

<div class="list">
  {#if transactions.length === 0}
    <p class="empty">no transactions yet</p>
  {:else}
    {#each transactions as transaction (transaction.id)}
      <TransactionCard {transaction} />
    {/each}
  {/if}
</div>

<style>
  .list {
    margin-top: 1rem;
  }

  .empty {
    color: #555;
    text-align: center;
    padding: 2rem;
  }
</style>
```

- [ ] **Step 3: Create Stats.svelte**

```svelte
<script>
  let { stats } = $props();

  function formatPLN(amount) {
    return new Intl.NumberFormat("pl-PL", {
      style: "currency",
      currency: "PLN",
    }).format(amount);
  }
</script>

<div class="stats">
  <div class="stat-grid">
    <div class="stat">
      <span class="label">total spent</span>
      <span class="value">{formatPLN(stats.total_spent)}</span>
    </div>
    <div class="stat">
      <span class="label">transactions</span>
      <span class="value">{stats.transaction_count}</span>
    </div>
    <div class="stat">
      <span class="label">avg transaction</span>
      <span class="value">{formatPLN(stats.avg_transaction)}</span>
    </div>
  </div>

  {#if stats.top_merchants?.length > 0}
    <div class="section">
      <h3>top merchants</h3>
      {#each stats.top_merchants.slice(0, 5) as m}
        <div class="row">
          <span>{m.merchant}</span>
          <span class="dim">{m.count}x &middot; {formatPLN(m.total)}</span>
        </div>
      {/each}
    </div>
  {/if}

  {#if stats.spending_by_category?.length > 0}
    <div class="section">
      <h3>by category</h3>
      {#each stats.spending_by_category as cat}
        <div class="row">
          <span class="cat-badge">{cat.category}</span>
          <span>{formatPLN(cat.total)}</span>
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .stats {
    background: #1a1a1a;
    border: 1px solid #222;
    padding: 1rem;
    margin-bottom: 1.5rem;
  }

  .stat-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 1rem;
    text-align: center;
  }

  .label {
    display: block;
    color: #555;
    font-size: 0.75rem;
    text-transform: uppercase;
    margin-bottom: 0.25rem;
  }

  .value {
    color: #00ff88;
    font-size: 1.25rem;
    font-weight: bold;
  }

  .section {
    margin-top: 1.5rem;
    border-top: 1px solid #222;
    padding-top: 1rem;
  }

  h3 {
    color: #555;
    font-size: 0.75rem;
    text-transform: uppercase;
    margin: 0 0 0.75rem;
  }

  .row {
    display: flex;
    justify-content: space-between;
    padding: 0.25rem 0;
    color: #ccc;
    font-size: 0.875rem;
  }

  .dim {
    color: #555;
  }

  .cat-badge {
    color: #00ff88;
  }
</style>
```

- [ ] **Step 4: Commit**

```bash
git add packages/web/src/lib/components/
git commit -m "feat(web): add TransactionCard, TransactionList, Stats components"
```

---

### Task 10: SvelteKit — Dashboard page + layout

**Files:**
- Create: `packages/web/src/routes/+layout.svelte`
- Create: `packages/web/src/routes/+page.server.ts`
- Create: `packages/web/src/routes/+page.svelte`

- [ ] **Step 1: Create +layout.svelte**

```svelte
<script>
  let { children } = $props();
</script>

{@render children()}

<style>
  :global(body) {
    margin: 0;
    background: #0a0a0a;
    color: #e0e0e0;
    font-family: "SF Mono", "Fira Code", "Cascadia Code", monospace;
    -webkit-font-smoothing: antialiased;
  }

  :global(*, *::before, *::after) {
    box-sizing: border-box;
  }
</style>
```

- [ ] **Step 2: Create +page.server.ts**

```typescript
import { apiFetch } from "$lib/api";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ locals }) => {
  const [transactionsRes, statsRes] = await Promise.all([
    apiFetch("/api/transactions?limit=50", locals.authToken),
    apiFetch("/api/transactions/stats", locals.authToken),
  ]);

  const transactions = await transactionsRes.json();
  const stats = await statsRes.json();

  return { transactions, stats };
};
```

- [ ] **Step 3: Create +page.svelte**

```svelte
<script>
  import TransactionList from "$lib/components/TransactionList.svelte";
  import Stats from "$lib/components/Stats.svelte";

  let { data } = $props();

  function formatPLN(amount) {
    return new Intl.NumberFormat("pl-PL", {
      style: "currency",
      currency: "PLN",
    }).format(amount);
  }
</script>

<div class="container">
  <header>
    <div class="title-row">
      <h1>$ payment-tracker</h1>
      <form method="POST" action="/login?/logout">
        <button type="submit" class="logout">logout</button>
      </form>
    </div>
    <p class="subtitle">
      total: {formatPLN(data.stats.total_spent)} &middot; {data.stats.transaction_count} transactions
    </p>
  </header>

  <Stats stats={data.stats} />

  <h2>recent transactions</h2>
  <TransactionList transactions={data.transactions} />
</div>

<style>
  .container {
    max-width: 700px;
    margin: 0 auto;
    padding: 2rem 1rem;
  }

  header {
    margin-bottom: 2rem;
  }

  .title-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  h1 {
    color: #00ff88;
    font-size: 1.5rem;
    margin: 0;
  }

  h2 {
    color: #555;
    font-size: 0.8rem;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    margin: 1.5rem 0 0.5rem;
  }

  .subtitle {
    color: #555;
    margin: 0.5rem 0 0;
    font-size: 0.875rem;
  }

  .logout {
    background: none;
    border: 1px solid #333;
    color: #666;
    font-family: inherit;
    font-size: 0.8rem;
    padding: 0.4rem 0.8rem;
    cursor: pointer;
  }

  .logout:hover {
    border-color: #ff6b6b;
    color: #ff6b6b;
  }
</style>
```

- [ ] **Step 4: Verify dev:web starts**

Run: `cd /Users/me/Development/ios-budget-fn && bun run dev:web`
Expected: SvelteKit dev server starts on port 5173 without build errors.

- [ ] **Step 5: Commit**

```bash
git add packages/web/src/routes/+layout.svelte packages/web/src/routes/+page.server.ts packages/web/src/routes/+page.svelte
git commit -m "feat(web): add dashboard page with layout, stats, and transaction list"
```

---

### Task 11: Docker + README

**Files:**
- Create: `packages/api/Dockerfile`
- Create: `packages/web/Dockerfile`
- Create: `docker-compose.yml`
- Create: `README.md` (overwrite)

- [ ] **Step 1: Create packages/api/Dockerfile**

```dockerfile
FROM oven/bun:1 AS base
WORKDIR /app
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile || bun install
COPY . .
RUN mkdir -p data
EXPOSE 3000
CMD ["bun", "run", "src/index.ts"]
```

- [ ] **Step 2: Create packages/web/Dockerfile**

```dockerfile
FROM oven/bun:1 AS build
WORKDIR /app
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile || bun install
COPY . .
RUN bun run build

FROM oven/bun:1 AS runtime
WORKDIR /app
COPY --from=build /app/build ./build
COPY --from=build /app/package.json .
COPY --from=build /app/node_modules ./node_modules
EXPOSE 3000
ENV PORT=3000
CMD ["bun", "./build/index.js"]
```

- [ ] **Step 3: Create docker-compose.yml**

```yaml
services:
  api:
    build:
      context: ./packages/api
    ports:
      - "3000:3000"
    environment:
      - AUTH_TOKEN=${AUTH_TOKEN}
      - PORT=3000
    volumes:
      - api-data:/app/data
    restart: unless-stopped

  web:
    build:
      context: ./packages/web
    ports:
      - "3001:3000"
    environment:
      - API_URL=http://api:3000
      - AUTH_TOKEN=${AUTH_TOKEN}
      - PORT=3000
    depends_on:
      - api
    restart: unless-stopped

volumes:
  api-data:
```

- [ ] **Step 4: Create README.md**

```markdown
# Payment Tracker

A self-hosted payment tracking app. Accepts transactions from Apple Shortcuts via API and displays them in a dark-themed dashboard.

## Quick Start

```bash
bun install
cp .env.example .env
# Edit .env and set a secure AUTH_TOKEN

# Start both API and frontend
bun run dev
```

API runs on http://localhost:3000, frontend on http://localhost:5173.

## Docker Deployment

```bash
cp .env.example .env
# Edit .env with your AUTH_TOKEN
docker compose up -d
```

API: port 3000, Frontend: port 3001.

## Apple Shortcut Setup

1. Create a new Shortcut in the Shortcuts app
2. Add action: **Get Contents of URL**
   - URL: `https://your-domain.com/api/transactions`
   - Method: **POST**
   - Headers:
     - `Authorization`: `Bearer YOUR_TOKEN`
     - `Content-Type`: `application/json`
   - Request Body (JSON):
     - `amount`: Shortcut Input (transaction amount)
     - `merchant`: Shortcut Input (merchant name)
     - `currency`: `PLN`
3. Go to **Automations** tab → **New Automation**
4. Select **Transaction** trigger (iOS 17.2+)
5. Set it to run your shortcut
6. iOS provides `amount` and `merchant` as input variables from the payment notification

## API Endpoints

All endpoints require `Authorization: Bearer <token>` header.

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/transactions` | Create transaction |
| GET | `/api/transactions` | List transactions (?limit, ?offset, ?from, ?to) |
| GET | `/api/transactions/stats` | Summary statistics (?from, ?to) |
| DELETE | `/api/transactions/:id` | Delete transaction |
| GET | `/health` | Health check (no auth) |
```

- [ ] **Step 5: Commit**

```bash
git add packages/api/Dockerfile packages/web/Dockerfile docker-compose.yml README.md
git commit -m "feat: add Docker setup and README with Apple Shortcut instructions"
```

---

### Task 12: End-to-end smoke test

- [ ] **Step 1: Clean any test DB and start API**

```bash
cd /Users/me/Development/ios-budget-fn
rm -f packages/api/data/data.db
AUTH_TOKEN=test-token-123 bun run dev:api &
sleep 1
```

- [ ] **Step 2: Run smoke tests**

```bash
# 401 without auth
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/transactions
# Expected: 401

# Create transaction
curl -s -X POST http://localhost:3000/api/transactions \
  -H "Authorization: Bearer test-token-123" \
  -H "Content-Type: application/json" \
  -d '{"amount": 42.50, "merchant": "Żabka", "category": "groceries"}'
# Expected: 201 with JSON containing id

# Create another
curl -s -X POST http://localhost:3000/api/transactions \
  -H "Authorization: Bearer test-token-123" \
  -H "Content-Type: application/json" \
  -d '{"amount": 15.00, "merchant": "Lidl", "category": "groceries", "note": "weekly shop"}'

# List
curl -s http://localhost:3000/api/transactions \
  -H "Authorization: Bearer test-token-123"
# Expected: JSON array with 2 transactions

# Stats
curl -s http://localhost:3000/api/transactions/stats \
  -H "Authorization: Bearer test-token-123"
# Expected: JSON with total_spent: 57.50, transaction_count: 2

# Delete
curl -s -X DELETE http://localhost:3000/api/transactions/1 \
  -H "Authorization: Bearer test-token-123"
# Expected: {"success": true}

# Health
curl -s http://localhost:3000/health
# Expected: {"status":"ok"}
```

- [ ] **Step 3: Stop API, verify frontend builds**

```bash
kill %1
cd /Users/me/Development/ios-budget-fn
bun run --cwd packages/web build
```

Expected: SvelteKit build succeeds.

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "chore: verify smoke tests pass, project complete"
```
