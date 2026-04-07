# Transaction Data Encryption Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Encrypt sensitive transaction fields (amount, seller, card, title) at rest using per-user AES-256-GCM keys, so that the server stores only ciphertext and data is decrypted on read.

**Architecture:** Each user gets a 256-bit AES key generated at signup and stored in the `users` table (column `encryption_key`). On transaction creation, the API encrypts `amount`, `seller`, `card`, and `title` before inserting into the DB. On read, it decrypts them before returning to the client. AES-256-GCM is used via the Web Crypto API (built into Bun) — a standardized AEAD cipher providing both confidentiality and integrity. Each encrypted value gets a unique random 12-byte IV prepended to the ciphertext. The encryption module is a single file (`packages/api/src/crypto.ts`) used by all routes.

**Tech Stack:** Web Crypto API (globalThis.crypto.subtle), AES-256-GCM, Bun runtime, SQLite

**Fields encrypted:** `amount` (stored as encrypted string of the numeric value), `seller`, `card`, `title`
**Fields NOT encrypted:** `id`, `user_id`, `timestamp`, `created_at` (needed for queries, indexing, sorting)

**Trade-off — stats aggregation:** Since encrypted fields can't be aggregated with SQL, stats (SUM, AVG, GROUP BY seller/card) will decrypt all matching transactions in application code. This is acceptable for a personal tracker with bounded data volume.

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `packages/api/src/crypto.ts` | Create | AES-256-GCM encrypt/decrypt functions, key generation |
| `packages/api/src/db.ts` | Modify | Add `encryption_key` column to users table, change transaction columns to TEXT |
| `packages/api/src/types.ts` | Modify | Update Transaction type (encrypted fields become strings in DB) |
| `packages/api/src/routes/transactions.ts` | Modify | Encrypt on write, decrypt on read, rewrite stats to use app-level aggregation |
| `packages/api/src/routes/auth.ts` | Modify | Generate encryption key at user creation |
| `packages/api/src/webhooks.ts` | Modify | Ensure webhook payloads contain decrypted data |
| `packages/api/src/middleware/auth.ts` | Modify | Load encryption_key into context alongside user |
| `tests/crypto.test.ts` | Create | Tests for encrypt/decrypt module |
| `tests/transactions.test.ts` | Create | Tests for encrypted transaction CRUD and stats |

---

### Task 1: Encryption Module (`crypto.ts`)

**Files:**
- Create: `packages/api/src/crypto.ts`
- Create: `packages/api/tests/crypto.test.ts`

- [ ] **Step 1: Write the failing test for key generation**

```typescript
// packages/api/tests/crypto.test.ts
import { test, expect } from "bun:test";
import { generateEncryptionKey, encrypt, decrypt } from "../src/crypto";

test("generateEncryptionKey returns 64-char hex string", async () => {
  const key = await generateEncryptionKey();
  expect(key).toHaveLength(64);
  expect(key).toMatch(/^[0-9a-f]{64}$/);
});

test("generateEncryptionKey returns unique keys", async () => {
  const key1 = await generateEncryptionKey();
  const key2 = await generateEncryptionKey();
  expect(key1).not.toBe(key2);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/api && bun test tests/crypto.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write the crypto module with key generation**

```typescript
// packages/api/src/crypto.ts

/**
 * AES-256-GCM encryption for transaction data.
 * Each encrypted value is stored as: base64(iv + ciphertext + authTag)
 * - IV: 12 bytes (random per encryption)
 * - Auth tag: 16 bytes (appended by GCM)
 */

export async function generateEncryptionKey(): Promise<string> {
  const key = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(key).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

async function importKey(hexKey: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    hexToBytes(hexKey),
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"]
  );
}

export async function encrypt(plaintext: string, hexKey: string): Promise<string> {
  const key = await importKey(hexKey);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoded
  );
  // Prepend IV to ciphertext (IV + ciphertext+authTag)
  const combined = new Uint8Array(iv.length + ciphertext.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(ciphertext), iv.length);
  return btoa(String.fromCharCode(...combined));
}

export async function decrypt(encoded: string, hexKey: string): Promise<string> {
  const key = await importKey(hexKey);
  const combined = Uint8Array.from(atob(encoded), (c) => c.charCodeAt(0));
  const iv = combined.slice(0, 12);
  const ciphertext = combined.slice(12);
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    ciphertext
  );
  return new TextDecoder().decode(decrypted);
}

export async function encryptField(
  value: string | number | null | undefined,
  hexKey: string
): Promise<string | null> {
  if (value == null) return null;
  return encrypt(String(value), hexKey);
}

export async function decryptField(
  value: string | null | undefined,
  hexKey: string
): Promise<string | null> {
  if (value == null) return null;
  return decrypt(value, hexKey);
}

export async function decryptNumber(
  value: string | null | undefined,
  hexKey: string
): Promise<number | null> {
  if (value == null) return null;
  const decrypted = await decrypt(value, hexKey);
  return parseFloat(decrypted);
}
```

- [ ] **Step 4: Run key generation tests to verify they pass**

Run: `cd packages/api && bun test tests/crypto.test.ts`
Expected: PASS

- [ ] **Step 5: Add encrypt/decrypt tests**

Append to `packages/api/tests/crypto.test.ts`:

```typescript
test("encrypt then decrypt returns original string", async () => {
  const key = await generateEncryptionKey();
  const plaintext = "Hello, World! 123.45";
  const encrypted = await encrypt(plaintext, key);
  const decrypted = await decrypt(encrypted, key);
  expect(decrypted).toBe(plaintext);
});

test("encrypt produces different ciphertext each time (random IV)", async () => {
  const key = await generateEncryptionKey();
  const plaintext = "same input";
  const enc1 = await encrypt(plaintext, key);
  const enc2 = await encrypt(plaintext, key);
  expect(enc1).not.toBe(enc2);
});

test("decrypt with wrong key throws", async () => {
  const key1 = await generateEncryptionKey();
  const key2 = await generateEncryptionKey();
  const encrypted = await encrypt("secret", key1);
  expect(decrypt(encrypted, key2)).rejects.toThrow();
});

test("encryptField handles null", async () => {
  const key = await generateEncryptionKey();
  const result = await encryptField(null, key);
  expect(result).toBeNull();
});

test("encryptField handles numbers", async () => {
  const key = await generateEncryptionKey();
  const encrypted = await encryptField(42.50, key);
  expect(encrypted).not.toBeNull();
  const decrypted = await decryptNumber(encrypted, key);
  expect(decrypted).toBe(42.5);
});
```

- [ ] **Step 6: Run all crypto tests**

Run: `cd packages/api && bun test tests/crypto.test.ts`
Expected: All PASS

- [ ] **Step 7: Commit**

```bash
git add packages/api/src/crypto.ts packages/api/tests/crypto.test.ts
git commit -m "feat: add AES-256-GCM encryption module for transaction data"
```

---

### Task 2: Database Schema Migration

**Files:**
- Modify: `packages/api/src/db.ts`
- Modify: `packages/api/src/types.ts`

- [ ] **Step 1: Add encryption_key column to users table**

In `packages/api/src/db.ts`, after the users table CREATE, add:

```typescript
// Add encryption_key column if not exists (migration)
const userColumns = db.prepare("PRAGMA table_info(users)").all() as { name: string }[];
if (!userColumns.some((c) => c.name === "encryption_key")) {
  db.run("ALTER TABLE users ADD COLUMN encryption_key TEXT");
}
```

- [ ] **Step 2: Change transaction amount column handling**

In `packages/api/src/db.ts`, the `amount REAL NOT NULL` column will now store encrypted text. For new installations the schema should use TEXT. Add migration for existing DBs:

After the transactions table CREATE, add:

```typescript
// For existing databases: amount was REAL, now stores encrypted TEXT.
// SQLite is dynamically typed so no ALTER needed — existing REAL column accepts TEXT values.
// New databases will store encrypted strings from the start.
```

No actual ALTER is needed because SQLite uses dynamic typing — a REAL column can store TEXT values.

- [ ] **Step 3: Update User type to include encryption_key**

In `packages/api/src/types.ts`, update the User interface:

```typescript
export interface User {
  id: number;
  email: string;
  name: string;
  github_id: string | null;
  api_token: string;
  encryption_key: string | null;
  created_at: string;
}
```

- [ ] **Step 4: Verify build succeeds**

Run: `cd packages/api && bun build --target=bun src/index.ts --outdir=./dist`
Expected: Bundles without errors

- [ ] **Step 5: Commit**

```bash
git add packages/api/src/db.ts packages/api/src/types.ts
git commit -m "feat: add encryption_key column to users table"
```

---

### Task 3: Generate Encryption Key at User Creation

**Files:**
- Modify: `packages/api/src/routes/auth.ts`
- Modify: `packages/api/src/middleware/auth.ts`

- [ ] **Step 1: Import generateEncryptionKey in auth route**

At the top of `packages/api/src/routes/auth.ts`, add:

```typescript
import { generateEncryptionKey } from "../crypto";
```

- [ ] **Step 2: Generate key when creating user via magic link**

In the magic link verify handler, find the INSERT for new users (around line 57) and update:

```typescript
const encKey = await generateEncryptionKey();
db.run(
  "INSERT INTO users (email, name, api_token, encryption_key) VALUES (?, ?, ?, ?)",
  [email, "", apiToken, encKey]
);
```

- [ ] **Step 3: Generate key when creating user via GitHub OAuth**

In the GitHub callback handler, find the INSERT for new users (around line 136) and update:

```typescript
const encKey = await generateEncryptionKey();
db.run(
  "INSERT INTO users (email, name, github_id, api_token, encryption_key) VALUES (?, ?, ?, ?, ?)",
  [primaryEmail, ghName, String(ghUser.id), apiToken, encKey]
);
```

- [ ] **Step 4: Backfill key for existing users without one**

In `packages/api/src/middleware/auth.ts`, after setting `c.set("user", user)`, add a backfill for users who signed up before encryption was added:

```typescript
if (!user.encryption_key) {
  const { generateEncryptionKey } = await import("../crypto");
  const encKey = await generateEncryptionKey();
  db.run("UPDATE users SET encryption_key = ? WHERE id = ?", [encKey, user.id]);
  user.encryption_key = encKey;
  logger.info({ userId: user.id }, "backfilled encryption key");
}
```

Do the same in the DEV_MODE block — update the dev user creation:

```typescript
function getOrCreateDevUser(): User {
  let user = db.prepare("SELECT * FROM users WHERE email = ?").get("dev@local") as User | null;
  if (!user) {
    // Key generated synchronously isn't possible with Web Crypto — we'll backfill on first request
    db.run(
      "INSERT INTO users (email, name, api_token) VALUES (?, ?, ?)",
      ["dev@local", "Dev User", "dev-token"]
    );
    user = db.prepare("SELECT * FROM users WHERE email = ?").get("dev@local") as User;
    logger.info("created dev user (dev@local / dev-token)");
  }
  return user;
}
```

The backfill in the auth middleware will handle generating the key on first request.

- [ ] **Step 5: Verify build succeeds**

Run: `cd packages/api && bun build --target=bun src/index.ts --outdir=./dist`
Expected: Bundles without errors

- [ ] **Step 6: Commit**

```bash
git add packages/api/src/routes/auth.ts packages/api/src/middleware/auth.ts
git commit -m "feat: generate AES-256 encryption key at user signup"
```

---

### Task 4: Encrypt Transaction Data on Write

**Files:**
- Modify: `packages/api/src/routes/transactions.ts`

- [ ] **Step 1: Import crypto functions**

At the top of `packages/api/src/routes/transactions.ts`, add:

```typescript
import { encryptField } from "../crypto";
import type { User } from "../types";
```

- [ ] **Step 2: Encrypt fields in the POST handler**

Replace the INSERT section (around lines 38-47) with:

```typescript
const user = c.get("user") as User;
const encKey = user.encryption_key!;

const [encAmount, encSeller, encCard, encTitle] = await Promise.all([
  encryptField(amount, encKey),
  encryptField(seller, encKey),
  encryptField(card, encKey),
  encryptField(title, encKey),
]);

const stmt = db.prepare(`
  INSERT INTO transactions (amount, seller, card, title, user_id)
  VALUES (?, ?, ?, ?, ?)
`);
const insertResult = stmt.run(encAmount, encSeller, encCard, encTitle, userId);
```

- [ ] **Step 3: Decrypt the created transaction before returning**

After retrieving the created row, decrypt before returning:

```typescript
const row = db
  .prepare("SELECT * FROM transactions WHERE id = ?")
  .get(insertResult.lastInsertRowid) as any;

const created = {
  ...row,
  amount,  // use original plaintext values
  seller,
  card,
  title,
};

logger.info({ id: created.id, amount, seller, userId }, "transaction created");
fireWebhooks(userId, "transaction.created", { transaction: created });
return c.json(created, 201);
```

- [ ] **Step 4: Verify build succeeds**

Run: `cd packages/api && bun build --target=bun src/index.ts --outdir=./dist`
Expected: Bundles without errors

- [ ] **Step 5: Commit**

```bash
git add packages/api/src/routes/transactions.ts
git commit -m "feat: encrypt transaction fields on creation"
```

---

### Task 5: Decrypt Transaction Data on Read

**Files:**
- Modify: `packages/api/src/routes/transactions.ts`

- [ ] **Step 1: Import decrypt functions**

Update the import at the top of `packages/api/src/routes/transactions.ts`:

```typescript
import { encryptField, decryptField, decryptNumber } from "../crypto";
```

- [ ] **Step 2: Add a helper to decrypt a transaction row**

Add after the imports:

```typescript
async function decryptTransaction(row: any, encKey: string): Promise<Transaction> {
  const [amount, seller, card, title] = await Promise.all([
    decryptNumber(row.amount, encKey),
    decryptField(row.seller, encKey),
    decryptField(row.card, encKey),
    decryptField(row.title, encKey),
  ]);
  return { ...row, amount: amount!, seller: seller!, card, title };
}

async function decryptTransactions(rows: any[], encKey: string): Promise<Transaction[]> {
  return Promise.all(rows.map((row) => decryptTransaction(row, encKey)));
}
```

- [ ] **Step 3: Decrypt in the GET / list handler**

In the GET `/` handler, replace the return section:

```typescript
const user = c.get("user") as User;
const encKey = user.encryption_key!;

const rows = db.prepare(
  `SELECT * FROM transactions WHERE user_id = ?${dateFilter} ORDER BY timestamp DESC LIMIT ? OFFSET ?`
).all(...params) as any[];

const transactions = await decryptTransactions(rows, encKey);

logger.info({ total: totalRow.count, returned: transactions.length, userId }, "list transactions response");
return c.json({ transactions, total: totalRow.count });
```

- [ ] **Step 4: Rewrite stats handler to decrypt and aggregate in JS**

Replace the entire stats handler body with:

```typescript
transactions.get("/stats", async (c) => {
  const userId = c.get("userId") as number;
  const user = c.get("user") as User;
  const encKey = user.encryption_key!;

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

  const rows = db.prepare(
    `SELECT * FROM transactions WHERE user_id = ?${dateFilter}`
  ).all(...params) as any[];

  const txns = await decryptTransactions(rows, encKey);

  const totalSpent = txns.reduce((sum, t) => sum + t.amount, 0);
  const count = txns.length;
  const avgTransaction = count > 0 ? Math.round((totalSpent / count) * 100) / 100 : 0;

  // Top sellers
  const sellerMap = new Map<string, { count: number; total: number }>();
  for (const t of txns) {
    const s = sellerMap.get(t.seller) ?? { count: 0, total: 0 };
    s.count++;
    s.total += t.amount;
    sellerMap.set(t.seller, s);
  }
  const topSellers = [...sellerMap.entries()]
    .map(([seller, v]) => ({ seller, count: v.count, total: v.total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 10);

  // Daily totals
  const dailyMap = new Map<string, number>();
  for (const t of txns) {
    const date = t.timestamp.slice(0, 10);
    dailyMap.set(date, (dailyMap.get(date) ?? 0) + t.amount);
  }
  const dailyTotals = [...dailyMap.entries()]
    .map(([date, total]) => ({ date, total }))
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 30);

  // Card breakdown
  const cardMap = new Map<string, number>();
  for (const t of txns) {
    const card = t.card ?? "Unknown";
    cardMap.set(card, (cardMap.get(card) ?? 0) + t.amount);
  }
  const cardTotal = [...cardMap.values()].reduce((a, b) => a + b, 0);
  const cardBreakdown = [...cardMap.entries()]
    .map(([card, total]) => ({
      card,
      total,
      percentage: cardTotal > 0 ? Math.round((total / cardTotal) * 100) : 0,
    }))
    .sort((a, b) => b.total - a.total);

  logger.info({ transaction_count: count, userId }, "stats computed");

  return c.json({
    total_spent: totalSpent,
    transaction_count: count,
    avg_transaction: avgTransaction,
    top_sellers: topSellers,
    daily_totals: dailyTotals,
    card_breakdown: cardBreakdown,
  });
});
```

- [ ] **Step 5: Decrypt in the export handler**

Update the export handler to decrypt rows:

```typescript
transactions.get("/export", async (c) => {
  const userId = c.get("userId") as number;
  const user = c.get("user") as User;
  const encKey = user.encryption_key!;
  const format = c.req.query("format") ?? "csv";
  const from = c.req.query("from");
  const to = c.req.query("to");

  let dateFilter = "";
  const params: (string | number)[] = [userId];
  if (from) { dateFilter += " AND timestamp >= ?"; params.push(from); }
  if (to) { dateFilter += " AND timestamp <= ?"; params.push(to + " 23:59:59"); }

  const rows = db.prepare(
    `SELECT * FROM transactions WHERE user_id = ?${dateFilter} ORDER BY timestamp DESC`
  ).all(...params) as any[];

  const txns = await decryptTransactions(rows, encKey);

  // ... rest of format/response logic stays the same but uses `txns` instead of `rows`
```

- [ ] **Step 6: Decrypt in the delete handler for webhook payload**

Update the delete handler to decrypt the transaction before passing to webhook:

```typescript
transactions.delete("/:id", async (c) => {
  const userId = c.get("userId") as number;
  const user = c.get("user") as User;
  const encKey = user.encryption_key!;

  const result = idParamSchema.safeParse({ id: c.req.param("id") });
  if (!result.success) {
    return c.json({ error: "Invalid transaction ID" }, 400);
  }

  const { id } = result.data;
  const existing = db.prepare("SELECT * FROM transactions WHERE id = ? AND user_id = ?").get(id, userId) as any;
  if (!existing) {
    logger.warn({ id, userId }, "transaction not found for deletion");
    return c.json({ error: "Transaction not found" }, 404);
  }
  const decrypted = await decryptTransaction(existing, encKey);
  db.prepare("DELETE FROM transactions WHERE id = ? AND user_id = ?").run(id, userId);
  logger.info({ id, userId }, "transaction deleted");
  fireWebhooks(userId, "transaction.deleted", { transaction: decrypted });
  return c.json({ success: true });
});
```

- [ ] **Step 7: Verify build succeeds**

Run: `cd packages/api && bun build --target=bun src/index.ts --outdir=./dist`
Expected: Bundles without errors

- [ ] **Step 8: Commit**

```bash
git add packages/api/src/routes/transactions.ts
git commit -m "feat: decrypt transactions on read, rewrite stats to app-level aggregation"
```

---

### Task 6: Migration Script for Existing Unencrypted Data

**Files:**
- Create: `packages/api/scripts/migrate-encrypt.ts`

- [ ] **Step 1: Write the migration script**

This script encrypts all existing plaintext transactions for users who now have encryption keys.

```typescript
// packages/api/scripts/migrate-encrypt.ts
import db from "../src/db";
import { generateEncryptionKey, encryptField } from "../src/crypto";
import type { User, Transaction } from "../src/types";

async function migrate() {
  // 1. Ensure all users have encryption keys
  const usersWithoutKey = db.prepare(
    "SELECT * FROM users WHERE encryption_key IS NULL"
  ).all() as User[];

  for (const user of usersWithoutKey) {
    const key = await generateEncryptionKey();
    db.run("UPDATE users SET encryption_key = ? WHERE id = ?", [key, user.id]);
    console.log(`Generated key for user ${user.id} (${user.email})`);
  }

  // 2. Encrypt existing plaintext transactions
  // Detect plaintext: encrypted values are base64 (long strings), plaintext amounts are short numbers
  const allUsers = db.prepare("SELECT * FROM users").all() as User[];

  for (const user of allUsers) {
    const key = user.encryption_key!;
    const txns = db.prepare(
      "SELECT * FROM transactions WHERE user_id = ?"
    ).all(user.id) as any[];

    let migrated = 0;
    for (const tx of txns) {
      // Skip if already encrypted (base64 strings are long, amounts are short)
      const amountStr = String(tx.amount);
      if (amountStr.length > 20) continue; // likely already encrypted

      const [encAmount, encSeller, encCard, encTitle] = await Promise.all([
        encryptField(tx.amount, key),
        encryptField(tx.seller, key),
        encryptField(tx.card, key),
        encryptField(tx.title, key),
      ]);

      db.run(
        "UPDATE transactions SET amount = ?, seller = ?, card = ?, title = ? WHERE id = ?",
        [encAmount, encSeller, encCard, encTitle, tx.id]
      );
      migrated++;
    }

    if (migrated > 0) {
      console.log(`Encrypted ${migrated} transactions for user ${user.id} (${user.email})`);
    }
  }

  console.log("Migration complete.");
}

migrate().catch(console.error);
```

- [ ] **Step 2: Add migration script to package.json**

In `packages/api/package.json`, add to scripts:

```json
"migrate:encrypt": "bun scripts/migrate-encrypt.ts"
```

- [ ] **Step 3: Commit**

```bash
git add packages/api/scripts/migrate-encrypt.ts packages/api/package.json
git commit -m "feat: add migration script to encrypt existing plaintext transactions"
```

---

### Task 7: Redact Sensitive Data from Logs

**Files:**
- Modify: `packages/api/src/routes/transactions.ts`

- [ ] **Step 1: Remove plaintext transaction data from log lines**

In the POST handler, replace:
```typescript
logger.info({ contentType, body }, "incoming transaction");
```
with:
```typescript
logger.info({ contentType }, "incoming transaction");
```

And replace:
```typescript
logger.info({ amount, seller, card, title, userId }, "parsed transaction");
```
with:
```typescript
logger.info({ userId }, "parsed transaction");
```

Keep the log line at creation:
```typescript
logger.info({ id: created.id, userId }, "transaction created");
```

- [ ] **Step 2: Commit**

```bash
git add packages/api/src/routes/transactions.ts
git commit -m "fix: redact sensitive transaction data from API logs"
```

---

### Task 8: Integration Test

**Files:**
- Create: `packages/api/tests/transactions.test.ts`

- [ ] **Step 1: Write integration test for encrypted CRUD**

```typescript
// packages/api/tests/transactions.test.ts
import { test, expect, beforeAll } from "bun:test";
import { generateEncryptionKey, encrypt, decrypt } from "../src/crypto";
import db from "../src/db";

let testUserId: number;
let testToken: string;
let testEncKey: string;

beforeAll(async () => {
  testToken = "test-token-" + crypto.randomUUID();
  testEncKey = await generateEncryptionKey();
  db.run(
    "INSERT INTO users (email, name, api_token, encryption_key) VALUES (?, ?, ?, ?)",
    [`test-${Date.now()}@test.com`, "Test User", testToken, testEncKey]
  );
  const user = db.prepare("SELECT id FROM users WHERE api_token = ?").get(testToken) as { id: number };
  testUserId = user.id;
});

test("encrypted transaction fields are not readable in DB", async () => {
  const { encryptField } = await import("../src/crypto");

  const encAmount = await encryptField(42.50, testEncKey);
  const encSeller = await encryptField("Test Store", testEncKey);

  db.run(
    "INSERT INTO transactions (amount, seller, user_id) VALUES (?, ?, ?)",
    [encAmount, encSeller, testUserId]
  );

  const row = db.prepare(
    "SELECT amount, seller FROM transactions WHERE user_id = ? ORDER BY id DESC LIMIT 1"
  ).get(testUserId) as { amount: string; seller: string };

  // DB contains ciphertext, not plaintext
  expect(row.amount).not.toBe("42.5");
  expect(row.seller).not.toBe("Test Store");
  expect(row.amount.length).toBeGreaterThan(20); // base64 ciphertext

  // But can be decrypted
  const { decryptNumber, decryptField } = await import("../src/crypto");
  expect(await decryptNumber(row.amount, testEncKey)).toBe(42.5);
  expect(await decryptField(row.seller, testEncKey)).toBe("Test Store");
});
```

- [ ] **Step 2: Run integration test**

Run: `cd packages/api && bun test tests/transactions.test.ts`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add packages/api/tests/transactions.test.ts
git commit -m "test: add integration tests for encrypted transaction storage"
```

---

## Post-Implementation Notes

### Running the migration

After deploying the encrypted code:
```bash
cd packages/api && bun run migrate:encrypt
```

This will:
1. Generate encryption keys for any users missing them
2. Encrypt all existing plaintext transaction data

### Key management considerations

- **Encryption keys are stored in the same database** as the encrypted data. This protects against scenarios where the DB file is accessed without the application (e.g., stolen backup, disk access). It does NOT protect against a full server compromise.
- **For stronger security in the future:** Consider deriving the encryption key from a user-provided passphrase (using PBKDF2/Argon2), so the server never stores the key at rest. This would require the user to enter their passphrase on each session.
- **Key rotation:** Not implemented in this plan. Could be added later as a settings page feature that re-encrypts all transactions with a new key.
