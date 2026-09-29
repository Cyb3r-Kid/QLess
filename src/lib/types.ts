export type TokenStatus =
  "WAITING" | "SERVING" | "COMPLETED" | "SKIPPED" | "CANCELLED";
export type QueueStatus = "OPEN" | "PAUSED" | "CLOSED";
export interface Token {
  id: string;
  queue_session_id: string;
  sequence_number: number;
  display_token: string;
  status: TokenStatus;
  is_demo: boolean;
  joined_at: string;
  called_at: string | null;
  completed_at: string | null;
  skipped_at: string | null;
  cancelled_at: string | null;
}
export interface QueueSession {
  id: string;
  status: QueueStatus;
  started_at: string;
  ended_at: string | null;
  next_sequence: number;
}
export interface Settings {
  default_service_seconds: number;
  almost_turn_threshold: number;
}
export interface Snapshot {
  session: QueueSession;
  tokens: Token[];
  settings: Settings;
  history: Token[];
  peak: number;
}
export interface Metrics {
  waiting: number;
  served: number;
  averageWait: number | null;
  averageService: number | null;
  serviceSeconds: number;
  peak: number;
}
export interface QueueView {
  observedAt: number;
  session: QueueSession;
  settings: Settings;
  tokens: Token[];
  serving: Token | null;
  metrics: Metrics;
  history?: Token[];
}
export interface StudentView {
  token: Token;
  session: QueueSession;
  ahead: number;
  etaSeconds: number;
  serving: string | null;
  initialAhead: number;
  threshold: number;
}
export interface LiveConfig {
  supabaseUrl: string;
  anonKey: string;
  local: boolean;
}
export type QueueAction =
  | "advance"
  | "skip"
  | "status"
  | "new_session"
  | "demo"
  | "clear_demo"
  | "settings";
