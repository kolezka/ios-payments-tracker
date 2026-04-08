import { z } from "zod";

const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD format");

export const createTransactionSchema = z.object({
  amount: z.preprocess(
    (val) => {
      if (typeof val === "string") {
        const cleaned = val.replace(/[^0-9.,-]/g, "").replace(",", ".");
        return parseFloat(cleaned);
      }
      return val;
    },
    z.number().positive("amount must be positive")
  ),
  seller: z.string().min(1).nullish().default("Unknown"),
  card: z.string().nullish().default("Unknown"),
  title: z.string().nullish().default("Unknown"),
});

export const listTransactionsSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(25),
  offset: z.coerce.number().int().min(0).default(0),
  from: dateString.optional(),
  to: dateString.optional(),
});

export const statsQuerySchema = z.object({
  from: dateString.optional(),
  to: dateString.optional(),
});

export const idParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const magicLinkSchema = z.object({
  email: z.string().email("Invalid email address"),
});

export const verifyTokenSchema = z.object({
  token: z.string().min(1, "Token is required"),
});

export const updateNameSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
});

const validWebhookEvents = ["transaction.created", "transaction.deleted"] as const;

function isInternalUrl(urlStr: string): boolean {
  try {
    const url = new URL(urlStr);
    const hostname = url.hostname.toLowerCase();
    if (url.protocol !== "https:" && url.protocol !== "http:") return true;
    if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1") return true;
    if (hostname === "0.0.0.0" || hostname.endsWith(".local")) return true;
    if (hostname === "metadata.google.internal") return true;
    // Block private IP ranges
    const parts = hostname.split(".").map(Number);
    if (parts.length === 4 && parts.every((p) => !isNaN(p))) {
      if (parts[0] === 10) return true;
      if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
      if (parts[0] === 192 && parts[1] === 168) return true;
      if (parts[0] === 169 && parts[1] === 254) return true;
    }
    return false;
  } catch {
    return true;
  }
}

export const createWebhookSchema = z.object({
  url: z.string().url("Invalid URL").refine((val) => !isInternalUrl(val), {
    message: "Webhook URL must not point to internal/private addresses",
  }),
  events: z.string().default("transaction.created").refine(
    (val) => val.split(",").every((e) => validWebhookEvents.includes(e.trim() as any)),
    { message: `Invalid events. Valid: ${validWebhookEvents.join(", ")}` }
  ),
  secret: z.string().nullish(),
});

export const updateWebhookSchema = z.object({
  active: z.boolean(),
});
