"use client";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import {
  ArrowRight,
  Check,
  Clock3,
  Coffee,
  QrCode,
  SkipForward,
  Sparkles,
  Users,
  TrendingUp,
} from "lucide-react";
import type { LiveConfig } from "@/lib/types";
import { formatWait, timeLabel } from "@/lib/queue";
import { useAdmin } from "@/hooks/use-admin";
import { CounterPill, ErrorNotice, LiveBadge, Loading } from "./ui";
export function AdminDashboard({ config }: { config: LiveConfig }) {
  const {
    data,
    error,
    connection,
    refresh,
    busy,
    notice,
    actionError,
    act,
    fatal,
  } = useAdmin(config);
  const reduced = useReducedMotion();
  const waiting = data?.tokens.filter((t) => t.status === "WAITING") ?? [];
  const demo = data?.tokens.some(
    (t) => t.is_demo && ["WAITING", "SERVING"].includes(t.status),
  );
  return (
    <main>
      <div className="page-heading">
        <div>
          <div className="eyebrow">YOUR COUNTER, AT A GLANCE</div>
          <h1>
            A smoother break starts here<span>.</span>
          </h1>
          <p>Keep the queue moving. Give everyone their time back.</p>
        </div>
        <Link href="/admin/display" className="button button-primary">
          <QrCode size={18} /> Show QR <ArrowRight size={16} />
        </Link>
      </div>
      {(error || actionError) && (
        <ErrorNotice
          message={actionError ?? error!}
          onRetry={fatal ? () => window.location.reload() : refresh}
        />
      )}
      {notice && (
        <div className="toast" role="status">
          <Check size={16} />
          {notice}
        </div>
      )}
      {!data && !error && <Loading />}
      {data && (
        <>
          <div className="dashboard-status">
            <div>
              <span
                className={`status-pill status-${data.session.status.toLowerCase()}`}
              >
                <span className="live-dot" /> Queue{" "}
                {data.session.status.toLowerCase()}
              </span>
              <span className="muted small">Counter 01</span>
              {demo && (
                <span className="demo-badge">
                  <Sparkles size={11} /> Demo data
                </span>
              )}
              {config.local && (
                <span className="local-label">Local demo database</span>
              )}
            </div>
            <LiveBadge connection={connection} />
          </div>
          <section className="stats-grid" aria-label="Queue statistics">
            {[
              {
                label: "Waiting in line",
                value: data.metrics.waiting,
                sub: "Tokens in this queue",
                icon: Users,
              },
              {
                label: "Average wait",
                value: formatWait(data.metrics.averageWait),
                sub: "Completed today · real tokens",
                icon: Clock3,
              },
              {
                label: "Served today",
                value: data.metrics.served,
                sub: "Breaks made a little better",
                icon: Check,
              },
              {
                label: "Average service",
                value: formatWait(data.metrics.averageService),
                sub: `Peak queue: ${data.metrics.peak} waiting`,
                icon: TrendingUp,
              },
            ].map(({ label, value, sub, icon: Icon }) => (
              <article className="stat-card" key={label}>
                <div>
                  <span>{label}</span>
                  <Icon size={17} />
                </div>
                <strong className={value === "No data yet" ? "no-data" : ""}>
                  {value}
                </strong>
                <p>{sub}</p>
              </article>
            ))}
          </section>
          <div className="dashboard-grid">
            <div className="dashboard-left">
              <section className="serving-card">
                <div className="serving-top">
                  <span className="eyebrow">
                    <span className="live-dot" /> NOW SERVING
                  </span>
                  <CounterPill />
                </div>
                <motion.div
                  key={data.serving?.id ?? "empty"}
                  initial={reduced ? false : { opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`serving-number ${!data.serving ? "serving-empty" : ""}`}
                >
                  {data.serving?.display_token ?? "Ready when you are."}
                </motion.div>
                <p>
                  {data.serving
                    ? "A little less waiting for this one."
                    : waiting.length
                      ? "Your first token is ready to be called."
                      : "The next good break starts with a scan."}
                </p>
                <button
                  className="button button-primary complete-button"
                  disabled={busy || (!data.serving && !waiting.length)}
                  onClick={() => act("advance")}
                >
                  <Check size={19} />
                  {busy
                    ? "Updating queue…"
                    : data.serving
                      ? "Complete & call next"
                      : "Call next"}
                  <ArrowRight size={19} />
                </button>
                <button
                  className="skip-button"
                  disabled={busy || !data.serving}
                  onClick={() => act("skip")}
                >
                  <SkipForward size={14} /> Skip this token
                </button>
              </section>
              <section className="counter-note">
                <span className="note-icon">
                  <Coffee size={23} />
                </span>
                <div>
                  <h3>A little space goes a long way.</h3>
                  <p>
                    Students can wait wherever they like. Their token updates as
                    you move the queue.
                  </p>
                </div>
              </section>
              <Link href="/admin/display" className="qr-shortcut">
                <QrCode size={23} />
                <div>
                  <strong>Let the next break begin.</strong>
                  <span>Open your fullscreen QR display</span>
                </div>
                <ArrowRight size={19} />
              </Link>
            </div>
            <section className="queue-card">
              <div className="queue-card-heading">
                <h2>
                  Live queue <span>{waiting.length}</span>
                </h2>
                <LiveBadge connection={connection} />
              </div>
              <div className="queue-table-head">
                <span>TOKEN</span>
                <span>STATUS</span>
                <span>JOINED</span>
              </div>
              <div className="queue-rows">
                {waiting.length ? (
                  waiting.map((t, i) => (
                    <motion.div
                      layout={!reduced}
                      initial={reduced ? false : { opacity: 0, y: 7 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`queue-row ${i === 0 ? "first-row" : ""}`}
                      key={t.id}
                    >
                      <div className="queue-token">
                        <span className="queue-avatar">
                          {String(t.sequence_number).padStart(2, "0")}
                        </span>
                        <strong>{t.display_token}</strong>
                        {t.is_demo && <span className="row-demo">DEMO</span>}
                      </div>
                      <span
                        className={`row-status ${i === 0 ? "row-next" : ""}`}
                      >
                        {i === 0 ? "Up next" : "Waiting"}
                      </span>
                      <time dateTime={t.joined_at}>
                        {data.observedAt - Date.parse(t.joined_at) < 60000
                          ? "Just now"
                          : timeLabel(t.joined_at)}
                      </time>
                    </motion.div>
                  ))
                ) : (
                  <div className="empty-queue">
                    <Users size={29} strokeWidth={1.3} />
                    <h3>A little breathing room.</h3>
                    <p>New tokens will appear here as students scan.</p>
                  </div>
                )}
              </div>
              <div className="queue-card-footer">
                <span className="live-dot" /> Updates automatically. No
                refreshing needed.
              </div>
            </section>
          </div>
        </>
      )}
    </main>
  );
}
