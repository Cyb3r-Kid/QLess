import { cookies } from "next/headers";
import { apiError, json, sameOrigin } from "@/lib/http";
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    (await cookies()).delete("qless_admin");
    return json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
