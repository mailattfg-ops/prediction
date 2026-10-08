import { dashboardStats, listSessions } from "@/lib/sessions";
import { fmtDate, fmtTime } from "@/lib/format";
import { Card, Stat } from "@/components/ui";
import { SessionsTable, type SessionRowView } from "@/components/SessionsTable";

export const metadata = { title: "Dashboard · Prediction Admin" };

export default async function Dashboard() {
  const [stats, sessions] = await Promise.all([dashboardStats(), listSessions()]);
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
  const maxDay = Math.max(1, ...stats.perDay.map((d) => d.count));
  const participation = stats.totalSessions ? Math.round((stats.totalPredictions / stats.totalSessions) * 10) / 10 : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Dashboard</h1>
      </div>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
        <Stat label="Total sessions" value={stats.totalSessions} hint={`${stats.scheduledSessions} scheduled · ${stats.completedSessions} completed`} />
        <Stat label="Active sessions" value={stats.activeSessions} />
        <Stat label="Expired sessions" value={stats.expiredSessions} hint={`${stats.cancelledSessions} cancelled`} />
        <Stat label="Total participants" value={stats.totalParticipants} />
        <Stat label="Total predictions" value={stats.totalPredictions} hint={`${participation} per session on average`} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="font-semibold">Participation over time</h2>
          <p className="text-xs text-slate-500">Predictions per day, last 14 days</p>
          {stats.perDay.length === 0 ? (
            <p className="mt-6 text-sm text-slate-500">No predictions yet.</p>
          ) : (
            <div className="mt-4 flex h-32 items-end gap-1">
              {stats.perDay.map((d) => (
                <div key={d.day} className="flex flex-1 flex-col items-center justify-end gap-1" title={`${d.day}: ${d.count}`}>
                  <span className="text-[10px] text-slate-600">{d.count}</span>
                  <div className="w-full rounded-t bg-emerald-500" style={{ height: `${Math.max(4, (d.count / maxDay) * 100)}%` }} />
                  <span className="text-[10px] text-slate-400">{d.day.slice(5)}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
        <Card>
          <h2 className="font-semibold">WhatsApp notifications</h2>
          <p className="text-xs text-slate-500">All sessions</p>
          <dl className="mt-4 grid grid-cols-4 gap-3 text-center">
            {[
              ["Total", stats.notifications.total],
              ["Sent", stats.notifications.sent],
              ["Failed", stats.notifications.failed],
              ["Queued", stats.notifications.queued],
            ].map(([k, v]) => (
              <div key={k} className="rounded-lg bg-slate-50 p-3">
                <dt className="text-xs text-slate-500">{k}</dt>
                <dd className="text-2xl font-bold">{v}</dd>
              </div>
            ))}
          </dl>
        </Card>
      </div>
      <div>
        <h2 className="mb-3 text-lg font-semibold">Prediction sessions</h2>
        <SessionsTable rows={rows} />
      </div>
    </div>
  );
}
