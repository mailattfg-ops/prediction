"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, ApiClientError } from "@/components/api";
import { Button, StatusBadge, Td, Th } from "@/components/ui";
import type { EffectiveStatus } from "@/lib/window";

export type SessionRowView = {
  id: string;
  match: string;
  campaign: string;
  date: string;
  start: string;
  expiry: string;
  status: EffectiveStatus;
  predictions: number;
  late: number;
  canCancel: boolean;
};

export function SessionsTable({ rows }: { rows: SessionRowView[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  async function cancel(row: SessionRowView) {
    if (!confirm(`Cancel the prediction session for ${row.match}? The QR code will stop accepting predictions.`)) return;
    setBusy(row.id);
    try {
      await api(`/api/sessions/${row.id}/cancel`, { method: "POST" });
      router.refresh();
    } catch (e) {
      alert((e as ApiClientError).message);
    } finally {
      setBusy(null);
    }
  }

  if (!rows.length) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-slate-500">
        No sessions yet. <Link href="/admin/sessions/new" className="text-emerald-700 underline">Create the first one</Link>.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <table className="min-w-full divide-y divide-slate-200">
        <thead className="bg-slate-50">
          <tr>
            <Th>Match</Th><Th>Date</Th><Th>Start</Th><Th>Expiry</Th><Th>Status</Th><Th>Predictions</Th><Th>QR</Th><Th>Actions</Th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((r) => (
            <tr key={r.id} className="hover:bg-slate-50">
              <Td>
                <Link href={`/admin/sessions/${r.id}`} className="font-medium text-slate-900 hover:underline">{r.match}</Link>
                {r.campaign && <div className="text-xs text-slate-500">{r.campaign}</div>}
              </Td>
              <Td>{r.date}</Td>
              <Td>{r.start}</Td>
              <Td>{r.expiry}</Td>
              <Td><StatusBadge status={r.status} /></Td>
              <Td className="font-semibold">
                {r.predictions}
                {r.late > 0 && <span className="ml-1 text-xs font-normal text-slate-500" title="Timed-out registrations (details only)">+{r.late} late</span>}
              </Td>
              <Td><Link href={`/admin/sessions/${r.id}/qr`} className="text-emerald-700 hover:underline">QR page</Link></Td>
              <Td>
                <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
                  <Link href={`/admin/sessions/${r.id}`} className="text-sky-700 hover:underline">View</Link>
                  <Link href={`/admin/sessions/${r.id}/edit`} className="text-sky-700 hover:underline">Edit</Link>
                  <a href={`/api/sessions/${r.id}/qr?format=png`} className="text-sky-700 hover:underline">Download QR</a>
                  <Link href={`/admin/sessions/${r.id}/predictions`} className="text-sky-700 hover:underline">Predictions</Link>
                  <a href={`/api/sessions/${r.id}/export?format=csv`} className="text-sky-700 hover:underline">Export CSV</a>
                  <a href={`/api/sessions/${r.id}/export?format=xlsx`} className="text-sky-700 hover:underline">Export Excel</a>
                  {r.canCancel && (
                    <Button variant="ghost" className="!px-1 !py-0 text-xs !text-rose-700" disabled={busy === r.id} onClick={() => cancel(r)}>
                      Cancel
                    </Button>
                  )}
                </div>
              </Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
