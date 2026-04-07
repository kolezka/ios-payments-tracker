import { eq, isNull } from "drizzle-orm";
import db, { schema } from "../src/db";
import { generateEncryptionKey, encryptField } from "../src/crypto";

async function migrate() {
  // 1. Ensure all users have encryption keys
  const usersWithoutKey = await db.select().from(schema.users).where(isNull(schema.users.encryptionKey));

  for (const user of usersWithoutKey) {
    const key = await generateEncryptionKey();
    await db.update(schema.users).set({ encryptionKey: key }).where(eq(schema.users.id, user.id));
    console.log(`Generated key for user ${user.id} (${user.email})`);
  }

  // 2. Encrypt existing plaintext transactions
  const allUsers = await db.select().from(schema.users);

  for (const user of allUsers) {
    const key = user.encryptionKey!;
    const txns = await db.select().from(schema.transactions).where(eq(schema.transactions.userId, user.id));

    let migrated = 0;
    for (const tx of txns) {
      if (tx.amount.length > 20) continue;

      const [encAmount, encSeller, encCard, encTitle] = await Promise.all([
        encryptField(parseFloat(tx.amount), key),
        encryptField(tx.seller, key),
        encryptField(tx.card, key),
        encryptField(tx.title, key),
      ]);

      await db.update(schema.transactions).set({
        amount: encAmount!,
        seller: encSeller!,
        card: encCard,
        title: encTitle,
      }).where(eq(schema.transactions.id, tx.id));
      migrated++;
    }

    if (migrated > 0) {
      console.log(`Encrypted ${migrated} transactions for user ${user.id} (${user.email})`);
    }
  }

  console.log("Migration complete.");
  process.exit(0);
}

migrate().catch(console.error);
