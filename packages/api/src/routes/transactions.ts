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
