import { Hono } from "hono";
import db from "../db";
import { logger } from "../logger";
import type { Transaction, User } from "../types";
import {
  createTransactionSchema,
  listTransactionsSchema,
  statsQuerySchema,
  idParamSchema,
} from "../schemas";
import { fireWebhooks } from "../webhooks";
import { encryptField, decryptField, decryptNumber } from "../crypto";

const transactions = new Hono();

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
  logger.info({ contentType }, "incoming transaction");

  const result = createTransactionSchema.safeParse(body);
  if (!result.success) {
    logger.warn({ errors: result.error.flatten() }, "validation failed");
    return c.json({ error: result.error.flatten() }, 400);
  }

  const { amount, seller, card, title } = result.data;
  logger.info({ userId }, "parsed transaction");

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

  const row = db
    .prepare("SELECT * FROM transactions WHERE id = ?")
    .get(insertResult.lastInsertRowid) as any;
  const created = { ...row, amount, seller, card, title };

  logger.info({ id: created.id, userId }, "transaction created");
  fireWebhooks(userId, "transaction.created", { transaction: created });
  return c.json(created, 201);
});

transactions.get("/stats", async (c) => {
  const userId = c.get("userId") as number;
  const user = c.get("user") as User;
  const encKey = user.encryption_key!;

  const result = statsQuerySchema.safeParse(c.req.query());
  if (!result.success) return c.json({ error: result.error.flatten() }, 400);

  const { from, to } = result.data;
  logger.debug({ from, to, userId }, "stats request");

  let dateFilter = "";
  const params: (string | number)[] = [userId];
  if (from) { dateFilter += " AND timestamp >= ?"; params.push(from); }
  if (to) { dateFilter += " AND timestamp <= ?"; params.push(to + " 23:59:59"); }

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
      card, total,
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

transactions.get("/", async (c) => {
  const userId = c.get("userId") as number;
  const user = c.get("user") as User;
  const encKey = user.encryption_key!;

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
  ).all(...params) as any[];

  const transactions_list = await decryptTransactions(rows, encKey);

  logger.info({ total: totalRow.count, returned: transactions_list.length, userId }, "list transactions response");
  return c.json({ transactions: transactions_list, total: totalRow.count });
});

transactions.get("/export", async (c) => {
  const userId = c.get("userId") as number;
  const user = c.get("user") as User;
  const encKey = user.encryption_key!;
  const format = c.req.query("format") ?? "csv";
  const from = c.req.query("from");
  const to = c.req.query("to");

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
    `SELECT * FROM transactions WHERE user_id = ?${dateFilter} ORDER BY timestamp DESC`
  ).all(...params) as any[];

  const txns = await decryptTransactions(rows, encKey);

  logger.info({ format, count: txns.length, userId }, "export transactions");

  if (format === "json") {
    return new Response(JSON.stringify(txns, null, 2), {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": 'attachment; filename="transactions.json"',
      },
    });
  }

  const header = "id,amount,seller,card,title,timestamp";
  const csvRows = txns.map((r) => {
    const escape = (v: string | null) => {
      if (v == null) return "";
      if (v.includes(",") || v.includes('"') || v.includes("\n")) return `"${v.replace(/"/g, '""')}"`;
      return v;
    };
    return `${r.id},${r.amount},${escape(r.seller)},${escape(r.card)},${escape(r.title)},${r.timestamp}`;
  });
  const csv = [header, ...csvRows].join("\n");

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": 'attachment; filename="transactions.csv"',
    },
  });
});

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

export default transactions;
