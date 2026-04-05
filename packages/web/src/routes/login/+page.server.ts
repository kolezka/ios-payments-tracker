import { fail, redirect } from "@sveltejs/kit";
import { logger } from "$lib/logger";
import type { Actions } from "./$types";

const API_URL = process.env.API_URL ?? "http://localhost:3010";

export const actions: Actions = {
  login: async ({ request, cookies }) => {
    const data = await request.formData();
    const token = data.get("token") as string;

    if (!token) {
      logger.warn("login attempt with empty token");
      return fail(400, { error: "Token is required" });
    }

    logger.info({ tokenLength: token.length }, "login attempt");

    // Validate token against the API
    const res = await fetch(`${API_URL}/api/transactions?limit=1`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      logger.warn({ status: res.status }, "login failed - invalid token");
      return fail(401, { error: "Invalid token" });
    }

    cookies.set("session_token", token, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: true,
      maxAge: 60 * 60 * 24 * 365, // 1 year
    });

    logger.info("login successful");
    redirect(303, "/");
  },

  logout: async ({ cookies }) => {
    logger.info("user logged out");
    cookies.delete("session_token", { path: "/" });
    redirect(303, "/login");
  },
};
