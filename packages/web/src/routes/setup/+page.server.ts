import type { ServerLoad } from "@sveltejs/kit";
import QRCode from "qrcode";

const API_URL = process.env.API_URL ?? "http://localhost:3010";
const BASE_URL = process.env.BASE_URL ?? "http://localhost:5173";

export const load: ServerLoad = async ({ locals }) => {
  const apiEndpoint = `${API_URL}/api/transactions`;
  const token = locals.authToken;
  const downloadUrl = `${API_URL}/api/shortcut/download`;

  const qrData = `${BASE_URL}/setup`;
  const qrSvg = await QRCode.toString(qrData, { type: "svg", margin: 1, color: { dark: "#a5b4fc", light: "#00000000" } });

  return { apiEndpoint, token, downloadUrl, qrSvg, user: locals.user };
};
