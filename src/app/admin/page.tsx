import { AdminDashboard } from "@/components/admin-dashboard";
import { publicConfig } from "@/lib/env";
export default function AdminPage() {
  return <AdminDashboard config={publicConfig()} />;
}
