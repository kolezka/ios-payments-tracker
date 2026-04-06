import { redirect, type ServerLoad } from "@sveltejs/kit";
import { logger } from "$lib/logger";

const API_URL = process.env.API_URL ?? "http://localhost:3010";

export const load: ServerLoad = async ({ url, cookies }) => {
  const token = url.searchParams.get("token");
  if (!token) { return { error: "Missing token" }; }

  const res = await fetch(`${API_URL}/api/auth/verify?token=${token}`);
  const data = await res.json();

  if (!res.ok) {
    logger.warn({ error: data.error }, "magic link verification failed");
    return { error: data.error ?? "Invalid or expired link" };
  }

  const isSecure = process.env.NODE_ENV === "production";
  cookies.set("session_token", data.api_token, { path: "/", httpOnly: true, sameSite: "lax", secure: isSecure, maxAge: 60 * 60 * 24 * 365 });
  logger.info({ isNew: data.is_new }, "magic link verified");
  redirect(303, data.is_new ? "/onboarding" : "/");
};
