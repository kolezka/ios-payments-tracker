import { Hono } from "hono";
import { eq, and, desc } from "drizzle-orm";
import db, { schema } from "../db";
import { logger } from "../logger";

const webhooks = new Hono();

webhooks.get("/", async (c) => {
  const userId = c.get("userId") as number;
  const rows = await db.select().from(schema.webhooks)
    .where(eq(schema.webhooks.userId, userId))
    .orderBy(desc(schema.webhooks.createdAt));
  const safe = rows.map(({ secret, ...rest }) => ({ ...rest, has_secret: !!secret }));
  return c.json(safe);
});

webhooks.post("/", async (c) => {
  const userId = c.get("userId") as number;
  const body = await c.req.json();
  const { url, events, secret } = body as { url?: string; events?: string; secret?: string };

  if (!url || typeof url !== "string") {
    return c.json({ error: "url is required" }, 400);
  }

  try { new URL(url); } catch { return c.json({ error: "Invalid URL" }, 400); }

  const eventList = events ?? "transaction.created";
  const validEvents = ["transaction.created", "transaction.deleted"];
  const parsed = eventList.split(",").map((e) => e.trim());
  if (parsed.some((e) => !validEvents.includes(e))) {
    return c.json({ error: `Invalid events. Valid: ${validEvents.join(", ")}` }, 400);
  }

  const [created] = await db.insert(schema.webhooks).values({
    userId, url, events: parsed.join(","), secret: secret ?? null,
  }).returning();

  logger.info({ webhookId: created.id, url, events: parsed, userId }, "webhook created");

  const { secret: _, ...safe } = created;
  return c.json({ ...safe, has_secret: !!created.secret }, 201);
});

webhooks.delete("/:id", async (c) => {
  const userId = c.get("userId") as number;
  const id = parseInt(c.req.param("id"));
  if (isNaN(id)) return c.json({ error: "Invalid ID" }, 400);

  const [existing] = await db.select({ id: schema.webhooks.id }).from(schema.webhooks)
    .where(and(eq(schema.webhooks.id, id), eq(schema.webhooks.userId, userId)));
  if (!existing) return c.json({ error: "Webhook not found" }, 404);

  await db.delete(schema.webhooks).where(and(eq(schema.webhooks.id, id), eq(schema.webhooks.userId, userId)));
  logger.info({ webhookId: id, userId }, "webhook deleted");
  return c.json({ success: true });
});

webhooks.patch("/:id", async (c) => {
  const userId = c.get("userId") as number;
  const id = parseInt(c.req.param("id"));
  if (isNaN(id)) return c.json({ error: "Invalid ID" }, 400);

  const [existing] = await db.select().from(schema.webhooks)
    .where(and(eq(schema.webhooks.id, id), eq(schema.webhooks.userId, userId)));
  if (!existing) return c.json({ error: "Webhook not found" }, 404);

  const body = await c.req.json();
  const { active } = body as { active?: boolean };

  if (active !== undefined) {
    await db.update(schema.webhooks).set({ active }).where(eq(schema.webhooks.id, id));
    logger.info({ webhookId: id, active, userId }, "webhook toggled");
  }

  const [updated] = await db.select().from(schema.webhooks).where(eq(schema.webhooks.id, id));
  const { secret: _, ...safe } = updated;
  return c.json({ ...safe, has_secret: !!updated.secret });
});

export default webhooks;
