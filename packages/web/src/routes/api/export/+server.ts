import { redirect } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

const API_URL = process.env.API_URL ?? "http://localhost:3010";

export const GET: RequestHandler = async ({ cookies, url }) => {
  const token = cookies.get("session_token");
  if (!token) redirect(303, "/login");

  const format = url.searchParams.get("format") ?? "csv";
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");

  const params = new URLSearchParams();
  params.set("format", format);
  if (from) params.set("from", from);
  if (to) params.set("to", to);

  const res = await fetch(`${API_URL}/api/transactions/export?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    return new Response("Failed to export", { status: res.status });
  }

  return new Response(res.body, {
    headers: {
      "Content-Type": res.headers.get("Content-Type") ?? "application/octet-stream",
      "Content-Disposition": res.headers.get("Content-Disposition") ?? `attachment; filename="transactions.${format}"`,
    },
  });
};
