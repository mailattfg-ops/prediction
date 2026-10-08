import Link from "next/link";
import { Pencil, Plus, QrCode } from "lucide-react";
import { listMatches } from "@/lib/matches";
import { fmtDateTime, outcomeLabel } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/admin/page-header";
import { MatchDeleteButton } from "./MatchDeleteButton";

export const metadata = { title: "Matches · Prediction Admin" };

export default async function MatchesPage() {
  const matches = await listMatches();
  return (
    <>
      <PageHeader
        title="Matches"
        description="Fixtures that sessions are built on. Teams are defined per match."
        actions={
          <Button nativeButton={false} render={<Link href="/admin/matches/new" />}>
            <Plus data-icon="inline-start" /> New match
          </Button>
        }
      />
      {matches.length === 0 ? (
        <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">No matches yet. Create the first fixture to start a session.</div>
      ) : (
        <div className="overflow-hidden rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Match</TableHead>
                <TableHead>Competition</TableHead>
                <TableHead>Kick-off</TableHead>
                <TableHead>Venue</TableHead>
                <TableHead className="text-right">Sessions</TableHead>
                <TableHead>Result</TableHead>
                <TableHead className="w-[1%]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {matches.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="font-medium">{m.homeTeam} vs {m.awayTeam}</TableCell>
                  <TableCell className="text-muted-foreground">{m.competition ?? "—"}</TableCell>
                  <TableCell className="whitespace-nowrap">{fmtDateTime(m.kickoffAt)}</TableCell>
                  <TableCell className="text-muted-foreground">{m.venue ?? "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">{m._count.sessions}</TableCell>
                  <TableCell>
                    {m.result && m.result.resultStatus === "FINAL" ? (
                      <Badge variant="secondary" className="bg-violet-500/15 text-violet-700">
                        {m.result.homeScore} - {m.result.awayScore} · {outcomeLabel(m.result.winningOutcome, m)}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      <Button nativeButton={false} variant="outline" size="sm" render={<Link href={`/admin/sessions/new?matchId=${m.id}`} />}>
                        <QrCode data-icon="inline-start" /> New session
                      </Button>
                      <Button nativeButton={false} variant="ghost" size="icon-sm" render={<Link href={`/admin/matches/${m.id}/edit`} aria-label="Edit match" />}>
                        <Pencil />
                      </Button>
                      <MatchDeleteButton id={m.id} label={`${m.homeTeam} vs ${m.awayTeam}`} />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </>
  );
}
