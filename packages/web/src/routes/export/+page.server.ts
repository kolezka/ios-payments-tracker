import type { ServerLoad } from "@sveltejs/kit";

export const load: ServerLoad = async ({ locals }) => {
  return { exportBaseUrl: "/api/export", user: locals.user };
};
