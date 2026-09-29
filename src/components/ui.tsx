"use client";
import Link from "next/link";
import { ArrowUpRight, LoaderCircle, Radio, WifiOff } from "lucide-react";
import type { Connection } from "@/hooks/use-live-queue";
export function Brand({ light = false }: { light?: boolean }) {
  return (
    <Link
      href="/"
      className={`brand ${light ? "brand-light" : ""}`}
      aria-label="Qless home"
    >
      <span className="brand-mark">
        q<span />
      </span>
      qless<span className="brand-period">.</span>
    </Link>
  );
}
export function LiveBadge({ connection }: { connection: Connection }) {
  const label =
    connection === "live"
      ? "Live"
      : connection === "polling"
        ? "Live · 2s updates"
        : connection === "offline"
          ? "Reconnecting…"
          : "Connecting…";
  return (
    <span
      className={`live-badge ${connection === "offline" ? "is-offline" : ""}`}
      role="status"
    >
      {connection === "offline" ? (
        <WifiOff size={12} />
      ) : (
        <span className="live-dot" />
      )}
      {label}
    </span>
  );
}
export function Loading({
  text = "Connecting to the queue…",
}: {
  text?: string;
}) {
  return (
    <div className="loading-state" role="status">
      <LoaderCircle size={25} className="spinner" />
      <p>{text}</p>
    </div>
  );
}
export function ErrorNotice({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="error-notice" role="alert">
      <WifiOff size={18} />
      <span>{message}</span>
      {onRetry && (
        <button className="text-button" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  );
}
export function Footer() {
  return (
    <footer className="site-footer">
      <span>Less waiting. More living.</span>
      <span>
        Made for your campus <ArrowUpRight size={13} />
      </span>
    </footer>
  );
}
export function CounterPill() {
  return (
    <span className="counter-pill">
      <Radio size={13} /> Counter 01
    </span>
  );
}
