import { rpc } from "@/lib/db";
import { isAdmin } from "@/lib/session";
import { apiError, json, uuidPattern } from "@/lib/http";
import { metrics, studentView } from "@/lib/queue";
import type { Snapshot } from "@/lib/types";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    const query = new URL(request.url).searchParams;
    const tokenId = query.get("token");
    const admin = query.get("admin") === "1";
    if (admin && !(await isAdmin())) throw new Error("UNAUTHORIZED");
    if (tokenId && !uuidPattern.test(tokenId))
      throw new Error("TOKEN_NOT_FOUND");
    const snapshot = await rpc<Snapshot>("qless_snapshot", {
      p_token: tokenId ?? null,
    });
    if (tokenId) {
      const token = snapshot.tokens.find((t) => t.id === tokenId);
      if (!token) throw new Error("TOKEN_NOT_FOUND");
      return json(studentView(snapshot, token));
    }
    const serving = snapshot.tokens.find((t) => t.status === "SERVING") ?? null;
    if (admin)
      return json({
        observedAt: Date.now(),
        session: snapshot.session,
        settings: snapshot.settings,
        tokens: snapshot.tokens,
        serving,
        metrics: metrics(snapshot),
        ...(query.get("history") === "1" ? { history: snapshot.history } : {}),
      });
    // Public queue summary deliberately omits UUIDs, history, and anonymous identifiers.
    return json({
      status: snapshot.session.status,
      waiting: metrics(snapshot).waiting,
      serving: serving?.display_token ?? null,
      etaSeconds: metrics(snapshot).waiting * metrics(snapshot).serviceSeconds,
    });
  } catch (error) {
    return apiError(error);
  }
}
