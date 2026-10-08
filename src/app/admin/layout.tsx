import Link from "next/link";
import { getAdmin } from "@/lib/auth";
import { LogoutButton } from "./LogoutButton";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await getAdmin();
  if (!admin) return <>{children}</>;
  return (
    <div className="min-h-screen">
      <header className="no-print bg-slate-900 text-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <nav className="flex flex-wrap items-center gap-4 text-sm">
            <Link href="/admin" className="text-base font-bold">⚽ Prediction Admin</Link>
            <Link href="/admin" className="text-slate-300 hover:text-white">Dashboard</Link>
            <Link href="/admin/matches" className="text-slate-300 hover:text-white">Matches</Link>
            <Link href="/admin/sessions/new" className="rounded-md bg-emerald-600 px-3 py-1 font-medium hover:bg-emerald-500">+ New Session</Link>
          </nav>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-slate-300">{admin.name} · {admin.role === "SUPER_ADMIN" ? "Super Admin" : "Admin"}</span>
            <LogoutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
    </div>
  );
}
