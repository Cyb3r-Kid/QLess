import { StudentToken } from "@/components/student-token";
import { publicConfig } from "@/lib/env";
export const dynamic = "force-dynamic";
export default async function TokenPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <StudentToken id={id} config={publicConfig()} />;
}
