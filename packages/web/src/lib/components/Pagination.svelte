<script lang="ts">
  let { page, totalPages, baseParams }: { page: number; totalPages: number; baseParams: string } = $props();

  function pageUrl(p: number) {
    const params = new URLSearchParams(baseParams);
    if (p > 1) params.set("page", String(p));
    else params.delete("page");
    const qs = params.toString();
    return `/${qs ? "?" + qs : ""}`;
  }
</script>

{#if totalPages > 1}
  <nav class="flex justify-center items-center gap-4 mt-8">
    {#if page > 1}
      <a href={pageUrl(page - 1)} class="px-4 py-2 rounded-lg bg-white/[0.03] border border-glass-border text-text-secondary text-sm hover:bg-white/[0.06] hover:text-accent transition-colors">← prev</a>
    {:else}
      <span class="px-4 py-2 rounded-lg bg-white/[0.03] border border-glass-border text-text-dim text-sm opacity-25">← prev</span>
    {/if}

    <span class="text-text-dim text-sm">page {page} of {totalPages}</span>

    {#if page < totalPages}
      <a href={pageUrl(page + 1)} class="px-4 py-2 rounded-lg bg-white/[0.03] border border-glass-border text-text-secondary text-sm hover:bg-white/[0.06] hover:text-accent transition-colors">next →</a>
    {:else}
      <span class="px-4 py-2 rounded-lg bg-white/[0.03] border border-glass-border text-text-dim text-sm opacity-25">next →</span>
    {/if}
  </nav>
{/if}
