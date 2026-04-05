# Filters & Pagination Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add date range filtering (presets + custom), multi-select category filtering, and page-based pagination to the payment tracker dashboard.

**Architecture:** Filters live in URL search params (`?from=&to=&category=&page=`). The SvelteKit `+page.server.ts` loader reads these params and forwards them to the API. Two new Svelte components (FilterBar, Pagination) are added to the dashboard page. The API is extended with `?category=` support and returns total count for pagination.

**Tech Stack:** Hono (API), SvelteKit 5 (frontend), bun:sqlite, Svelte 5 `$props()`

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `packages/api/src/routes/transactions.ts` | Modify | Add `?category=` filter to list + stats; return `{transactions, total}` from list endpoint |
| `packages/web/src/lib/components/FilterBar.svelte` | Create | Date presets, custom date inputs, category toggle pills |
| `packages/web/src/lib/components/Pagination.svelte` | Create | Page navigation: prev/next + "page N of M" |
| `packages/web/src/routes/+page.server.ts` | Modify | Read URL search params, forward to API, calculate pagination |
| `packages/web/src/routes/+page.svelte` | Modify | Wire FilterBar + Pagination into dashboard |

---

### Task 1: API — Add category filter and total count

**Files:**
- Modify: `packages/api/src/routes/transactions.ts`

- [ ] **Step 1: Modify the GET /api/transactions route to return `{transactions, total}` and support `?category=`**

Replace the entire `GET /` handler (lines 87-113 of `transactions.ts`) with:

```typescript
// GET /api/transactions — list
transactions.get("/", (c) => {
  const limit = parseInt(c.req.query("limit") ?? "25");
  const offset = parseInt(c.req.query("offset") ?? "0");
  const from = c.req.query("from");
  const to = c.req.query("to");
  const categoryParam = c.req.query("category");

  let dateFilter = "";
  const params: (string | number)[] = [];
  if (from) {
    dateFilter += " AND timestamp >= ?";
    params.push(from);
  }
  if (to) {
    dateFilter += " AND timestamp <= ?";
    params.push(to + " 23:59:59");
  }

  let categoryFilter = "";
  if (categoryParam) {
    const categories = categoryParam.split(",").map((s) => s.trim());
    categoryFilter = ` AND category IN (${categories.map(() => "?").join(",")})`;
    params.push(...categories);
  }

  const countParams = [...params];
  const totalRow = db
    .prepare(
      `SELECT COUNT(*) as count FROM transactions WHERE 1=1${dateFilter}${categoryFilter}`
    )
    .get(...countParams) as { count: number };

  params.push(limit, offset);

  const rows = db
    .prepare(
      `SELECT * FROM transactions WHERE 1=1${dateFilter}${categoryFilter} ORDER BY timestamp DESC LIMIT ? OFFSET ?`
    )
    .all(...params) as Transaction[];

  return c.json({ transactions: rows, total: totalRow.count });
});
```

- [ ] **Step 2: Modify the GET /api/transactions/stats route to support `?category=`**

In the stats handler (lines 37-84), add category filtering. After the date filter block (after line 49 `}`), add:

```typescript
  let categoryFilter = "";
  if (c.req.query("category")) {
    const categories = c.req.query("category")!.split(",").map((s) => s.trim());
    categoryFilter = ` AND category IN (${categories.map(() => "?").join(",")})`;
    params.push(...categories);
  }
```

Then append `${categoryFilter}` to every SQL query string in the stats handler, right after `${dateFilter}`. There are 4 queries to update:
- summary query: `...WHERE 1=1${dateFilter}${categoryFilter}`
- topMerchants query: `...WHERE 1=1${dateFilter}${categoryFilter} GROUP BY...`
- spendingByCategory query: `...WHERE 1=1${dateFilter}${categoryFilter} GROUP BY...`
- dailySpending query: `...WHERE 1=1${dateFilter}${categoryFilter} GROUP BY...`

- [ ] **Step 3: Smoke test the API changes**

```bash
cd /Users/me/Development/ios-budget-fn
rm -f packages/api/data/data.db*
AUTH_TOKEN=test bun packages/api/src/index.ts &
sleep 1

# Seed data
curl -s -X POST http://localhost:3000/api/transactions \
  -H "Authorization: Bearer test" -H "Content-Type: application/json" \
  -d '{"amount":10,"merchant":"Zabka","category":"groceries"}'
curl -s -X POST http://localhost:3000/api/transactions \
  -H "Authorization: Bearer test" -H "Content-Type: application/json" \
  -d '{"amount":50,"merchant":"Shell","category":"fuel"}'
curl -s -X POST http://localhost:3000/api/transactions \
  -H "Authorization: Bearer test" -H "Content-Type: application/json" \
  -d '{"amount":20,"merchant":"Lidl","category":"groceries"}'

# Test: list returns {transactions, total}
curl -s http://localhost:3000/api/transactions \
  -H "Authorization: Bearer test" | head -c 200
# Expected: {"transactions":[...],"total":3}

# Test: category filter
curl -s "http://localhost:3000/api/transactions?category=fuel" \
  -H "Authorization: Bearer test"
# Expected: only Shell transaction, total:1

# Test: multi-category
curl -s "http://localhost:3000/api/transactions?category=groceries,fuel" \
  -H "Authorization: Bearer test"
# Expected: all 3 transactions, total:3

# Test: stats with category
curl -s "http://localhost:3000/api/transactions/stats?category=groceries" \
  -H "Authorization: Bearer test"
# Expected: total_spent:30, transaction_count:2

kill %1
```

- [ ] **Step 4: Commit**

```bash
git add packages/api/src/routes/transactions.ts
git commit -m "feat(api): add category filter and total count to transaction endpoints"
```

---

### Task 2: FilterBar component

**Files:**
- Create: `packages/web/src/lib/components/FilterBar.svelte`

- [ ] **Step 1: Create FilterBar.svelte**

```svelte
<script>
  import { goto } from "$app/navigation";
  import { page } from "$app/stores";

  let { filters, availableCategories } = $props();

  function today() {
    return new Date().toISOString().slice(0, 10);
  }

  function daysAgo(n) {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d.toISOString().slice(0, 10);
  }

  function firstOfMonth() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
  }

  function firstOfYear() {
    return `${new Date().getFullYear()}-01-01`;
  }

  const presets = [
    { label: "7d", from: () => daysAgo(7), to: () => today() },
    { label: "30d", from: () => daysAgo(30), to: () => today() },
    { label: "this month", from: () => firstOfMonth(), to: () => today() },
    { label: "this year", from: () => firstOfYear(), to: () => today() },
    { label: "all", from: () => "", to: () => "" },
  ];

  function activePreset() {
    for (const p of presets) {
      if (filters.from === p.from() && filters.to === p.to()) return p.label;
    }
    return null;
  }

  function applyFilters(newFilters) {
    const params = new URLSearchParams();
    if (newFilters.from) params.set("from", newFilters.from);
    if (newFilters.to) params.set("to", newFilters.to);
    if (newFilters.categories?.length > 0) params.set("category", newFilters.categories.join(","));
    // Reset page when filters change
    const qs = params.toString();
    goto(`/${qs ? "?" + qs : ""}`, { replaceState: true });
  }

  function selectPreset(preset) {
    applyFilters({ from: preset.from(), to: preset.to(), categories: filters.categories });
  }

  function onDateChange(e, field) {
    const val = e.target.value;
    applyFilters({
      from: field === "from" ? val : filters.from,
      to: field === "to" ? val : filters.to,
      categories: filters.categories,
    });
  }

  function toggleCategory(cat) {
    const cats = filters.categories.includes(cat)
      ? filters.categories.filter((c) => c !== cat)
      : [...filters.categories, cat];
    applyFilters({ from: filters.from, to: filters.to, categories: cats });
  }
</script>

<div class="filter-bar">
  <div class="section">
    <span class="label">period</span>
    <div class="presets">
      {#each presets as preset}
        <button
          class="preset"
          class:active={activePreset() === preset.label}
          onclick={() => selectPreset(preset)}
        >
          {preset.label}
        </button>
      {/each}
    </div>
    <div class="date-inputs">
      <input type="date" value={filters.from} onchange={(e) => onDateChange(e, "from")} />
      <span class="sep">-</span>
      <input type="date" value={filters.to} onchange={(e) => onDateChange(e, "to")} />
    </div>
  </div>

  {#if availableCategories.length > 0}
    <div class="section">
      <span class="label">category</span>
      <div class="categories">
        {#each availableCategories as cat}
          <button
            class="pill"
            class:active={filters.categories.includes(cat)}
            onclick={() => toggleCategory(cat)}
          >
            {cat}
          </button>
        {/each}
      </div>
    </div>
  {/if}
</div>

<style>
  .filter-bar {
    background: #1a1a1a;
    border: 1px solid #222;
    padding: 1rem;
    margin-bottom: 1rem;
  }

  .section {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex-wrap: wrap;
  }

  .section + .section {
    margin-top: 0.75rem;
    padding-top: 0.75rem;
    border-top: 1px solid #222;
  }

  .label {
    color: #555;
    font-size: 0.7rem;
    text-transform: uppercase;
    min-width: 4rem;
  }

  .presets {
    display: flex;
    gap: 0.25rem;
  }

  .preset {
    background: none;
    border: 1px solid #333;
    color: #666;
    font-family: inherit;
    font-size: 0.75rem;
    padding: 0.25rem 0.5rem;
    cursor: pointer;
  }

  .preset:hover {
    border-color: #00ff88;
    color: #00ff88;
  }

  .preset.active {
    border-color: #00ff88;
    color: #00ff88;
    background: #00ff8815;
  }

  .date-inputs {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    margin-left: auto;
  }

  .sep {
    color: #555;
  }

  input[type="date"] {
    background: #0a0a0a;
    border: 1px solid #333;
    color: #ccc;
    font-family: inherit;
    font-size: 0.75rem;
    padding: 0.25rem 0.4rem;
  }

  input[type="date"]:focus {
    outline: none;
    border-color: #00ff88;
  }

  .categories {
    display: flex;
    gap: 0.25rem;
    flex-wrap: wrap;
  }

  .pill {
    background: none;
    border: 1px solid #333;
    color: #666;
    font-family: inherit;
    font-size: 0.75rem;
    padding: 0.2rem 0.5rem;
    cursor: pointer;
  }

  .pill:hover {
    border-color: #00ff88;
    color: #00ff88;
  }

  .pill.active {
    background: #00ff8820;
    border-color: #00ff88;
    color: #00ff88;
  }
</style>
```

- [ ] **Step 2: Commit**

```bash
git add packages/web/src/lib/components/FilterBar.svelte
git commit -m "feat(web): add FilterBar component with date presets and category pills"
```

---

### Task 3: Pagination component

**Files:**
- Create: `packages/web/src/lib/components/Pagination.svelte`

- [ ] **Step 1: Create Pagination.svelte**

```svelte
<script>
  let { page, totalPages, baseParams } = $props();

  function pageUrl(p) {
    const params = new URLSearchParams(baseParams);
    if (p > 1) {
      params.set("page", String(p));
    } else {
      params.delete("page");
    }
    const qs = params.toString();
    return `/${qs ? "?" + qs : ""}`;
  }
</script>

{#if totalPages > 1}
  <nav class="pagination">
    {#if page > 1}
      <a href={pageUrl(page - 1)} class="btn">prev</a>
    {:else}
      <span class="btn disabled">prev</span>
    {/if}

    <span class="info">page {page} of {totalPages}</span>

    {#if page < totalPages}
      <a href={pageUrl(page + 1)} class="btn">next</a>
    {:else}
      <span class="btn disabled">next</span>
    {/if}
  </nav>
{/if}

<style>
  .pagination {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 1rem;
    margin-top: 1.5rem;
    padding: 1rem 0;
  }

  .btn {
    background: none;
    border: 1px solid #333;
    color: #ccc;
    font-family: inherit;
    font-size: 0.8rem;
    padding: 0.4rem 0.8rem;
    cursor: pointer;
    text-decoration: none;
  }

  .btn:hover:not(.disabled) {
    border-color: #00ff88;
    color: #00ff88;
  }

  .btn.disabled {
    color: #333;
    border-color: #222;
    cursor: default;
  }

  .info {
    color: #555;
    font-size: 0.8rem;
  }
</style>
```

- [ ] **Step 2: Commit**

```bash
git add packages/web/src/lib/components/Pagination.svelte
git commit -m "feat(web): add Pagination component with prev/next navigation"
```

---

### Task 4: Update page server loader to read URL params

**Files:**
- Modify: `packages/web/src/routes/+page.server.ts`

- [ ] **Step 1: Replace the entire +page.server.ts with filter-aware loader**

```typescript
import { apiFetch } from "$lib/api";
import type { PageServerLoad } from "./$types";

const PAGE_SIZE = 25;

export const load: PageServerLoad = async ({ locals, url }) => {
  const from = url.searchParams.get("from") ?? "";
  const to = url.searchParams.get("to") ?? "";
  const categoryParam = url.searchParams.get("category") ?? "";
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1"));
  const offset = (page - 1) * PAGE_SIZE;

  const categories = categoryParam ? categoryParam.split(",") : [];

  // Build query string for API calls
  const filterParams = new URLSearchParams();
  if (from) filterParams.set("from", from);
  if (to) filterParams.set("to", to);
  if (categoryParam) filterParams.set("category", categoryParam);

  const listParams = new URLSearchParams(filterParams);
  listParams.set("limit", String(PAGE_SIZE));
  listParams.set("offset", String(offset));

  // Fetch filtered stats + transactions, and also unfiltered stats for category list
  const unfilteredStatsParams = new URLSearchParams();
  if (from) unfilteredStatsParams.set("from", from);
  if (to) unfilteredStatsParams.set("to", to);

  const [transactionsRes, statsRes, allCatsRes] = await Promise.all([
    apiFetch(`/api/transactions?${listParams}`, locals.authToken),
    apiFetch(`/api/transactions/stats?${filterParams}`, locals.authToken),
    apiFetch(`/api/transactions/stats?${unfilteredStatsParams}`, locals.authToken),
  ]);

  const { transactions, total } = await transactionsRes.json();
  const stats = await statsRes.json();
  const allCatsStats = await allCatsRes.json();
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // Use unfiltered (but date-filtered) stats for category list so all pills remain visible
  const availableCategories: string[] = (allCatsStats.spending_by_category ?? []).map(
    (c: { category: string }) => c.category
  );

  return {
    transactions,
    stats,
    page,
    totalPages,
    filters: { from, to, categories },
    availableCategories,
  };
};
```

- [ ] **Step 2: Commit**

```bash
git add packages/web/src/routes/+page.server.ts
git commit -m "feat(web): read URL filter params in page loader, forward to API"
```

---

### Task 5: Wire FilterBar + Pagination into dashboard page

**Files:**
- Modify: `packages/web/src/routes/+page.svelte`

- [ ] **Step 1: Replace the entire +page.svelte with the updated dashboard**

```svelte
<script>
  import TransactionList from "$lib/components/TransactionList.svelte";
  import Stats from "$lib/components/Stats.svelte";
  import FilterBar from "$lib/components/FilterBar.svelte";
  import Pagination from "$lib/components/Pagination.svelte";
  import { page as pageStore } from "$app/stores";

  let { data } = $props();

  function formatPLN(amount) {
    return new Intl.NumberFormat("pl-PL", {
      style: "currency",
      currency: "PLN",
    }).format(amount);
  }

  function baseParams() {
    const params = new URLSearchParams();
    if (data.filters.from) params.set("from", data.filters.from);
    if (data.filters.to) params.set("to", data.filters.to);
    if (data.filters.categories.length > 0) params.set("category", data.filters.categories.join(","));
    return params.toString();
  }
</script>

<div class="container">
  <header>
    <div class="title-row">
      <h1>$ payment-tracker</h1>
      <form method="POST" action="/login?/logout">
        <button type="submit" class="logout">logout</button>
      </form>
    </div>
    <p class="subtitle">
      total: {formatPLN(data.stats.total_spent)} &middot; {data.stats.transaction_count} transactions
    </p>
  </header>

  <Stats stats={data.stats} />

  <FilterBar filters={data.filters} availableCategories={data.availableCategories} />

  <h2>recent transactions</h2>
  <TransactionList transactions={data.transactions} />

  <Pagination page={data.page} totalPages={data.totalPages} baseParams={baseParams()} />
</div>

<style>
  .container {
    max-width: 700px;
    margin: 0 auto;
    padding: 2rem 1rem;
  }

  header {
    margin-bottom: 2rem;
  }

  .title-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  h1 {
    color: #00ff88;
    font-size: 1.5rem;
    margin: 0;
  }

  h2 {
    color: #555;
    font-size: 0.8rem;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    margin: 1.5rem 0 0.5rem;
  }

  .subtitle {
    color: #555;
    margin: 0.5rem 0 0;
    font-size: 0.875rem;
  }

  .logout {
    background: none;
    border: 1px solid #333;
    color: #666;
    font-family: inherit;
    font-size: 0.8rem;
    padding: 0.4rem 0.8rem;
    cursor: pointer;
  }

  .logout:hover {
    border-color: #ff6b6b;
    color: #ff6b6b;
  }
</style>
```

- [ ] **Step 2: Commit**

```bash
git add packages/web/src/routes/+page.svelte
git commit -m "feat(web): integrate FilterBar and Pagination into dashboard"
```

---

### Task 6: End-to-end QA with Playwright

- [ ] **Step 1: Start both servers**

```bash
cd /Users/me/Development/ios-budget-fn
rm -f packages/api/data/data.db*
AUTH_TOKEN=test-token-123 bun packages/api/src/index.ts &
sleep 1
AUTH_TOKEN=test-token-123 API_URL=http://localhost:3000 bunx vite dev --port 5173 &
sleep 3
```

- [ ] **Step 2: Seed diverse test data via curl**

```bash
curl -s -X POST http://localhost:3000/api/transactions \
  -H "Authorization: Bearer test-token-123" -H "Content-Type: application/json" \
  -d '{"amount":42.50,"merchant":"Żabka","category":"groceries"}'
curl -s -X POST http://localhost:3000/api/transactions \
  -H "Authorization: Bearer test-token-123" -H "Content-Type: application/json" \
  -d '{"amount":150,"merchant":"Shell","category":"fuel"}'
curl -s -X POST http://localhost:3000/api/transactions \
  -H "Authorization: Bearer test-token-123" -H "Content-Type: application/json" \
  -d '{"amount":25,"merchant":"Lidl","category":"groceries","note":"milk"}'
```

- [ ] **Step 3: Use Playwright to test the full flow**

With Playwright MCP:
1. Navigate to `http://localhost:5173/` — should redirect to `/login`
2. Enter token `test-token-123`, click login — should land on dashboard
3. Take screenshot — verify FilterBar (date presets + category pills) and transaction list visible
4. Click a category pill (e.g. "groceries") — verify URL updates with `?category=groceries`, stats and list update
5. Click "fuel" pill too — verify multi-select works (`?category=groceries,fuel`)
6. Click a date preset (e.g. "7d") — verify URL has `?from=...&to=...`
7. Take final screenshot

- [ ] **Step 4: Stop servers, clean up**

```bash
kill %1 %2 2>/dev/null
rm -f packages/api/data/data.db*
```
