import Link from "next/link";
import { Plus } from "lucide-react";
import { listMatches } from "@/lib/matches";
import { fmtDateTime } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/admin/page-header";
import { SessionForm } from "../SessionForm";

export const metadata = { title: "New session · Prediction Admin" };

export default async function NewSessionPage({ searchParams }: { searchParams: Promise<{ matchId?: string }> }) {
  const { matchId } = await searchParams;
  const matches = (await listMatches()).map((m) => ({ id: m.id, label: `${m.homeTeam} vs ${m.awayTeam} · ${fmtDateTime(m.kickoffAt)}` }));
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="New prediction session" description="One session = one QR code = one prediction window." />
      {matches.length === 0 ? (
        <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
          Create a match first.
          <div className="mt-3">
            <Button nativeButton={false} render={<Link href="/admin/matches/new" />}><Plus data-icon="inline-start" /> New match</Button>
          </div>
        </div>
      ) : (
        <SessionForm matches={matches} defaultMatchId={matchId} />
      )}
    </div>
  );
}
