import { Hono } from "hono";
import { eq, and, desc } from "drizzle-orm";
import db, { schema } from "../db";
import { logger } from "../logger";
import { createWebhookSchema, updateWebhookSchema, idParamSchema } from "../schemas";

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
  const result = createWebhookSchema.safeParse(body);
  if (!result.success) {
    return c.json({ error: result.error.flatten() }, 400);
  }

  const { url, events, secret } = result.data;

  const [created] = await db.insert(schema.webhooks).values({
    userId, url, events, secret: secret ?? null,
  }).returning();

  logger.info({ webhookId: created.id, url, events, userId }, "webhook created");

  const { secret: _, ...safe } = created;
  return c.json({ ...safe, has_secret: !!created.secret }, 201);
});

webhooks.delete("/:id", async (c) => {
  const userId = c.get("userId") as number;
  const paramResult = idParamSchema.safeParse({ id: c.req.param("id") });
  if (!paramResult.success) return c.json({ error: "Invalid ID" }, 400);

  const { id } = paramResult.data;
  const [existing] = await db.select({ id: schema.webhooks.id }).from(schema.webhooks)
    .where(and(eq(schema.webhooks.id, id), eq(schema.webhooks.userId, userId)));
  if (!existing) return c.json({ error: "Webhook not found" }, 404);

  await db.delete(schema.webhooks).where(and(eq(schema.webhooks.id, id), eq(schema.webhooks.userId, userId)));
  logger.info({ webhookId: id, userId }, "webhook deleted");
  return c.json({ success: true });
});

webhooks.patch("/:id", async (c) => {
  const userId = c.get("userId") as number;
  const paramResult = idParamSchema.safeParse({ id: c.req.param("id") });
  if (!paramResult.success) return c.json({ error: "Invalid ID" }, 400);

  const { id } = paramResult.data;
  const [existing] = await db.select().from(schema.webhooks)
    .where(and(eq(schema.webhooks.id, id), eq(schema.webhooks.userId, userId)));
  if (!existing) return c.json({ error: "Webhook not found" }, 404);

  const body = await c.req.json();
  const result = updateWebhookSchema.safeParse(body);
  if (!result.success) {
    return c.json({ error: result.error.flatten() }, 400);
  }

  await db.update(schema.webhooks).set({ active: result.data.active }).where(eq(schema.webhooks.id, id));
  logger.info({ webhookId: id, active: result.data.active, userId }, "webhook toggled");

  const [updated] = await db.select().from(schema.webhooks).where(eq(schema.webhooks.id, id));
  const { secret: _, ...safe } = updated;
  return c.json({ ...safe, has_secret: !!updated.secret });
});

export default webhooks;
