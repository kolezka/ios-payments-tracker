import { createMiddleware } from "hono/factory";
import { logger } from "../logger";
import db from "../db";
import type { User } from "../types";

export const authMiddleware = createMiddleware(async (c, next) => {
  const header = c.req.header("Authorization");
  if (!header) {
    logger.warn({ path: c.req.path, method: c.req.method }, "missing Authorization header");
    return c.json({ error: "Unauthorized" }, 401);
  }

  const isBearerFormat = header.startsWith("Bearer ");
  const token = isBearerFormat ? header.slice(7) : header;

  const user = db.prepare("SELECT * FROM users WHERE api_token = ?").get(token) as User | null;
  if (!user) {
    logger.warn({ path: c.req.path, isBearerFormat, tokenLength: token.length }, "invalid auth token");
    return c.json({ error: "Unauthorized" }, 401);
  }

  logger.debug({ userId: user.id, email: user.email }, "authenticated");
  c.set("user", user);
  c.set("userId", user.id);

  await next();
});
