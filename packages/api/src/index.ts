import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger as honoLogger } from "hono/logger";
import { logger } from "./logger";
import { authMiddleware } from "./middleware/auth";
import transactions from "./routes/transactions";

const app = new Hono();

app.use(honoLogger((msg) => logger.info(msg)));

const corsOrigin = process.env.WEB_ORIGIN ?? "http://localhost:5173";
logger.info({ corsOrigin }, "CORS configured");

app.use(
  "/api/*",
  cors({
    origin: corsOrigin,
    credentials: true,
  })
);

app.use("/api/*", authMiddleware);

app.route("/api/transactions", transactions);

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
