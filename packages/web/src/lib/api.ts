import { redirect } from "@sveltejs/kit";

const API_URL = process.env.API_URL ?? "http://localhost:3000";

export async function apiFetch(path: string, token: string, init?: RequestInit) {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      ...init?.headers,
      Authorization: `Bearer ${token}`,
    },
  });

  if (res.status === 401) {
    redirect(303, "/login");
  }

  return res;
}
