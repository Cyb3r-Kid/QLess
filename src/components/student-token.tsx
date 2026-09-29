"use client";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ArrowRight,
  Check,
  Coffee,
  MapPin,
  Ticket,
  Users,
  BellRing,
} from "lucide-react";
import { useLiveQueue } from "@/hooks/use-live-queue";
import type { LiveConfig, StudentView } from "@/lib/types";
import { formatWait } from "@/lib/queue";
import { Brand, ErrorNotice, LiveBadge, Loading } from "./ui";
export function StudentToken({
  id,
  config,
}: {
  id: string;
  config: LiveConfig;
}) {
  const { data, error, fatal, connection, refresh } = useLiveQueue<StudentView>(
    `/api/queue?token=${encodeURIComponent(id)}`,
    config,
  );
  const reduced = useReducedMotion();
  const token = data?.token;
  const serving = token?.status === "SERVING";
  const completed = token?.status === "COMPLETED";
  const ended = token?.status === "CANCELLED" || token?.status === "SKIPPED";
  const next = token?.status === "WAITING" && (data?.ahead ?? 9) <= 1;
  const almost =
    token?.status === "WAITING" &&
    !next &&
    (data?.ahead ?? 9) <= (data?.threshold ?? 2);
  const title = serving
    ? "It’s your turn!"
    : completed
      ? "All done!"
      : token?.status === "SKIPPED"
        ? "We missed you."
        : ended
          ? "This queue has ended."
          : next
            ? "You’re next."
            : almost
              ? "Almost there."
              : "Your break starts now.";
  const description = serving
    ? "Head over to Counter 01. We’re ready for you."
    : completed
      ? "Thanks for using Qless. Hope your break was a good one."
      : ended
        ? "You can scan the canteen QR again for a new token. Your previous token is saved here."
        : next
          ? "Please be ready near Counter 01. You’re up soon."
          : almost
            ? `Only ${data?.ahead} people ahead. Please start moving toward the canteen.`
            : "No need to stand in line. Find a seat, catch up with a friend, and keep this page open.";
  const StatusIcon = completed
    ? Check
    : serving || next || almost
      ? BellRing
      : Coffee;
  return (
    <div className="student-page">
      <header className="student-header">
        <Brand />
        <LiveBadge connection={connection} />
      </header>
      <main className="student-main">
        <div className="student-location">
          <MapPin size={14} /> Sathyabama Canteen <span>Counter 01</span>
        </div>
        {error && (
          <ErrorNotice message={error} onRetry={fatal ? undefined : refresh} />
        )}
        {!data && !fatal && <Loading text="Finding your token…" />}
        {data && (
          <>
            <div className="student-heading">
              <span className={`status-icon ${serving ? "serving-icon" : ""}`}>
                <StatusIcon size={22} />
              </span>
              <h1>{title}</h1>
              <p>
                {completed
                  ? "A little less waiting. A little more living."
                  : "Let the queue wait for you."}
              </p>
            </div>
            <motion.section
              layout={!reduced}
              className={`token-card ${serving ? "token-serving" : ""} ${completed ? "token-completed" : ""}`}
              aria-label="Your live queue token"
            >
              <div className="token-card-top">
                <span className="eyebrow">
                  <Ticket size={14} />{" "}
                  {serving ? "IT’S YOUR TURN" : "YOUR TOKEN"}
                </span>
                <span className="ticket-corner">SBC / 01</span>
              </div>
              <motion.div
                initial={reduced ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="student-token-number"
              >
                {token?.display_token}
              </motion.div>
              <div className="token-subtitle">
                {completed
                  ? "Served with a little less waiting."
                  : serving
                    ? "Your spot at the counter is ready."
                    : ended
                      ? "This token is no longer active."
                      : "Your place in line is saved."}
              </div>
              <div className="token-divider" />
              <div aria-live="polite" aria-atomic="true">
                {serving ? (
                  <div className="proceed">
                    <span>PROCEED TO</span>
                    <strong>
                      Counter 01 <ArrowRight size={27} />
                    </strong>
                  </div>
                ) : completed ? (
                  <div className="completed-message">
                    <span className="check-circle">
                      <Check size={22} />
                    </span>
                    <strong>All done. Enjoy!</strong>
                  </div>
                ) : ended ? (
                  <div className="ended-message">
                    {token?.status === "SKIPPED"
                      ? "Token skipped"
                      : "Session ended"}
                  </div>
                ) : (
                  <>
                    <div className="position">
                      <AnimatePresence mode="wait">
                        <motion.strong
                          key={data.ahead}
                          initial={reduced ? false : { opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={reduced ? {} : { opacity: 0, y: -8 }}
                          transition={{ duration: 0.18 }}
                        >
                          {data.ahead}
                        </motion.strong>
                      </AnimatePresence>
                      <span>
                        {data.ahead === 1 ? "PERSON AHEAD" : "PEOPLE AHEAD"}
                      </span>
                    </div>
                    <div className="token-info">
                      <div>
                        <span>Estimated wait</span>
                        <strong>~{formatWait(data.etaSeconds)}</strong>
                      </div>
                      <div>
                        <span>Currently serving</span>
                        <strong>{data.serving ?? "Getting ready"}</strong>
                      </div>
                    </div>
                    <div
                      className="progress-track"
                      role="progressbar"
                      aria-label="Progress toward your turn"
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={Math.round(
                        Math.min(
                          100,
                          Math.max(
                            5,
                            (1 - data.ahead / data.initialAhead) * 100,
                          ),
                        ),
                      )}
                    >
                      <span
                        style={{
                          width: `${Math.min(100, Math.max(5, (1 - data.ahead / data.initialAhead) * 100))}%`,
                        }}
                      />
                    </div>
                    <div className="progress-caption">
                      <span>You’re in the queue</span>
                      <span>See you soon</span>
                    </div>
                  </>
                )}
              </div>
            </motion.section>
            <div
              className={`student-advice ${almost || next ? "advice-near" : ""}`}
            >
              <StatusIcon size={20} />
              <div>
                <strong>
                  {serving
                    ? "Your break, made better."
                    : completed
                      ? "Let the queue wait for you."
                      : ended
                        ? "Need a hand?"
                        : next
                          ? "Keep your token handy."
                          : almost
                            ? "Time to head over."
                            : "Make yourself comfortable."}
                </strong>
                <p>{description}</p>
              </div>
            </div>
            {!completed && !ended && (
              <p className="keep-open">
                <Users size={13} /> Keep this page open for live updates.
              </p>
            )}
            {data.session.status !== "OPEN" && token?.status === "WAITING" && (
              <p className="muted small center">
                New admissions are {data.session.status.toLowerCase()}. Your
                place is still saved.
              </p>
            )}
          </>
        )}
        {fatal && (
          <Link className="button button-white" href="/">
            Back to Qless
          </Link>
        )}
      </main>
      <footer className="student-footer">
        A smarter queue. A better break.<span>qless.</span>
      </footer>
    </div>
  );
}
