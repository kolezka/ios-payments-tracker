import type { ServerLoad } from "@sveltejs/kit";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:5173";
const ICLOUD_SHORTCUT_URL = process.env.ICLOUD_SHORTCUT_URL ?? "";
const SHOW_DOWNLOAD_SHORTCUT = process.env.SHOW_DOWNLOAD_SHORTCUT !== "false";
const SHOW_ADD_SHORTCUT = process.env.SHOW_ADD_SHORTCUT !== "false";

export const load: ServerLoad = async ({ locals }) => {
  const apiEndpoint = `${BASE_URL}/api/transactions`;
  const token = locals.authToken;

  return {
    apiEndpoint, token,
    downloadUrl: "/api/shortcut",
    icloudUrl: ICLOUD_SHORTCUT_URL,
    showDownloadShortcut: SHOW_DOWNLOAD_SHORTCUT,
    showAddShortcut: SHOW_ADD_SHORTCUT,
    user: locals.user,
  };
};
