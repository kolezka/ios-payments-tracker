import { createMiddleware } from "hono/factory";
import { logger } from "../logger";

export const authMiddleware = createMiddleware(async (c, next) => {
  const authToken = process.env.AUTH_TOKEN;
  if (!authToken) {
    logger.error("AUTH_TOKEN not set");
    return c.json({ error: "Server misconfigured: AUTH_TOKEN not set" }, 500);
  }

  const header = c.req.header("Authorization");
  if (!header) {
    logger.warn({
      path: c.req.path,
      method: c.req.method,
      headers: Object.fromEntries(
        [...c.req.raw.headers.entries()].filter(([k]) => k !== "authorization")
      ),
    }, "missing Authorization header");
    return c.json({ error: "Unauthorized" }, 401);
  }

  // Accept both "Bearer <token>" and raw "<token>" (iOS Shortcuts sends raw)
  const isBearerFormat = header.startsWith("Bearer ");
  const token = isBearerFormat ? header.slice(7) : header;
  logger.debug({ isBearerFormat, tokenLength: token.length }, "auth attempt");

  if (token !== authToken) {
    logger.warn({
      path: c.req.path,
      method: c.req.method,
      isBearerFormat,
      tokenLength: token.length,
      expectedLength: authToken.length,
    }, "invalid auth token");
    return c.json({ error: "Unauthorized" }, 401);
  }

  await next();
});
