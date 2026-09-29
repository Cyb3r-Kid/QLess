"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { LiveConfig, QueueAction, QueueView } from "@/lib/types";
import { requestJson } from "@/lib/client-api";
import { useLiveQueue } from "./use-live-queue";
export function useAdmin(config: LiveConfig, history = false) {
  const live = useLiveQueue<QueueView>(
    `/api/queue?admin=1${history ? "&history=1" : ""}`,
    config,
  );
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const lock = useRef(false);
  const router = useRouter();
  async function act(action: QueueAction, value: Record<string, unknown> = {}) {
    if (!live.data || lock.current) return;
    lock.current = true;
    setBusy(true);
    setActionError(null);
    setNotice(null);
    try {
      await requestJson("/api/admin/action", {
        method: "POST",
        body: JSON.stringify({
          action,
          session: live.data.session.id,
          expected: live.data.serving?.id ?? null,
          value,
        }),
      });
      setNotice(
        {
          advance: "Queue updated. All token screens will follow.",
          skip: "Token skipped. Next token called.",
          status: "Queue admissions updated.",
          new_session: "New queue started. Previous history is saved.",
          demo: "Demo ready: Q-001 is serving, Q-002–Q-005 are waiting.",
          clear_demo: "Active demo tokens cleared. Their history is preserved.",
          settings: "Settings saved.",
        }[action],
      );
      await live.refresh();
    } catch (err) {
      if ((err as { status?: number }).status === 401) router.refresh();
      setActionError((err as Error).message);
      await live.refresh();
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return { ...live, busy, notice, actionError, act };
}
