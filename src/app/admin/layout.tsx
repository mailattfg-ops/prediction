import { getAdmin } from "@/lib/auth";
import { AdminShell } from "@/components/admin/shell";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await getAdmin();
  if (!admin) return <>{children}</>;
  return <AdminShell user={{ name: admin.name, email: admin.email, role: admin.role }}>{children}</AdminShell>;
}
