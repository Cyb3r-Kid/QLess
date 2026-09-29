-- Run once in a fresh Supabase project's SQL Editor.
-- All queue mutations serialize on the canteen row, including session rollover.
create table public.canteens (
  id uuid primary key default gen_random_uuid(),
  name text not null, slug text not null unique, counter_name text not null,
  created_at timestamptz not null default now()
);
create table public.queue_sessions (
  id uuid primary key default gen_random_uuid(),
  canteen_id uuid not null references public.canteens(id),
  status text not null default 'OPEN' check (status in ('OPEN','PAUSED','CLOSED')),
  next_sequence integer not null default 1 check (next_sequence > 0),
  started_at timestamptz not null default now(), ended_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index one_active_session on public.queue_sessions(canteen_id) where ended_at is null;
create table public.tokens (
  id uuid primary key default gen_random_uuid(),
  queue_session_id uuid not null references public.queue_sessions(id),
  sequence_number integer not null check (sequence_number > 0),
  display_token text not null,
  status text not null default 'WAITING' check (status in ('WAITING','SERVING','COMPLETED','SKIPPED','CANCELLED')),
  anonymous_session_id uuid not null, is_demo boolean not null default false,
  joined_at timestamptz not null default now(), called_at timestamptz,
  completed_at timestamptz, skipped_at timestamptz, cancelled_at timestamptz,
  unique(queue_session_id, sequence_number),
  check (status <> 'SERVING' or called_at is not null),
  check (status <> 'COMPLETED' or (called_at is not null and completed_at is not null)),
  check (completed_at is null or completed_at >= called_at)
);
create unique index one_serving_per_session on public.tokens(queue_session_id) where status = 'SERVING';
create unique index one_active_token_per_browser on public.tokens(queue_session_id, anonymous_session_id) where status in ('WAITING','SERVING');
create index tokens_queue_order on public.tokens(queue_session_id, status, sequence_number);
create index tokens_history on public.tokens(joined_at desc);
create table public.queue_events (
  id uuid primary key default gen_random_uuid(),
  queue_session_id uuid not null references public.queue_sessions(id),
  token_id uuid references public.tokens(id), event_type text not null,
  metadata jsonb not null default '{}', created_at timestamptz not null default now()
);
create index events_session on public.queue_events(queue_session_id, created_at);
create table public.settings (
  canteen_id uuid primary key references public.canteens(id),
  default_service_seconds integer not null default 90 check (default_service_seconds between 10 and 3600),
  almost_turn_threshold integer not null default 2 check (almost_turn_threshold between 2 and 10),
  updated_at timestamptz not null default now()
);
-- Public invalidation only: never broadcast token UUIDs or anonymous browser IDs.
create table public.queue_signals (
  canteen_id uuid primary key references public.canteens(id),
  revision bigint not null default 0, updated_at timestamptz not null default now()
);
create table public.auth_attempts (
  key text primary key, attempts integer not null, window_start timestamptz not null
);

insert into public.canteens(id, name, slug, counter_name)
values ('00000000-0000-4000-8000-000000000001', 'Sathyabama Canteen', 'canteen', 'Counter 01');
insert into public.settings(canteen_id) select id from public.canteens;
insert into public.queue_signals(canteen_id) select id from public.canteens;
insert into public.queue_sessions(canteen_id) select id from public.canteens;

create function public.qless_signal() returns trigger language plpgsql security definer set search_path = public as $$
begin
  update queue_signals set revision = revision + 1, updated_at = clock_timestamp();
  return null;
end $$;
create trigger tokens_changed after insert or update or delete on public.tokens for each statement execute function public.qless_signal();
create trigger sessions_changed after insert or update on public.queue_sessions for each statement execute function public.qless_signal();
create trigger settings_changed after update on public.settings for each statement execute function public.qless_signal();

create function public.qless_join(p_browser uuid) returns jsonb language plpgsql security definer set search_path = public as $$
declare c uuid; s queue_sessions; t tokens; n integer; size integer;
begin
  select id into c from canteens where slug = 'canteen' for update;
  select * into s from queue_sessions where canteen_id = c and ended_at is null;
  if not found then raise exception 'NO_SESSION'; end if;
  -- Recover an existing token even when new admissions are paused/closed.
  select * into t from tokens where queue_session_id = s.id and anonymous_session_id = p_browser and status in ('WAITING','SERVING');
  if found then return jsonb_build_object('id', t.id, 'recovered', true); end if;
  if s.status <> 'OPEN' then raise exception 'QUEUE_%', s.status; end if;
  update queue_sessions set next_sequence = next_sequence + 1 where id = s.id returning next_sequence - 1 into n;
  insert into tokens(queue_session_id, sequence_number, display_token, anonymous_session_id)
    values(s.id, n, 'Q-' || lpad(n::text, greatest(3, length(n::text)), '0'), p_browser) returning * into t;
  select count(*) into size from tokens where queue_session_id = s.id and status = 'WAITING';
  insert into queue_events(queue_session_id, token_id, event_type, metadata)
    values(s.id, t.id, 'JOINED', jsonb_build_object('queue_size', size));
  return jsonb_build_object('id', t.id, 'recovered', false);
end $$;

create function public.qless_action(p_action text, p_session uuid, p_expected uuid default null, p_value jsonb default '{}')
returns jsonb language plpgsql security definer set search_path = public as $$
declare c uuid; s queue_sessions; cur tokens; nxt tokens; n integer; i integer; new_id uuid;
begin
  select id into c from canteens where slug = 'canteen' for update;
  select * into s from queue_sessions where canteen_id = c and ended_at is null;
  if s.id is distinct from p_session then raise exception 'STALE_SESSION'; end if;
  select * into cur from tokens where queue_session_id = s.id and status = 'SERVING';
  if p_action in ('advance','skip') then
    -- A second click/tab carrying the old serving ID cannot advance again.
    if cur.id is distinct from p_expected then raise exception 'STALE_ACTION'; end if;
    if p_action = 'skip' and cur.id is null then raise exception 'NOT_SERVING'; end if;
    if cur.id is not null then
      if p_action = 'skip' then
        update tokens set status = 'SKIPPED', skipped_at = clock_timestamp() where id = cur.id;
      else
        update tokens set status = 'COMPLETED', completed_at = clock_timestamp() where id = cur.id;
      end if;
      insert into queue_events(queue_session_id, token_id, event_type) values(s.id, cur.id, case when p_action = 'skip' then 'SKIPPED' else 'COMPLETED' end);
    end if;
    select * into nxt from tokens where queue_session_id = s.id and status = 'WAITING' order by sequence_number limit 1;
    if nxt.id is not null then
      update tokens set status = 'SERVING', called_at = clock_timestamp() where id = nxt.id;
      insert into queue_events(queue_session_id, token_id, event_type) values(s.id, nxt.id, 'CALLED');
    end if;
  elsif p_action = 'status' then
    if (p_value->>'status') is null or (p_value->>'status') not in ('OPEN','PAUSED','CLOSED') then raise exception 'INVALID_INPUT'; end if;
    update queue_sessions set status = p_value->>'status' where id = s.id;
  elsif p_action = 'new_session' then
    update tokens set status = 'CANCELLED', cancelled_at = clock_timestamp() where queue_session_id = s.id and status in ('WAITING','SERVING');
    update queue_sessions set status = 'CLOSED', ended_at = clock_timestamp() where id = s.id;
    insert into queue_sessions(canteen_id) values(c) returning id into new_id;
  elsif p_action = 'demo' then
    if s.next_sequence <> 1 then raise exception 'DEMO_NEEDS_EMPTY_SESSION'; end if;
    if s.status <> 'OPEN' then raise exception 'QUEUE_%', s.status; end if;
    for i in 1..5 loop
      insert into tokens(queue_session_id, sequence_number, display_token, anonymous_session_id, is_demo, status, called_at)
        values(s.id, i, 'Q-' || lpad(i::text, 3, '0'), gen_random_uuid(), true,
          case when i = 1 then 'SERVING' else 'WAITING' end,
          case when i = 1 then clock_timestamp() else null end);
    end loop;
    update queue_sessions set next_sequence = 6 where id = s.id;
    insert into queue_events(queue_session_id, event_type, metadata) values(s.id, 'DEMO_LOADED', '{"queue_size":4}');
  elsif p_action = 'clear_demo' then
    update tokens set status = 'CANCELLED', cancelled_at = clock_timestamp() where queue_session_id = s.id and is_demo and status in ('WAITING','SERVING');
    if not exists(select 1 from tokens where queue_session_id = s.id and status = 'SERVING') then
      select * into nxt from tokens where queue_session_id = s.id and status = 'WAITING' order by sequence_number limit 1;
      if nxt.id is not null then
        update tokens set status = 'SERVING', called_at = clock_timestamp() where id = nxt.id;
        insert into queue_events(queue_session_id, token_id, event_type) values(s.id, nxt.id, 'CALLED');
      end if;
    end if;
  elsif p_action = 'settings' then
    if not (p_value ? 'default_service_seconds' and p_value ? 'almost_turn_threshold') then raise exception 'INVALID_INPUT'; end if;
    update settings set default_service_seconds = (p_value->>'default_service_seconds')::integer,
      almost_turn_threshold = (p_value->>'almost_turn_threshold')::integer, updated_at = clock_timestamp() where canteen_id = c;
  else raise exception 'INVALID_ACTION';
  end if;
  insert into queue_events(queue_session_id, event_type, metadata) values(s.id, upper(p_action), p_value);
  return jsonb_build_object('ok', true, 'session_id', coalesce(new_id, s.id));
end $$;

create function public.qless_snapshot(p_token uuid default null) returns jsonb language plpgsql security definer set search_path = public as $$
declare s queue_sessions; c uuid; result jsonb;
begin
  select id into c from canteens where slug = 'canteen';
  if p_token is not null then
    select qs.* into s from queue_sessions qs join tokens t on t.queue_session_id = qs.id where t.id = p_token;
    if not found then raise exception 'TOKEN_NOT_FOUND'; end if;
  else
    select * into s from queue_sessions where canteen_id = c and ended_at is null;
  end if;
  if s.id is null then raise exception 'NO_SESSION'; end if;
  select jsonb_build_object(
    'session', to_jsonb(s),
    'tokens', coalesce((select jsonb_agg(to_jsonb(t) - 'anonymous_session_id' order by sequence_number) from tokens t where queue_session_id = s.id), '[]'::jsonb),
    'settings', (select to_jsonb(st) from settings st where canteen_id = c),
    'history', coalesce((select jsonb_agg(to_jsonb(t) - 'anonymous_session_id' order by joined_at desc) from tokens t), '[]'::jsonb),
    'peak', coalesce((select max((metadata->>'queue_size')::integer) from queue_events where queue_session_id = s.id), 0)
  ) into result;
  return result;
end $$;

-- Persistent login throttling also works across Vercel instances.
create function public.qless_auth_attempt(p_key text) returns boolean language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  delete from auth_attempts where window_start < now() - interval '1 day';
  insert into auth_attempts(key, attempts, window_start) values(p_key, 1, now())
  on conflict(key) do update set
    attempts = case when auth_attempts.window_start < now() - interval '10 minutes' then 1 else auth_attempts.attempts + 1 end,
    window_start = case when auth_attempts.window_start < now() - interval '10 minutes' then now() else auth_attempts.window_start end
  returning attempts into n;
  return n <= 10;
end $$;

alter table public.canteens enable row level security;
alter table public.queue_sessions enable row level security;
alter table public.tokens enable row level security;
alter table public.queue_events enable row level security;
alter table public.settings enable row level security;
alter table public.auth_attempts enable row level security;
alter table public.queue_signals enable row level security;
create policy "Read anonymous invalidation signals" on public.queue_signals for select using (true);
revoke all on function public.qless_join(uuid) from public;
revoke all on function public.qless_action(text, uuid, uuid, jsonb) from public;
revoke all on function public.qless_snapshot(uuid) from public;
revoke all on function public.qless_auth_attempt(text) from public;
revoke all on function public.qless_signal() from public;

-- These roles/publication exist on Supabase; the same schema also runs on local PostgreSQL.
do $$
begin
  if exists(select 1 from pg_roles where rolname = 'anon') then
    revoke all on public.canteens, public.queue_sessions, public.tokens, public.queue_events, public.settings, public.auth_attempts, public.queue_signals from anon, authenticated;
    grant select on public.queue_signals to anon, authenticated;
    grant all on public.canteens, public.queue_sessions, public.tokens, public.queue_events, public.settings, public.auth_attempts, public.queue_signals to service_role;
    grant execute on function public.qless_join(uuid), public.qless_action(text,uuid,uuid,jsonb), public.qless_snapshot(uuid), public.qless_auth_attempt(text) to service_role;
  end if;
  if exists(select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.queue_signals;
  end if;
end $$;
