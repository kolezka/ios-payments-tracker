import { redirect, type Handle } from "@sveltejs/kit";
import { logger } from "$lib/logger";

const AUTH_TOKEN = process.env.AUTH_TOKEN ?? "";
const PUBLIC_PATHS = ["/login"];

if (!AUTH_TOKEN) {
  logger.error("AUTH_TOKEN is not set — all authenticated requests will fail");
}

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
    if (token !== AUTH_TOKEN) {
      logger.warn({ pathname, tokenLength: token.length }, "invalid session token");
      redirect(303, "/login");
    }
  }

  event.locals.authToken = token ?? "";

  logger.debug({ pathname, isPublic, hasToken: !!token }, "request authenticated");

  const response = await resolve(event);

  logger.info({
    method: event.request.method,
    path: `${pathname}${search}`,
    status: response.status,
    duration: `${Date.now() - start}ms`,
  }, `${event.request.method} ${pathname} ${response.status}`);

  return response;
};
