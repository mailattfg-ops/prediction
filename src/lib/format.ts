import type { Outcome } from "@prisma/client";

const TZ = process.env.APP_TIMEZONE || "UTC";

const dateTime = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: TZ });
const dateOnly = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeZone: TZ });
const timeOnly = new Intl.DateTimeFormat("en-GB", { timeStyle: "short", timeZone: TZ });

export const fmtDateTime = (d: Date | string) => dateTime.format(new Date(d));
export const fmtDate = (d: Date | string) => dateOnly.format(new Date(d));
export const fmtTime = (d: Date | string) => timeOnly.format(new Date(d));
export const appTimeZone = TZ;

export function outcomeLabel(o: Outcome, m: { homeTeam: string; awayTeam: string }) {
  return o === "HOME" ? m.homeTeam : o === "AWAY" ? m.awayTeam : "Draw";
}

export const pct = (n: number, total: number) => (total ? Math.round((n / total) * 1000) / 10 : 0);
