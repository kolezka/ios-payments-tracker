import type { ServerLoad } from "@sveltejs/kit";
import QRCode from "qrcode";

const PUBLIC_API_URL = process.env.PUBLIC_API_URL ?? process.env.API_URL ?? "http://localhost:3010";
const BASE_URL = process.env.BASE_URL ?? "http://localhost:5173";

export const load: ServerLoad = async ({ locals }) => {
  const apiEndpoint = `${PUBLIC_API_URL}/api/transactions`;
  const token = locals.authToken;
  const downloadUrl = `${PUBLIC_API_URL}/api/shortcut/download?token=${token}`;
  const importUrl = `shortcuts://import-shortcut?url=${encodeURIComponent(downloadUrl)}&name=${encodeURIComponent("Dodaj Platnosc")}`;

  const qrData = `${BASE_URL}/setup`;
  const qrSvg = await QRCode.toString(qrData, { type: "svg", margin: 1, color: { dark: "#a5b4fc", light: "#00000000" } });

  return { apiEndpoint, token, downloadUrl, importUrl, qrSvg, user: locals.user };
};
