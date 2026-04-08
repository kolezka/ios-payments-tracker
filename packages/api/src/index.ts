import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger as honoLogger } from "hono/logger";
import { logger } from "./logger";
import { authMiddleware } from "./middleware/auth";
import { securityHeaders } from "./middleware/security-headers";
import { rateLimiter } from "./middleware/rate-limit";
import transactions from "./routes/transactions";
import auth from "./routes/auth";
import shortcut from "./routes/shortcut";
import webhooks from "./routes/webhooks";

const app = new Hono();

app.use(honoLogger((msg) => logger.info(msg)));
app.use(securityHeaders);

// Global rate limit: 100 requests per minute per IP
app.use(rateLimiter({ windowMs: 60_000, max: 100, keyPrefix: "global" }));

const corsOrigin = process.env.WEB_ORIGIN ?? "http://localhost:5173";
logger.info({ corsOrigin }, "CORS configured");

app.use(
  "/api/*",
  cors({
    origin: corsOrigin,
    credentials: true,
  })
);

// Strict rate limit on auth endpoints: 5 requests per 15 minutes per IP
app.use("/api/auth/magic-link", rateLimiter({ windowMs: 15 * 60_000, max: 5, keyPrefix: "magic-link" }));
app.use("/api/auth/verify", rateLimiter({ windowMs: 15 * 60_000, max: 10, keyPrefix: "verify" }));
app.use("/api/auth/github/*", rateLimiter({ windowMs: 15 * 60_000, max: 10, keyPrefix: "github" }));

// Public routes (no auth)
app.route("/api/auth", auth);

// Protected routes
app.use("/api/transactions/*", authMiddleware);
app.use("/api/transactions", authMiddleware);
app.route("/api/transactions", transactions);

app.use("/api/shortcut/*", authMiddleware);
app.use("/api/shortcut", authMiddleware);
app.route("/api/shortcut", shortcut);

app.use("/api/webhooks/*", authMiddleware);
app.use("/api/webhooks", authMiddleware);
app.route("/api/webhooks", webhooks);

app.get("/health", (c) => {
  logger.debug("health check");
  return c.json({ status: "ok" });
});

const port = parseInt(process.env.PORT ?? "3010");
logger.info({ port }, "server starting");

export default {
  fetch: app.fetch,
  port,
};
