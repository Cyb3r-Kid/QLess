import { browserSession } from "@/lib/session";
import { rpc } from "@/lib/db";
import { apiError, json, sameOrigin } from "@/lib/http";
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const browser = await browserSession();
    return json(await rpc("qless_join", { p_browser: browser }));
  } catch (error) {
    return apiError(error);
  }
}
