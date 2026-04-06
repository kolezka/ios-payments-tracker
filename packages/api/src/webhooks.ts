import db from "./db";
import { logger } from "./logger";
import type { Webhook } from "./types";

export async function fireWebhooks(userId: number, event: string, payload: Record<string, unknown>) {
  const hooks = db.prepare(
    "SELECT * FROM webhooks WHERE user_id = ? AND active = 1"
  ).all(userId) as Webhook[];

  const matching = hooks.filter((h) => h.events.split(",").includes(event));
  if (matching.length === 0) return;

  logger.info({ event, userId, count: matching.length }, "firing webhooks");

  const body = JSON.stringify({ event, timestamp: new Date().toISOString(), data: payload });

  for (const hook of matching) {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (hook.secret) {
      const encoder = new TextEncoder();
      const key = await crypto.subtle.importKey("raw", encoder.encode(hook.secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
      const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(body));
      headers["X-Webhook-Signature"] = Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
    }

    fetch(hook.url, { method: "POST", headers, body }).then((res) => {
      logger.info({ webhookId: hook.id, status: res.status, event }, "webhook delivered");
    }).catch((err) => {
      logger.error({ webhookId: hook.id, error: String(err), event }, "webhook delivery failed");
    });
  }
}
