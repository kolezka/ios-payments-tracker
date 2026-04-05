import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger as honoLogger } from "hono/logger";
import { logger } from "./logger";
import { authMiddleware } from "./middleware/auth";
import transactions from "./routes/transactions";

const app = new Hono();

app.use(honoLogger((msg) => logger.info(msg)));

app.use(
  "/api/*",
  cors({
    origin: process.env.WEB_ORIGIN ?? "http://localhost:5173",
    credentials: true,
  })
);

app.use("/api/*", authMiddleware);

app.route("/api/transactions", transactions);

app.get("/health", (c) => c.json({ status: "ok" }));

const port = parseInt(process.env.PORT ?? "3010");
logger.info({ port }, "server starting");

export default {
  fetch: app.fetch,
  port,
};
