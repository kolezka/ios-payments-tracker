import type { RequestHandler } from "./$types";

const API_URL = process.env.API_URL ?? "http://localhost:3010";

export const POST: RequestHandler = async ({ request }) => {
  const auth = request.headers.get("Authorization");
  if (!auth) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  const body = await request.text();

  const res = await fetch(`${API_URL}/api/transactions`, {
    method: "POST",
    headers: {
      Authorization: auth,
      "Content-Type": request.headers.get("Content-Type") ?? "application/json",
    },
    body,
  });

  return new Response(res.body, {
    status: res.status,
    headers: { "Content-Type": "application/json" },
  });
};
