import { apiFetch } from "$lib/api";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ locals }) => {
  const [transactionsRes, statsRes] = await Promise.all([
    apiFetch("/api/transactions?limit=50", locals.authToken),
    apiFetch("/api/transactions/stats", locals.authToken),
  ]);

  const transactions = await transactionsRes.json();
  const stats = await statsRes.json();

  return { transactions, stats };
};
