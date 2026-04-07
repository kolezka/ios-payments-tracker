import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { logger } from "./logger";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/payment_tracker";
logger.info({ connectionString: connectionString.replace(/:[^:@]+@/, ":***@") }, "connecting to database");

const client = postgres(connectionString);
const db = drizzle(client, { schema });

export { schema };
export default db;
