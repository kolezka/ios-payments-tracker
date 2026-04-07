Default to using Bun instead of Node.js.

- Use `bun <file>` instead of `node <file>` or `ts-node <file>`
- Use `bun test` instead of `jest` or `vitest`
- Use `bun install` instead of `npm install`
- Use `bun run <script>` instead of `npm run <script>`
- Bun automatically loads .env, so don't use dotenv.

## Project Stack

- **API:** Hono framework, Drizzle ORM, PostgreSQL, Bun runtime
- **Frontend:** SvelteKit, Tailwind CSS v4, Node adapter
- **Database:** PostgreSQL 17 (via docker-compose), Drizzle schema in `packages/api/src/schema.ts`
- **Encryption:** AES-256-GCM via Web Crypto API (`packages/api/src/crypto.ts`)

## Key Patterns

- Database queries use Drizzle ORM query builder — never raw SQL
- Transaction fields (amount, seller, card, title) are encrypted at rest
- API calls from browser are proxied through SvelteKit server routes (`packages/web/src/routes/api/`)
- The backend API URL is never exposed to the client
- Feature flags use env vars checked in `+page.server.ts` load functions

## Testing

```bash
cd packages/api && bun test
```

## Database

```bash
cd packages/api
bun run db:generate  # Generate migration from schema changes
bun run db:push      # Push schema directly (dev)
bun run db:studio    # Open Drizzle Studio
```

Migrations auto-run on API startup.
