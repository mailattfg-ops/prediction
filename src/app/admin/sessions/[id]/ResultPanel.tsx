"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiClientError } from "@/components/api";
import { Modal } from "@/components/Modal";
import { Alert, Button, Card, Field, Input, Select } from "@/components/ui";

type Outcome = "HOME" | "AWAY" | "DRAW";
type Result = { homeScore: number; awayScore: number; winningOutcome: Outcome; resultStatus: "PENDING" | "FINAL"; version: number; finalizedLabel: string | null } | null;
type Preview = {
  homeScore: number; awayScore: number; autoOutcome: Outcome; winningOutcome: Outcome; overridden: boolean; total: number; winners: number; losers: number;
  scoreEnabled: boolean; exactScoreCount: number;
  otherSessions: { id: string; label: string; predictions: number }[];
};

export function ResultPanel({ sessionId, homeTeam, awayTeam, result, isSuperAdmin, stats, cancelled }: {
  sessionId: string; homeTeam: string; awayTeam: string; result: Result; isSuperAdmin: boolean; cancelled: boolean;
  stats: { total: number; winners: number; losers: number; home: number; away: number; draw: number; scoreEnabled: boolean; scoreCorrect: number; scoreWinnerName: string | null };
}) {
  const router = useRouter();
  const label = (o: Outcome) => (o === "HOME" ? homeTeam : o === "AWAY" ? awayTeam : "Draw");
  const [home, setHome] = useState(result?.homeScore ?? 0);
  const [away, setAway] = useState(result?.awayScore ?? 0);
  const [override, setOverride] = useState<"" | Outcome>("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [reopen, setReopen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function call<T>(fn: () => Promise<T>, after?: (r: T) => void) {
    setBusy(true);
    setError(null);
    try {
      const r = await fn();
      after?.(r);
    } catch (e) {
      setError((e as ApiClientError).message);
    } finally {
      setBusy(false);
    }
  }
  const body = () => ({ homeScore: home, awayScore: away, winningOutcome: override || undefined });

  if (cancelled) return null;

  if (result?.resultStatus === "FINAL") {
    const winPct = stats.total ? Math.round((stats.winners / stats.total) * 1000) / 10 : 0;
    return (
      <Card className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">Match Result</h2>
          <span className="rounded-full bg-violet-100 px-3 py-1 text-xs font-semibold text-violet-800">
            Result Finalized{result.version > 1 ? ` · corrected (v${result.version})` : ""}
          </span>
        </div>
        <div className="text-2xl font-bold">
          {homeTeam} {result.homeScore} - {result.awayScore} {awayTeam}
        </div>
        <div className="text-sm text-slate-600">
          Winning outcome: <strong>{label(result.winningOutcome)}</strong>
          {result.finalizedLabel && <> · finalized {result.finalizedLabel}</>}
        </div>
        <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {[["Total predictions", stats.total], ["Winners", stats.winners], ["Losers", stats.losers], ["Winning percentage", `${winPct}%`]].map(([k, v]) => (
            <div key={k} className="rounded-lg bg-slate-50 p-3"><dt className="text-xs text-slate-500">{k}</dt><dd className="text-xl font-bold">{v}</dd></div>
          ))}
        </dl>
        {stats.scoreEnabled && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            🏆 Exact score predicted by <strong>{stats.scoreCorrect}</strong> participant(s).{" "}
            {stats.scoreWinnerName ? <>Score winner (random draw): <strong>{stats.scoreWinnerName}</strong>.</> : "No score winner."}
          </div>
        )}
        {error && <Alert>{error}</Alert>}
        {isSuperAdmin ? (
          <Button variant="secondary" onClick={() => setReopen(true)} disabled={busy}>Reopen Result</Button>
        ) : (
          <p className="text-xs text-slate-500">Only a Super Admin can reopen a finalized result.</p>
        )}
        <Modal open={reopen} title="Reopen finalized result?" onClose={() => setReopen(false)}>
          <Alert>
            Changing the final result will recalculate all participant results and may trigger WhatsApp notifications again when you finalize. This action is recorded in the audit log.
          </Alert>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setReopen(false)}>Cancel</Button>
            <Button variant="danger" disabled={busy} onClick={() => call(() => api(`/api/sessions/${sessionId}/result/reopen`, { method: "POST" }), () => { setReopen(false); router.refresh(); })}>
              Yes, reopen result
            </Button>
          </div>
        </Modal>
      </Card>
    );
  }

  return (
    <Card className="space-y-4">
      <h2 className="text-lg font-semibold">Enter Match Result</h2>
      {result?.resultStatus === "PENDING" && (
        <Alert kind="info">
          This result was reopened. Previous result: {homeTeam} {result.homeScore} - {result.awayScore} {awayTeam}. Participant results are PENDING until you finalize again.
        </Alert>
      )}
      <div className="flex flex-wrap items-end gap-3">
        <Field label={homeTeam}><Input type="number" min={0} max={99} value={home} onChange={(e) => setHome(Number(e.target.value))} className="w-24 text-center text-xl font-bold" /></Field>
        <div className="pb-3 font-bold text-slate-400">VS</div>
        <Field label={awayTeam}><Input type="number" min={0} max={99} value={away} onChange={(e) => setAway(Number(e.target.value))} className="w-24 text-center text-xl font-bold" /></Field>
        <Field label="Official outcome" hint="Leave on Auto unless an official ruling differs from the score">
          <Select value={override} onChange={(e) => setOverride(e.target.value as "" | Outcome)}>
            <option value="">Auto (from score)</option>
            <option value="HOME">{homeTeam}</option>
            <option value="AWAY">{awayTeam}</option>
            <option value="DRAW">Draw</option>
          </Select>
        </Field>
        <Button disabled={busy} onClick={() => call(() => api<Preview>(`/api/sessions/${sessionId}/result/preview`, { method: "POST", body: body() }), setPreview)}>
          Calculate Winners
        </Button>
      </div>
      {error && <Alert>{error}</Alert>}
      <Modal open={!!preview} title="Confirm match result" onClose={() => setPreview(null)}>
        {preview && (
          <div className="space-y-3">
            <p className="text-lg font-semibold">
              {preview.winningOutcome === "DRAW"
                ? `${homeTeam} and ${awayTeam} drew ${preview.homeScore}-${preview.awayScore}.`
                : `${label(preview.winningOutcome)} won ${preview.winningOutcome === "HOME" ? `${preview.homeScore}-${preview.awayScore}` : `${preview.awayScore}-${preview.homeScore}`}.`}
            </p>
            <p className="text-slate-700">All participants who predicted <strong>{label(preview.winningOutcome)}</strong> will be marked as winners.</p>
            <p className="text-xs text-slate-500">Numbers below are for this session only.</p>
            {preview.overridden && <Alert>You overrode the automatic outcome ({label(preview.autoOutcome)}). Make sure this matches the official ruling.</Alert>}
            <dl className="grid grid-cols-3 gap-2 text-center">
              {[["Predictions", preview.total], ["Winners", preview.winners], ["Losers", preview.losers]].map(([k, v]) => (
                <div key={k} className="rounded-lg bg-slate-50 p-2"><dt className="text-xs text-slate-500">{k}</dt><dd className="text-xl font-bold">{v}</dd></div>
              ))}
            </dl>
            {preview.otherSessions.length > 0 && (
              <Alert kind="info">
                The result belongs to the match, so it will also be applied to {preview.otherSessions.length} other session(s) of this match:{" "}
                {preview.otherSessions.map((s) => `${s.label} (${s.predictions} prediction${s.predictions === 1 ? "" : "s"})`).join(", ")}.
              </Alert>
            )}
            {preview.scoreEnabled && (
              <p className="rounded-lg bg-amber-50 p-2 text-sm text-amber-900">
                🏆 Exact score {preview.homeScore}-{preview.awayScore} predicted by <strong>{preview.exactScoreCount}</strong> participant(s).{" "}
                {preview.exactScoreCount > 1
                  ? "One score winner will be drawn at random among them when you confirm (cryptographically secure draw, recorded in the audit log)."
                  : preview.exactScoreCount === 1
                    ? "That participant becomes the score winner when you confirm."
                    : "No score winner will be selected."}
              </p>
            )}
            <p className="text-xs text-slate-500">Finalizing stores the result, marks every prediction WINNER or LOST and queues WhatsApp result notifications. It cannot be repeated without a Super Admin reopening the result.</p>
            {error && <Alert>{error}</Alert>}
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setPreview(null)}>Cancel</Button>
              <Button disabled={busy} onClick={() => call(() => api(`/api/sessions/${sessionId}/result`, { method: "POST", body: body() }), () => { setPreview(null); router.refresh(); })}>
                Confirm Result
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </Card>
  );
}
