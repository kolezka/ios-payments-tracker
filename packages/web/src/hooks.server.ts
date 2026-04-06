import { redirect, type Handle } from "@sveltejs/kit";
import { logger } from "$lib/logger";

const API_URL = process.env.API_URL ?? "http://localhost:3010";
const PUBLIC_PATHS = ["/login", "/auth/verify", "/auth/github/callback"];

export const handle: Handle = async ({ event, resolve }) => {
  const start = Date.now();
  const { pathname, search } = event.url;
  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));

  const token = event.cookies.get("session_token");

  if (!isPublic) {
    if (!token) {
      logger.debug({ pathname }, "no session cookie, redirecting to login");
      redirect(303, "/login");
    }

    const res = await fetch(`${API_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      logger.warn({ pathname }, "invalid session token");
      event.cookies.delete("session_token", { path: "/" });
      redirect(303, "/login");
    }

    const user = await res.json();
    event.locals.authToken = token;
    event.locals.user = user;

    if (user.name === "" && pathname !== "/onboarding") {
      redirect(303, "/onboarding");
    }
  }

  const response = await resolve(event);

  logger.info({
    method: event.request.method,
    path: `${pathname}${search}`,
    status: response.status,
    duration: `${Date.now() - start}ms`,
  }, `${event.request.method} ${pathname} ${response.status}`);

  return response;
};
