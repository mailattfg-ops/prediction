"use client";
import { useState } from "react";
import { api, ApiClientError } from "@/components/api";
import { Alert, Button, Card, Td, Th } from "@/components/ui";

type Stat = { type: string; total: number; sent: number; failed: number; queued: number };
type Row = { id: string; type: string; phoneNumber: string; status: string; attempts: number; errorMessage: string | null; participant: { fullName: string } };

const LABELS: Record<string, string> = {
  PREDICTION_SUBMITTED: "Prediction Confirmation",
  PREDICTION_WINNER: "Winner Notification",
  PREDICTION_LOST: "Losing Notification",
  SCORE_WINNER: "Score Winner Notification",
  RESULT_ANNOUNCEMENT: "Result Announcement",
};

export function NotificationsPanel({ sessionId, initial }: { sessionId: string; initial: Stat[] }) {
  const [stats, setStats] = useState(initial);
  const [failed, setFailed] = useState<Row[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const totalFailed = stats.reduce((a, s) => a + s.failed, 0);
  const totalQueued = stats.reduce((a, s) => a + s.queued, 0);

  async function refresh(showFailed = failed !== null) {
    const r = await api<{ stats: Stat[]; notifications: Row[] }>(`/api/sessions/${sessionId}/notifications${showFailed ? "?status=FAILED" : ""}`);
    setStats(r.stats);
    setFailed(showFailed ? r.notifications : null);
  }

  async function retry() {
    setBusy(true);
    setMessage(null);
    try {
      const r = await api<{ requeued: number }>(`/api/sessions/${sessionId}/notifications/retry`, { method: "POST" });
      setMessage(`${r.requeued} notification(s) queued for retry.`);
      await refresh();
    } catch (e) {
      setMessage((e as ApiClientError).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">WhatsApp Notifications</h2>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => refresh()} disabled={busy}>Refresh</Button>
          <Button variant="secondary" onClick={() => refresh(failed === null)} disabled={busy}>{failed === null ? "Show failed" : "Hide failed"}</Button>
          <Button onClick={retry} disabled={busy || totalFailed === 0}>Retry Failed ({totalFailed})</Button>
        </div>
      </div>
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead><tr><Th>Notification</Th><Th>Total</Th><Th>Sent</Th><Th>Failed</Th><Th>Queued</Th></tr></thead>
        <tbody className="divide-y divide-slate-100">
          {stats.map((s) => (
            <tr key={s.type}>
              <Td>{LABELS[s.type] ?? s.type}</Td><Td>{s.total}</Td><Td className="text-emerald-700">{s.sent}</Td>
              <Td className={s.failed ? "font-semibold text-rose-700" : ""}>{s.failed}</Td><Td>{s.queued}</Td>
            </tr>
          ))}
        </tbody>
      </table>
      {totalQueued > 0 && <p className="text-xs text-slate-500">Queued messages are delivered by the background worker (<code>npm run worker</code>) or the cron job route.</p>}
      {message && <Alert kind="info">{message}</Alert>}
      {failed && (
        <div className="overflow-x-auto rounded-lg border border-rose-100">
          {failed.length === 0 ? (
            <p className="p-3 text-sm text-slate-500">No failed notifications.</p>
          ) : (
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-rose-50"><tr><Th>Participant</Th><Th>Phone</Th><Th>Type</Th><Th>Attempts</Th><Th>Error</Th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {failed.map((n) => (
                  <tr key={n.id}>
                    <Td>{n.participant.fullName}</Td><Td>{n.phoneNumber}</Td><Td>{LABELS[n.type] ?? n.type}</Td><Td>{n.attempts}</Td>
                    <Td className="max-w-md truncate text-rose-700" >{n.errorMessage}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </Card>
  );
}
