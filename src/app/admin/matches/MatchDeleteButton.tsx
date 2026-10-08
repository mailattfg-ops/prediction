"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2, TriangleAlert } from "lucide-react";
import { api, ApiClientError } from "@/components/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";

type Usage = { sessions: number; predictions: number; lateEntries: number };

/** GitHub-style destructive confirmation: the exact match name must be typed before Delete enables. */
export function MatchDeleteButton({ id, label }: { id: string; label: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [usage, setUsage] = useState<Usage | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const confirmed = typed.trim() === label;

  async function openDialog() {
    setTyped("");
    setError(null);
    setUsage(null);
    setOpen(true);
    try {
      const r = await api<{ usage: Usage }>(`/api/matches/${id}`);
      setUsage(r.usage);
    } catch (e) {
      setError((e as ApiClientError).message);
    }
  }

  async function remove() {
    setBusy(true);
    setError(null);
    try {
      await api(`/api/matches/${id}`, { method: "DELETE", body: { confirm: typed.trim() } });
      toast.success(`${label} deleted.`);
      setOpen(false);
      router.refresh();
    } catch (e) {
      setError((e as ApiClientError).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button variant="ghost" size="icon-sm" className="text-destructive hover:text-destructive" aria-label="Delete match" onClick={openDialog}>
        <Trash2 />
      </Button>
      <Dialog open={open} onOpenChange={(o) => !busy && setOpen(o)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete match</DialogTitle>
            <DialogDescription>
              You are about to permanently delete <strong className="text-foreground">{label}</strong>.
            </DialogDescription>
          </DialogHeader>
          <Alert variant="destructive">
            <TriangleAlert />
            <AlertTitle>This cannot be undone</AlertTitle>
            <AlertDescription>
              {usage ? (
                <ul className="list-disc pl-4">
                  <li>{usage.sessions} prediction session(s) and their QR codes</li>
                  <li>{usage.predictions} prediction(s)</li>
                  <li>{usage.lateEntries} timed-out registration(s)</li>
                  <li>the match result and the WhatsApp notification logs</li>
                </ul>
              ) : (
                <div className="space-y-1.5"><Skeleton className="h-3 w-48" /><Skeleton className="h-3 w-32" /><Skeleton className="h-3 w-40" /></div>
              )}
            </AlertDescription>
          </Alert>
          <div className="space-y-2">
            <Label htmlFor={`confirm-${id}`}>
              Type <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-destructive">{label}</code> to confirm
            </Label>
            <Input id={`confirm-${id}`} value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={label} autoComplete="off" autoFocus />
          </div>
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>Cancel</Button>
            <Button variant="destructive" onClick={remove} disabled={!confirmed || busy || !usage}>
              {busy ? "Deleting…" : "I understand, delete this match"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
