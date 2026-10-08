import ExcelJS from "exceljs";
import { listPredictions } from "./predictions";
import { getSession, listLateEntries } from "./sessions";
import { fmtDateTime, outcomeLabel } from "./format";

export async function exportTable(sessionId: string, winnersOnly: boolean) {
  const session = await getSession(sessionId);
  const rows = await listPredictions(sessionId, { winnersOnly });
  const matchLabel = `${session.match.homeTeam} vs ${session.match.awayTeam}`;
  const sessionLabel = session.campaignName || session.eventName || session.id;
  const score = session.enableScorePrediction;
  const columns = [
    "Name", "Mobile", "Email", "Match", "Prediction", "Result",
    ...(score ? ["Predicted Score", "Exact Score", "Score Winner"] : []),
    "Session", "Submitted At", ...session.fields.map((f) => f.label),
  ];
  const data = rows.map((p) => {
    const custom = (p.customData ?? {}) as Record<string, unknown>;
    return [
      p.participant.fullName,
      p.participant.mobile,
      p.participant.email,
      matchLabel,
      outcomeLabel(p.selectedOutcome, session.match),
      p.resultStatus,
      ...(score
        ? [
            p.predictedHomeScore == null ? "" : `${p.predictedHomeScore}-${p.predictedAwayScore}`,
            p.scoreCorrect == null ? "PENDING" : p.scoreCorrect ? "YES" : "NO",
            p.scoreWinner ? "YES" : "",
          ]
        : []),
      sessionLabel,
      fmtDateTime(p.submittedAt),
      ...session.fields.map((f) => (custom[f.key] == null ? "" : String(custom[f.key]))),
    ];
  });
  // Timed-out registrations (details captured after the window closed) go at the end, marked TIMED_OUT.
  const late = winnersOnly ? [] : await listLateEntries(sessionId);
  const lateRows = late.map((e) => {
    const custom = (e.customData ?? {}) as Record<string, unknown>;
    return [
      e.participant.fullName,
      e.participant.mobile,
      e.participant.email,
      matchLabel,
      "",
      "TIMED_OUT",
      ...(score ? ["", "", ""] : []),
      sessionLabel,
      fmtDateTime(e.submittedAt),
      ...session.fields.map((f) => (custom[f.key] == null ? "" : String(custom[f.key]))),
    ];
  });
  const filename = `${session.match.homeTeam}-vs-${session.match.awayTeam}-${winnersOnly ? "winners" : "predictions"}`
    .replace(/[^a-z0-9-]+/gi, "-")
    .toLowerCase();
  return { columns, rows: [...data, ...lateRows], filename };
}

/** Neutralizes spreadsheet formula injection without mangling values like "+919876543210". */
function csvCell(v: string): string {
  let s = v;
  if (/^[=@]/.test(s) || /^[+-](?![\d.])/.test(s)) s = "'" + s;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export const toCsv = (columns: string[], rows: string[][]) =>
  "﻿" + [columns, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n");

export async function toXlsx(columns: string[], rows: string[][], sheetName = "Predictions"): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(sheetName);
  ws.addRow(columns);
  ws.getRow(1).font = { bold: true };
  for (const r of rows) ws.addRow(r.map((c) => (/^[=@]/.test(c) || /^[+-](?![\d.])/.test(c) ? "'" + c : c)));
  ws.columns.forEach((c) => (c.width = 22));
  return Buffer.from(await wb.xlsx.writeBuffer());
}
