"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, ApiClientError } from "@/components/api";
import { Button } from "@/components/ui";

export function SessionActions({ id, canCancel }: { id: string; canCancel: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function run(label: string, path: string, method: string, after?: () => void) {
    if (!confirm(label)) return;
    setBusy(true);
    try {
      await api(path, { method });
      if (after) after();
      else router.refresh();
    } catch (e) {
      alert((e as ApiClientError).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      {canCancel && (
        <Button variant="danger" disabled={busy} onClick={() => run("Cancel this session? The QR code will stop accepting predictions.", `/api/sessions/${id}/cancel`, "POST")}>
          Cancel session
        </Button>
      )}
      <Button variant="ghost" disabled={busy} className="!text-rose-700" onClick={() => run("Archive this session? It disappears from lists and the QR stops working. Data is kept.", `/api/sessions/${id}`, "DELETE", () => { router.push("/admin"); router.refresh(); })}>
        Archive
      </Button>
    </>
  );
}
