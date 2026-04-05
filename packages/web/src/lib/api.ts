import { redirect } from "@sveltejs/kit";
import { logger } from "$lib/logger";

const API_URL = process.env.API_URL ?? "http://localhost:3010";

logger.info({ API_URL }, "api client configured");

export async function apiFetch(path: string, token: string, init?: RequestInit) {
  const url = `${API_URL}${path}`;
  const method = init?.method ?? "GET";
  const start = Date.now();

  logger.debug({ method, url }, "api request");

  try {
    const res = await fetch(url, {
      ...init,
      headers: {
        ...init?.headers,
        Authorization: `Bearer ${token}`,
      },
    });

    logger.info({
      method,
      url,
      status: res.status,
      duration: `${Date.now() - start}ms`,
    }, `api ${method} ${path} ${res.status}`);

    if (res.status === 401) {
      logger.warn({ path }, "api returned 401, redirecting to login");
      redirect(303, "/login");
    }

    return res;
  } catch (err) {
    if ((err as any)?.status === 303) throw err; // re-throw SvelteKit redirects
    logger.error({ method, url, error: String(err), duration: `${Date.now() - start}ms` }, "api request failed");
    throw err;
  }
}
