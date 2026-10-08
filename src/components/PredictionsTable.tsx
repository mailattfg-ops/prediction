import { listPredictions } from "@/lib/predictions";
import { fmtDateTime, outcomeLabel } from "@/lib/format";
import type { SessionWithStatus } from "@/lib/sessions";
import { Td, Th } from "@/components/ui";

const resultStyle: Record<string, string> = {
  WINNER: "bg-emerald-100 text-emerald-800",
  LOST: "bg-slate-200 text-slate-700",
  PENDING: "bg-amber-100 text-amber-800",
};

export async function PredictionsTable({ session, winnersOnly }: { session: SessionWithStatus; winnersOnly: boolean }) {
  const rows = await listPredictions(session.id, { winnersOnly });
  if (!rows.length) {
    return <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-slate-500">{winnersOnly ? "No winners yet. Finalize the match result first." : "No predictions yet."}</div>;
  }
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <table className="min-w-full divide-y divide-slate-200">
        <thead className="bg-slate-50">
          <tr>
            <Th>#</Th><Th>Name</Th><Th>Mobile</Th><Th>Email</Th><Th>Prediction</Th><Th>Result</Th>
            {session.enableScorePrediction && <><Th>Score</Th><Th>Exact score</Th></>}
            <Th>Submitted At</Th>
            {session.fields.map((f) => <Th key={f.key}>{f.label}</Th>)}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((p, i) => {
            const custom = (p.customData ?? {}) as Record<string, unknown>;
            return (
              <tr key={p.id} className="hover:bg-slate-50">
                <Td className="text-slate-400">{i + 1}</Td>
                <Td className="font-medium">{p.participant.fullName}</Td>
                <Td>{p.participant.mobile}</Td>
                <Td>{p.participant.email}</Td>
                <Td className="font-semibold">{outcomeLabel(p.selectedOutcome, session.match)}</Td>
                <Td><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${resultStyle[p.resultStatus]}`}>{p.resultStatus}</span></Td>
                {session.enableScorePrediction && (
                  <>
                    <Td className="font-semibold">{p.predictedHomeScore == null ? "—" : `${p.predictedHomeScore} - ${p.predictedAwayScore}`}</Td>
                    <Td>
                      {p.scoreWinner ? (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">🏆 Score winner</span>
                      ) : p.scoreCorrect == null ? "—" : p.scoreCorrect ? "✓ exact" : "✗"}
                    </Td>
                  </>
                )}
                <Td>{fmtDateTime(p.submittedAt)}</Td>
                {session.fields.map((f) => <Td key={f.key}>{custom[f.key] == null ? "—" : String(custom[f.key])}</Td>)}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
