-- stream_stage_passes: Stage Pass system for broadcast guests
-- Max 5 Stage Passes per stream; host + 5 guests = 6 total on-screen panels

create table if not exists public.stream_stage_passes (
  id uuid primary key default gen_random_uuid(),
  stream_id uuid not null references public.streams(id) on delete cascade,
  broadcaster_id uuid not null references public.user_profiles(id) on delete cascade,
  user_id uuid references public.user_profiles(id) on delete set null,
  status text not null default 'open' check (status in (
    'open', 'requested', 'approved', 'live', 'denied', 'removed', 'expired'
  )),
  stage_index integer not null,
  price_coins integer not null default 0,
  paid_amount integer not null default 0,
  requested_at timestamptz,
  approved_at timestamptz,
  went_live_at timestamptz,
  denied_at timestamptz,
  removed_at timestamptz,
  expired_at timestamptz,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  constraint stream_stage_passes_stream_index_unique unique (stream_id, stage_index),
  constraint stream_stage_passes_user_stream_unique unique (stream_id, user_id)
    where user_id is not null and status in ('requested', 'approved', 'live')
);

create index if not exists idx_ssp_stream on public.stream_stage_passes(stream_id);
create index if not exists idx_ssp_user on public.stream_stage_passes(user_id);
create index if not exists idx_ssp_status on public.stream_stage_passes(status);
create index if not exists idx_ssp_broadcaster on public.stream_stage_passes(broadcaster_id);
create index if not exists idx_ssp_stream_status on public.stream_stage_passes(stream_id, status);

alter table public.stream_stage_passes enable row level security;

-- Broadcaster fully manages their own Stage Passes
create policy "Broadcaster manages own Stage Passes"
  on public.stream_stage_passes
  for all
  using (broadcaster_id = auth.uid())
  with check (broadcaster_id = auth.uid());

-- Anyone can read open / requested passes for a stream (to show availability)
create policy "Anyone can view open or requested Stage Passes"
  on public.stream_stage_passes
  for select
  using (
    status in ('open', 'requested')
    or user_id = auth.uid()
  );

-- Viewers can insert a request for an open slot in a stream they don't broadcast
create policy "Viewers can request open Stage Passes"
  on public.stream_stage_passes
  for insert
  with check (
    (select broadcaster_id from public.streams where id = stream_id) <> auth.uid()
    and exists (
      select 1 from public.stream_stage_passes ssp
      where ssp.stream_id = stream_stage_passes.stream_id
        and ssp.stage_index = stream_stage_passes.stage_index
        and ssp.status = 'open'
    )
    and auth.uid() is not null
  );

-- Prevent duplicate active requests per viewer per stream
create or replace function public.stage_pass_request_guard()
returns trigger language plpgsql as $$
begin
  if new.user_id is null then
    raise exception 'User ID required for Stage Pass request';
  end if;
  if new.status not in ('open', 'requested', 'approved', 'live', 'denied', 'removed', 'expired') then
    raise exception 'Invalid Stage Pass status: %', new.status;
  end if;
  if new.stage_index < 1 or new.stage_index > 5 then
    raise exception 'Stage index must be 1–5';
  end if;
  -- Max 5 open passes per stream
  if new.status = 'open' then
    declare open_count int;
    begin
      select count(*) into open_count
      from public.stream_stage_passes
      where stream_id = new.stream_id and status = 'open';
      if open_count >= 5 then
        raise exception 'Maximum of 5 Stage Passes per stream';
      end if;
    end;
  end if;
  -- Guard: only one active (requested/approved/live) pass per user per stream
  if new.status in ('requested', 'approved', 'live') then
    if exists (
      select 1 from public.stream_stage_passes
      where stream_id = new.stream_id
        and user_id = new.user_id
        and status in ('requested', 'approved', 'live')
        and id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000')
    ) then
      raise exception 'User already has an active Stage Pass for this stream';
    end if;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_stage_pass_guard on public.stream_stage_passes;
create trigger trg_stage_pass_guard
  before insert or update on public.stream_stage_passes
  for each row execute function public.stage_pass_request_guard();

-- Auto-update updated_at timestamp
drop trigger if exists trg_stage_pass_updated_at on public.stream_stage_passes;
create trigger trg_stage_pass_updated_at
  before update on public.stream_stage_passes
  for each row execute function public.handle_updated_at();
