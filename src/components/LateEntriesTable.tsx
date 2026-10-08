import { listLateEntries, type SessionWithStatus } from "@/lib/sessions";
import { fmtDateTime } from "@/lib/format";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

/** Participants who scanned after the window closed: details only, no prediction, never evaluated. */
export async function LateEntriesTable({ session }: { session: SessionWithStatus }) {
  const rows = await listLateEntries(session.id);
  if (!rows.length && !session.collectLateEntries) return null;
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold">Timed-out registrations ({rows.length})</h2>
        <p className="text-sm text-muted-foreground">Scanned after the prediction window closed. Details were kept; no prediction or score was recorded.</p>
      </div>
      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">No timed-out registrations.</div>
      ) : (
        <div className="overflow-hidden rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">#</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Mobile</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Submitted</TableHead>
                {session.fields.map((f) => <TableHead key={f.key}>{f.label}</TableHead>)}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((e, i) => {
                const custom = (e.customData ?? {}) as Record<string, unknown>;
                return (
                  <TableRow key={e.id}>
                    <TableCell className="text-muted-foreground tabular-nums">{i + 1}</TableCell>
                    <TableCell className="font-medium">{e.participant.fullName}</TableCell>
                    <TableCell className="tabular-nums">{e.participant.mobile}</TableCell>
                    <TableCell className="text-muted-foreground">{e.participant.email}</TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">{fmtDateTime(e.submittedAt)}</TableCell>
                    {session.fields.map((f) => <TableCell key={f.key}>{custom[f.key] == null ? "—" : String(custom[f.key])}</TableCell>)}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </section>
  );
}
