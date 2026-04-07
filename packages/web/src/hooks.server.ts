import { redirect, type Handle } from "@sveltejs/kit";
import { logger } from "$lib/logger";

const PUBLIC_PATHS = ["/login", "/auth/verify", "/auth/github/callback", "/api/"];
const OPTIONAL_AUTH_PATHS = ["/"];
const DEV_MODE = process.env.DEV_MODE === "true";
logger.info({ DEV_MODE }, "hooks loaded");

export const handle: Handle = async ({ event, resolve }) => {
  const start = Date.now();
  const { pathname, search } = event.url;
  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));
  const isOptionalAuth = OPTIONAL_AUTH_PATHS.includes(pathname);

  if (DEV_MODE && !isPublic) {
    event.locals.authToken = "dev-token";
    event.locals.user = { id: 1, email: "dev@local", name: "Dev User", api_token: "dev-token" };
  } else if (!isPublic) {
    const token = event.cookies.get("session_token");

    if (!token) {
      if (!isOptionalAuth) {
        logger.debug({ pathname }, "no session cookie, redirecting to login");
        redirect(303, "/login");
      }
    } else {
      const res = await fetch(`${process.env.API_URL ?? "http://localhost:3010"}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        logger.warn({ pathname }, "invalid session token");
        event.cookies.delete("session_token", { path: "/" });
        if (!isOptionalAuth) {
          redirect(303, "/login");
        }
      } else {
        const user = await res.json();
        event.locals.authToken = token;
        event.locals.user = user;

        if (user.name === "" && pathname !== "/onboarding") {
          redirect(303, "/onboarding");
        }
      }
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
