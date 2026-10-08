import Link from "next/link";
import { Activity, CalendarClock, MessageCircle, Plus, Target, Users } from "lucide-react";
import { dashboardStats, listSessions } from "@/lib/sessions";
import { fmtDate, fmtTime } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/admin/page-header";
import { StatCard } from "@/components/admin/stat-card";
import { CountBars } from "@/components/admin/charts";
import { SessionsTable, type SessionRowView } from "@/components/SessionsTable";

export const metadata = { title: "Dashboard · Prediction Admin" };

export default async function Dashboard() {
  const [stats, sessions] = await Promise.all([dashboardStats(), listSessions()]);
  const rows: SessionRowView[] = sessions.slice(0, 8).map((s) => ({
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
  const perSession = stats.totalSessions ? Math.round((stats.totalPredictions / stats.totalSessions) * 10) / 10 : 0;
  const n = stats.notifications;

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Live overview of your prediction campaigns."
        actions={
          <Button nativeButton={false} render={<Link href="/admin/sessions/new" />}>
            <Plus data-icon="inline-start" /> New session
          </Button>
        }
      />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard label="Sessions" value={stats.totalSessions} hint={`${stats.scheduledSessions} scheduled · ${stats.completedSessions} completed`} icon={CalendarClock} />
        <StatCard label="Live now" value={stats.activeSessions} hint="accepting predictions" icon={Activity} tone="primary" />
        <StatCard label="Expired" value={stats.expiredSessions} hint={`${stats.cancelledSessions} cancelled`} icon={Target} />
        <StatCard label="Participants" value={stats.totalParticipants} hint="unique mobile numbers" icon={Users} tone="info" />
        <StatCard label="Predictions" value={stats.totalPredictions} hint={`${perSession} per session on average`} icon={Target} tone="primary" />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Participation over time</CardTitle>
            <CardDescription>Predictions per day, last 14 days</CardDescription>
          </CardHeader>
          <CardContent>
            <CountBars data={stats.perDay.map((d) => ({ label: d.day.slice(5), count: d.count }))} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><MessageCircle className="size-4 text-primary" /> WhatsApp</CardTitle>
            <CardDescription>Notification delivery, all sessions</CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-3">
              {[
                ["Total", n.total, ""],
                ["Sent", n.sent, "text-emerald-600"],
                ["Failed", n.failed, n.failed ? "text-rose-600" : ""],
                ["Queued", n.queued, ""],
              ].map(([k, v, cls]) => (
                <div key={k as string} className="rounded-lg bg-muted/60 p-3">
                  <dt className="text-xs text-muted-foreground">{k}</dt>
                  <dd className={`text-2xl font-bold tabular-nums ${cls}`}>{v}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>
      </div>

      <div className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Recent sessions</h2>
          <Button nativeButton={false} variant="ghost" size="sm" render={<Link href="/admin/sessions" />}>View all</Button>
        </div>
        <SessionsTable rows={rows} />
      </div>
    </>
  );
}
