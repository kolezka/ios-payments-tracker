# Payment Tracker

A self-hosted payment tracking app. Accepts transactions from Apple Shortcuts via API and displays them in a dark-themed dashboard.

## Quick Start

```bash
bun install
cp .env.example .env
# Edit .env and set a secure AUTH_TOKEN

# Start both API and frontend
bun run dev
```

API runs on http://localhost:3010, frontend on http://localhost:5173.

## Docker Deployment

```bash
cp .env.example .env
# Edit .env with your AUTH_TOKEN
docker compose up -d
```

API: port 3010, Frontend: port 3011.

Logs are written to `./logs/api.log` (mounted from the api container).

## Apple Shortcut Setup

1. Create a new Shortcut in the Shortcuts app
2. Add action: **Get Contents of URL**
   - URL: `https://your-domain.com:3010/api/transactions`
   - Method: **POST**
   - Headers:
     - `Authorization`: `Bearer YOUR_TOKEN`
     - `Content-Type`: `application/json`
   - Request Body (JSON):
     - `amount`: Shortcut Input (transaction amount)
     - `seller`: Shortcut Input (merchant name)
     - `card`: Shortcut Input (last 4 digits)
     - `title`: Shortcut Input (note)
     - `currency`: `PLN`
3. Go to **Automations** tab -> **New Automation**
4. Select **Transaction** trigger (iOS 17.2+)
5. Set it to run your shortcut
6. iOS provides `amount` and `seller` as input variables from the payment notification

## API Endpoints

All endpoints require `Authorization: Bearer <token>` header.

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/transactions` | Create transaction |
| GET | `/api/transactions` | List transactions (?limit, ?offset, ?from, ?to, ?category) |
| GET | `/api/transactions/stats` | Summary statistics (?from, ?to, ?category) |
| DELETE | `/api/transactions/:id` | Delete transaction |
| GET | `/health` | Health check (no auth) |
