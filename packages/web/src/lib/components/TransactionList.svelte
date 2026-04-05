<script>
  import TransactionCard from "./TransactionCard.svelte";

  let { transactions } = $props();
</script>

<div class="list">
  {#if transactions.length === 0}
    <p class="empty">no transactions yet</p>
  {:else}
    {#each transactions as transaction (transaction.id)}
      <TransactionCard {transaction} />
    {/each}
  {/if}
</div>

<style>
  .list {
    margin-top: 1rem;
  }

  .empty {
    color: #555;
    text-align: center;
    padding: 2rem;
  }
</style>
