import QRCode from "qrcode";

// QR links use APP_URL; on Vercel they fall back to the production domain so no extra setup is needed.
const vercelUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL && `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
export const appUrl = () => (process.env.APP_URL || vercelUrl || "http://localhost:3000").replace(/\/$/, "");
export const predictionUrl = (token: string) => `${appUrl()}/predict/${token}`;

export const qrPng = (url: string) => QRCode.toBuffer(url, { type: "png", width: 1024, margin: 2, errorCorrectionLevel: "M" });
export const qrSvg = (url: string) => QRCode.toString(url, { type: "svg", margin: 2, errorCorrectionLevel: "M" });
export const qrDataUrl = (url: string) => QRCode.toDataURL(url, { width: 512, margin: 2, errorCorrectionLevel: "M" });
