import { z } from "zod";

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
  seller: z.string().min(1, "seller is required"),
  card: z.string().nullish().default(null),
  title: z.string().nullish().default(null),
});

export const listTransactionsSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(25),
  offset: z.coerce.number().int().min(0).default(0),
  from: z.string().optional(),
  to: z.string().optional(),
});

export const statsQuerySchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
});

export const idParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});
