<script lang="ts">
  import { relativeTime } from "$lib/time";

  let { transaction }: { transaction: Record<string, any> } = $props();

  function formatAmount(amount: number, currency: string) {
    return new Intl.NumberFormat("pl-PL", {
      style: "currency",
      currency: currency || "PLN",
    }).format(amount);
  }
</script>

<div class="card">
  <div class="row">
    <span class="amount">{formatAmount(transaction.amount, transaction.currency)}</span>
    <span class="time">{relativeTime(transaction.timestamp)}</span>
  </div>
  <div class="row">
    <span class="merchant">{transaction.merchant}</span>
    {#if transaction.category}
      <span class="category">{transaction.category}</span>
    {/if}
  </div>
  {#if transaction.note || transaction.card_last4}
    <div class="row meta">
      {#if transaction.note}
        <span class="note">{transaction.note}</span>
      {/if}
      {#if transaction.card_last4}
        <span class="card-digits">*{transaction.card_last4}</span>
      {/if}
    </div>
  {/if}
</div>

<style>
  .card {
    background: #1a1a1a;
    border: 1px solid #222;
    padding: 1rem;
    margin-bottom: 0.5rem;
  }

  .row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 1rem;
  }

  .row + .row {
    margin-top: 0.5rem;
  }

  .amount {
    color: #ff6b6b;
    font-weight: bold;
    font-size: 1.1rem;
  }

  .time {
    color: #555;
    font-size: 0.8rem;
  }

  .merchant {
    color: #ccc;
  }

  .category {
    background: #00ff8820;
    color: #00ff88;
    padding: 0.15rem 0.5rem;
    font-size: 0.75rem;
  }

  .meta {
    color: #555;
    font-size: 0.8rem;
  }

  .note {
    font-style: italic;
  }

  .card-digits {
    color: #444;
  }
</style>
