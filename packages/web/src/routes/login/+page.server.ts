import { fail, redirect, type Actions, type ServerLoad } from "@sveltejs/kit";
import { logger } from "$lib/logger";

const API_URL = process.env.API_URL ?? "http://localhost:3010";

export const load: ServerLoad = async () => {
  return { githubEnabled: process.env.ENABLE_GITHUB_LOGIN === "true" };
};

export const actions: Actions = {
  "magic-link": async ({ request }) => {
    const data = await request.formData();
    const email = data.get("email") as string;

    if (!email) {
      return fail(400, { error: "Email is required", email: "" });
    }

    logger.info({ email }, "magic link request");

    const res = await fetch(`${API_URL}/api/auth/magic-link`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });

    if (!res.ok) {
      const err = await res.json();
      return fail(res.status, { error: err.error ?? "Failed to send email", email });
    }

    return { success: true, email };
  },

  github: async () => {
    const clientId = process.env.GITHUB_CLIENT_ID;
    if (!clientId) {
      return fail(500, { error: "GitHub OAuth not configured" });
    }
    const baseUrl = process.env.BASE_URL ?? "http://localhost:5173";
    const redirectUri = `${baseUrl}/auth/github/callback`;
    redirect(303, `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=user:email`);
  },

  logout: async ({ cookies }) => {
    logger.info("user logged out");
    cookies.delete("session_token", { path: "/" });
    redirect(303, "/login");
  },
};
