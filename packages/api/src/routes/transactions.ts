import { Hono } from "hono";
import { eq, and, gte, lte, desc, count } from "drizzle-orm";
import db, { schema } from "../db";
import { logger } from "../logger";
import type { User } from "../types";
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
  return { ...row, amount: String(amount), seller: seller!, card, title };
}

async function decryptTransactions(rows: any[], encKey: string): Promise<any[]> {
  return Promise.all(rows.map((row) => decryptTransaction(row, encKey)));
}

function buildDateFilters(from?: string, to?: string) {
  const conditions: any[] = [];
  if (from) conditions.push(gte(schema.transactions.timestamp, from));
  if (to) conditions.push(lte(schema.transactions.timestamp, to + " 23:59:59"));
  return conditions;
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
  const encKey = user.encryptionKey!;

  const [encAmount, encSeller, encCard, encTitle] = await Promise.all([
    encryptField(amount, encKey),
    encryptField(seller, encKey),
    encryptField(card, encKey),
    encryptField(title, encKey),
  ]);

  const [row] = await db.insert(schema.transactions).values({
    amount: encAmount!,
    seller: encSeller!,
    card: encCard,
    title: encTitle,
    userId,
  }).returning();

  const created = { ...row, amount, seller, card, title };

  logger.info({ id: created.id, userId }, "transaction created");
  fireWebhooks(userId, "transaction.created", { transaction: created });
  return c.json(created, 201);
});

transactions.get("/stats", async (c) => {
  const userId = c.get("userId") as number;
  const user = c.get("user") as User;
  const encKey = user.encryptionKey!;

  const result = statsQuerySchema.safeParse(c.req.query());
  if (!result.success) return c.json({ error: result.error.flatten() }, 400);

  const { from, to } = result.data;
  logger.debug({ from, to, userId }, "stats request");

  const dateFilters = buildDateFilters(from, to);

  const rows = await db.select().from(schema.transactions)
    .where(and(eq(schema.transactions.userId, userId), ...dateFilters));

  const txns = await decryptTransactions(rows, encKey);

  const totalSpent = txns.reduce((sum: number, t: any) => sum + parseFloat(t.amount), 0);
  const txnCount = txns.length;
  const avgTransaction = txnCount > 0 ? Math.round((totalSpent / txnCount) * 100) / 100 : 0;

  const sellerMap = new Map<string, { count: number; total: number }>();
  for (const t of txns) {
    const amt = parseFloat(t.amount);
    const s = sellerMap.get(t.seller) ?? { count: 0, total: 0 };
    s.count++;
    s.total += amt;
    sellerMap.set(t.seller, s);
  }
  const topSellers = [...sellerMap.entries()]
    .map(([seller, v]) => ({ seller, count: v.count, total: v.total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 10);

  const dailyMap = new Map<string, number>();
  for (const t of txns) {
    const date = typeof t.timestamp === "string" ? t.timestamp.slice(0, 10) : new Date(t.timestamp).toISOString().slice(0, 10);
    dailyMap.set(date, (dailyMap.get(date) ?? 0) + parseFloat(t.amount));
  }
  const dailyTotals = [...dailyMap.entries()]
    .map(([date, total]) => ({ date, total }))
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 30);

  const cardMap = new Map<string, number>();
  for (const t of txns) {
    const card = t.card ?? "Unknown";
    cardMap.set(card, (cardMap.get(card) ?? 0) + parseFloat(t.amount));
  }
  const cardTotal = [...cardMap.values()].reduce((a, b) => a + b, 0);
  const cardBreakdown = [...cardMap.entries()]
    .map(([card, total]) => ({
      card, total,
      percentage: cardTotal > 0 ? Math.round((total / cardTotal) * 100) : 0,
    }))
    .sort((a, b) => b.total - a.total);

  logger.info({ transaction_count: txnCount, userId }, "stats computed");

  return c.json({
    total_spent: totalSpent,
    transaction_count: txnCount,
    avg_transaction: avgTransaction,
    top_sellers: topSellers,
    daily_totals: dailyTotals,
    card_breakdown: cardBreakdown,
  });
});

transactions.get("/", async (c) => {
  const userId = c.get("userId") as number;
  const user = c.get("user") as User;
  const encKey = user.encryptionKey!;

  const result = listTransactionsSchema.safeParse(c.req.query());
  if (!result.success) {
    return c.json({ error: result.error.flatten() }, 400);
  }

  const { limit, offset, from, to } = result.data;
  logger.debug({ limit, offset, from, to, userId }, "list transactions request");

  const dateFilters = buildDateFilters(from, to);
  const whereClause = and(eq(schema.transactions.userId, userId), ...dateFilters);

  const [totalRow] = await db.select({ count: count() }).from(schema.transactions).where(whereClause);

  const rows = await db.select().from(schema.transactions)
    .where(whereClause)
    .orderBy(desc(schema.transactions.timestamp))
    .limit(limit)
    .offset(offset);

  const txnList = await decryptTransactions(rows, encKey);

  logger.info({ total: totalRow.count, returned: txnList.length, userId }, "list transactions response");
  return c.json({ transactions: txnList, total: totalRow.count });
});

transactions.get("/export", async (c) => {
  const userId = c.get("userId") as number;
  const user = c.get("user") as User;
  const encKey = user.encryptionKey!;
  const format = c.req.query("format") ?? "csv";
  const from = c.req.query("from");
  const to = c.req.query("to");

  const dateFilters = buildDateFilters(from ?? undefined, to ?? undefined);

  const rows = await db.select().from(schema.transactions)
    .where(and(eq(schema.transactions.userId, userId), ...dateFilters))
    .orderBy(desc(schema.transactions.timestamp));

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
  const csvRows = txns.map((r: any) => {
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
  const encKey = user.encryptionKey!;

  const result = idParamSchema.safeParse({ id: c.req.param("id") });
  if (!result.success) {
    return c.json({ error: "Invalid transaction ID" }, 400);
  }

  const { id } = result.data;
  const [existing] = await db.select().from(schema.transactions)
    .where(and(eq(schema.transactions.id, id), eq(schema.transactions.userId, userId)));
  if (!existing) {
    logger.warn({ id, userId }, "transaction not found for deletion");
    return c.json({ error: "Transaction not found" }, 404);
  }
  const decrypted = await decryptTransaction(existing, encKey);
  await db.delete(schema.transactions)
    .where(and(eq(schema.transactions.id, id), eq(schema.transactions.userId, userId)));
  logger.info({ id, userId }, "transaction deleted");
  fireWebhooks(userId, "transaction.deleted", { transaction: decrypted });
  return c.json({ success: true });
});

export default transactions;
