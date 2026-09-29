import "server-only";
import type { LiveConfig } from "./types";

export function localMode() {
  if (process.env.QLESS_LOCAL_DB === "true" && process.env.VERCEL)
    throw new Error("LOCAL_DB_ON_VERCEL");
  return process.env.QLESS_LOCAL_DB === "true";
}
export function sessionSecret() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error("MISSING_CONFIG");
  return secret;
}
export function publicConfig(): LiveConfig {
  return {
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
    local: process.env.QLESS_LOCAL_DB === "true" && !process.env.VERCEL,
  };
}
export function qrConfig() {
  const raw = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (!raw)
    return {
      url: null,
      warning:
        "Set NEXT_PUBLIC_APP_URL to your public site URL or laptop’s network address to generate a QR code.",
    };
  try {
    const url = new URL(raw);
    if (
      !["https:", "http:"].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.pathname !== "/" ||
      url.search ||
      url.hash
    )
      throw new Error();
    if (["localhost", "127.0.0.1", "0.0.0.0", "[::1]"].includes(url.hostname)) {
      return {
        url: null,
        warning:
          "This QR may not be accessible from another device. Set NEXT_PUBLIC_APP_URL to your laptop’s network IP or public domain; a localhost QR is disabled.",
      };
    }
    return { url: `${url.origin}/join/canteen`, warning: null };
  } catch {
    return {
      url: null,
      warning:
        "NEXT_PUBLIC_APP_URL must be a complete http:// or https:// origin without a path.",
    };
  }
}
