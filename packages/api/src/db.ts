import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { join } from "path";
import { logger } from "./logger";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/payment_tracker";
logger.info({ connectionString: connectionString.replace(/:[^:@]+@/, ":***@") }, "connecting to database");

const client = postgres(connectionString);
const db = drizzle(client, { schema });

// Run migrations on startup — block until complete, exit on failure
const migrationsFolder = join(import.meta.dir, "..", "drizzle");
migrate(db, { migrationsFolder }).then(() => {
  logger.info("database migrations applied");
}).catch((err) => {
  logger.error({ error: String(err) }, "database migration failed — exiting");
  process.exit(1);
});

export { schema };
export default db;
