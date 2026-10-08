import { requireAdmin } from "@/lib/auth";
import { route } from "@/lib/http";
import { exportTable, toCsv, toXlsx } from "@/lib/export";

export const GET = route<{ id: string }>(async (req, { params }) => {
  await requireAdmin(req);
  const q = new URL(req.url).searchParams;
  const { columns, rows, filename } = await exportTable((await params).id, q.get("winners") === "1");
  const xlsx = q.get("format") === "xlsx";
  const body = xlsx ? new Uint8Array(await toXlsx(columns, rows)) : toCsv(columns, rows);
  return new Response(body, {
    headers: {
      "Content-Type": xlsx ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" : "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}.${xlsx ? "xlsx" : "csv"}"`,
      "Cache-Control": "private, no-store",
    },
  });
});
