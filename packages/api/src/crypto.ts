/**
 * AES-256-GCM encryption for transaction data.
 * Each encrypted value is stored as: base64(iv + ciphertext + authTag)
 * - IV: 12 bytes (random per encryption)
 * - Auth tag: 16 bytes (appended by GCM)
 */

export async function generateEncryptionKey(): Promise<string> {
  const key = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(key).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

async function importKey(hexKey: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    hexToBytes(hexKey),
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"]
  );
}

export async function encrypt(plaintext: string, hexKey: string): Promise<string> {
  const key = await importKey(hexKey);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoded
  );
  const combined = new Uint8Array(iv.length + ciphertext.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(ciphertext), iv.length);
  return btoa(String.fromCharCode(...combined));
}

export async function decrypt(encoded: string, hexKey: string): Promise<string> {
  const key = await importKey(hexKey);
  const combined = Uint8Array.from(atob(encoded), (c) => c.charCodeAt(0));
  const iv = combined.slice(0, 12);
  const ciphertext = combined.slice(12);
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    ciphertext
  );
  return new TextDecoder().decode(decrypted);
}

export async function encryptField(
  value: string | number | null | undefined,
  hexKey: string
): Promise<string | null> {
  if (value == null) return null;
  return encrypt(String(value), hexKey);
}

export async function decryptField(
  value: string | null | undefined,
  hexKey: string
): Promise<string | null> {
  if (value == null) return null;
  return decrypt(value, hexKey);
}

export async function decryptNumber(
  value: string | null | undefined,
  hexKey: string
): Promise<number | null> {
  if (value == null) return null;
  const decrypted = await decrypt(value, hexKey);
  return parseFloat(decrypted);
}
