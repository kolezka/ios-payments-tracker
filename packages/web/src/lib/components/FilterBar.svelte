<script lang="ts">
  import { goto } from "$app/navigation";

  interface Filters { from: string; to: string; }
  interface Preset { label: string; from: () => string; to: () => string; }

  let { filters }: { filters: Filters } = $props();

  function today() { return new Date().toISOString().slice(0, 10); }
  function daysAgo(n: number) { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); }
  function firstOfMonth() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`; }
  function firstOfYear() { return `${new Date().getFullYear()}-01-01`; }

  const presets: Preset[] = [
    { label: "7d", from: () => daysAgo(7), to: () => today() },
    { label: "30d", from: () => daysAgo(30), to: () => today() },
    { label: "This month", from: () => firstOfMonth(), to: () => today() },
    { label: "This year", from: () => firstOfYear(), to: () => today() },
    { label: "All", from: () => "", to: () => "" },
  ];

  function activePreset() {
    for (const p of presets) {
      if (filters.from === p.from() && filters.to === p.to()) return p.label;
    }
    return null;
  }

  function applyFilters(f: Filters) {
    const params = new URLSearchParams();
    if (f.from) params.set("from", f.from);
    if (f.to) params.set("to", f.to);
    const qs = params.toString();
    goto(`/${qs ? "?" + qs : ""}`, { replaceState: true });
  }

  function selectPreset(p: Preset) { applyFilters({ from: p.from(), to: p.to() }); }

  function onDateChange(e: Event, field: string) {
    const val = (e.target as HTMLInputElement).value;
    applyFilters({ from: field === "from" ? val : filters.from, to: field === "to" ? val : filters.to });
  }
</script>

<div class="glass flex items-center gap-2 px-4 py-2.5 mb-6 flex-nowrap">
  {#each presets as preset}
    <button
      class="px-3.5 py-1.5 rounded-full text-[0.8rem] font-medium transition-all cursor-pointer
        {activePreset() === preset.label
          ? 'bg-indigo-500/15 border border-indigo-500/30 text-accent shadow-[0_0_12px_rgba(99,102,241,0.1)]'
          : 'bg-white/[0.03] border border-glass-border text-text-muted hover:bg-indigo-500/8 hover:border-indigo-500/15 hover:text-indigo-300'
        }"
      onclick={() => selectPreset(preset)}
    >
      {preset.label}
    </button>
  {/each}
  <div class="ml-auto flex items-center gap-1.5">
    <input type="date" value={filters.from} onchange={(e) => onDateChange(e, "from")}
      class="bg-white/[0.03] border border-glass-border rounded-lg px-2.5 py-1.5 text-text-muted text-xs font-sans focus:outline-none focus:border-accent/40 focus:text-accent" />
    <span class="text-text-dim text-xs">→</span>
    <input type="date" value={filters.to} onchange={(e) => onDateChange(e, "to")}
      class="bg-white/[0.03] border border-glass-border rounded-lg px-2.5 py-1.5 text-text-muted text-xs font-sans focus:outline-none focus:border-accent/40 focus:text-accent" />
  </div>
</div>
