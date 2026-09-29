"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import type { LiveConfig } from "@/lib/types";
import { requestJson } from "@/lib/client-api";
export type Connection = "connecting" | "live" | "polling" | "offline";

export function useLiveQueue<T>(url: string, config: LiveConfig) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fatal, setFatal] = useState(false);
  const [connection, setConnection] = useState<Connection>("connecting");
  const refreshRef = useRef<() => Promise<void>>(async () => {});
  const refresh = useCallback(() => refreshRef.current(), []);
  useEffect(() => {
    let alive = true;
    let subscribed = false;
    let pending = false;
    let rerun = false;
    let terminal = false;
    let timer: ReturnType<typeof setTimeout>;
    const controller = new AbortController();
    const load = async () => {
      if (!alive || terminal) return;
      if (pending) {
        rerun = true;
        return;
      }
      pending = true;
      clearTimeout(timer);
      try {
        const next = await requestJson<T>(url, { signal: controller.signal });
        if (alive) {
          setData(next);
          setError(null);
          setFatal(false);
          setConnection(subscribed ? "live" : "polling");
        }
      } catch (err) {
        if (alive) {
          terminal = [401, 404].includes(
            (err as { status?: number }).status ?? 0,
          );
          setFatal(terminal);
          setError(
            err instanceof Error
              ? err.message
              : "Connection lost. Reconnecting…",
          );
          setConnection("offline");
        }
      } finally {
        pending = false;
        if (alive && !terminal) {
          // Realtime drives immediate updates. Poll every 2s when disconnected;
          // a 15s reconciliation also catches a lost websocket message.
          timer = setTimeout(load, rerun ? 0 : subscribed ? 15000 : 2000);
          rerun = false;
        }
      }
    };
    refreshRef.current = load;
    const client =
      !config.local && config.supabaseUrl && config.anonKey
        ? createClient(config.supabaseUrl, config.anonKey, {
            auth: { persistSession: false, autoRefreshToken: false },
          })
        : null;
    const channel = client
      ?.channel(`qless-${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "queue_signals" },
        () => {
          void load();
        },
      )
      .subscribe((status) => {
        subscribed = status === "SUBSCRIBED";
        if (alive) void load();
      });
    const onFocus = () => {
      if (document.visibilityState === "visible") void load();
    };
    document.addEventListener("visibilitychange", onFocus);
    window.addEventListener("online", load);
    void load();
    return () => {
      alive = false;
      controller.abort();
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onFocus);
      window.removeEventListener("online", load);
      if (channel) void client?.removeChannel(channel);
    };
  }, [url, config.local, config.supabaseUrl, config.anonKey]);
  return { data, error, fatal, connection, refresh };
}
