import { createMiddleware } from "hono/factory";
import { eq } from "drizzle-orm";
import { logger } from "../logger";
import db, { schema } from "../db";
import type { User } from "../types";

const DEV_MODE = process.env.DEV_MODE === "true";

async function getOrCreateDevUser(): Promise<User> {
  let [user] = await db.select().from(schema.users).where(eq(schema.users.email, "dev@local"));
  if (!user) {
    [user] = await db.insert(schema.users).values({
      email: "dev@local",
      name: "Dev User",
      apiToken: "dev-token",
    }).returning();
    logger.info("created dev user (dev@local / dev-token)");
  }
  return user;
}

export const authMiddleware = createMiddleware(async (c, next) => {
  if (DEV_MODE) {
    const user = await getOrCreateDevUser();
    c.set("user", user);
    c.set("userId", user.id);
    if (!user.encryptionKey) {
      const { generateEncryptionKey } = await import("../crypto");
      const encKey = await generateEncryptionKey();
      await db.update(schema.users).set({ encryptionKey: encKey }).where(eq(schema.users.id, user.id));
      user.encryptionKey = encKey;
      logger.info({ userId: user.id }, "backfilled encryption key");
    }
    await next();
    return;
  }

  const header = c.req.header("Authorization");
  const queryToken = c.req.query("token");

  if (!header && !queryToken) {
    logger.warn({ path: c.req.path, method: c.req.method }, "missing Authorization header");
    return c.json({ error: "Unauthorized" }, 401);
  }

  const token = queryToken ?? (header!.startsWith("Bearer ") ? header!.slice(7) : header!);

  const [user] = await db.select().from(schema.users).where(eq(schema.users.apiToken, token));
  if (!user) {
    logger.warn({ path: c.req.path, tokenLength: token.length }, "invalid auth token");
    return c.json({ error: "Unauthorized" }, 401);
  }

  logger.debug({ userId: user.id, email: user.email }, "authenticated");
  c.set("user", user);
  c.set("userId", user.id);

  if (!user.encryptionKey) {
    const { generateEncryptionKey } = await import("../crypto");
    const encKey = await generateEncryptionKey();
    await db.update(schema.users).set({ encryptionKey: encKey }).where(eq(schema.users.id, user.id));
    user.encryptionKey = encKey;
    logger.info({ userId: user.id }, "backfilled encryption key");
  }

  await next();
});
