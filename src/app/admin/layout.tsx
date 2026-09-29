import { isAdmin } from "@/lib/session";
import { AdminLogin } from "@/components/admin-login";
import { AdminShell } from "@/components/admin-shell";
export const dynamic = "force-dynamic";
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!(await isAdmin())) return <AdminLogin />;
  return <AdminShell>{children}</AdminShell>;
}
