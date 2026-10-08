import { listLateEntries, type SessionWithStatus } from "@/lib/sessions";
import { fmtDateTime } from "@/lib/format";
import { Td, Th } from "@/components/ui";

/** Participants who scanned after the window closed: details only, no prediction, never evaluated. */
export async function LateEntriesTable({ session }: { session: SessionWithStatus }) {
  const rows = await listLateEntries(session.id);
  if (!rows.length && !session.collectLateEntries) return null;
  return (
    <section className="space-y-2">
      <div>
        <h2 className="text-lg font-semibold">Timed-out registrations ({rows.length})</h2>
        <p className="text-sm text-slate-500">Scanned after the prediction window closed. Details were kept; no prediction or score was recorded.</p>
      </div>
      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">No timed-out registrations.</div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <Th>#</Th><Th>Name</Th><Th>Mobile</Th><Th>Email</Th><Th>Submitted At</Th>
                {session.fields.map((f) => <Th key={f.key}>{f.label}</Th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((e, i) => {
                const custom = (e.customData ?? {}) as Record<string, unknown>;
                return (
                  <tr key={e.id} className="hover:bg-slate-50">
                    <Td className="text-slate-400">{i + 1}</Td>
                    <Td className="font-medium">{e.participant.fullName}</Td>
                    <Td>{e.participant.mobile}</Td>
                    <Td>{e.participant.email}</Td>
                    <Td>{fmtDateTime(e.submittedAt)}</Td>
                    {session.fields.map((f) => <Td key={f.key}>{custom[f.key] == null ? "—" : String(custom[f.key])}</Td>)}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
