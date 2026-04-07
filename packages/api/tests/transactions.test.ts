import { test, expect, beforeAll } from "bun:test";
import { eq, desc } from "drizzle-orm";
import { generateEncryptionKey, encryptField, decryptNumber, decryptField } from "../src/crypto";
import db, { schema } from "../src/db";

let testUserId: number;
let testToken: string;
let testEncKey: string;

beforeAll(async () => {
  testToken = "test-token-" + crypto.randomUUID();
  testEncKey = await generateEncryptionKey();
  const [user] = await db.insert(schema.users).values({
    email: `test-${Date.now()}@test.com`,
    name: "Test User",
    apiToken: testToken,
    encryptionKey: testEncKey,
  }).returning();
  testUserId = user.id;
});

test("encrypted transaction fields are not readable in DB", async () => {
  const encAmount = await encryptField(42.50, testEncKey);
  const encSeller = await encryptField("Test Store", testEncKey);

  await db.insert(schema.transactions).values({
    amount: encAmount!,
    seller: encSeller!,
    userId: testUserId,
  });

  const [row] = await db.select({
    amount: schema.transactions.amount,
    seller: schema.transactions.seller,
  }).from(schema.transactions)
    .where(eq(schema.transactions.userId, testUserId))
    .orderBy(desc(schema.transactions.id))
    .limit(1);

  // DB contains ciphertext, not plaintext
  expect(row.amount).not.toBe("42.5");
  expect(row.seller).not.toBe("Test Store");
  expect(row.amount.length).toBeGreaterThan(20);

  // But can be decrypted
  expect(await decryptNumber(row.amount, testEncKey)).toBe(42.5);
  expect(await decryptField(row.seller, testEncKey)).toBe("Test Store");
});
