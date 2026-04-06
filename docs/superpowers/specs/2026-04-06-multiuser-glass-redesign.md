# Multi-User Auth + Apple Glass UI Redesign

## Overview

Transform Payment Tracker from a single-user tool with a terminal-hacker aesthetic into a multi-user app with open registration, per-user API tokens, Apple Shortcut auto-setup, and a modern Apple Glass UI.

## 1. Multi-User Auth System

### Database Schema

New `users` table:

```sql
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  github_id TEXT UNIQUE,
  api_token TEXT UNIQUE NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);
```

New `magic_links` table:

```sql
CREATE TABLE magic_links (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL,
  token TEXT UNIQUE NOT NULL,
  expires_at TEXT NOT NULL,
  used INTEGER DEFAULT 0
);
```

Existing `transactions` table gains a `user_id` foreign key:

```sql
ALTER TABLE transactions ADD COLUMN user_id INTEGER REFERENCES users(id);
```

All transaction queries must be scoped by `user_id`.

### Auth Methods

Two auth methods, user picks on the login/register page:

**1. Magic Link (email)**
- User enters email → API generates a token (random 32 bytes, hex), stores in `magic_links` with 15-minute expiry
- Send email via SMTP with link: `{BASE_URL}/auth/verify?token={token}`
- Clicking the link: look up token, check not expired/used, mark as used
- If user with that email exists → log them in (set session cookie)
- If no user exists → create account (prompt for name on first visit), set session cookie
- No passwords anywhere — magic link handles both registration and login

**2. GitHub OAuth**
- "Sign in with GitHub" button → redirect to `https://github.com/login/oauth/authorize` with `client_id` and `redirect_uri`
- GitHub redirects back to `/auth/github/callback?code={code}`
- Exchange `code` for access token via `POST https://github.com/login/oauth/access_token`
- Fetch user profile via `GET https://api.github.com/user` (need `user:email` scope for email)
- If user with that `github_id` exists → log them in
- If no user exists → create account using GitHub name + email, set session cookie
- Store `github_id` on user record for future logins

**Logout** (`POST /api/auth/logout`):
- Clear session cookie

### Environment Variables

```
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=noreply@example.com
SMTP_PASS=xxx
SMTP_FROM=Payment Tracker <noreply@example.com>
GITHUB_CLIENT_ID=xxx
GITHUB_CLIENT_SECRET=xxx
BASE_URL=https://payments.example.com
```

### SMTP Integration

Use `nodemailer` (works with Bun) to send magic link emails. Email template: minimal, plain-text-friendly, with a single "Sign in" button/link. Keep it simple — no fancy HTML email templates.

### Session Management

- Web dashboard: HTTP-only secure cookie (`session_token`) containing the user's `api_token` (simple — reuse the same token for both web sessions and API auth, no JWT library needed)
- API (Shortcut calls): Per-user `api_token` sent as `Authorization: Bearer <token>` header
- The shared `AUTH_TOKEN` env var is removed — each user has their own token

### API Auth Middleware Changes

Current middleware checks a single `AUTH_TOKEN` env var. Replace with:
- Look up the bearer token in the `users` table
- Attach `user_id` to the request context
- All transaction endpoints filter by `user_id`

### Web Auth Changes

Current `hooks.server.ts` validates session cookies against `AUTH_TOKEN`. Replace with:
- Validate session cookie (look up `api_token` in users table)
- Attach user object to `locals`
- Pass `user.api_token` when making API calls from SSR

## 2. Apple Shortcut Setup

### Setup Page (`/setup`)

Authenticated page showing three ways to connect:

1. **Copy API URL + Token** — Display the user's personal endpoint URL (`POST /api/transactions`) and API token with copy-to-clipboard buttons.

2. **One-Tap Import** — "Add to Shortcuts" button that downloads a `.shortcut` file (actually a signed `.plist` URL or a `shortcuts://` deep link) pre-configured with:
   - The API endpoint URL
   - The user's API token in the Authorization header
   - Input fields for `amount`, `seller`, `card`, `title`

3. **QR Code** — Renders a QR code containing the setup URL or a `shortcuts://` import link. Scan from phone to quickly set up.

### Implementation

- QR code: Generate SVG server-side (e.g., `qrcode` npm package or a lightweight SVG generator)
- Shortcut import: Serve a `.shortcut` file download endpoint (`GET /api/shortcut/download`) that generates the unsigned plist with the user's token embedded. The "Add to Shortcuts" button links to this endpoint. On iOS, downloading a `.shortcut` file triggers the Shortcuts app import flow automatically.
- The setup page should be styled with the Apple Glass design system

## 3. UI Redesign — Apple Glass Design System

### Design Tokens

**Background:**
```
Base: #080a10
Gradient: radial-gradient orbs of rgba(99,102,241,0.12), rgba(59,130,246,0.07), rgba(139,92,246,0.06)
```

**Glass surfaces:**
```
Default (.glass):
  background: rgba(255,255,255,0.025)
  backdrop-filter: blur(24px) saturate(1.4)
  border: 1px solid rgba(255,255,255,0.06)
  box-shadow: inset 0 0.5px 0 rgba(255,255,255,0.05), 0 4px 20px rgba(0,0,0,0.15)
  border-radius: 16px

Strong (.glass-strong):
  background: rgba(255,255,255,0.04)
  backdrop-filter: blur(30px) saturate(1.6)
  border: 1px solid rgba(255,255,255,0.08)
  box-shadow: inset 0 0.5px 0 rgba(255,255,255,0.08), 0 8px 32px rgba(0,0,0,0.2)
  border-radius: 16px
```

**Colors:**
- Text primary: `#e2e8f0`
- Text secondary: `#64748b`
- Text muted: `#475569`
- Text dim: `#334155`
- Accent (active states): `#a5b4fc` (indigo-300)
- Amounts (expense): `#fca5a5` (red-300)
- Badge indigo: `rgba(99,102,241,0.1)` bg / `#a5b4fc` text
- Badge emerald: `rgba(52,211,153,0.1)` bg / `#6ee7b7` text
- Badge amber: `rgba(251,191,36,0.1)` bg / `#fcd34d` text

**Typography:**
- Font: `-apple-system, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif`
- Values/numbers: weight 700, letter-spacing -0.02em
- Labels: weight 500-600, 0.65-0.7rem, uppercase, letter-spacing 0.08-0.1em
- Body: weight 400-500, 0.8-0.95rem

**Radius:**
- Cards/panels: 16px
- Buttons/pills: 22px (filter pills), 12px (action buttons)
- Badges: 6-7px
- Navbar: 16px

### Container

Max-width: 800px, centered.

### Navbar

Floating glass bar, sticky at top. Contains:
- Right-aligned user avatar (32px circle, gradient indigo-to-purple, user initials)
- Green online dot on avatar
- Click opens dropdown: Settings, Shortcut Setup, Logout
- Fade-to-transparent background gradient so content scrolls under smoothly

### Charts Section

Two glass-strong panels in a 2-column grid:

**Left — Daily Spending Bar Chart:**
- Label: "Last 7 Days"
- Large value: total for period
- 7 vertical bars with indigo gradient fill, proportional heights
- Day labels below (Mon–Sun)
- Data source: existing stats endpoint, extended to return `daily_totals` array

**Right — Card Breakdown Donut:**
- Label: "By Card"
- Large value: number of cards used
- SVG donut chart with colored segments (indigo, emerald, amber)
- Legend with colored dots + card name + percentage
- Data source: existing stats endpoint, extended to return `card_breakdown` array

### Filter Bar

Glass panel, single row:
- Pill-shaped preset buttons (7d, 30d, This month, This year, All)
- Active pill: indigo background glow
- Date inputs on the right with arrow separator
- No wrapping — all fits on one line at 800px

### Transaction List

Day-grouped with headers:

```
Today — April 6                    ————————————————  -150,93 zł
[glass card] Biedronka  mBank Visa  Weekly groceries    -127,43 zł  2 min ago
[glass card] Żabka      Revolut                          -23,50 zł  1 hr ago

Yesterday — April 5                ————————————————  -356,58 zł
[glass card] ...
```

Each day group has:
- Date header with day name + date
- Horizontal divider line
- Daily total on the right
- Transaction cards below

Transaction cards show:
- Seller name (primary text)
- Card badge (colored by card name) + optional title (secondary text)
- Amount (red-300) + time (dim)
- Hover: slightly brighter background + stronger border

Minimum 10 transactions shown per page. Page size adjustable but default to showing enough to fill ~3 day groups.

### Pagination

Centered, glass-styled prev/next buttons with page info between.

### Login / Register Page (unified)

Single `/login` page — no separate registration needed (magic links auto-create accounts):

Full-viewport centered glass panel:
- **Magic link section**: Email input + "Send magic link" button (indigo accent). After submit, show "Check your email" confirmation message.
- **Divider**: Horizontal line with "or" text
- **GitHub section**: "Sign in with GitHub" button (dark, GitHub-branded)
- Same ambient gradient background

### First-Time Name Prompt

When a magic link creates a new user, redirect to a simple `/onboarding` page:
- Glass panel with name input + "Continue" button
- Only shown once (when `name` is empty on the user record)
- After submit: redirect to `/setup`

GitHub OAuth users get their name from the GitHub profile automatically, so they skip this and go straight to `/setup`.

### Setup Page (`/setup`)

Glass panel with three sections:

1. **Your API Endpoint** — URL + token displayed in monospace, copy buttons
2. **One-Tap Setup** — Large "Add to Shortcuts" button styled as indigo accent
3. **QR Code** — SVG QR rendered in a glass panel, scannable

## 4. Stats API Extension

The existing `GET /api/transactions/stats` endpoint needs two additional fields in its response:

```typescript
{
  total_spent: number;
  transaction_count: number;
  avg_transaction: number;
  top_sellers: Array<{ seller: string; count: number; total: number }>;
  // New:
  daily_totals: Array<{ date: string; total: number }>;  // last 7 days
  card_breakdown: Array<{ card: string; total: number; percentage: number }>;
}
```

These are computed via SQL aggregation, scoped by `user_id` and the existing date filters.

## 5. Pages Summary

| Route | Auth | Purpose |
|-------|------|---------|
| `/login` | Public | Magic link + GitHub OAuth (unified login/register) |
| `/auth/verify` | Public | Magic link verification callback |
| `/auth/github/callback` | Public | GitHub OAuth callback |
| `/onboarding` | Authenticated | First-time name prompt (magic link users only) |
| `/` | Authenticated | Dashboard (charts, filters, transactions) |
| `/setup` | Authenticated | Shortcut setup (API URL, one-tap import, QR) |

## 6. Migration Strategy

- Add `users` table
- Add `user_id` column to `transactions` (nullable initially for migration)
- Create a default admin user, assign all existing transactions to it
- Make `user_id` NOT NULL after migration
- Remove `AUTH_TOKEN` env var dependency
- Add SMTP and GitHub OAuth env vars

## 7. Tailwind CSS

Add Tailwind CSS v4 to the web package for styling:

- Install `tailwindcss` and `@tailwindcss/vite` 
- Add `@tailwindcss/vite` plugin to `vite.config.ts`
- Add `@import "tailwindcss"` to a global CSS file (e.g., `app.css`) imported in the root layout
- Define the glass design tokens as custom Tailwind utilities/theme extensions via `@theme` in CSS (glass surface classes, color palette, radius values)
- Remove all existing `<style>` blocks from components — replace with Tailwind utility classes
- The login page's `:global(body)` styles move to `app.css`

All components (TransactionCard, Stats→Charts, FilterBar, Pagination, login, onboarding, setup) should use Tailwind classes exclusively. No component-scoped `<style>` blocks.

## 8. What Does NOT Change

- Bun + Hono + SvelteKit + bun:sqlite stack
- Transaction data model: `amount`, `seller`, `card`, `title`
- API structure (same endpoints, just scoped by user)
- Docker deployment setup
- Logging (pino)
