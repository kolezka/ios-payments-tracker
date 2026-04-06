import type { ServerLoad } from "@sveltejs/kit";

const PUBLIC_API_URL = process.env.PUBLIC_API_URL ?? process.env.API_URL ?? "http://localhost:3010";

export const load: ServerLoad = async ({ locals }) => {
  const exportBaseUrl = `${PUBLIC_API_URL}/api/transactions/export?token=${locals.authToken}`;
  return { exportBaseUrl, user: locals.user };
};
