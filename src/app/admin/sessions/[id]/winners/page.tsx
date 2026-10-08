import Link from "next/link";
import { ArrowLeft, Trophy } from "lucide-react";
import { getSession, sessionStats } from "@/lib/sessions";
import { getScoreDraw } from "@/lib/results";
import { fmtDateTime, fmtTime, outcomeLabel } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/admin/page-header";
import { ExportMenu } from "@/components/admin/export-menu";
import { PredictionsTable } from "@/components/PredictionsTable";

export const metadata = { title: "Winners · Prediction Admin" };

export default async function WinnersPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await getSession(id);
  const r = s.match.result?.resultStatus === "FINAL" ? s.match.result : null;
  const score = s.enableScorePrediction && r ? await sessionStats(id) : null;
  const draw = score ? await getScoreDraw(id) : null;
  return (
    <div className="space-y-4">
      <PageHeader
        title="Winners"
        description={
          r
            ? `${s.match.homeTeam} ${r.homeScore} - ${r.awayScore} ${s.match.awayTeam} · winning outcome: ${outcomeLabel(r.winningOutcome, s.match)}`
            : `${s.match.homeTeam} vs ${s.match.awayTeam}`
        }
        actions={
          <>
            <ExportMenu sessionId={s.id} winnersOnly label="Export winners" />
            <Button nativeButton={false} variant="ghost" render={<Link href={`/admin/sessions/${s.id}`} />}><ArrowLeft data-icon="inline-start" /> Back</Button>
          </>
        }
      />
      {!r && (
        <Alert>
          <AlertDescription>The match result has not been finalized yet. Winners appear here after finalization.</AlertDescription>
        </Alert>
      )}
      {score && (
        <Card className="border-amber-300/60 bg-amber-50/60 dark:bg-amber-950/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-900 dark:text-amber-100"><Trophy className="size-4" /> Exact score prize</CardTitle>
            <CardDescription>
              {score.scoreWinner ? (
                <>
                  Score winner <strong className="text-foreground">{score.scoreWinner.participant.fullName}</strong> ({score.scoreWinner.participant.mobile}) predicted{" "}
                  {score.scoreWinner.predictedHomeScore} - {score.scoreWinner.predictedAwayScore} at {fmtTime(score.scoreWinner.submittedAt)}.{" "}
                  {score.scoreCorrect > 1 ? `Drawn at random from ${score.scoreCorrect} exact-score predictions.` : "The only exact-score prediction."}
                </>
              ) : (
                "Nobody predicted the exact score."
              )}
            </CardDescription>
          </CardHeader>
          {draw && (
            <CardContent>
              <details className="text-sm">
                <summary className="cursor-pointer font-medium">Draw record ({fmtDateTime(draw.drawnAt)})</summary>
                <div className="mt-2 text-muted-foreground">
                  Method: {draw.method}. Pool: {draw.poolSize} participant(s). Draw order (winner first, then runners-up):
                  <ol className="mt-1 list-decimal pl-5">
                    {draw.order.map((p) => (
                      <li key={p.id}>
                        {p.name}
                        {p.isWinner && <strong className="text-foreground"> · winner</strong>}
                      </li>
                    ))}
                  </ol>
                </div>
              </details>
            </CardContent>
          )}
        </Card>
      )}
      <PredictionsTable session={s} winnersOnly />
    </div>
  );
}
