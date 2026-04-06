<script lang="ts">
  import BarChart from "$lib/components/BarChart.svelte";
  import DonutChart from "$lib/components/DonutChart.svelte";
  import FilterBar from "$lib/components/FilterBar.svelte";
  import DayGroup from "$lib/components/DayGroup.svelte";
  import Pagination from "$lib/components/Pagination.svelte";

  let { data }: { data: any } = $props();

  function baseParams() {
    const params = new URLSearchParams();
    if (data.filters.from) params.set("from", data.filters.from);
    if (data.filters.to) params.set("to", data.filters.to);
    return params.toString();
  }
</script>

<div class="fixed inset-0 bg-ambient -z-10"></div>

<div class="max-w-[800px] mx-auto px-5 pb-12">
  <!-- Charts -->
  <div class="grid grid-cols-2 gap-3 mb-6">
    <BarChart dailyTotals={data.stats.daily_totals ?? []} />
    <DonutChart cardBreakdown={data.stats.card_breakdown ?? []} />
  </div>

  <!-- Filters -->
  <FilterBar filters={data.filters} />

  <!-- Transactions by day -->
  {#if data.dayGroups.length === 0}
    <div class="text-center py-12 text-text-muted text-sm">No transactions yet</div>
  {:else}
    {#each data.dayGroups as group (group.date)}
      <DayGroup date={group.date} transactions={group.transactions} />
    {/each}
  {/if}

  <Pagination page={data.page} totalPages={data.totalPages} baseParams={baseParams()} />
</div>
