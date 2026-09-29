import { cookies } from "next/headers";
import { cookieOptions, pinMatches, seal, throttleKey } from "@/lib/session";
import { apiError, json, sameOrigin } from "@/lib/http";
import { rpc } from "@/lib/db";
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const body = await request.json();
    if (typeof body.pin !== "string" || body.pin.length > 128)
      throw new Error("INVALID_INPUT");
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "local";
    const allowed = await rpc<boolean>("qless_auth_attempt", {
      p_key: throttleKey(ip),
    });
    if (!allowed)
      return json(
        {
          error:
            "Too many attempts. Please wait 10 minutes before trying again.",
        },
        429,
      );
    if (!pinMatches(body.pin))
      return json({ error: "That PIN isn’t right. Please try again." }, 401);
    (await cookies()).set(
      "qless_admin",
      seal("admin", 12 * 3600),
      cookieOptions(12 * 3600),
    );
    return json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
