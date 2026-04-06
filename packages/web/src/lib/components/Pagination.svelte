<script lang="ts">
  let { page, totalPages, baseParams }: { page: number; totalPages: number; baseParams: string } = $props();

  function pageUrl(p: number) {
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
