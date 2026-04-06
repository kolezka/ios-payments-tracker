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

## API Endpoints

All endpoints require `Authorization: Bearer <token>` header.

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/transactions` | Create transaction |
| GET | `/api/transactions` | List transactions (?limit, ?offset, ?from, ?to, ?category) |
| GET | `/api/transactions/stats` | Summary statistics (?from, ?to, ?category) |
| DELETE | `/api/transactions/:id` | Delete transaction |
| GET | `/health` | Health check (no auth) |
