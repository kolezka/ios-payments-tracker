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

{#if data.authenticated}
  <!-- Dashboard -->
  <div class="max-w-4xl mx-auto px-5 pb-12">
    <!-- Top grid: shortcut widget spans left, charts stack right -->
    <!-- Charts -->
    <div class="grid grid-cols-2 gap-3 mb-3">
      <BarChart dailyTotals={data.stats.daily_totals ?? []} />
      <DonutChart cardBreakdown={data.stats.card_breakdown ?? []} />
    </div>

    <!-- Quick action widgets -->
    {#if data.showShortcutWidget && data.dayGroups.length === 0}
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        <a href="/setup" class="glass p-4 flex items-center gap-3.5 group hover:border-indigo-500/20 transition-all">
          <div class="w-10 h-10 rounded-lg bg-indigo-500/10 flex items-center justify-center shrink-0 group-hover:bg-indigo-500/15 transition-colors">
            <svg class="w-5 h-5 text-indigo-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/>
              <path d="M6 15h2"/><path d="M12 15h6"/>
            </svg>
          </div>
          <div class="flex-1 min-w-0">
            <h3 class="text-sm font-semibold text-text-primary mb-0.5">iOS Shortcut</h3>
            <p class="text-xs text-text-muted leading-relaxed">Auto-track payments from Wallet</p>
          </div>
          <svg class="w-4 h-4 text-text-dim group-hover:text-accent transition-colors shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
        </a>

        <a href="/export" class="glass p-4 flex items-center gap-3.5 group hover:border-purple-500/20 transition-all">
          <div class="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center shrink-0 group-hover:bg-purple-500/15 transition-colors">
            <svg class="w-5 h-5 text-purple-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
          </div>
          <div class="flex-1 min-w-0">
            <h3 class="text-sm font-semibold text-text-primary mb-0.5">Export Data</h3>
            <p class="text-xs text-text-muted leading-relaxed">Download as CSV or JSON</p>
          </div>
          <svg class="w-4 h-4 text-text-dim group-hover:text-accent transition-colors shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
        </a>

        <a href="/settings" class="glass p-4 flex items-center gap-3.5 group hover:border-emerald-500/20 transition-all">
          <div class="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0 group-hover:bg-emerald-500/15 transition-colors">
            <svg class="w-5 h-5 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
            </svg>
          </div>
          <div class="flex-1 min-w-0">
            <h3 class="text-sm font-semibold text-text-primary mb-0.5">Webhooks</h3>
            <p class="text-xs text-text-muted leading-relaxed">Notify external services</p>
          </div>
          <svg class="w-4 h-4 text-text-dim group-hover:text-accent transition-colors shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
        </a>
      </div>
    {/if}

    <!-- Filter bar -->
    <FilterBar filters={data.filters} />

    <!-- Transactions -->
    {#if data.dayGroups.length === 0}
      <div class="text-center py-12 text-text-muted text-sm">No transactions yet</div>
    {:else}
      {#each data.dayGroups as group (group.date)}
        <DayGroup date={group.date} transactions={group.transactions} />
      {/each}
    {/if}

    <Pagination page={data.page} totalPages={data.totalPages} baseParams={baseParams()} />
  </div>
{:else}
  <!-- Landing -->
  <div class="min-h-screen flex flex-col">
    <!-- Hero -->
    <div class="flex-1 flex items-center justify-center px-5">
      <div class="max-w-2xl w-full text-center py-20">
        <div class="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-medium mb-8">
          <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
          </svg>
          Self-hosted &middot; Private &middot; Open source
        </div>

        <h1 class="text-4xl sm:text-5xl font-bold text-text-primary tracking-tight mb-4 leading-tight">
          Track every<br/>
          <span class="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">payment</span> automatically
        </h1>

        <p class="text-text-secondary text-base sm:text-lg mb-10 max-w-md mx-auto leading-relaxed">
          iOS Wallet automation meets a clean dashboard. Tap to pay, see it logged instantly.
        </p>

        <div class="flex flex-col sm:flex-row items-center justify-center gap-3">
          <a href="/login"
            class="w-full sm:w-auto px-8 py-3 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white text-sm font-semibold transition-colors text-center">
            Get started
          </a>
          <a href="https://github.com/kolezka/ios-payments-tracker" target="_blank" rel="noopener"
            class="w-full sm:w-auto px-8 py-3 rounded-xl bg-white/5 border border-glass-border-strong hover:bg-white/8 text-text-primary text-sm font-medium transition-colors flex items-center justify-center gap-2">
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
            </svg>
            View on GitHub
          </a>
        </div>
      </div>
    </div>

    <!-- Features -->
    <div class="max-w-2xl mx-auto px-5 pb-20 w-full">
      <div class="grid sm:grid-cols-3 gap-3">
        <div class="glass p-5">
          <div class="w-9 h-9 rounded-lg bg-indigo-500/10 flex items-center justify-center mb-3">
            <svg class="w-4.5 h-4.5 text-indigo-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/>
            </svg>
          </div>
          <h3 class="text-sm font-semibold text-text-primary mb-1">Wallet Automation</h3>
          <p class="text-xs text-text-secondary leading-relaxed">iOS Shortcut triggers on every card tap. Amount, merchant, card name captured automatically.</p>
        </div>

        <div class="glass p-5">
          <div class="w-9 h-9 rounded-lg bg-purple-500/10 flex items-center justify-center mb-3">
            <svg class="w-4.5 h-4.5 text-purple-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
            </svg>
          </div>
          <h3 class="text-sm font-semibold text-text-primary mb-1">Live Dashboard</h3>
          <p class="text-xs text-text-secondary leading-relaxed">Charts, filters, and day-by-day breakdowns. See where your money goes at a glance.</p>
        </div>

        <div class="glass p-5">
          <div class="w-9 h-9 rounded-lg bg-emerald-500/10 flex items-center justify-center mb-3">
            <svg class="w-4.5 h-4.5 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/>
            </svg>
          </div>
          <h3 class="text-sm font-semibold text-text-primary mb-1">Fully Private</h3>
          <p class="text-xs text-text-secondary leading-relaxed">Self-hosted on your own server. Your financial data never leaves your infrastructure.</p>
        </div>
      </div>
    </div>
  </div>
{/if}
