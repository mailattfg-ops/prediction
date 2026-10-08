"use client";
import { useRouter } from "next/navigation";
import { api } from "@/components/api";

export function LogoutButton() {
  const router = useRouter();
  return (
    <button
      type="button"
      className="rounded-md border border-slate-600 px-3 py-1 text-slate-200 hover:bg-slate-800"
      onClick={async () => {
        await api("/api/auth/logout", { method: "POST" });
        router.push("/admin/login");
        router.refresh();
      }}
    >
      Logout
    </button>
  );
}
