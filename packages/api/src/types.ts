import type { InferSelectModel } from "drizzle-orm";
import type { users, magicLinks, transactions, webhooks } from "./schema";

export type User = InferSelectModel<typeof users>;
export type MagicLink = InferSelectModel<typeof magicLinks>;
export type Transaction = InferSelectModel<typeof transactions>;
export type Webhook = InferSelectModel<typeof webhooks>;
