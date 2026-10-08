import Link from "next/link";
import { ArrowLeft, Trophy } from "lucide-react";
import { getSession } from "@/lib/sessions";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/admin/page-header";
import { StatusBadge } from "@/components/admin/status-badge";
import { ExportMenu } from "@/components/admin/export-menu";
import { PredictionsTable } from "@/components/PredictionsTable";
import { LateEntriesTable } from "@/components/LateEntriesTable";

export const metadata = { title: "Predictions · Prediction Admin" };

export default async function PredictionsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await getSession(id);
  return (
    <div className="space-y-8">
      <div>
        <PageHeader
          title="Predictions"
          description={`${s.match.homeTeam} vs ${s.match.awayTeam} · ${s._count.predictions} prediction(s) · ${s._count.lateEntries} timed-out registration(s)`}
          badge={<StatusBadge status={s.effectiveStatus} />}
          actions={
            <>
              <ExportMenu sessionId={s.id} />
              <Button nativeButton={false} variant="outline" render={<Link href={`/admin/sessions/${s.id}/winners`} />}><Trophy data-icon="inline-start" /> Winners</Button>
              <Button nativeButton={false} variant="ghost" render={<Link href={`/admin/sessions/${s.id}`} />}><ArrowLeft data-icon="inline-start" /> Back</Button>
            </>
          }
        />
        <PredictionsTable session={s} winnersOnly={false} />
      </div>
      <LateEntriesTable session={s} />
    </div>
  );
}
