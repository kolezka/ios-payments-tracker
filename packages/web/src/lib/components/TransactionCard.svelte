<script lang="ts">
  import { formatPLN } from "$lib/format";
  let { transaction }: { transaction: Record<string, any> } = $props();

  function formatTime(timestamp: string): string {
    const d = new Date(timestamp + "Z");
    const now = Date.now();
    const diff = now - d.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return mins <= 1 ? "just now" : `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  }

  const badgeColors: Record<string, string> = {};
  const colorPool = [
    "bg-badge-indigo-bg text-badge-indigo-text",
    "bg-badge-emerald-bg text-badge-emerald-text",
    "bg-badge-amber-bg text-badge-amber-text",
  ];

  function getBadgeClass(card: string): string {
    if (!badgeColors[card]) {
      const idx = Object.keys(badgeColors).length % colorPool.length;
      badgeColors[card] = colorPool[idx];
    }
    return badgeColors[card];
  }
</script>

<div class="glass flex justify-between items-center px-5 py-3.5 rounded-[14px] hover:bg-white/[0.04] hover:border-white/[0.08] hover:shadow-[0_2px_16px_rgba(0,0,0,0.1)] transition-all">
  <div>
    <div class="text-[0.95rem] font-medium text-text-primary">{transaction.seller}</div>
    <div class="flex gap-2 items-center mt-1">
      {#if transaction.card}
        <span class="px-2 py-0.5 rounded-md text-[0.65rem] font-medium {getBadgeClass(transaction.card)}">{transaction.card}</span>
      {/if}
      {#if transaction.title}
        <span class="text-[0.78rem] text-text-muted">{transaction.title}</span>
      {/if}
    </div>
  </div>
  <div class="text-right">
    <div class="text-[1.05rem] font-semibold text-expense tracking-tight">{formatPLN(transaction.amount)}</div>
    <div class="text-[0.68rem] text-text-dim mt-0.5">{formatTime(transaction.timestamp)}</div>
  </div>
</div>
