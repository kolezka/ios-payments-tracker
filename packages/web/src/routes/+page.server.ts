import type { ServerLoad } from "@sveltejs/kit";
import { apiFetch } from "$lib/api";
import { logger } from "$lib/logger";

const PAGE_SIZE = 25;

export const load: ServerLoad = async ({ locals, url }) => {
  if (!locals.authToken) {
    return { authenticated: false };
  }

  const from = url.searchParams.get("from") ?? "";
  const to = url.searchParams.get("to") ?? "";
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1"));
  const offset = (page - 1) * PAGE_SIZE;

  logger.debug({ page, from, to, offset }, "dashboard load");

  const filterParams = new URLSearchParams();
  if (from) filterParams.set("from", from);
  if (to) filterParams.set("to", to);

  const listParams = new URLSearchParams(filterParams);
  listParams.set("limit", String(PAGE_SIZE));
  listParams.set("offset", String(offset));

  const start = Date.now();
  const [transactionsRes, statsRes] = await Promise.all([
    apiFetch(`/api/transactions?${listParams}`, locals.authToken),
    apiFetch(`/api/transactions/stats?${filterParams}`, locals.authToken),
  ]);

  const { transactions, total } = await transactionsRes.json();
  const stats = await statsRes.json();
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  logger.info({
    transactionCount: transactions.length,
    total,
    totalPages,
    duration: `${Date.now() - start}ms`,
  }, "dashboard data loaded");

  // Group transactions by date
  const dayGroups: Array<{ date: string; transactions: any[] }> = [];
  const groupMap = new Map<string, any[]>();
  for (const tx of transactions) {
    const date = tx.timestamp.slice(0, 10);
    if (!groupMap.has(date)) {
      groupMap.set(date, []);
      dayGroups.push({ date, transactions: groupMap.get(date)! });
    }
    groupMap.get(date)!.push(tx);
  }

  return {
    authenticated: true,
    dayGroups,
    stats,
    page,
    totalPages,
    filters: { from, to },
  };
};
