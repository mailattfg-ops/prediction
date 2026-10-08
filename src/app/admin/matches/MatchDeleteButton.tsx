"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiClientError } from "@/components/api";
import { Modal } from "@/components/Modal";
import { Alert, Button, Input } from "@/components/ui";

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
      <button type="button" className="text-rose-700 hover:underline" onClick={openDialog}>
        Delete
      </button>
      <Modal open={open} title="Delete match" onClose={() => (busy ? undefined : setOpen(false))}>
        <div className="space-y-3 text-sm text-slate-700">
          <p>
            You are about to permanently delete <strong>{label}</strong>. This will also delete:
          </p>
          {usage ? (
            <ul className="list-disc space-y-0.5 pl-5">
              <li>{usage.sessions} prediction session(s) and their QR codes</li>
              <li>{usage.predictions} prediction(s)</li>
              <li>{usage.lateEntries} timed-out registration(s)</li>
              <li>the match result and the WhatsApp notification logs of these sessions</li>
            </ul>
          ) : (
            <p className="text-slate-500">Loading what will be deleted…</p>
          )}
          <p>
            Participant identities are kept for other sessions. <strong>This cannot be undone.</strong>
          </p>
          <label className="block">
            <span className="mb-1 block font-medium">
              Type <code className="rounded bg-slate-100 px-1.5 py-0.5 text-rose-700">{label}</code> to confirm
            </span>
            <Input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={label} autoFocus autoComplete="off" />
          </label>
          {error && <Alert>{error}</Alert>}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button variant="danger" onClick={remove} disabled={!confirmed || busy || !usage}>
              {busy ? "Deleting…" : "I understand, delete this match"}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
