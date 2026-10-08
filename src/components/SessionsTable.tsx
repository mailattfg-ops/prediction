"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Ban, Download, Eye, FileSpreadsheet, FileText, MoreHorizontal, Pencil, QrCode, Users } from "lucide-react";
import { api, ApiClientError } from "@/components/api";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { StatusBadge } from "@/components/admin/status-badge";
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
  const [cancelling, setCancelling] = useState<SessionRowView | null>(null);
  const [busy, setBusy] = useState(false);

  async function cancel() {
    if (!cancelling) return;
    setBusy(true);
    try {
      await api(`/api/sessions/${cancelling.id}/cancel`, { method: "POST" });
      toast.success(`Session for ${cancelling.match} cancelled.`);
      setCancelling(null);
      router.refresh();
    } catch (e) {
      toast.error((e as ApiClientError).message);
    } finally {
      setBusy(false);
    }
  }

  if (!rows.length) {
    return (
      <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
        No sessions yet.{" "}
        <Link href="/admin/sessions/new" className="font-medium text-primary underline-offset-4 hover:underline">
          Create the first one
        </Link>
        .
      </div>
    );
  }

  return (
    <>
      <div className="overflow-hidden rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Match</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Window</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Predictions</TableHead>
              <TableHead className="w-[1%]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell>
                  <Link href={`/admin/sessions/${r.id}`} className="font-medium hover:underline">{r.match}</Link>
                  {r.campaign && <div className="text-xs text-muted-foreground">{r.campaign}</div>}
                </TableCell>
                <TableCell className="whitespace-nowrap">{r.date}</TableCell>
                <TableCell className="whitespace-nowrap tabular-nums">
                  {r.start} <span className="text-muted-foreground">→</span> {r.expiry}
                </TableCell>
                <TableCell><StatusBadge status={r.status} /></TableCell>
                <TableCell className="text-right font-semibold tabular-nums">
                  {r.predictions}
                  {r.late > 0 && <span className="ml-1 text-xs font-normal text-muted-foreground" title="Timed-out registrations">+{r.late} late</span>}
                </TableCell>
                <TableCell>
                  <div className="flex items-center justify-end gap-1">
                    <Button nativeButton={false} variant="ghost" size="icon-sm" render={<Link href={`/admin/sessions/${r.id}/qr`} aria-label="QR code" />}>
                      <QrCode />
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label="Actions" />}>
                        <MoreHorizontal />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-52">
                        <DropdownMenuItem render={<Link href={`/admin/sessions/${r.id}`} />}><Eye /> View</DropdownMenuItem>
                        <DropdownMenuItem render={<Link href={`/admin/sessions/${r.id}/edit`} />}><Pencil /> Edit</DropdownMenuItem>
                        <DropdownMenuItem render={<Link href={`/admin/sessions/${r.id}/predictions`} />}><Users /> Predictions</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem render={<a href={`/api/sessions/${r.id}/qr?format=png`} />}><Download /> Download QR (PNG)</DropdownMenuItem>
                        <DropdownMenuItem render={<a href={`/api/sessions/${r.id}/export?format=csv`} />}><FileText /> Export CSV</DropdownMenuItem>
                        <DropdownMenuItem render={<a href={`/api/sessions/${r.id}/export?format=xlsx`} />}><FileSpreadsheet /> Export Excel</DropdownMenuItem>
                        {r.canCancel && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem variant="destructive" onClick={() => setCancelling(r)}><Ban /> Cancel session</DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <AlertDialog open={!!cancelling} onOpenChange={(o) => !o && !busy && setCancelling(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel this session?</AlertDialogTitle>
            <AlertDialogDescription>
              The QR code for <strong>{cancelling?.match}</strong> will stop accepting predictions immediately. Existing predictions are kept.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Keep it</AlertDialogCancel>
            <AlertDialogAction variant="destructive" disabled={busy} onClick={cancel}>
              {busy ? "Cancelling…" : "Cancel session"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
