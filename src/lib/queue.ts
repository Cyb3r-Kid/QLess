import type { Metrics, Snapshot, StudentView, Token } from "./types";

export function durationSeconds(
  from: string | null,
  to: string | null,
): number | null {
  if (!from || !to) return null;
  return Math.max(0, (Date.parse(to) - Date.parse(from)) / 1000);
}
const mean = (values: number[]) =>
  values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
export function metrics(snapshot: Snapshot, now = new Date()): Metrics {
  const completed = snapshot.history.filter(
    (t) => t.status === "COMPLETED" && !t.is_demo,
  );
  const durations = completed
    .filter((t) => t.called_at && t.completed_at)
    .sort((a, b) => Date.parse(b.completed_at!) - Date.parse(a.completed_at!))
    .slice(0, 20)
    .map((t) => durationSeconds(t.called_at, t.completed_at)!);
  const averageService = mean(durations);
  // Campus reporting uses the canteen's timezone, independent of the server timezone.
  const day = (date: Date) =>
    date.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  const today = completed.filter(
    (t) => t.completed_at && day(new Date(t.completed_at)) === day(now),
  );
  return {
    waiting: snapshot.tokens.filter((t) => t.status === "WAITING").length,
    served: today.length,
    averageWait: mean(
      today
        .filter((t) => t.called_at)
        .map((t) => durationSeconds(t.joined_at, t.called_at)!),
    ),
    averageService,
    serviceSeconds: averageService ?? snapshot.settings.default_service_seconds,
    peak: snapshot.peak,
  };
}
export function studentView(snapshot: Snapshot, token: Token): StudentView {
  // The brief defines people ahead as earlier WAITING tokens, excluding the person at the counter.
  const ahead = snapshot.tokens.filter(
    (t) => t.status === "WAITING" && t.sequence_number < token.sequence_number,
  ).length;
  return {
    token,
    session: snapshot.session,
    ahead,
    etaSeconds: ahead * metrics(snapshot).serviceSeconds,
    serving:
      snapshot.tokens.find((t) => t.status === "SERVING")?.display_token ??
      null,
    initialAhead: Math.max(token.sequence_number - 2, 1),
    threshold: snapshot.settings.almost_turn_threshold,
  };
}
export function formatWait(seconds: number | null): string {
  if (seconds === null) return "No data yet";
  if (seconds < 60) return "<1 min";
  return `${Math.round(seconds / 60)} min`;
}
export function timeLabel(value: string | null) {
  return value
    ? new Date(value).toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Asia/Kolkata",
      })
    : "—";
}
