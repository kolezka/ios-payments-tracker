<script lang="ts">
  import TransactionCard from "./TransactionCard.svelte";

  let { date, transactions }: {
    date: string;
    transactions: Array<Record<string, any>>;
  } = $props();

  function formatPLN(amount: number) {
    return new Intl.NumberFormat("pl-PL", { style: "currency", currency: "PLN" }).format(amount);
  }

  function formatDayHeader(dateStr: string): string {
    const d = new Date(dateStr + "T00:00:00");
    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    const yesterday = new Date(now.setDate(now.getDate() - 1)).toISOString().slice(0, 10);

    const monthDay = d.toLocaleDateString("en-US", { month: "long", day: "numeric" });

    if (dateStr === today) return `Today — ${monthDay}`;
    if (dateStr === yesterday) return `Yesterday — ${monthDay}`;

    const dayName = d.toLocaleDateString("en-US", { weekday: "long" });
    return `${dayName} — ${monthDay}`;
  }

  let dayTotal = $derived(transactions.reduce((sum: number, t: Record<string, any>) => sum + t.amount, 0));
</script>

<div class="mb-2">
  <div class="flex items-center gap-3 py-3">
    <span class="text-xs font-semibold text-text-secondary whitespace-nowrap">{formatDayHeader(date)}</span>
    <div class="flex-1 h-px bg-glass-border"></div>
    <span class="text-[0.7rem] text-text-dim whitespace-nowrap">{formatPLN(dayTotal)}</span>
  </div>
  <div class="flex flex-col gap-1.5">
    {#each transactions as transaction (transaction.id)}
      <TransactionCard {transaction} />
    {/each}
  </div>
</div>
