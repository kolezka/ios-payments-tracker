import { redirect } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

const API_URL = process.env.API_URL ?? "http://localhost:3010";

export const GET: RequestHandler = async ({ cookies }) => {
  const token = cookies.get("session_token");
  if (!token) redirect(303, "/login");

  const res = await fetch(`${API_URL}/api/shortcut/download`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    return new Response("Failed to download shortcut", { status: res.status });
  }

  return new Response(res.body, {
    headers: {
      "Content-Type": res.headers.get("Content-Type") ?? "application/octet-stream",
      "Content-Disposition": res.headers.get("Content-Disposition") ?? 'attachment; filename="Dodaj-Platnosc.shortcut"',
    },
  });
};
