"use client";
import { useState } from "react";
import {
  Check,
  Clock3,
  FlaskConical,
  RotateCcw,
  Settings2,
} from "lucide-react";
import { useAdmin } from "@/hooks/use-admin";
import type { LiveConfig, Settings } from "@/lib/types";
import { ErrorNotice, Loading } from "./ui";
import { ConfirmDialog } from "./confirm-dialog";
function TimingForm({
  settings,
  busy,
  save,
}: {
  settings: Settings;
  busy: boolean;
  save: (values: Record<string, unknown>) => void;
}) {
  const [seconds, setSeconds] = useState(settings.default_service_seconds);
  const [threshold, setThreshold] = useState(settings.almost_turn_threshold);
  return (
    <form
      className="settings-form"
      onSubmit={(e) => {
        e.preventDefault();
        save({
          default_service_seconds: seconds,
          almost_turn_threshold: threshold,
        });
      }}
    >
      <div className="field">
        <label htmlFor="service-time">
          Default service time <span>seconds</span>
        </label>
        <input
          id="service-time"
          type="number"
          min={10}
          max={3600}
          value={seconds}
          required
          onChange={(e) => setSeconds(Number(e.target.value))}
        />
        <p>Used until real completed tokens provide a rolling average.</p>
      </div>
      <div className="field">
        <label htmlFor="threshold">
          Almost there alert <span>people ahead</span>
        </label>
        <input
          id="threshold"
          type="number"
          min={2}
          max={10}
          value={threshold}
          required
          onChange={(e) => setThreshold(Number(e.target.value))}
        />
        <p>When students should start moving toward the canteen.</p>
      </div>
      <button className="button button-primary" disabled={busy}>
        Save settings <Check size={16} />
      </button>
    </form>
  );
}
export function AdminSettings({
  config,
  qr,
}: {
  config: LiveConfig;
  qr: { url: string | null; warning: string | null };
}) {
  const { data, error, refresh, busy, notice, actionError, act } =
    useAdmin(config);
  const [confirm, setConfirm] = useState(false);
  return (
    <main>
      <div className="page-heading">
        <div>
          <span className="eyebrow">MAKE THE QUEUE WORK FOR YOU</span>
          <h1>
            A few simple controls<span>.</span>
          </h1>
          <p>One canteen. One counter. Everything you need.</p>
        </div>
      </div>
      {(error || actionError) && (
        <ErrorNotice message={actionError ?? error!} onRetry={refresh} />
      )}
      {notice && (
        <div className="toast" role="status">
          <Check size={16} />
          {notice}
        </div>
      )}
      {!data && !error && <Loading />}
      {data && (
        <div className="settings-stack">
          <section className="settings-card">
            <div className="settings-intro">
              <Settings2 size={21} />
              <div>
                <h2>Queue admissions</h2>
                <p>
                  Existing tokens stay viewable in every state. You can continue
                  serving them.
                </p>
              </div>
            </div>
            <div className="queue-state-options">
              {[
                { value: "OPEN", title: "Open", text: "Welcome new scans" },
                {
                  value: "PAUSED",
                  title: "Paused",
                  text: "Take a short break",
                },
                { value: "CLOSED", title: "Closed", text: "Done for now" },
              ].map((s) => (
                <button
                  key={s.value}
                  className={`state-option ${data.session.status === s.value ? "selected" : ""}`}
                  disabled={busy}
                  aria-pressed={data.session.status === s.value}
                  onClick={() => act("status", { status: s.value })}
                >
                  <span>
                    <span className="radio-dot" />
                    {s.title}
                  </span>
                  <small>{s.text}</small>
                </button>
              ))}
            </div>
          </section>
          <section className="settings-card">
            <div className="settings-intro">
              <Clock3 size={21} />
              <div>
                <h2>Timing & heads-up</h2>
                <p>Keep estimates useful, and students close when it counts.</p>
              </div>
            </div>
            <TimingForm
              key={`${data.settings.default_service_seconds}-${data.settings.almost_turn_threshold}`}
              settings={data.settings}
              busy={busy}
              save={(value) => act("settings", value)}
            />
          </section>
          <section className="settings-card demo-settings">
            <div className="settings-intro">
              <FlaskConical size={21} />
              <div>
                <h2>A demo that feels real</h2>
                <p>
                  Load five clearly marked demo tokens. Q-001 starts serving;
                  the next person to scan gets Q-006. Demo service times are
                  excluded from averages.
                </p>
              </div>
            </div>
            <div className="settings-actions">
              <button
                className="button button-primary"
                disabled={
                  busy ||
                  data.session.next_sequence !== 1 ||
                  data.session.status !== "OPEN"
                }
                onClick={() => act("demo")}
              >
                Load demo queue
              </button>
              <button
                className="button button-white"
                disabled={
                  busy ||
                  !data.tokens.some(
                    (t) =>
                      t.is_demo && ["WAITING", "SERVING"].includes(t.status),
                  )
                }
                onClick={() => act("clear_demo")}
              >
                Clear demo tokens
              </button>
            </div>
            {data.session.next_sequence !== 1 && (
              <p className="small muted">
                Start a new queue below to load a fresh demo.
              </p>
            )}
          </section>
          <section className="settings-card">
            <div className="settings-intro">
              <RotateCcw size={21} />
              <div>
                <h2>A fresh queue</h2>
                <p>
                  Archive this session and reset numbering to Q-001. Previous
                  history is always preserved.
                </p>
              </div>
            </div>
            <button
              className="button button-white"
              disabled={busy}
              onClick={() => setConfirm(true)}
            >
              Start new queue <RotateCcw size={15} />
            </button>
          </section>
          <section className="settings-card qr-config">
            <h2>Your QR destination</h2>
            {qr.warning ? (
              <ErrorNotice message={qr.warning} />
            ) : (
              <>
                <code>{qr.url}</code>
                <p className="small muted">
                  Configured with NEXT_PUBLIC_APP_URL. Redeploy after changing
                  your domain.
                </p>
              </>
            )}
            {config.local && (
              <p className="local-banner">
                Local demo mode · Persistent PostgreSQL on this laptop, with
                2-second polling. Connect Supabase for hosted realtime.
              </p>
            )}
          </section>
        </div>
      )}
      <ConfirmDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        onConfirm={() => act("new_session")}
      />
    </main>
  );
}
