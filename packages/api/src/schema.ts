import { pgTable, serial, text, real, integer, timestamp, boolean } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").unique().notNull(),
  name: text("name").notNull().default(""),
  githubId: text("github_id").unique(),
  apiToken: text("api_token").unique().notNull(),
  encryptionKey: text("encryption_key"),
  createdAt: timestamp("created_at", { mode: "string" }).defaultNow(),
});

export const magicLinks = pgTable("magic_links", {
  id: serial("id").primaryKey(),
  email: text("email").notNull(),
  token: text("token").unique().notNull(),
  expiresAt: text("expires_at").notNull(),
  used: integer("used").default(0),
});

export const transactions = pgTable("transactions", {
  id: serial("id").primaryKey(),
  amount: text("amount").notNull(),
  card: text("card"),
  seller: text("seller").notNull(),
  title: text("title"),
  userId: integer("user_id").references(() => users.id),
  timestamp: timestamp("timestamp", { mode: "string" }).defaultNow().notNull(),
  createdAt: timestamp("created_at", { mode: "string" }).defaultNow().notNull(),
});

export const webhooks = pgTable("webhooks", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  url: text("url").notNull(),
  events: text("events").notNull().default("transaction.created"),
  secret: text("secret"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { mode: "string" }).defaultNow().notNull(),
});
