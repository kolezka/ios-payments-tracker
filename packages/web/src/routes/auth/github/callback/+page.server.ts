import { redirect, type ServerLoad } from "@sveltejs/kit";
import { logger } from "$lib/logger";

const API_URL = process.env.API_URL ?? "http://localhost:3010";

export const load: ServerLoad = async ({ url, cookies }) => {
  const code = url.searchParams.get("code");
  if (!code) { return { error: "Missing authorization code" }; }

  const res = await fetch(`${API_URL}/api/auth/github/callback`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code }),
  });
  const data = await res.json();

  if (!res.ok) {
    logger.warn({ error: data.error }, "GitHub OAuth failed");
    return { error: data.error ?? "GitHub authentication failed" };
  }

  const isSecure = process.env.NODE_ENV === "production";
  cookies.set("session_token", data.api_token, { path: "/", httpOnly: true, sameSite: "lax", secure: isSecure, maxAge: 60 * 60 * 24 * 365 });
  logger.info("GitHub OAuth successful");
  redirect(303, data.is_new ? "/setup" : "/");
};
