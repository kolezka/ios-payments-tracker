<script>
  let { stats } = $props();

  function formatPLN(amount) {
    return new Intl.NumberFormat("pl-PL", {
      style: "currency",
      currency: "PLN",
    }).format(amount);
  }
</script>

<div class="stats">
  <div class="stat-grid">
    <div class="stat">
      <span class="label">total spent</span>
      <span class="value">{formatPLN(stats.total_spent)}</span>
    </div>
    <div class="stat">
      <span class="label">transactions</span>
      <span class="value">{stats.transaction_count}</span>
    </div>
    <div class="stat">
      <span class="label">avg transaction</span>
      <span class="value">{formatPLN(stats.avg_transaction)}</span>
    </div>
  </div>

  {#if stats.top_merchants?.length > 0}
    <div class="section">
      <h3>top merchants</h3>
      {#each stats.top_merchants.slice(0, 5) as m}
        <div class="row">
          <span>{m.merchant}</span>
          <span class="dim">{m.count}x &middot; {formatPLN(m.total)}</span>
        </div>
      {/each}
    </div>
  {/if}

  {#if stats.spending_by_category?.length > 0}
    <div class="section">
      <h3>by category</h3>
      {#each stats.spending_by_category as cat}
        <div class="row">
          <span class="cat-badge">{cat.category}</span>
          <span>{formatPLN(cat.total)}</span>
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .stats {
    background: #1a1a1a;
    border: 1px solid #222;
    padding: 1rem;
    margin-bottom: 1.5rem;
  }

  .stat-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 1rem;
    text-align: center;
  }

  .label {
    display: block;
    color: #555;
    font-size: 0.75rem;
    text-transform: uppercase;
    margin-bottom: 0.25rem;
  }

  .value {
    color: #00ff88;
    font-size: 1.25rem;
    font-weight: bold;
  }

  .section {
    margin-top: 1.5rem;
    border-top: 1px solid #222;
    padding-top: 1rem;
  }

  h3 {
    color: #555;
    font-size: 0.75rem;
    text-transform: uppercase;
    margin: 0 0 0.75rem;
  }

  .row {
    display: flex;
    justify-content: space-between;
    padding: 0.25rem 0;
    color: #ccc;
    font-size: 0.875rem;
  }

  .dim {
    color: #555;
  }

  .cat-badge {
    color: #00ff88;
  }
</style>
