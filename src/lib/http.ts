import { NextResponse } from "next/server";
export function json(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { "Cache-Control": "no-store, private" },
  });
}
export function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) throw new Error("BAD_ORIGIN");
  const actual = new URL(request.url);
  // Next's listen address may be 0.0.0.0 while the browser uses localhost or
  // a Wi-Fi IP. Host represents the requested site; browsers cannot forge it.
  const host = request.headers.get("host") ?? actual.host;
  const protocol =
    request.headers.get("x-forwarded-proto")?.split(",")[0] ??
    actual.protocol.slice(0, -1);
  const siteOrigin = `${protocol}://${host}`;
  const configured = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  if (origin !== siteOrigin && origin !== configured)
    throw new Error("BAD_ORIGIN");
}
const errors: Record<string, [number, string]> = {
  QUEUE_CLOSED: [
    409,
    "The queue is currently closed. Please check back when the canteen opens.",
  ],
  QUEUE_PAUSED: [
    409,
    "The queue is taking a short pause. Please try again in a moment.",
  ],
  NO_SESSION: [503, "The counter is getting ready. Please try again shortly."],
  TOKEN_NOT_FOUND: [
    404,
    "We couldn’t find this token. Scan the canteen QR code to get started.",
  ],
  STALE_ACTION: [
    409,
    "The queue has already moved forward. Your dashboard is refreshing.",
  ],
  STALE_SESSION: [
    409,
    "A new queue has started. Your dashboard is refreshing.",
  ],
  NOT_SERVING: [409, "There is no token being served yet."],
  DEMO_NEEDS_EMPTY_SESSION: [
    409,
    "Start a new queue before loading the five demo tokens.",
  ],
  MISSING_CONFIG: [
    503,
    "Qless needs a little setup. Ask the operator to check the environment settings.",
  ],
  LOCAL_DB_ON_VERCEL: [
    503,
    "Connect Supabase and disable local database mode for deployment.",
  ],
  UNAUTHORIZED: [401, "Please sign in to continue."],
  BAD_ORIGIN: [
    403,
    "This request could not be verified. Please reopen Qless and try again.",
  ],
  INVALID_INPUT: [400, "Please check the values and try again."],
  INVALID_ACTION: [400, "That queue action is not available."],
};
export function apiError(error: unknown) {
  const code = error instanceof Error ? error.message : "";
  const known = errors[code];
  if (!known)
    console.error(
      "Qless request failed:",
      error instanceof Error ? error.message : "Unknown error",
    );
  return json(
    {
      error:
        known?.[1] ??
        "We can’t reach the queue right now. Please try again shortly.",
      code: known ? code : "UNAVAILABLE",
    },
    known?.[0] ?? 503,
  );
}
export const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
