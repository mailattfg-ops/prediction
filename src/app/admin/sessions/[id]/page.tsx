import Link from "next/link";
import { Clock, ExternalLink, Pencil, QrCode, Target, Trophy, Users } from "lucide-react";
import { sessionStats } from "@/lib/sessions";
import { notificationStats } from "@/lib/notifications/queue";
import { fmtDateTime, pct } from "@/lib/format";
import { predictionUrl } from "@/lib/qr";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/admin/page-header";
import { StatCard } from "@/components/admin/stat-card";
import { StatusBadge } from "@/components/admin/status-badge";
import { CountBars, SplitBars } from "@/components/admin/charts";
import { ExportMenu } from "@/components/admin/export-menu";
import { ResultPanel } from "./ResultPanel";
import { NotificationsPanel } from "./NotificationsPanel";
import { SessionActions } from "./SessionActions";

export const metadata = { title: "Session · Prediction Admin" };

export default async function SessionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [stats, notif] = await Promise.all([sessionStats(id), notificationStats(id)]);
  const s = stats.session;
  const m = s.match;
  const url = predictionUrl(s.secureToken);

  return (
    <>
      <PageHeader
        title={`${m.homeTeam} vs ${m.awayTeam}`}
        badge={<StatusBadge status={s.effectiveStatus} />}
        description={
          <div className="space-y-1">
            <div>{[m.competition, s.eventName, s.campaignName].filter(Boolean).join(" · ") || "No event or campaign name"}</div>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <Clock className="size-3.5" /> Window {fmtDateTime(s.startTime)} → {fmtDateTime(s.expiryTime)} ({s.durationMinutes} min) · Kick-off {fmtDateTime(m.kickoffAt)}
              {s.enableScorePrediction && <span>· Exact score</span>}
              {s.allowDraw && <span>· Draw allowed</span>}
            </div>
            <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 break-all text-xs text-primary hover:underline">
              {url} <ExternalLink className="size-3" />
            </a>
          </div>
        }
        actions={
          <>
            <Button nativeButton={false} render={<Link href={`/admin/sessions/${s.id}/qr`} />}><QrCode data-icon="inline-start" /> QR code</Button>
            <Button nativeButton={false} variant="outline" render={<Link href={`/admin/sessions/${s.id}/predictions`} />}><Users data-icon="inline-start" /> Predictions</Button>
            <Button nativeButton={false} variant="outline" render={<Link href={`/admin/sessions/${s.id}/winners`} />}><Trophy data-icon="inline-start" /> Winners</Button>
            <ExportMenu sessionId={s.id} />
            {s.status !== "CANCELLED" && s.status !== "COMPLETED" && (
              <Button nativeButton={false} variant="outline" render={<Link href={`/admin/sessions/${s.id}/edit`} />}><Pencil data-icon="inline-start" /> Edit</Button>
            )}
            <SessionActions id={s.id} canCancel={s.status === "SCHEDULED" || s.status === "DRAFT"} />
          </>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Predictions" value={stats.total} hint={`${s._count.lateEntries} timed-out registration(s)`} icon={Target} tone="primary" />
        <StatCard label={m.homeTeam} value={stats.home} hint={`${pct(stats.home, stats.total)}%`} />
        <StatCard label={m.awayTeam} value={stats.away} hint={`${pct(stats.away, stats.total)}%`} />
        {s.allowDraw ? (
          <StatCard label="Draw" value={stats.draw} hint={`${pct(stats.draw, stats.total)}%`} />
        ) : (
          <StatCard label="Winners / losers" value={`${stats.winners} / ${stats.losers}`} hint={stats.pending ? `${stats.pending} pending result` : "evaluated"} icon={Trophy} tone="warning" />
        )}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Prediction summary</CardTitle>
            <CardDescription>How participants voted</CardDescription>
          </CardHeader>
          <CardContent>
            <SplitBars
              rows={[
                { label: m.homeTeam, value: stats.home, total: stats.total, color: "var(--chart-1)" },
                { label: m.awayTeam, value: stats.away, total: stats.total, color: "var(--chart-2)" },
                ...(s.allowDraw ? [{ label: "Draw", value: stats.draw, total: stats.total, color: "var(--chart-3)" }] : []),
              ]}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Participation over time</CardTitle>
            <CardDescription>Predictions per minute of the {s.durationMinutes}-minute window</CardDescription>
          </CardHeader>
          <CardContent>
            <CountBars data={stats.timeline.map((n, i) => ({ label: `${i + 1}`, count: n }))} className="h-40 w-full" />
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 space-y-6">
        <ResultPanel
          sessionId={s.id}
          homeTeam={m.homeTeam}
          awayTeam={m.awayTeam}
          cancelled={s.status === "CANCELLED"}
          result={m.result ? { ...m.result, finalizedLabel: m.result.finalizedAt ? fmtDateTime(m.result.finalizedAt) : null } : null}
          stats={{
            total: stats.total, winners: stats.winners, losers: stats.losers, home: stats.home, away: stats.away, draw: stats.draw,
            scoreEnabled: s.enableScorePrediction, scoreCorrect: stats.scoreCorrect, scoreWinnerName: stats.scoreWinner?.participant.fullName ?? null,
          }}
        />
        <NotificationsPanel sessionId={s.id} initial={notif} />
      </div>
    </>
  );
}
