import db from "../src/db";
import { generateEncryptionKey, encryptField } from "../src/crypto";
import type { User } from "../src/types";

async function migrate() {
  // 1. Ensure all users have encryption keys
  const usersWithoutKey = db.prepare(
    "SELECT * FROM users WHERE encryption_key IS NULL"
  ).all() as User[];

  for (const user of usersWithoutKey) {
    const key = await generateEncryptionKey();
    db.run("UPDATE users SET encryption_key = ? WHERE id = ?", [key, user.id]);
    console.log(`Generated key for user ${user.id} (${user.email})`);
  }

  // 2. Encrypt existing plaintext transactions
  const allUsers = db.prepare("SELECT * FROM users").all() as User[];

  for (const user of allUsers) {
    const key = user.encryption_key!;
    const txns = db.prepare(
      "SELECT * FROM transactions WHERE user_id = ?"
    ).all(user.id) as any[];

    let migrated = 0;
    for (const tx of txns) {
      // Skip if already encrypted (base64 strings are long, plaintext amounts are short)
      const amountStr = String(tx.amount);
      if (amountStr.length > 20) continue;

      const [encAmount, encSeller, encCard, encTitle] = await Promise.all([
        encryptField(tx.amount, key),
        encryptField(tx.seller, key),
        encryptField(tx.card, key),
        encryptField(tx.title, key),
      ]);

      db.run(
        "UPDATE transactions SET amount = ?, seller = ?, card = ?, title = ? WHERE id = ?",
        [encAmount, encSeller, encCard, encTitle, tx.id]
      );
      migrated++;
    }

    if (migrated > 0) {
      console.log(`Encrypted ${migrated} transactions for user ${user.id} (${user.email})`);
    }
  }

  console.log("Migration complete.");
}

migrate().catch(console.error);
