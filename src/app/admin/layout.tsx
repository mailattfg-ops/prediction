import { LockOpen } from "lucide-react";
import { authDisabled, getAdmin } from "@/lib/auth";
import { getSponsor } from "@/lib/sponsor";
import { AdminShell } from "@/components/admin/shell";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await getAdmin();
  if (!admin) return <>{children}</>;
  const open = authDisabled();
  return (
    <AdminShell user={{ name: admin.name, email: admin.email, role: admin.role }} sponsor={getSponsor()} openAccess={open}>
      {open && (
        <div className="no-print mb-6 flex items-start gap-3 rounded-xl border border-amber-300/60 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <LockOpen className="mt-0.5 size-4 shrink-0" />
          <div>
            <strong>Login is switched off</strong> (AUTH_DISABLED=true). Anyone with this address can use the console and see participant
            details. Set AUTH_DISABLED=false and redeploy to require the admin login again.
          </div>
        </div>
      )}
      {children}
    </AdminShell>
  );
}
