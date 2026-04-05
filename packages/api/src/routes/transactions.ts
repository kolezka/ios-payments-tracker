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
