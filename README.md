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

### Option A: iCloud Link (recommended)

If you have an iCloud shortcut link configured:

1. Open the **/setup** page on your iPhone
2. Tap **Add to Shortcuts**
3. Paste your **API URL** and **API Token** when prompted (shown on the setup page)
4. Go to **Automation** tab → **New Automation** → **Transaction** → select your card(s) → run the shortcut

To configure: create the shortcut manually (see Option B), add Import Questions for API URL and Token, share via iCloud, and set `ICLOUD_SHORTCUT_URL` in your `.env`.

### Option B: Manual Setup

1. Open the **Shortcuts** app and tap **+** to create a new shortcut
2. Add a **Dictionary** action with keys:
   - `amount` → Amount (Wallet variable)
   - `seller` → Merchant (Wallet variable)
   - `card` → Card (Wallet variable)
3. Add **Get Contents of URL** action:
   - URL: your API endpoint (shown on /setup page)
   - Method: **POST**
   - Headers: `Authorization: Bearer <your-token>`, `Content-Type: application/json`
   - Body: **Dictionary** from step 2
4. (Optional) Add **Show Notification** to confirm the payment was logged
5. Go to **Automation** tab → **New Automation** → **Transaction** → select your card(s) → run the shortcut

## Exporting Data

Export transactions as CSV or JSON from the dashboard filter bar, or via API:

```bash
# CSV export
curl -H "Authorization: Bearer <token>" \
  "https://your-domain/api/transactions/export?format=csv&from=2026-01-01&to=2026-12-31"

# JSON export
curl -H "Authorization: Bearer <token>" \
  "https://your-domain/api/transactions/export?format=json"
```

Both endpoints support `?from` and `?to` date filters.

## Webhooks

Webhooks notify external services when transactions are created or deleted.

### Setup

1. Go to **Settings** (from the user menu)
2. Add a webhook URL and select events (`transaction.created`, `transaction.deleted`)
3. Optionally add a secret for HMAC-SHA256 signature verification

### Payload

```json
{
  "event": "transaction.created",
  "timestamp": "2026-04-06T14:30:00.000Z",
  "data": {
    "transaction": {
      "id": 1,
      "amount": 29.99,
      "seller": "Amazon",
      "card": "Visa ****1234",
      "title": null,
      "timestamp": "2026-04-06T14:30:00.000Z"
    }
  }
}
```

### Signature Verification

When a secret is configured, each request includes an `X-Webhook-Signature` header containing an HMAC-SHA256 hex digest of the request body, signed with your secret.

## API Endpoints

All endpoints require `Authorization: Bearer <token>` header.

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/transactions` | Create transaction |
| GET | `/api/transactions` | List transactions (?limit, ?offset, ?from, ?to) |
| GET | `/api/transactions/stats` | Summary statistics (?from, ?to) |
| GET | `/api/transactions/export` | Export transactions (?format=csv\|json, ?from, ?to) |
| DELETE | `/api/transactions/:id` | Delete transaction |
| GET | `/api/webhooks` | List webhooks |
| POST | `/api/webhooks` | Create webhook |
| PATCH | `/api/webhooks/:id` | Toggle webhook (active/inactive) |
| DELETE | `/api/webhooks/:id` | Delete webhook |
| GET | `/health` | Health check (no auth) |
