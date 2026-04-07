// packages/api/tests/transactions.test.ts
import { test, expect, beforeAll } from "bun:test";
import { generateEncryptionKey, encryptField, decryptNumber, decryptField } from "../src/crypto";
import db from "../src/db";

let testUserId: number;
let testToken: string;
let testEncKey: string;

beforeAll(async () => {
  testToken = "test-token-" + crypto.randomUUID();
  testEncKey = await generateEncryptionKey();
  db.run(
    "INSERT INTO users (email, name, api_token, encryption_key) VALUES (?, ?, ?, ?)",
    [`test-${Date.now()}@test.com`, "Test User", testToken, testEncKey]
  );
  const user = db.prepare("SELECT id FROM users WHERE api_token = ?").get(testToken) as { id: number };
  testUserId = user.id;
});

test("encrypted transaction fields are not readable in DB", async () => {
  const encAmount = await encryptField(42.50, testEncKey);
  const encSeller = await encryptField("Test Store", testEncKey);

  db.run(
    "INSERT INTO transactions (amount, seller, user_id) VALUES (?, ?, ?)",
    [encAmount, encSeller, testUserId]
  );

  const row = db.prepare(
    "SELECT amount, seller FROM transactions WHERE user_id = ? ORDER BY id DESC LIMIT 1"
  ).get(testUserId) as { amount: string; seller: string };

  // DB contains ciphertext, not plaintext
  expect(row.amount).not.toBe("42.5");
  expect(row.seller).not.toBe("Test Store");
  expect(row.amount.length).toBeGreaterThan(20); // base64 ciphertext

  // But can be decrypted
  expect(await decryptNumber(row.amount, testEncKey)).toBe(42.5);
  expect(await decryptField(row.seller, testEncKey)).toBe("Test Store");
});
