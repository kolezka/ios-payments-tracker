<script lang="ts">
  let { data }: { data: any } = $props();
  let from = $state("");
  let to = $state("");

  function exportUrl(format: string) {
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    params.set("format", format);
    return `${data.exportBaseUrl}&${params}`;
  }
</script>

<div class="fixed inset-0 bg-ambient -z-10"></div>

<div class="max-w-2xl mx-auto px-5 pt-20 pb-12">
  <h1 class="text-2xl font-bold text-text-primary tracking-tight mb-1">Export Transactions</h1>
  <p class="text-sm text-text-secondary mb-8">Download your transaction data</p>

  <div class="glass-strong p-5 mb-4">
    <h2 class="text-xs font-semibold uppercase tracking-widest text-text-muted mb-4">Date Range (optional)</h2>
    <div class="flex items-center gap-3">
      <div class="flex-1">
        <label class="text-xs text-text-dim mb-1 block">From</label>
        <input type="date" bind:value={from}
          class="w-full px-3 py-2 rounded-lg bg-glass-bg border border-glass-border text-text-primary text-sm font-sans focus:outline-none focus:border-accent/40" />
      </div>
      <div class="flex-1">
        <label class="text-xs text-text-dim mb-1 block">To</label>
        <input type="date" bind:value={to}
          class="w-full px-3 py-2 rounded-lg bg-glass-bg border border-glass-border text-text-primary text-sm font-sans focus:outline-none focus:border-accent/40" />
      </div>
    </div>
  </div>

  <div class="glass p-5">
    <h2 class="text-xs font-semibold uppercase tracking-widest text-text-muted mb-4">Download</h2>
    <div class="grid grid-cols-2 gap-3">
      <a href={exportUrl("csv")} target="_blank"
        class="flex flex-col items-center gap-2 p-5 rounded-xl bg-white/[0.03] border border-glass-border hover:border-accent/30 hover:bg-indigo-500/5 transition-colors text-center">
        <svg class="w-8 h-8 text-text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
        </svg>
        <span class="text-sm font-semibold text-text-primary">CSV</span>
        <span class="text-xs text-text-dim">Spreadsheet-compatible</span>
      </a>
      <a href={exportUrl("json")} target="_blank"
        class="flex flex-col items-center gap-2 p-5 rounded-xl bg-white/[0.03] border border-glass-border hover:border-accent/30 hover:bg-indigo-500/5 transition-colors text-center">
        <svg class="w-8 h-8 text-text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>
        </svg>
        <span class="text-sm font-semibold text-text-primary">JSON</span>
        <span class="text-xs text-text-dim">For developers &amp; APIs</span>
      </a>
    </div>
  </div>

  <div class="mt-8 text-center">
    <a href="/" class="text-accent text-sm hover:underline">Back to dashboard</a>
  </div>
</div>
