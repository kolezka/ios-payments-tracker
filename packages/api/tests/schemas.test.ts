import { test, expect } from "bun:test";
import {
  createTransactionSchema,
  listTransactionsSchema,
  createWebhookSchema,
  updateWebhookSchema,
  magicLinkSchema,
  updateNameSchema,
} from "../src/schemas";

// Transaction schema
test("createTransactionSchema accepts valid transaction", () => {
  const result = createTransactionSchema.safeParse({ amount: 42.5, seller: "Amazon" });
  expect(result.success).toBe(true);
  if (result.success) {
    expect(result.data.amount).toBe(42.5);
    expect(result.data.seller).toBe("Amazon");
    expect(result.data.card).toBeNull();
    expect(result.data.title).toBeNull();
  }
});

test("createTransactionSchema parses string amounts", () => {
  const result = createTransactionSchema.safeParse({ amount: "29,99 zł", seller: "Shop" });
  expect(result.success).toBe(true);
  if (result.success) expect(result.data.amount).toBe(29.99);
});

test("createTransactionSchema rejects missing seller", () => {
  const result = createTransactionSchema.safeParse({ amount: 10 });
  expect(result.success).toBe(false);
});

test("createTransactionSchema rejects negative amount", () => {
  const result = createTransactionSchema.safeParse({ amount: -5, seller: "X" });
  expect(result.success).toBe(false);
});

// List schema
test("listTransactionsSchema defaults limit and offset", () => {
  const result = listTransactionsSchema.safeParse({});
  expect(result.success).toBe(true);
  if (result.success) {
    expect(result.data.limit).toBe(25);
    expect(result.data.offset).toBe(0);
  }
});

test("listTransactionsSchema rejects limit > 100", () => {
  const result = listTransactionsSchema.safeParse({ limit: 200 });
  expect(result.success).toBe(false);
});

// Webhook schema
test("createWebhookSchema accepts valid webhook", () => {
  const result = createWebhookSchema.safeParse({ url: "https://example.com/hook" });
  expect(result.success).toBe(true);
  if (result.success) {
    expect(result.data.events).toBe("transaction.created");
  }
});

test("createWebhookSchema accepts multiple events", () => {
  const result = createWebhookSchema.safeParse({
    url: "https://example.com/hook",
    events: "transaction.created,transaction.deleted",
  });
  expect(result.success).toBe(true);
});

test("createWebhookSchema rejects invalid URL", () => {
  const result = createWebhookSchema.safeParse({ url: "not-a-url" });
  expect(result.success).toBe(false);
});

test("createWebhookSchema rejects invalid events", () => {
  const result = createWebhookSchema.safeParse({
    url: "https://example.com",
    events: "transaction.updated",
  });
  expect(result.success).toBe(false);
});

test("updateWebhookSchema accepts boolean active", () => {
  const result = updateWebhookSchema.safeParse({ active: false });
  expect(result.success).toBe(true);
});

test("updateWebhookSchema rejects non-boolean active", () => {
  const result = updateWebhookSchema.safeParse({ active: "yes" });
  expect(result.success).toBe(false);
});

// Auth schemas
test("magicLinkSchema rejects invalid email", () => {
  const result = magicLinkSchema.safeParse({ email: "not-an-email" });
  expect(result.success).toBe(false);
});

test("updateNameSchema rejects empty name", () => {
  const result = updateNameSchema.safeParse({ name: "" });
  expect(result.success).toBe(false);
});

test("updateNameSchema rejects name > 100 chars", () => {
  const result = updateNameSchema.safeParse({ name: "a".repeat(101) });
  expect(result.success).toBe(false);
});
