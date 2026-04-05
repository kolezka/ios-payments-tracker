import pino from "pino";
import { join } from "node:path";
import { mkdirSync } from "node:fs";

const LOG_DIR = process.env.LOG_DIR ?? "./logs";
mkdirSync(LOG_DIR, { recursive: true });

const logFile = join(LOG_DIR, "api.log");

const level = process.env.LOG_LEVEL ?? "debug";

export const logger = pino(
  { level },
  pino.transport({
    targets: [
      {
        target: "pino-pretty",
        options: { colorize: true },
        level,
      },
      {
        target: "pino/file",
        options: { destination: logFile, mkdir: true },
        level,
      },
    ],
  })
);
