import { isAdmin } from "@/lib/session";
import { rpc } from "@/lib/db";
import { apiError, json, sameOrigin, uuidPattern } from "@/lib/http";
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    if (!(await isAdmin())) throw new Error("UNAUTHORIZED");
    const { action, session, expected, value = {} } = await request.json();
    if (
      typeof action !== "string" ||
      ![
        "advance",
        "skip",
        "status",
        "new_session",
        "demo",
        "clear_demo",
        "settings",
      ].includes(action) ||
      typeof session !== "string" ||
      !uuidPattern.test(session) ||
      (expected != null &&
        (typeof expected !== "string" || !uuidPattern.test(expected)))
    )
      throw new Error("INVALID_INPUT");
    if (
      action === "settings" &&
      (!Number.isInteger(value.default_service_seconds) ||
        value.default_service_seconds < 10 ||
        value.default_service_seconds > 3600 ||
        !Number.isInteger(value.almost_turn_threshold) ||
        value.almost_turn_threshold < 2 ||
        value.almost_turn_threshold > 10)
    )
      throw new Error("INVALID_INPUT");
    return json(
      await rpc("qless_action", {
        p_action: action,
        p_session: session,
        p_expected: expected ?? null,
        p_value: value,
      }),
    );
  } catch (error) {
    return apiError(error);
  }
}
