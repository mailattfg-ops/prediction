"use client";
import { useRouter } from "next/navigation";
import { api, ApiClientError } from "@/components/api";

export function MatchDeleteButton({ id, label }: { id: string; label: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      className="text-rose-700 hover:underline"
      onClick={async () => {
        if (!confirm(`Delete match ${label}?`)) return;
        try {
          await api(`/api/matches/${id}`, { method: "DELETE" });
          router.refresh();
        } catch (e) {
          alert((e as ApiClientError).message);
        }
      }}
    >
      Delete
    </button>
  );
}
