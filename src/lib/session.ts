import "server-only";
import { createHmac, timingSafeEqual, randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { sessionSecret } from "./env";

const sign = (payload: string) =>
  createHmac("sha256", sessionSecret()).update(payload).digest("base64url");
export function seal(value: string, ttl: number) {
  const payload = Buffer.from(
    JSON.stringify({ value, exp: Date.now() + ttl * 1000 }),
  ).toString("base64url");
  return `${payload}.${sign(payload)}`;
}
export function unseal(cookie: string | undefined): string | null {
  if (!cookie) return null;
  try {
    const [payload, signature, extra] = cookie.split(".");
    if (!payload || !signature || extra) return null;
    const expected = Buffer.from(sign(payload));
    const supplied = Buffer.from(signature);
    if (
      expected.length !== supplied.length ||
      !timingSafeEqual(expected, supplied)
    )
      return null;
    const data = JSON.parse(Buffer.from(payload, "base64url").toString());
    return typeof data.value === "string" && data.exp > Date.now()
      ? data.value
      : null;
  } catch {
    return null;
  }
}
export const cookieOptions = (maxAge: number) => ({
  httpOnly: true,
  secure:
    !!process.env.VERCEL ||
    process.env.NEXT_PUBLIC_APP_URL?.startsWith("https://") === true,
  sameSite: "lax" as const,
  path: "/",
  maxAge,
});
export async function isAdmin() {
  return unseal((await cookies()).get("qless_admin")?.value) === "admin";
}
export async function browserSession() {
  const jar = await cookies();
  const existing = unseal(jar.get("qless_browser")?.value);
  if (existing && /^[0-9a-f-]{36}$/i.test(existing)) return existing;
  const id = randomUUID();
  jar.set(
    "qless_browser",
    seal(id, 60 * 60 * 24 * 365),
    cookieOptions(60 * 60 * 24 * 365),
  );
  return id;
}
export function pinMatches(pin: string) {
  const configured = process.env.ADMIN_PIN;
  if (!configured || configured.length < 4) throw new Error("MISSING_CONFIG");
  const hash = (value: string) =>
    createHmac("sha256", sessionSecret()).update(value).digest();
  return timingSafeEqual(hash(pin), hash(configured));
}
export function throttleKey(ip: string) {
  return createHmac("sha256", sessionSecret())
    .update(`login:${ip}`)
    .digest("hex");
}
