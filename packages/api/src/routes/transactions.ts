import { Hono } from "hono";
import db from "../db";
import { logger } from "../logger";
import type { Transaction } from "../types";

const transactions = new Hono();

// POST /api/transactions — create
// Accepts both standard fields {amount, merchant, ...} and iOS Shortcut fields {amount, seller, card, title}
transactions.post("/", async (c) => {
  let body: Record<string, any>;
  try {
    body = await c.req.json<Record<string, any>>();
  } catch (e) {
    const raw = await c.req.text();
    logger.error({ raw, error: String(e) }, "failed to parse JSON body");
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const contentType = c.req.header("Content-Type");
  logger.info({ contentType, bodyKeys: Object.keys(body), body }, "incoming transaction");

  const knownFields = ["amount", "merchant", "seller", "card", "card_last4", "title", "note", "category", "currency"];
  const unknownFields = Object.keys(body).filter((k) => !knownFields.includes(k));
  if (unknownFields.length > 0) {
    logger.warn({ unknownFields }, "request contains unknown fields");
  }

  // Map iOS Shortcut fields to internal fields
  const merchant = body.merchant ?? body.seller ?? null;
  const note = body.note ?? body.title ?? null;
  const card_last4 = body.card_last4 ?? body.card ?? null;

  // Parse amount: iOS sends strings like "42,50 zł", "42.50", or "42,50"
  let amount: number;
  if (body.amount === undefined || body.amount === null) {
    logger.warn("amount field is missing");
    return c.json({ error: "amount and merchant (or seller) are required" }, 400);
  } else if (typeof body.amount === "string") {
    logger.debug({ rawAmount: body.amount, type: "string" }, "parsing string amount");
    // Strip currency symbols/letters and whitespace, normalize comma to dot
    const cleaned = body.amount.replace(/[^0-9.,-]/g, "").replace(",", ".");
    amount = parseFloat(cleaned);
    if (isNaN(amount)) {
      logger.warn({ rawAmount: body.amount, cleaned }, "could not parse amount string");
    }
  } else if (typeof body.amount === "number") {
    amount = body.amount;
  } else {
    logger.warn({ rawAmount: body.amount, type: typeof body.amount }, "unexpected amount type");
    amount = Number(body.amount);
  }

  logger.info({ amount, merchant, note, card_last4, currency: body.currency ?? "PLN" }, "parsed transaction");

  if (!amount || isNaN(amount) || !merchant) {
    logger.warn({
      amount,
      amountIsNaN: isNaN(amount),
      merchant,
      hasMerchant: !!body.merchant,
      hasSeller: !!body.seller,
    }, "validation failed");
    return c.json({ error: "amount and merchant (or seller) are required" }, 400);
  }

  const stmt = db.prepare(`
    INSERT INTO transactions (amount, currency, merchant, category, note, card_last4)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const result = stmt.run(
    amount,
    body.currency ?? "PLN",
    merchant,
    body.category ?? null,
    note,
    card_last4 ?? null
  );

  const created = db
    .prepare("SELECT * FROM transactions WHERE id = ?")
    .get(result.lastInsertRowid) as Transaction;

  logger.info({ id: created.id, amount, merchant }, "transaction created");

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

  let categoryFilter = "";
  if (c.req.query("category")) {
    const categories = c.req.query("category")!.split(",").map((s) => s.trim());
    categoryFilter = ` AND category IN (${categories.map(() => "?").join(",")})`;
    params.push(...categories);
  }

  const summary = db
    .prepare(
      `SELECT COALESCE(SUM(amount), 0) as total_spent, COUNT(*) as transaction_count, COALESCE(AVG(amount), 0) as avg_transaction FROM transactions WHERE 1=1${dateFilter}${categoryFilter}`
    )
    .get(...params) as { total_spent: number; transaction_count: number; avg_transaction: number };

  const topMerchants = db
    .prepare(
      `SELECT merchant, COUNT(*) as count, SUM(amount) as total FROM transactions WHERE 1=1${dateFilter}${categoryFilter} GROUP BY merchant ORDER BY total DESC LIMIT 10`
    )
    .all(...params) as { merchant: string; count: number; total: number }[];

  const spendingByCategory = db
    .prepare(
      `SELECT COALESCE(category, 'uncategorized') as category, SUM(amount) as total FROM transactions WHERE 1=1${dateFilter}${categoryFilter} GROUP BY category ORDER BY total DESC`
    )
    .all(...params) as { category: string; total: number }[];

  const dailySpending = db
    .prepare(
      `SELECT DATE(timestamp) as date, SUM(amount) as total FROM transactions WHERE 1=1${dateFilter}${categoryFilter} GROUP BY DATE(timestamp) ORDER BY date DESC LIMIT 30`
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
  const limit = parseInt(c.req.query("limit") ?? "25");
  const offset = parseInt(c.req.query("offset") ?? "0");
  const from = c.req.query("from");
  const to = c.req.query("to");
  const categoryParam = c.req.query("category");

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

  let categoryFilter = "";
  if (categoryParam) {
    const categories = categoryParam.split(",").map((s) => s.trim());
    categoryFilter = ` AND category IN (${categories.map(() => "?").join(",")})`;
    params.push(...categories);
  }

  const countParams = [...params];
  const totalRow = db
    .prepare(
      `SELECT COUNT(*) as count FROM transactions WHERE 1=1${dateFilter}${categoryFilter}`
    )
    .get(...countParams) as { count: number };

  params.push(limit, offset);

  const rows = db
    .prepare(
      `SELECT * FROM transactions WHERE 1=1${dateFilter}${categoryFilter} ORDER BY timestamp DESC LIMIT ? OFFSET ?`
    )
    .all(...params) as Transaction[];

  return c.json({ transactions: rows, total: totalRow.count });
});

// DELETE /api/transactions/:id
transactions.delete("/:id", (c) => {
  const id = parseInt(c.req.param("id"));
  const existing = db.prepare("SELECT id FROM transactions WHERE id = ?").get(id);
  if (!existing) {
    return c.json({ error: "Transaction not found" }, 404);
  }
  db.prepare("DELETE FROM transactions WHERE id = ?").run(id);
  logger.info({ id }, "transaction deleted");
  return c.json({ success: true });
});

export default transactions;
