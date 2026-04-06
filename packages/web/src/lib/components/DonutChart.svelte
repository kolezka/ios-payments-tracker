<script lang="ts">
  let { cardBreakdown }: { cardBreakdown: Array<{ card: string; total: number; percentage: number }> } = $props();

  const colors = [
    { stroke: "rgba(99,102,241,0.6)", dot: "rgba(99,102,241,0.7)" },
    { stroke: "rgba(52,211,153,0.5)", dot: "rgba(52,211,153,0.6)" },
    { stroke: "rgba(251,191,36,0.5)", dot: "rgba(251,191,36,0.6)" },
    { stroke: "rgba(244,114,182,0.5)", dot: "rgba(244,114,182,0.6)" },
    { stroke: "rgba(148,163,184,0.4)", dot: "rgba(148,163,184,0.5)" },
  ];

  const segments = (() => {
    let offset = 25;
    return cardBreakdown.map((c, i) => {
      const seg = { ...c, color: colors[i % colors.length], dashArray: `${c.percentage} ${100 - c.percentage}`, dashOffset: offset };
      offset -= c.percentage;
      return seg;
    });
  })();
</script>

<div class="glass-strong p-5">
  <div class="text-[0.65rem] font-semibold uppercase tracking-widest text-text-muted mb-1">By Card</div>
  <div class="text-2xl font-bold text-text-primary tracking-tight mb-5">{cardBreakdown.length} <span class="text-sm font-medium text-text-secondary">cards</span></div>

  {#if cardBreakdown.length > 0}
    <div class="flex items-center gap-5">
      <svg class="shrink-0" width="80" height="80" viewBox="0 0 36 36">
        <circle cx="18" cy="18" r="14" fill="none" stroke="rgba(255,255,255,0.03)" stroke-width="4"/>
        {#each segments as seg}
          <circle cx="18" cy="18" r="14" fill="none" stroke={seg.color.stroke} stroke-width="4"
            stroke-dasharray={seg.dashArray} stroke-dashoffset={seg.dashOffset} stroke-linecap="round" />
        {/each}
      </svg>
      <div class="flex flex-col gap-2">
        {#each segments as seg}
          <div class="flex items-center gap-2">
            <div class="w-2 h-2 rounded-full shrink-0" style="background: {seg.color.dot};"></div>
            <span class="text-xs text-text-secondary"><strong class="text-slate-300 font-semibold">{seg.card}</strong> {seg.percentage}%</span>
          </div>
        {/each}
      </div>
    </div>
  {:else}
    <p class="text-text-dim text-sm">No transactions yet</p>
  {/if}
</div>
