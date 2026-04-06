<script lang="ts">
  import TransactionList from "$lib/components/TransactionList.svelte";
  import Stats from "$lib/components/Stats.svelte";
  import FilterBar from "$lib/components/FilterBar.svelte";
  import Pagination from "$lib/components/Pagination.svelte";

  let { data }: { data: any } = $props();

  function formatPLN(amount: number) {
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
