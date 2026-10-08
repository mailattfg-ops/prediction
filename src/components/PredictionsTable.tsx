import { Trophy } from "lucide-react";
import { listPredictions } from "@/lib/predictions";
import { fmtDateTime, outcomeLabel } from "@/lib/format";
import type { SessionWithStatus } from "@/lib/sessions";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ResultBadge } from "@/components/admin/status-badge";

export async function PredictionsTable({ session, winnersOnly }: { session: SessionWithStatus; winnersOnly: boolean }) {
  const rows = await listPredictions(session.id, { winnersOnly });
  if (!rows.length) {
    return (
      <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
        {winnersOnly ? "No winners yet. Finalize the match result first." : "No predictions yet."}
      </div>
    );
  }
  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10">#</TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Mobile</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Prediction</TableHead>
            <TableHead>Result</TableHead>
            {session.enableScorePrediction && <><TableHead>Score</TableHead><TableHead>Exact score</TableHead></>}
            <TableHead>Submitted</TableHead>
            {session.fields.map((f) => <TableHead key={f.key}>{f.label}</TableHead>)}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((p, i) => {
            const custom = (p.customData ?? {}) as Record<string, unknown>;
            return (
              <TableRow key={p.id}>
                <TableCell className="text-muted-foreground tabular-nums">{i + 1}</TableCell>
                <TableCell className="font-medium">{p.participant.fullName}</TableCell>
                <TableCell className="tabular-nums">{p.participant.mobile}</TableCell>
                <TableCell className="text-muted-foreground">{p.participant.email}</TableCell>
                <TableCell className="font-semibold">{outcomeLabel(p.selectedOutcome, session.match)}</TableCell>
                <TableCell><ResultBadge status={p.resultStatus} /></TableCell>
                {session.enableScorePrediction && (
                  <>
                    <TableCell className="font-semibold tabular-nums">{p.predictedHomeScore == null ? "—" : `${p.predictedHomeScore} - ${p.predictedAwayScore}`}</TableCell>
                    <TableCell>
                      {p.scoreWinner ? (
                        <Badge className="bg-amber-500/15 text-amber-800 hover:bg-amber-500/15"><Trophy /> Score winner</Badge>
                      ) : p.scoreCorrect == null ? "—" : p.scoreCorrect ? "✓ exact" : "✗"}
                    </TableCell>
                  </>
                )}
                <TableCell className="whitespace-nowrap text-muted-foreground">{fmtDateTime(p.submittedAt)}</TableCell>
                {session.fields.map((f) => <TableCell key={f.key}>{custom[f.key] == null ? "—" : String(custom[f.key])}</TableCell>)}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
