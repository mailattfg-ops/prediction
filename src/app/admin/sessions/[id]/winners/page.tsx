import { getSession, sessionStats } from "@/lib/sessions";
import { fmtTime, outcomeLabel } from "@/lib/format";
import { Alert, LinkButton } from "@/components/ui";
import { PredictionsTable } from "@/components/PredictionsTable";

export const metadata = { title: "Winners · Prediction Admin" };

export default async function WinnersPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await getSession(id);
  const r = s.match.result?.resultStatus === "FINAL" ? s.match.result : null;
  const score = s.enableScorePrediction && r ? await sessionStats(id) : null;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Winners · {s.match.homeTeam} vs {s.match.awayTeam}</h1>
          {r && <p className="text-sm text-slate-600">Final result {s.match.homeTeam} {r.homeScore} - {r.awayScore} {s.match.awayTeam} · winning outcome: {outcomeLabel(r.winningOutcome, s.match)}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          <a href={`/api/sessions/${s.id}/export?format=csv&winners=1`} className="inline-flex items-center rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700">Export winners CSV</a>
          <a href={`/api/sessions/${s.id}/export?format=xlsx&winners=1`} className="inline-flex items-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium hover:bg-slate-50">Export winners Excel</a>
          <LinkButton href={`/admin/sessions/${s.id}`}>Back</LinkButton>
        </div>
      </div>
      {!r && <Alert kind="info">The match result has not been finalized yet. Winners appear here after finalization.</Alert>}
      {score && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <div className="font-semibold">🏆 Exact score prize</div>
          {score.scoreWinner ? (
            <div>
              Score winner: <strong>{score.scoreWinner.participant.fullName}</strong> ({score.scoreWinner.participant.mobile}) predicted{" "}
              {score.scoreWinner.predictedHomeScore} - {score.scoreWinner.predictedAwayScore} at {fmtTime(score.scoreWinner.submittedAt)}. Auto-selected as the earliest of{" "}
              {score.scoreCorrect} exact-score prediction(s).
            </div>
          ) : (
            <div>Nobody predicted the exact score.</div>
          )}
        </div>
      )}
      <PredictionsTable session={s} winnersOnly />
    </div>
  );
}
