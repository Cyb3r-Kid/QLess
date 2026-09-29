import { browserSession } from "@/lib/session";
import { apiError, json, sameOrigin } from "@/lib/http";
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    await browserSession();
    return json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
