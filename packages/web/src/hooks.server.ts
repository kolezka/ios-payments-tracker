import { redirect, type Handle } from "@sveltejs/kit";

const AUTH_TOKEN = process.env.AUTH_TOKEN ?? "";
const PUBLIC_PATHS = ["/login"];

export const handle: Handle = async ({ event, resolve }) => {
  const isPublic = PUBLIC_PATHS.some((p) => event.url.pathname.startsWith(p));

  const token = event.cookies.get("session_token");

  if (!isPublic) {
    if (!token || token !== AUTH_TOKEN) {
      redirect(303, "/login");
    }
  }

  event.locals.authToken = token ?? "";

  return resolve(event);
};
