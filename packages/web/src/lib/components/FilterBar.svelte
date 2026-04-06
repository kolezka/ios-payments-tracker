<script lang="ts">
  import { goto } from "$app/navigation";

  interface Preset {
    label: string;
    from: () => string;
    to: () => string;
  }

  interface Filters {
    from: string;
    to: string;
    categories: string[];
  }

  let { filters, availableCategories }: { filters: Filters; availableCategories: string[] } = $props();

  function today() {
    return new Date().toISOString().slice(0, 10);
  }

  function daysAgo(n: number) {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d.toISOString().slice(0, 10);
  }

  function firstOfMonth() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
  }

  function firstOfYear() {
    return `${new Date().getFullYear()}-01-01`;
  }

  const presets = [
    { label: "7d", from: () => daysAgo(7), to: () => today() },
    { label: "30d", from: () => daysAgo(30), to: () => today() },
    { label: "this month", from: () => firstOfMonth(), to: () => today() },
    { label: "this year", from: () => firstOfYear(), to: () => today() },
    { label: "all", from: () => "", to: () => "" },
  ];

  function activePreset() {
    for (const p of presets) {
      if (filters.from === p.from() && filters.to === p.to()) return p.label;
    }
    return null;
  }

  function applyFilters(newFilters: Filters) {
    const params = new URLSearchParams();
    if (newFilters.from) params.set("from", newFilters.from);
    if (newFilters.to) params.set("to", newFilters.to);
    if (newFilters.categories?.length > 0) params.set("category", newFilters.categories.join(","));
    const qs = params.toString();
    goto(`/${qs ? "?" + qs : ""}`, { replaceState: true });
  }

  function selectPreset(preset: Preset) {
    applyFilters({ from: preset.from(), to: preset.to(), categories: filters.categories });
  }

  function onDateChange(e: Event, field: string) {
    const val = (e.target as HTMLInputElement).value;
    applyFilters({
      from: field === "from" ? val : filters.from,
      to: field === "to" ? val : filters.to,
      categories: filters.categories,
    });
  }

  function toggleCategory(cat: string) {
    const cats = filters.categories.includes(cat)
      ? filters.categories.filter((c: string) => c !== cat)
      : [...filters.categories, cat];
    applyFilters({ from: filters.from, to: filters.to, categories: cats });
  }
</script>

<div class="filter-bar">
  <div class="section">
    <span class="label">period</span>
    <div class="presets">
      {#each presets as preset}
        <button
          class="preset"
          class:active={activePreset() === preset.label}
          onclick={() => selectPreset(preset)}
        >
          {preset.label}
        </button>
      {/each}
    </div>
    <div class="date-inputs">
      <input type="date" value={filters.from} onchange={(e) => onDateChange(e, "from")} />
      <span class="sep">-</span>
      <input type="date" value={filters.to} onchange={(e) => onDateChange(e, "to")} />
    </div>
  </div>

  {#if availableCategories.length > 0}
    <div class="section">
      <span class="label">category</span>
      <div class="categories">
        {#each availableCategories as cat}
          <button
            class="pill"
            class:active={filters.categories.includes(cat)}
            onclick={() => toggleCategory(cat)}
          >
            {cat}
          </button>
        {/each}
      </div>
    </div>
  {/if}
</div>

<style>
  .filter-bar {
    background: #1a1a1a;
    border: 1px solid #222;
    padding: 1rem;
    margin-bottom: 1rem;
  }

  .section {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex-wrap: wrap;
  }

  .section + .section {
    margin-top: 0.75rem;
    padding-top: 0.75rem;
    border-top: 1px solid #222;
  }

  .label {
    color: #555;
    font-size: 0.7rem;
    text-transform: uppercase;
    min-width: 4rem;
  }

  .presets {
    display: flex;
    gap: 0.25rem;
  }

  .preset {
    background: none;
    border: 1px solid #333;
    color: #666;
    font-family: inherit;
    font-size: 0.75rem;
    padding: 0.25rem 0.5rem;
    cursor: pointer;
  }

  .preset:hover {
    border-color: #00ff88;
    color: #00ff88;
  }

  .preset.active {
    border-color: #00ff88;
    color: #00ff88;
    background: #00ff8815;
  }

  .date-inputs {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    margin-left: auto;
  }

  .sep {
    color: #555;
  }

  input[type="date"] {
    background: #0a0a0a;
    border: 1px solid #333;
    color: #ccc;
    font-family: inherit;
    font-size: 0.75rem;
    padding: 0.25rem 0.4rem;
  }

  input[type="date"]:focus {
    outline: none;
    border-color: #00ff88;
  }

  .categories {
    display: flex;
    gap: 0.25rem;
    flex-wrap: wrap;
  }

  .pill {
    background: none;
    border: 1px solid #333;
    color: #666;
    font-family: inherit;
    font-size: 0.75rem;
    padding: 0.2rem 0.5rem;
    cursor: pointer;
  }

  .pill:hover {
    border-color: #00ff88;
    color: #00ff88;
  }

  .pill.active {
    background: #00ff8820;
    border-color: #00ff88;
    color: #00ff88;
  }
</style>
