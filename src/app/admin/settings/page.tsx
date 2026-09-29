import { AdminSettings } from "@/components/admin-settings";
import { publicConfig, qrConfig } from "@/lib/env";
export default function SettingsPage() {
  return <AdminSettings config={publicConfig()} qr={qrConfig()} />;
}
