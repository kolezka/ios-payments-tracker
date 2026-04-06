import { Hono } from "hono";
import db from "../db";
import { logger } from "../logger";
import type { Webhook } from "../types";

const webhooks = new Hono();

webhooks.get("/", (c) => {
  const userId = c.get("userId") as number;
  const rows = db.prepare("SELECT * FROM webhooks WHERE user_id = ? ORDER BY created_at DESC").all(userId) as Webhook[];
  // Mask secrets in response
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

  try {
    new URL(url);
  } catch {
    return c.json({ error: "Invalid URL" }, 400);
  }

  const eventList = events ?? "transaction.created";
  const validEvents = ["transaction.created", "transaction.deleted"];
  const parsed = eventList.split(",").map((e) => e.trim());
  if (parsed.some((e) => !validEvents.includes(e))) {
    return c.json({ error: `Invalid events. Valid: ${validEvents.join(", ")}` }, 400);
  }

  const result = db.prepare(
    "INSERT INTO webhooks (user_id, url, events, secret) VALUES (?, ?, ?, ?)"
  ).run(userId, url, parsed.join(","), secret ?? null);

  const created = db.prepare("SELECT * FROM webhooks WHERE id = ?").get(result.lastInsertRowid) as Webhook;
  logger.info({ webhookId: created.id, url, events: parsed, userId }, "webhook created");

  const { secret: _, ...safe } = created;
  return c.json({ ...safe, has_secret: !!created.secret }, 201);
});

webhooks.delete("/:id", (c) => {
  const userId = c.get("userId") as number;
  const id = parseInt(c.req.param("id"));
  if (isNaN(id)) return c.json({ error: "Invalid ID" }, 400);

  const existing = db.prepare("SELECT id FROM webhooks WHERE id = ? AND user_id = ?").get(id, userId);
  if (!existing) return c.json({ error: "Webhook not found" }, 404);

  db.prepare("DELETE FROM webhooks WHERE id = ? AND user_id = ?").run(id, userId);
  logger.info({ webhookId: id, userId }, "webhook deleted");
  return c.json({ success: true });
});

webhooks.patch("/:id", async (c) => {
  const userId = c.get("userId") as number;
  const id = parseInt(c.req.param("id"));
  if (isNaN(id)) return c.json({ error: "Invalid ID" }, 400);

  const existing = db.prepare("SELECT * FROM webhooks WHERE id = ? AND user_id = ?").get(id, userId) as Webhook | null;
  if (!existing) return c.json({ error: "Webhook not found" }, 404);

  const body = await c.req.json();
  const { active } = body as { active?: boolean };

  if (active !== undefined) {
    db.prepare("UPDATE webhooks SET active = ? WHERE id = ?").run(active ? 1 : 0, id);
    logger.info({ webhookId: id, active, userId }, "webhook toggled");
  }

  const updated = db.prepare("SELECT * FROM webhooks WHERE id = ?").get(id) as Webhook;
  const { secret: _, ...safe } = updated;
  return c.json({ ...safe, has_secret: !!updated.secret });
});

export default webhooks;
