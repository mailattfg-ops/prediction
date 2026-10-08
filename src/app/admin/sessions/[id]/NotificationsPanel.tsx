"use client";
import { useState } from "react";
import { toast } from "sonner";
import { MessageCircle, RefreshCw, RotateCcw } from "lucide-react";
import { api, ApiClientError } from "@/components/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type Stat = { type: string; total: number; sent: number; failed: number; queued: number };
type Row = { id: string; type: string; phoneNumber: string; status: string; attempts: number; errorMessage: string | null; participant: { fullName: string } };

const LABELS: Record<string, string> = {
  PREDICTION_SUBMITTED: "Prediction confirmation",
  PREDICTION_WINNER: "Winner notification",
  PREDICTION_LOST: "Losing notification",
  SCORE_WINNER: "Score-prize winner",
  RESULT_ANNOUNCEMENT: "Result announcement",
};

export function NotificationsPanel({ sessionId, initial }: { sessionId: string; initial: Stat[] }) {
  const [stats, setStats] = useState(initial);
  const [failed, setFailed] = useState<Row[] | null>(null);
  const [busy, setBusy] = useState(false);
  const totalFailed = stats.reduce((a, s) => a + s.failed, 0);
  const totalQueued = stats.reduce((a, s) => a + s.queued, 0);

  async function refresh(showFailed = failed !== null) {
    const r = await api<{ stats: Stat[]; notifications: Row[] }>(`/api/sessions/${sessionId}/notifications${showFailed ? "?status=FAILED" : ""}`);
    setStats(r.stats);
    setFailed(showFailed ? r.notifications : null);
  }

  async function retry() {
    setBusy(true);
    try {
      const r = await api<{ requeued: number }>(`/api/sessions/${sessionId}/notifications/retry`, { method: "POST" });
      toast.success(`${r.requeued} notification(s) queued for retry.`);
      await refresh();
    } catch (e) {
      toast.error((e as ApiClientError).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2"><MessageCircle className="size-4 text-primary" /> WhatsApp notifications</CardTitle>
            <CardDescription>
              Delivery per message type.{totalQueued > 0 && <> Queued messages are sent by the background worker.</>}
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => refresh()} disabled={busy}><RefreshCw data-icon="inline-start" /> Refresh</Button>
            <Button variant="outline" size="sm" onClick={() => refresh(failed === null)} disabled={busy}>{failed === null ? "Show failed" : "Hide failed"}</Button>
            <Button size="sm" onClick={retry} disabled={busy || totalFailed === 0}><RotateCcw data-icon="inline-start" /> Retry failed ({totalFailed})</Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="overflow-hidden rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Notification</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Sent</TableHead>
                <TableHead className="text-right">Failed</TableHead>
                <TableHead className="text-right">Queued</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stats.map((s) => (
                <TableRow key={s.type}>
                  <TableCell>{LABELS[s.type] ?? s.type}</TableCell>
                  <TableCell className="text-right tabular-nums">{s.total}</TableCell>
                  <TableCell className="text-right tabular-nums text-emerald-600">{s.sent}</TableCell>
                  <TableCell className={`text-right tabular-nums ${s.failed ? "font-semibold text-destructive" : ""}`}>{s.failed}</TableCell>
                  <TableCell className="text-right tabular-nums">{s.queued}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        {failed && (
          <div className="overflow-hidden rounded-lg border border-destructive/30">
            {failed.length === 0 ? (
              <p className="p-3 text-sm text-muted-foreground">No failed notifications.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Participant</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Attempts</TableHead>
                    <TableHead>Error</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {failed.map((n) => (
                    <TableRow key={n.id}>
                      <TableCell>{n.participant.fullName}</TableCell>
                      <TableCell className="tabular-nums">{n.phoneNumber}</TableCell>
                      <TableCell>{LABELS[n.type] ?? n.type}</TableCell>
                      <TableCell className="text-right tabular-nums">{n.attempts}</TableCell>
                      <TableCell className="max-w-md truncate text-destructive" title={n.errorMessage ?? ""}>{n.errorMessage}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
