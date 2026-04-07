import type { ServerLoad } from "@sveltejs/kit";
import QRCode from "qrcode";

const PUBLIC_API_URL = process.env.PUBLIC_API_URL ?? process.env.API_URL ?? "http://localhost:3010";
const BASE_URL = process.env.BASE_URL ?? "http://localhost:5173";
const ICLOUD_SHORTCUT_URL = process.env.ICLOUD_SHORTCUT_URL ?? "";
const SHOW_DOWNLOAD_SHORTCUT = process.env.SHOW_DOWNLOAD_SHORTCUT !== "false";
const SHOW_ADD_SHORTCUT = process.env.SHOW_ADD_SHORTCUT !== "false";

export const load: ServerLoad = async ({ locals }) => {
  const apiEndpoint = `${PUBLIC_API_URL}/api/transactions`;
  const token = locals.authToken;
  const downloadUrl = `${PUBLIC_API_URL}/api/shortcut/download?token=${token}`;

  const qrData = `${BASE_URL}/setup`;
  const qrSvg = await QRCode.toString(qrData, { type: "svg", margin: 1, color: { dark: "#a5b4fc", light: "#00000000" } });

  return {
    apiEndpoint, token, downloadUrl,
    icloudUrl: ICLOUD_SHORTCUT_URL,
    showDownloadShortcut: SHOW_DOWNLOAD_SHORTCUT,
    showAddShortcut: SHOW_ADD_SHORTCUT,
    qrSvg, user: locals.user,
  };
};
