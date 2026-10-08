import { getSession } from "@/lib/sessions";
import { LinkButton } from "@/components/ui";
import { PredictionsTable } from "@/components/PredictionsTable";
import { LateEntriesTable } from "@/components/LateEntriesTable";

export const metadata = { title: "Predictions · Prediction Admin" };

export default async function PredictionsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await getSession(id);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Predictions · {s.match.homeTeam} vs {s.match.awayTeam}</h1>
          <p className="text-sm text-slate-600">{s._count.predictions} prediction(s) · {s._count.lateEntries} timed-out registration(s)</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a href={`/api/sessions/${s.id}/export?format=csv`} className="inline-flex items-center rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700">Export CSV</a>
          <a href={`/api/sessions/${s.id}/export?format=xlsx`} className="inline-flex items-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium hover:bg-slate-50">Export Excel</a>
          <LinkButton href={`/admin/sessions/${s.id}/winners`}>Winners</LinkButton>
          <LinkButton href={`/admin/sessions/${s.id}`}>Back</LinkButton>
        </div>
      </div>
      <PredictionsTable session={s} winnersOnly={false} />
      <LateEntriesTable session={s} />
    </div>
  );
}
