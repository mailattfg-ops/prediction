import { listMatches } from "@/lib/matches";
import { fmtDateTime } from "@/lib/format";
import { SessionForm } from "../SessionForm";
import { LinkButton } from "@/components/ui";

export const metadata = { title: "New session · Prediction Admin" };

export default async function NewSessionPage({ searchParams }: { searchParams: Promise<{ matchId?: string }> }) {
  const { matchId } = await searchParams;
  const matches = (await listMatches()).map((m) => ({ id: m.id, label: `${m.homeTeam} vs ${m.awayTeam} · ${fmtDateTime(m.kickoffAt)}` }));
  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <h1 className="text-2xl font-bold">New prediction session</h1>
      {matches.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-slate-500">
          Create a match first. <LinkButton href="/admin/matches/new" variant="primary" className="ml-2">+ New match</LinkButton>
        </div>
      ) : (
        <SessionForm matches={matches} defaultMatchId={matchId} />
      )}
    </div>
  );
}
