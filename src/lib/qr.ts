import QRCode from "qrcode";

export const appUrl = () => (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
export const predictionUrl = (token: string) => `${appUrl()}/predict/${token}`;

export const qrPng = (url: string) => QRCode.toBuffer(url, { type: "png", width: 1024, margin: 2, errorCorrectionLevel: "M" });
export const qrSvg = (url: string) => QRCode.toString(url, { type: "svg", margin: 2, errorCorrectionLevel: "M" });
export const qrDataUrl = (url: string) => QRCode.toDataURL(url, { width: 512, margin: 2, errorCorrectionLevel: "M" });
