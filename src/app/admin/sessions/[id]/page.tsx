import Link from "next/link";
import { getAdmin } from "@/lib/auth";
import { sessionStats } from "@/lib/sessions";
import { notificationStats } from "@/lib/notifications/queue";
import { fmtDateTime, pct } from "@/lib/format";
import { predictionUrl } from "@/lib/qr";
import { Bar, Card, LinkButton, Stat, StatusBadge } from "@/components/ui";
import { ResultPanel } from "./ResultPanel";
import { NotificationsPanel } from "./NotificationsPanel";
import { SessionActions } from "./SessionActions";

export const metadata = { title: "Session · Prediction Admin" };

export default async function SessionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [stats, notif, admin] = await Promise.all([sessionStats(id), notificationStats(id), getAdmin()]);
  const s = stats.session;
  const m = s.match;
  const maxMinute = Math.max(1, ...stats.timeline);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{m.homeTeam} vs {m.awayTeam}</h1>
            <StatusBadge status={s.effectiveStatus} />
          </div>
          <div className="mt-1 text-sm text-slate-600">
            {[m.competition, s.eventName, s.campaignName].filter(Boolean).join(" · ") || "—"}
          </div>
          <div className="mt-1 text-sm text-slate-600">
            Kick-off {fmtDateTime(m.kickoffAt)} · Prediction window {fmtDateTime(s.startTime)} → {fmtDateTime(s.expiryTime)} ({s.durationMinutes} min)
            {s.allowDraw && " · Draw allowed"}
            {s.enableScorePrediction && " · Exact score prediction"}
          </div>
          <div className="mt-1 break-all text-xs text-slate-500">
            QR URL: <Link href={predictionUrl(s.secureToken)} className="text-emerald-700 hover:underline" target="_blank">{predictionUrl(s.secureToken)}</Link>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <LinkButton href={`/admin/sessions/${s.id}/qr`} variant="primary">QR code</LinkButton>
          <LinkButton href={`/admin/sessions/${s.id}/predictions`}>Predictions</LinkButton>
          <LinkButton href={`/admin/sessions/${s.id}/winners`}>Winners</LinkButton>
          <a href={`/api/sessions/${s.id}/export?format=csv`} className="inline-flex items-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium hover:bg-slate-50">Export CSV</a>
          <a href={`/api/sessions/${s.id}/export?format=xlsx`} className="inline-flex items-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium hover:bg-slate-50">Export Excel</a>
          {s.status !== "CANCELLED" && s.status !== "COMPLETED" && <LinkButton href={`/admin/sessions/${s.id}/edit`}>Edit</LinkButton>}
          <SessionActions id={s.id} canCancel={s.status === "SCHEDULED" || s.status === "DRAFT"} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat label="Predictions" value={stats.total} hint={`${s._count.lateEntries} timed-out registration(s)`} />
        <Stat label={m.homeTeam} value={stats.home} hint={`${pct(stats.home, stats.total)}%`} />
        <Stat label={m.awayTeam} value={stats.away} hint={`${pct(stats.away, stats.total)}%`} />
        {s.allowDraw ? <Stat label="Draw" value={stats.draw} hint={`${pct(stats.draw, stats.total)}%`} /> : <Stat label="Winners / losers" value={`${stats.winners} / ${stats.losers}`} hint={stats.pending ? `${stats.pending} pending result` : "evaluated"} />}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="space-y-3">
          <h2 className="font-semibold">Prediction summary</h2>
          <Bar label={m.homeTeam} value={stats.home} total={stats.total} />
          <Bar label={m.awayTeam} value={stats.away} total={stats.total} color="bg-sky-500" />
          {s.allowDraw && <Bar label="Draw" value={stats.draw} total={stats.total} color="bg-amber-500" />}
        </Card>
        <Card>
          <h2 className="font-semibold">Participation over time</h2>
          <p className="text-xs text-slate-500">Predictions per minute of the {s.durationMinutes}-minute window</p>
          <div className="mt-4 flex h-28 items-end gap-0.5">
            {stats.timeline.map((n, i) => (
              <div key={i} className="flex flex-1 flex-col items-center justify-end" title={`Minute ${i + 1}: ${n}`}>
                <div className="w-full rounded-t bg-emerald-500" style={{ height: `${Math.max(n ? 6 : 2, (n / maxMinute) * 100)}%` }} />
              </div>
            ))}
          </div>
          <div className="mt-1 flex justify-between text-[10px] text-slate-400"><span>min 1</span><span>min {s.durationMinutes}</span></div>
        </Card>
      </div>

      <ResultPanel
        sessionId={s.id}
        homeTeam={m.homeTeam}
        awayTeam={m.awayTeam}
        cancelled={s.status === "CANCELLED"}
        isSuperAdmin={admin?.role === "SUPER_ADMIN"}
        result={m.result ? { ...m.result, finalizedLabel: m.result.finalizedAt ? fmtDateTime(m.result.finalizedAt) : null } : null}
        stats={{
          total: stats.total, winners: stats.winners, losers: stats.losers, home: stats.home, away: stats.away, draw: stats.draw,
          scoreEnabled: s.enableScorePrediction, scoreCorrect: stats.scoreCorrect, scoreWinnerName: stats.scoreWinner?.participant.fullName ?? null,
        }}
      />

      <NotificationsPanel sessionId={s.id} initial={notif} />
    </div>
  );
}
