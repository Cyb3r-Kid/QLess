"use client";
import { History } from "lucide-react";
import { useAdmin } from "@/hooks/use-admin";
import type { LiveConfig } from "@/lib/types";
import { durationSeconds, formatWait, timeLabel } from "@/lib/queue";
import { ErrorNotice, LiveBadge, Loading } from "./ui";
export function AdminHistory({ config }: { config: LiveConfig }) {
  const { data, error, refresh, connection } = useAdmin(config, true);
  return (
    <main>
      <div className="page-heading">
        <div>
          <span className="eyebrow">EVERY BREAK HAS A STORY</span>
          <h1>
            Queue history<span>.</span>
          </h1>
          <p>Real timestamps. Every session. Nothing lost.</p>
        </div>
        <LiveBadge connection={connection} />
      </div>
      {error && <ErrorNotice message={error} onRetry={refresh} />}
      {!data && !error && <Loading />}
      {data && (
        <section className="history-card">
          <div className="history-top">
            <h2>
              All tokens{" "}
              <span className="muted">({data.history?.length ?? 0})</span>
            </h2>
            <span className="small muted">Times in IST · Latest 200 shown</span>
          </div>
          {data.history?.length ? (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    {[
                      "Token",
                      "Joined",
                      "Called",
                      "Completed",
                      "Wait",
                      "Service",
                      "Status",
                    ].map((h) => (
                      <th key={h}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.history.slice(0, 200).map((t) => (
                    <tr key={t.id}>
                      <td>
                        <strong>{t.display_token}</strong>
                        {t.is_demo && <span className="row-demo">DEMO</span>}
                        <small>
                          {new Date(t.joined_at).toLocaleDateString("en-IN", {
                            day: "2-digit",
                            month: "short",
                            timeZone: "Asia/Kolkata",
                          })}{" "}
                          · {t.queue_session_id.slice(0, 6)}
                        </small>
                      </td>
                      <td>{timeLabel(t.joined_at)}</td>
                      <td>{timeLabel(t.called_at)}</td>
                      <td>{timeLabel(t.completed_at)}</td>
                      <td>
                        {t.called_at
                          ? formatWait(
                              durationSeconds(t.joined_at, t.called_at),
                            )
                          : "—"}
                      </td>
                      <td>
                        {t.completed_at
                          ? formatWait(
                              durationSeconds(t.called_at, t.completed_at),
                            )
                          : "—"}
                      </td>
                      <td>
                        <span
                          className={`history-status history-${t.status.toLowerCase()}`}
                        >
                          {t.status.toLowerCase()}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty-queue">
              <History size={30} />
              <h3>A fresh start.</h3>
              <p>Your token history will appear here after the first scan.</p>
            </div>
          )}
        </section>
      )}
    </main>
  );
}
