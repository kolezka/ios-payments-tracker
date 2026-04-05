import { createMiddleware } from "hono/factory";

export const authMiddleware = createMiddleware(async (c, next) => {
  const authToken = process.env.AUTH_TOKEN;
  if (!authToken) {
    return c.json({ error: "Server misconfigured: AUTH_TOKEN not set" }, 500);
  }

  const header = c.req.header("Authorization");
  if (!header) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  // Accept both "Bearer <token>" and raw "<token>" (iOS Shortcuts sends raw)
  const token = header.startsWith("Bearer ") ? header.slice(7) : header;
  if (token !== authToken) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  await next();
});
