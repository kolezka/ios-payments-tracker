# Dashboard Filters & Pagination Design

**Goal:** Add date range filtering, category filtering, and page-based pagination to the payment tracker dashboard, applied to both the transaction list and stats panel.

**Approach:** URL search param-driven filters (SSR-friendly, back-button works, shareable). All filtering happens server-side via existing API query params, extended with category support and total count.

---

## API Changes

### `GET /api/transactions`

**Current:** Returns a bare JSON array of transactions.

**New:** Returns an object with total count for pagination:
```json
{
  "transactions": [...],
  "total": 123
}
```

**New query param:** `?category=groceries,transport` (comma-separated). Filters transactions where `category` matches any of the provided values. Applied as `AND category IN (?, ?, ...)`.

### `GET /api/transactions/stats`

**New query param:** `?category=groceries,transport` (same comma-separated format). Filters stats to only include transactions matching the selected categories.

### No other API changes needed

`?from`, `?to`, `?limit`, `?offset` already work correctly.

---

## Frontend: Filter Bar Component

New component: `packages/web/src/lib/components/FilterBar.svelte`

Positioned between the Stats panel and the "recent transactions" heading.

### Date Range Section

A row with two parts:

**Preset buttons:** "7d", "30d", "this month", "this year", "all"
- Each is a link/button that sets `?from=<date>&to=<date>` (or clears them for "all")
- Active preset is highlighted (green border/text)
- "7d" = today minus 7 days. "30d" = today minus 30 days. "this month" = first of current month to today. "this year" = Jan 1 to today. "all" = no from/to params.

**Custom date inputs:** Two `<input type="date">` fields (from / to)
- When custom dates are set, presets deactivate
- When a preset is clicked, custom date inputs update to reflect the preset's range
- Clearing both inputs is equivalent to "all"

### Category Section

A row of toggle pills showing all available categories.

- Categories are derived from the stats response (`spending_by_category` array) — no separate API call needed
- Each pill is a toggle button. Active = green background (`#00ff8820`) with green text. Inactive = dark background with grey text.
- Multiple can be active simultaneously
- When no categories are selected, all transactions show (no filter applied)
- Selecting categories sets `?category=groceries,transport` in the URL
- Category pills include the "uncategorized" option if present in data

### Filter interaction

- All filters modify URL search params via `goto()` from `$app/navigation` with `replaceState: true`
- Changing any filter resets page to 1
- The `+page.server.ts` loader reads `url.searchParams` and forwards them to the API

---

## Frontend: Pagination Component

New component: `packages/web/src/lib/components/Pagination.svelte`

Positioned below the transaction list.

**Props:** `page` (current, 1-indexed), `totalPages`, `baseUrl` (current URL with filters preserved)

**Layout:** `< prev | page 1 of N | next >`
- Prev/next are links that update `?page=` search param
- Prev disabled on page 1, next disabled on last page
- 25 items per page (constant)
- Dark theme styling consistent with the rest of the app

---

## Frontend: Page Server Loader Changes

`packages/web/src/routes/+page.server.ts`

Read from `url.searchParams`:
- `from`, `to` — pass to API as-is
- `category` — pass to API as-is (comma-separated string)
- `page` — convert to `offset = (page - 1) * 25`, pass `limit=25&offset=N` to API

Build API query strings for both `/api/transactions` and `/api/transactions/stats` using these params.

Return to page: `{ transactions, stats, total, page, filters: { from, to, categories } }`

---

## Frontend: Dashboard Page Changes

`packages/web/src/routes/+page.svelte`

- Add `<FilterBar>` between `<Stats>` and the transaction list heading
- FilterBar receives current filter state and available categories (from stats data)
- Add `<Pagination>` below `<TransactionList>`
- Pagination receives current page and total pages (calculated from `total / 25`)
- Update subtitle to reflect filtered state

---

## Styling

All new components follow existing dark hacker aesthetic:
- Backgrounds: `#0a0a0a`, `#1a1a1a`
- Borders: `#222`, `#333`
- Accent: `#00ff88`
- Text: `#e0e0e0`, `#ccc`, `#555`
- Monospace font family
- No Tailwind, inline `<style>` blocks in Svelte components

---

## Files Summary

| File | Action |
|------|--------|
| `packages/api/src/routes/transactions.ts` | Modify: add `?category=` filter, return `{transactions, total}` |
| `packages/web/src/lib/components/FilterBar.svelte` | Create |
| `packages/web/src/lib/components/Pagination.svelte` | Create |
| `packages/web/src/routes/+page.server.ts` | Modify: read URL params, forward to API |
| `packages/web/src/routes/+page.svelte` | Modify: add FilterBar + Pagination |
