import { apiFetch } from "$lib/api";
import type { PageServerLoad } from "./$types";

const PAGE_SIZE = 25;

export const load: PageServerLoad = async ({ locals, url }) => {
  const from = url.searchParams.get("from") ?? "";
  const to = url.searchParams.get("to") ?? "";
  const categoryParam = url.searchParams.get("category") ?? "";
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1"));
  const offset = (page - 1) * PAGE_SIZE;

  const categories = categoryParam ? categoryParam.split(",") : [];

  // Build query string for API calls
  const filterParams = new URLSearchParams();
  if (from) filterParams.set("from", from);
  if (to) filterParams.set("to", to);
  if (categoryParam) filterParams.set("category", categoryParam);

  const listParams = new URLSearchParams(filterParams);
  listParams.set("limit", String(PAGE_SIZE));
  listParams.set("offset", String(offset));

  // Fetch filtered stats + transactions, and also unfiltered stats for category list
  const unfilteredStatsParams = new URLSearchParams();
  if (from) unfilteredStatsParams.set("from", from);
  if (to) unfilteredStatsParams.set("to", to);

  const [transactionsRes, statsRes, allCatsRes] = await Promise.all([
    apiFetch(`/api/transactions?${listParams}`, locals.authToken),
    apiFetch(`/api/transactions/stats?${filterParams}`, locals.authToken),
    apiFetch(`/api/transactions/stats?${unfilteredStatsParams}`, locals.authToken),
  ]);

  const { transactions, total } = await transactionsRes.json();
  const stats = await statsRes.json();
  const allCatsStats = await allCatsRes.json();
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // Use unfiltered (but date-filtered) stats for category list so all pills remain visible
  const availableCategories: string[] = (allCatsStats.spending_by_category ?? []).map(
    (c: { category: string }) => c.category
  );

  return {
    transactions,
    stats,
    page,
    totalPages,
    filters: { from, to, categories },
    availableCategories,
  };
};
