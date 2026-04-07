#!/bin/sh
echo "Pushing database schema..."
bunx drizzle-kit push --force
echo "Starting API server..."
exec bun run src/index.ts
