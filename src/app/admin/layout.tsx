import { getAdmin } from "@/lib/auth";
import { getSponsor } from "@/lib/sponsor";
import { AdminShell } from "@/components/admin/shell";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await getAdmin();
  if (!admin) return <>{children}</>;
  return (
    <AdminShell user={{ name: admin.name, email: admin.email, role: admin.role, avatarUrl: process.env.ADMIN_AVATAR_URL?.trim() || null }} sponsor={getSponsor()}>
      {children}
    </AdminShell>
  );
}
