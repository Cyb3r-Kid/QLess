import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { PGlite } from "@electric-sql/pglite";
import { localMode } from "./env";

const globalDb = globalThis as unknown as { qlessDb?: Promise<PGlite> };
async function localDb() {
  if (!globalDb.qlessDb) {
    globalDb.qlessDb = (async () => {
      const { PGlite } = await import("@electric-sql/pglite");
      const { readFile, mkdir } = await import("node:fs/promises");
      const { join } = await import("node:path");
      await mkdir(join(process.cwd(), ".qless"), { recursive: true });
      const db = new PGlite(join(process.cwd(), ".qless", "pgdata"));
      await db.waitReady;
      const check = await db.query<{ exists: string | null }>(
        "select to_regclass('public.canteens')::text as exists",
      );
      if (!check.rows[0].exists)
        await db.exec(
          await readFile(
            join(process.cwd(), "supabase/migrations/001_qless.sql"),
            "utf8",
          ),
        );
      return db;
    })();
    globalDb.qlessDb.catch(() => {
      globalDb.qlessDb = undefined;
    });
  }
  return globalDb.qlessDb;
}
const rpcParams = {
  qless_join: ["p_browser"],
  qless_action: ["p_action", "p_session", "p_expected", "p_value"],
  qless_snapshot: ["p_token"],
  qless_auth_attempt: ["p_key"],
} as const;
export async function rpc<T>(
  name: keyof typeof rpcParams,
  args: Record<string, unknown>,
): Promise<T> {
  if (localMode()) {
    const db = await localDb();
    const values = rpcParams[name].map((key) => args[key] ?? null);
    // Function identifiers come only from this fixed whitelist; values are parameterized.
    const result = await db.query<{ result: T }>(
      `select public.${name}(${values.map((_, i) => `$${i + 1}`).join(",")}) as result`,
      values,
    );
    return result.rows[0].result;
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("MISSING_CONFIG");
  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.rpc(name, args);
  if (error) throw new Error(error.message);
  return data as T;
}
