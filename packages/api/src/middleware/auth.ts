import { createMiddleware } from "hono/factory";
import { logger } from "../logger";
import db from "../db";
import type { User } from "../types";

const DEV_MODE = process.env.DEV_MODE === "true";

function getOrCreateDevUser(): User {
  let user = db.prepare("SELECT * FROM users WHERE email = ?").get("dev@local") as User | null;
  if (!user) {
    db.run(
      "INSERT INTO users (email, name, api_token) VALUES (?, ?, ?)",
      ["dev@local", "Dev User", "dev-token"]
    );
    user = db.prepare("SELECT * FROM users WHERE email = ?").get("dev@local") as User;
    logger.info("created dev user (dev@local / dev-token)");
  }
  return user;
}

export const authMiddleware = createMiddleware(async (c, next) => {
  if (DEV_MODE) {
    const user = getOrCreateDevUser();
    c.set("user", user);
    c.set("userId", user.id);
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

  const user = db.prepare("SELECT * FROM users WHERE api_token = ?").get(token) as User | null;
  if (!user) {
    logger.warn({ path: c.req.path, tokenLength: token.length }, "invalid auth token");
    return c.json({ error: "Unauthorized" }, 401);
  }

  logger.debug({ userId: user.id, email: user.email }, "authenticated");
  c.set("user", user);
  c.set("userId", user.id);

  await next();
});
