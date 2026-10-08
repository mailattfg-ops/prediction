import { getSession } from "@/lib/sessions";
import { listMatches } from "@/lib/matches";
import { fmtDateTime } from "@/lib/format";
import { toInputValue } from "@/components/datetime";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { PageHeader } from "@/components/admin/page-header";
import { StatusBadge } from "@/components/admin/status-badge";
import { SessionForm } from "../../SessionForm";

export const metadata = { title: "Edit session · Prediction Admin" };

export default async function EditSessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [s, matches] = await Promise.all([getSession(id), listMatches()]);
  const locked = s.status === "CANCELLED" || s.status === "COMPLETED";
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Edit session" description={`${s.match.homeTeam} vs ${s.match.awayTeam}`} badge={<StatusBadge status={s.effectiveStatus} />} />
      {locked && (
        <Alert className="mb-4">
          <AlertDescription>This session is {s.status.toLowerCase()} and can no longer be edited.</AlertDescription>
        </Alert>
      )}
      <SessionForm
        id={s.id}
        matches={matches.map((m) => ({ id: m.id, label: `${m.homeTeam} vs ${m.awayTeam} · ${fmtDateTime(m.kickoffAt)}` }))}
        initial={{
          matchId: s.matchId, startTime: toInputValue(s.startTime.toISOString()), durationMinutes: s.durationMinutes,
          status: s.status === "DRAFT" ? "DRAFT" : "SCHEDULED", allowDraw: s.allowDraw, showResultsToParticipants: s.showResultsToParticipants,
          showWinnersToParticipants: s.showWinnersToParticipants, requireConsent: s.requireConsent, enableScorePrediction: s.enableScorePrediction,
          collectLateEntries: s.collectLateEntries, campaignName: s.campaignName ?? "", eventName: s.eventName ?? "",
          fields: s.fields.map((f) => ({ key: f.key, label: f.label, type: f.type, options: f.options.join(", "), required: f.required })),
        }}
      />
    </div>
  );
}
