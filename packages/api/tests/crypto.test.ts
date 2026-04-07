import { test, expect } from "bun:test";
import { generateEncryptionKey, encrypt, decrypt, encryptField, decryptField, decryptNumber } from "../src/crypto";

test("generateEncryptionKey returns 64-char hex string", async () => {
  const key = await generateEncryptionKey();
  expect(key).toHaveLength(64);
  expect(key).toMatch(/^[0-9a-f]{64}$/);
});

test("generateEncryptionKey returns unique keys", async () => {
  const key1 = await generateEncryptionKey();
  const key2 = await generateEncryptionKey();
  expect(key1).not.toBe(key2);
});

test("encrypt then decrypt returns original string", async () => {
  const key = await generateEncryptionKey();
  const plaintext = "Hello, World! 123.45";
  const encrypted = await encrypt(plaintext, key);
  const decrypted = await decrypt(encrypted, key);
  expect(decrypted).toBe(plaintext);
});

test("encrypt produces different ciphertext each time (random IV)", async () => {
  const key = await generateEncryptionKey();
  const plaintext = "same input";
  const enc1 = await encrypt(plaintext, key);
  const enc2 = await encrypt(plaintext, key);
  expect(enc1).not.toBe(enc2);
});

test("decrypt with wrong key throws", async () => {
  const key1 = await generateEncryptionKey();
  const key2 = await generateEncryptionKey();
  const encrypted = await encrypt("secret", key1);
  expect(decrypt(encrypted, key2)).rejects.toThrow();
});

test("encryptField handles null", async () => {
  const key = await generateEncryptionKey();
  const result = await encryptField(null, key);
  expect(result).toBeNull();
});

test("encryptField handles numbers", async () => {
  const key = await generateEncryptionKey();
  const encrypted = await encryptField(42.50, key);
  expect(encrypted).not.toBeNull();
  const decrypted = await decryptNumber(encrypted, key);
  expect(decrypted).toBe(42.5);
});
