import { DatabaseZap, LockOpen } from "lucide-react";
import { authDisabled, getAdmin } from "@/lib/auth";
import { checkHealth } from "@/lib/health";
import { getSponsor } from "@/lib/sponsor";
import { AdminShell } from "@/components/admin/shell";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  let admin;
  try {
    admin = await getAdmin();
  } catch {
    // Open access needs the database for the admin account; explain what is missing instead of crashing.
    const { hints } = await checkHealth();
    return <SetupNeeded hints={hints.length ? hints : ["The database did not answer. Refresh in a moment."]} />;
  }
  if (!admin) return <>{children}</>;
  const open = authDisabled();
  return (
    <AdminShell user={{ name: admin.name, email: admin.email, role: admin.role }} sponsor={getSponsor()} openAccess={open}>
      {open && (
        <div className="no-print mb-6 flex items-start gap-3 rounded-xl border border-amber-300/60 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <LockOpen className="mt-0.5 size-4 shrink-0" />
          <div>
            <strong>Login is switched off.</strong> Anyone with this address can use the console and see participant details. Set
            AUTH_DISABLED=false and redeploy to require the admin login again.
          </div>
        </div>
      )}
      {children}
    </AdminShell>
  );
}

function SetupNeeded({ hints }: { hints: string[] }) {
  return (
    <main className="mx-auto w-full max-w-xl px-4 py-16">
      <div className="rounded-2xl border bg-card p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
            <DatabaseZap className="size-5" />
          </span>
          <div>
            <h1 className="font-display text-3xl leading-none tracking-wide">Setup needed</h1>
            <p className="text-sm text-muted-foreground">The admin console cannot open until this is fixed.</p>
          </div>
        </div>
        <ul className="mt-5 list-disc space-y-2 pl-5 text-sm">
          {hints.map((h) => (
            <li key={h}>{h}</li>
          ))}
        </ul>
        <p className="mt-5 text-xs text-muted-foreground">
          Live status: <a className="underline underline-offset-2" href="/api/health">/api/health</a>
        </p>
      </div>
    </main>
  );
}
