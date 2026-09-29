import { AdminHistory } from "@/components/admin-history";
import { publicConfig } from "@/lib/env";
export default function HistoryPage() {
  return <AdminHistory config={publicConfig()} />;
}
