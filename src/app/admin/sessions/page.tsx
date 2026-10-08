import Link from "next/link";
import { Plus } from "lucide-react";
import { listSessions } from "@/lib/sessions";
import { fmtDate, fmtTime } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/admin/page-header";
import { SessionsTable, type SessionRowView } from "@/components/SessionsTable";

export const metadata = { title: "Sessions · Prediction Admin" };

export default async function SessionsPage() {
  const sessions = await listSessions();
  const rows: SessionRowView[] = sessions.map((s) => ({
    id: s.id,
    match: `${s.match.homeTeam} vs ${s.match.awayTeam}`,
    campaign: [s.eventName, s.campaignName].filter(Boolean).join(" · "),
    date: fmtDate(s.match.kickoffAt),
    start: fmtTime(s.startTime),
    expiry: fmtTime(s.expiryTime),
    status: s.effectiveStatus,
    predictions: s._count.predictions,
    late: s._count.lateEntries,
    canCancel: s.status === "SCHEDULED" || s.status === "DRAFT",
  }));
  return (
    <>
      <PageHeader
        title="Prediction sessions"
        description={`${rows.length} session${rows.length === 1 ? "" : "s"}. Each session has its own QR code and 10-minute window.`}
        actions={
          <Button nativeButton={false} render={<Link href="/admin/sessions/new" />}>
            <Plus data-icon="inline-start" /> New session
          </Button>
        }
      />
      <SessionsTable rows={rows} />
    </>
  );
}
