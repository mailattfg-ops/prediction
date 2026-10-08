"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Archive, Ban } from "lucide-react";
import { api, ApiClientError } from "@/components/api";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export function SessionActions({ id, canCancel }: { id: string; canCancel: boolean }) {
  const router = useRouter();
  const [dialog, setDialog] = useState<"cancel" | "archive" | null>(null);
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    try {
      if (dialog === "cancel") {
        await api(`/api/sessions/${id}/cancel`, { method: "POST" });
        toast.success("Session cancelled.");
        setDialog(null);
        router.refresh();
      } else {
        await api(`/api/sessions/${id}`, { method: "DELETE" });
        toast.success("Session archived.");
        router.push("/admin/sessions");
        router.refresh();
      }
    } catch (e) {
      toast.error((e as ApiClientError).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {canCancel && (
        <Button variant="outline" className="text-destructive" onClick={() => setDialog("cancel")}>
          <Ban data-icon="inline-start" /> Cancel session
        </Button>
      )}
      <Button variant="ghost" className="text-muted-foreground" onClick={() => setDialog("archive")}>
        <Archive data-icon="inline-start" /> Archive
      </Button>
      <AlertDialog open={dialog !== null} onOpenChange={(o) => !o && !busy && setDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{dialog === "cancel" ? "Cancel this session?" : "Archive this session?"}</AlertDialogTitle>
            <AlertDialogDescription>
              {dialog === "cancel"
                ? "The QR code stops accepting predictions immediately. Existing predictions are kept."
                : "The session disappears from all lists and its QR code stops working. Data is kept for audit."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Back</AlertDialogCancel>
            <AlertDialogAction variant="destructive" disabled={busy} onClick={run}>
              {busy ? "Working…" : dialog === "cancel" ? "Cancel session" : "Archive"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
