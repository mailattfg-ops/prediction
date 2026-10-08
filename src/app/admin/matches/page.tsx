import Link from "next/link";
import { listMatches } from "@/lib/matches";
import { fmtDateTime, outcomeLabel } from "@/lib/format";
import { LinkButton, Td, Th } from "@/components/ui";
import { MatchDeleteButton } from "./MatchDeleteButton";

export const metadata = { title: "Matches · Prediction Admin" };

export default async function MatchesPage() {
  const matches = await listMatches();
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Matches</h1>
        <LinkButton href="/admin/matches/new" variant="primary">+ New match</LinkButton>
      </div>
      {matches.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-slate-500">No matches yet.</div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr><Th>Match</Th><Th>Competition</Th><Th>Kick-off</Th><Th>Venue</Th><Th>Sessions</Th><Th>Result</Th><Th>Actions</Th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {matches.map((m) => (
                <tr key={m.id} className="hover:bg-slate-50">
                  <Td className="font-medium">{m.homeTeam} vs {m.awayTeam}</Td>
                  <Td>{m.competition ?? "—"}</Td>
                  <Td>{fmtDateTime(m.kickoffAt)}</Td>
                  <Td>{m.venue ?? "—"}</Td>
                  <Td>{m._count.sessions}</Td>
                  <Td>
                    {m.result && m.result.resultStatus === "FINAL"
                      ? `${m.result.homeScore} - ${m.result.awayScore} (${outcomeLabel(m.result.winningOutcome, m)})`
                      : "—"}
                  </Td>
                  <Td>
                    <div className="flex flex-wrap gap-3 text-xs">
                      <Link href={`/admin/sessions/new?matchId=${m.id}`} className="text-emerald-700 hover:underline">New session</Link>
                      <Link href={`/admin/matches/${m.id}/edit`} className="text-sky-700 hover:underline">Edit</Link>
                      {m._count.sessions === 0 && <MatchDeleteButton id={m.id} label={`${m.homeTeam} vs ${m.awayTeam}`} />}
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
