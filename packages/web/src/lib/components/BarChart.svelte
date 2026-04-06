<script lang="ts">
  let { dailyTotals }: { dailyTotals: Array<{ date: string; total: number }> } = $props();

  function formatPLN(amount: number) {
    return new Intl.NumberFormat("pl-PL", { style: "currency", currency: "PLN" }).format(amount);
  }

  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const last7 = (() => {
    const map = new Map(dailyTotals.map((d) => [d.date, d.total]));
    const result: Array<{ date: string; day: string; total: number }> = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().slice(0, 10);
      result.push({ date: dateStr, day: days[d.getDay()], total: map.get(dateStr) ?? 0 });
    }
    return result;
  })();

  const maxTotal = Math.max(...last7.map((d) => d.total), 1);
  const weekTotal = last7.reduce((sum, d) => sum + d.total, 0);
</script>

<div class="glass-strong p-5">
  <div class="text-[0.65rem] font-semibold uppercase tracking-widest text-text-muted mb-1">Last 7 Days</div>
  <div class="text-2xl font-bold text-text-primary tracking-tight mb-5">{formatPLN(weekTotal)}</div>
  <div class="flex items-end gap-1 h-20">
    {#each last7 as bar}
      <div class="flex-1 flex flex-col items-center gap-1 h-full justify-end">
        <div
          class="w-full rounded-t min-h-[3px] transition-opacity hover:opacity-80"
          style="height: {Math.max((bar.total / maxTotal) * 100, 4)}%; background: linear-gradient(180deg, rgba(165,180,252,0.8), rgba(99,102,241,0.2));"
        ></div>
        <span class="text-[0.55rem] text-text-dim uppercase tracking-tight">{bar.day}</span>
      </div>
    {/each}
  </div>
</div>
