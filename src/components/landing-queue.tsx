"use client";
import { ArrowUpRight, MapPin } from "lucide-react";
import { useLiveQueue } from "@/hooks/use-live-queue";
import { formatWait } from "@/lib/queue";
import type { LiveConfig } from "@/lib/types";
import { LiveBadge } from "./ui";
export function LandingQueue({ config }: { config: LiveConfig }) {
  const { data, connection, error } = useLiveQueue<{
    waiting: number;
    serving: string | null;
    status: string;
    etaSeconds: number;
  }>("/api/queue", config);
  return (
    <section id="live-queue" className="landing-live">
      <div>
        <span className="eyebrow">
          <MapPin size={13} /> RIGHT HERE ON CAMPUS
        </span>
        <h2>
          Sathyabama Canteen <ArrowUpRight size={23} />
        </h2>
        <p>
          {error
            ? "Live queue unavailable. The counter will be back shortly."
            : "A little heads-up before you head over."}
        </p>
      </div>
      <div className="landing-live-stats">
        <LiveBadge connection={connection} />
        <div>
          <span>Waiting</span>
          <strong>{data?.waiting ?? "—"}</strong>
        </div>
        <div>
          <span>Estimated wait</span>
          <strong>{data ? `~${formatWait(data.etaSeconds)}` : "—"}</strong>
        </div>
        <span className="status-pill">{data?.status ?? "Connecting"}</span>
      </div>
    </section>
  );
}
