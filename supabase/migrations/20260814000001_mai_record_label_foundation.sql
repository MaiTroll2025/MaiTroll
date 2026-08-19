-- ============================================================
-- MAI RECORD LABEL
-- Core database foundation
-- ============================================================

create extension if not exists pgcrypto;

-- ============================================================
-- USER PROFILE ARTIST FLAGS
-- ============================================================

alter table public.user_profiles
  add column if not exists is_record_label_artist boolean not null default false;

alter table public.user_profiles
  add column if not exists record_label_artist_since timestamptz;

-- ============================================================
-- APPLICATIONS
-- ============================================================

create table if not exists public.record_label_applications (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null references public.user_profiles(id) on delete cascade,

  legal_name text not null,
  stage_name text not null,
  artist_bio text,

  primary_genre text not null,
  additional_genres text[] not null default '{}',

  years_making_music integer,

  location text,

  website_url text,
  spotify_url text,
  apple_music_url text,
  soundcloud_url text,
  youtube_url text,

  other_links jsonb not null default '[]'::jsonb,
  sample_track_urls text[] not null default '{}',

  why_join text,

  confirms_original_music boolean not null default false,
  confirms_rights_control boolean not null default false,
  agreed_to_application_terms boolean not null default false,

  status text not null default 'pending'
    check (status in ('pending', 'approved', 'declined', 'withdrawn')),

  reviewed_by uuid references public.user_profiles(id) on delete set null,
  reviewed_at timestamptz,

  review_notes text,
  decline_reason text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_record_label_applications_user
  on public.record_label_applications(user_id);

create index if not exists idx_record_label_applications_status
  on public.record_label_applications(status);

create index if not exists idx_record_label_applications_created
  on public.record_label_applications(created_at desc);

-- Only one pending application per user.
create unique index if not exists uq_record_label_pending_application
  on public.record_label_applications(user_id)
  where status = 'pending';

-- ============================================================
-- ARTIST PROFILES
-- ============================================================

create table if not exists public.record_label_artist_profiles (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null unique
    references public.user_profiles(id) on delete cascade,

  application_id uuid
    references public.record_label_applications(id) on delete set null,

  stage_name text not null,
  bio text,

  primary_genre text,
  genres text[] not null default '{}',

  artist_image_url text,

  verified boolean not null default false,

  status text not null default 'active'
    check (status in ('probation', 'active', 'suspended', 'terminated')),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_record_label_artist_user
  on public.record_label_artist_profiles(user_id);

create index if not exists idx_record_label_artist_created
  on public.record_label_artist_profiles(created_at desc);

create index if not exists idx_record_label_artist_status
  on public.record_label_artist_profiles(status);

-- ============================================================
-- CONTRACTS
-- ============================================================

create sequence if not exists public.record_label_contract_number_seq;

create table if not exists public.record_label_contracts (
  id uuid primary key default gen_random_uuid(),

  artist_id uuid not null
    references public.record_label_artist_profiles(id) on delete cascade,

  application_id uuid
    references public.record_label_applications(id) on delete set null,

  contract_number text not null unique
    default (
      'MAI-' ||
      to_char(current_date, 'YYYY') ||
      '-' ||
      lpad(nextval('public.record_label_contract_number_seq')::text, 7, '0')
    ),

  tier text not null default 'probation'
    check (
      tier in (
        'probation',
        'standard',
        'tier_90_10',
        'tier_95_5'
      )
    ),

  artist_split_bps integer not null default 5000
    check (artist_split_bps between 0 and 10000),

  label_split_bps integer not null default 5000
    check (label_split_bps between 0 and 10000),

  effective_at timestamptz not null default now(),
  probation_ends_at timestamptz,
  expires_at timestamptz,

  status text not null default 'pending_signature'
    check (
      status in (
        'pending_signature',
        'active',
        'completed',
        'terminated',
        'superseded'
      )
    ),

  terms_version text not null default '1.0',

  artist_signed_at timestamptz,
  mai_accepted_at timestamptz,

  created_by uuid
    references public.user_profiles(id) on delete set null,

  terminated_at timestamptz,
  termination_reason text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint record_label_contract_split_100
    check (artist_split_bps + label_split_bps = 10000)
);

create index if not exists idx_record_label_contract_artist
  on public.record_label_contracts(artist_id);

create index if not exists idx_record_label_contract_status
  on public.record_label_contracts(status);

-- Only one current active/pending contract.
create unique index if not exists uq_record_label_current_contract
  on public.record_label_contracts(artist_id)
  where status in ('pending_signature', 'pending_notarization', 'active');

-- ============================================================
-- ARTIST BALANCES
-- ============================================================

create table if not exists public.record_label_artist_balances (
  artist_id uuid primary key
    references public.record_label_artist_profiles(id) on delete cascade,

  available_coins bigint not null default 0
    check (available_coins >= 0),

  pending_coins bigint not null default 0
    check (pending_coins >= 0),

  lifetime_artist_coins bigint not null default 0
    check (lifetime_artist_coins >= 0),

  lifetime_gross_coins bigint not null default 0
    check (lifetime_gross_coins >= 0),

  updated_at timestamptz not null default now()
);

-- ============================================================
-- ALBUMS
-- ============================================================

create table if not exists public.record_label_albums (
  id uuid primary key default gen_random_uuid(),

  artist_id uuid not null
    references public.record_label_artist_profiles(id) on delete cascade,

  title text not null,
  description text,
  cover_url text,

  status text not null default 'draft'
    check (status in ('draft', 'published', 'archived')),

  release_date date,

  published_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_record_label_albums_artist
  on public.record_label_albums(artist_id);

create index if not exists idx_record_label_albums_status
  on public.record_label_albums(status);

-- ============================================================
-- TRACKS
-- ============================================================

create table if not exists public.record_label_tracks (
  id uuid primary key default gen_random_uuid(),

  artist_id uuid not null
    references public.record_label_artist_profiles(id) on delete cascade,

  album_id uuid
    references public.record_label_albums(id) on delete set null,

  title text not null,
  description text,

  audio_url text,
  cover_url text,

  genre text,

  duration_seconds integer
    check (duration_seconds is null or duration_seconds >= 0),

  explicit boolean not null default false,

  status text not null default 'draft'
    check (
      status in (
        'draft',
        'processing',
        'published',
        'rejected',
        'archived'
      )
    ),

  like_count bigint not null default 0
    check (like_count >= 0),

  play_count bigint not null default 0
    check (play_count >= 0),

  tip_coins bigint not null default 0
    check (tip_coins >= 0),

  published_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_record_label_tracks_artist
  on public.record_label_tracks(artist_id);

create index if not exists idx_record_label_tracks_album
  on public.record_label_tracks(album_id);

create index if not exists idx_record_label_tracks_status
  on public.record_label_tracks(status);

create index if not exists idx_record_label_tracks_top_liked
  on public.record_label_tracks(status, like_count desc);

create index if not exists idx_record_label_tracks_published
  on public.record_label_tracks(published_at desc);

-- ============================================================
-- TRACK LIKES
-- ============================================================

create table if not exists public.record_label_track_likes (
  id uuid primary key default gen_random_uuid(),

  track_id uuid not null
    references public.record_label_tracks(id) on delete cascade,

  user_id uuid not null
    references public.user_profiles(id) on delete cascade,

  created_at timestamptz not null default now(),

  unique(track_id, user_id)
);

create index if not exists idx_record_label_track_likes_track
  on public.record_label_track_likes(track_id);

create index if not exists idx_record_label_track_likes_user
  on public.record_label_track_likes(user_id);

-- ============================================================
-- MUSIC TRANSACTION LEDGER
-- ============================================================

create table if not exists public.record_label_transactions (
  id uuid primary key default gen_random_uuid(),

  artist_id uuid not null
    references public.record_label_artist_profiles(id) on delete cascade,

  track_id uuid
    references public.record_label_tracks(id) on delete set null,

  album_id uuid
    references public.record_label_albums(id) on delete set null,

  contract_id uuid
    references public.record_label_contracts(id) on delete set null,

  payer_user_id uuid
    references public.user_profiles(id) on delete set null,

  transaction_type text not null
    check (
      transaction_type in (
        'artist_tip',
        'track_tip',
        'track_revenue',
        'album_revenue',
        'adjustment',
        'bonus'
      )
    ),

  source_transaction_id uuid,

  gross_coins bigint not null
    check (gross_coins >= 0),

  artist_split_bps integer not null
    check (artist_split_bps between 0 and 10000),

  label_split_bps integer not null
    check (label_split_bps between 0 and 10000),

  artist_coins bigint not null
    check (artist_coins >= 0),

  label_coins bigint not null
    check (label_coins >= 0),

  cashout_eligible boolean not null default true,

  status text not null default 'completed'
    check (
      status in (
        'pending',
        'completed',
        'reversed',
        'failed'
      )
    ),

  metadata jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),

  constraint record_label_transaction_split_100
    check (artist_split_bps + label_split_bps = 10000),

  constraint record_label_transaction_amount_check
    check (artist_coins + label_coins = gross_coins)
);

create index if not exists idx_record_label_transactions_artist
  on public.record_label_transactions(artist_id, created_at desc);

create index if not exists idx_record_label_transactions_track
  on public.record_label_transactions(track_id);

create index if not exists idx_record_label_transactions_contract
  on public.record_label_transactions(contract_id);

-- ============================================================
-- APPLICATION REVIEW AUDIT
-- ============================================================

create table if not exists public.record_label_application_reviews (
  id uuid primary key default gen_random_uuid(),

  application_id uuid not null
    references public.record_label_applications(id) on delete cascade,

  reviewed_by uuid not null
    references public.user_profiles(id) on delete restrict,

  decision text not null
    check (decision in ('approved', 'declined')),

  review_notes text,
  decline_reason text,

  created_at timestamptz not null default now()
);

create index if not exists idx_record_label_reviews_application
  on public.record_label_application_reviews(application_id);

-- ============================================================
-- UPDATED_AT TRIGGER
-- ============================================================

create or replace function public.set_record_label_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_record_label_applications_updated
  on public.record_label_applications;

create trigger trg_record_label_applications_updated
before update on public.record_label_applications
for each row
execute function public.set_record_label_updated_at();

drop trigger if exists trg_record_label_artists_updated
  on public.record_label_artist_profiles;

create trigger trg_record_label_artists_updated
before update on public.record_label_artist_profiles
for each row
execute function public.set_record_label_updated_at();

drop trigger if exists trg_record_label_contracts_updated
  on public.record_label_contracts;

create trigger trg_record_label_contracts_updated
before update on public.record_label_contracts
for each row
execute function public.set_record_label_updated_at();

drop trigger if exists trg_record_label_albums_updated
  on public.record_label_albums;

create trigger trg_record_label_albums_updated
before update on public.record_label_albums
for each row
execute function public.set_record_label_updated_at();

drop trigger if exists trg_record_label_tracks_updated
  on public.record_label_tracks;

create trigger trg_record_label_tracks_updated
before update on public.record_label_tracks
for each row
execute function public.set_record_label_updated_at();

-- ============================================================
-- LIKE COUNT TRIGGERS
-- Prevent frontend from being source of truth.
-- ============================================================

create or replace function public.sync_record_label_track_like_count()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then

    update public.record_label_tracks
    set like_count = like_count + 1
    where id = new.track_id;

    return new;

  elsif tg_op = 'DELETE' then

    update public.record_label_tracks
    set like_count = greatest(like_count - 1, 0)
    where id = old.track_id;

    return old;

  end if;

  return null;
end;
$$;

drop trigger if exists trg_record_label_track_like_insert
  on public.record_label_track_likes;

create trigger trg_record_label_track_like_insert
after insert on public.record_label_track_likes
for each row
execute function public.sync_record_label_track_like_count();

drop trigger if exists trg_record_label_track_like_delete
  on public.record_label_track_likes;

create trigger trg_record_label_track_like_delete
after delete on public.record_label_track_likes
for each row
execute function public.sync_record_label_track_like_count();

-- ============================================================
-- RLS
-- ============================================================

alter table public.record_label_applications enable row level security;
alter table public.record_label_artist_profiles enable row level security;
alter table public.record_label_contracts enable row level security;
alter table public.record_label_artist_balances enable row level security;
alter table public.record_label_albums enable row level security;
alter table public.record_label_tracks enable row level security;
alter table public.record_label_track_likes enable row level security;
alter table public.record_label_transactions enable row level security;
alter table public.record_label_application_reviews enable row level security;

-- ============================================================
-- APPLICATION POLICIES
-- ============================================================

drop policy if exists "record_label_application_insert_own"
  on public.record_label_applications;

create policy "record_label_application_insert_own"
on public.record_label_applications
for insert
to authenticated
with check (
  (select auth.uid()) = user_id
  and status = 'pending'
  and reviewed_by is null
  and reviewed_at is null
);

drop policy if exists "record_label_application_read_own"
  on public.record_label_applications;

create policy "record_label_application_read_own"
on public.record_label_applications
for select
to authenticated
using (
  (select auth.uid()) = user_id
);

-- ============================================================
-- ARTIST PROFILE POLICIES
-- ============================================================

drop policy if exists "record_label_artist_public_read"
  on public.record_label_artist_profiles;

create policy "record_label_artist_public_read"
on public.record_label_artist_profiles
for select
to anon, authenticated
using (
  status in ('probation', 'active')
);

drop policy if exists "record_label_artist_owner_update"
  on public.record_label_artist_profiles;

create policy "record_label_artist_owner_update"
on public.record_label_artist_profiles
for update
to authenticated
using (
  (select auth.uid()) = user_id
)
with check (
  (select auth.uid()) = user_id
);

-- ============================================================
-- ALBUM POLICIES
-- ============================================================

drop policy if exists "record_label_album_public_read"
  on public.record_label_albums;

create policy "record_label_album_public_read"
on public.record_label_albums
for select
to anon, authenticated
using (
  status = 'published'
  or exists (
    select 1
    from public.record_label_artist_profiles ap
    where ap.id = artist_id
      and ap.user_id = (select auth.uid())
  )
);

drop policy if exists "record_label_album_artist_insert"
  on public.record_label_albums;

create policy "record_label_album_artist_insert"
on public.record_label_albums
for insert
to authenticated
with check (
  exists (
    select 1
    from public.record_label_artist_profiles ap
    where ap.id = artist_id
      and ap.user_id = (select auth.uid())
      and ap.status in ('probation', 'active')
  )
);

drop policy if exists "record_label_album_artist_update"
  on public.record_label_albums;

create policy "record_label_album_artist_update"
on public.record_label_albums
for update
to authenticated
using (
  exists (
    select 1
    from public.record_label_artist_profiles ap
    where ap.id = artist_id
      and ap.user_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1
    from public.record_label_artist_profiles ap
    where ap.id = artist_id
      and ap.user_id = (select auth.uid())
  )
);

-- ============================================================
-- TRACK POLICIES
-- ============================================================

drop policy if exists "record_label_track_public_read"
  on public.record_label_tracks;

create policy "record_label_track_public_read"
on public.record_label_tracks
for select
to anon, authenticated
using (
  status = 'published'
  or exists (
    select 1
    from public.record_label_artist_profiles ap
    where ap.id = artist_id
      and ap.user_id = (select auth.uid())
  )
);

drop policy if exists "record_label_track_artist_insert"
  on public.record_label_tracks;

create policy "record_label_track_artist_insert"
on public.record_label_tracks
for insert
to authenticated
with check (
  exists (
    select 1
    from public.record_label_artist_profiles ap
    where ap.id = artist_id
      and ap.user_id = (select auth.uid())
      and ap.status in ('probation', 'active')
  )
);

drop policy if exists "record_label_track_artist_update"
  on public.record_label_tracks;

create policy "record_label_track_artist_update"
on public.record_label_tracks
for update
to authenticated
using (
  exists (
    select 1
    from public.record_label_artist_profiles ap
    where ap.id = artist_id
      and ap.user_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1
    from public.record_label_artist_profiles ap
    where ap.id = artist_id
      and ap.user_id = (select auth.uid())
  )
);

-- ============================================================
-- LIKE POLICIES
-- ============================================================

drop policy if exists "record_label_likes_public_read"
  on public.record_label_track_likes;

create policy "record_label_likes_public_read"
on public.record_label_track_likes
for select
to anon, authenticated
using (true);

drop policy if exists "record_label_likes_insert_own"
  on public.record_label_track_likes;

create policy "record_label_likes_insert_own"
on public.record_label_track_likes
for insert
to authenticated
with check (
  (select auth.uid()) = user_id
);

drop policy if exists "record_label_likes_delete_own"
  on public.record_label_track_likes;

create policy "record_label_likes_delete_own"
on public.record_label_track_likes
for delete
to authenticated
using (
  (select auth.uid()) = user_id
);

-- ============================================================
-- CONTRACT READ
-- ============================================================

drop policy if exists "record_label_contract_artist_read"
  on public.record_label_contracts;

create policy "record_label_contract_artist_read"
on public.record_label_contracts
for select
to authenticated
using (
  exists (
    select 1
    from public.record_label_artist_profiles ap
    where ap.id = artist_id
      and ap.user_id = (select auth.uid())
  )
);

-- ============================================================
-- BALANCE READ
-- ============================================================

drop policy if exists "record_label_balance_artist_read"
  on public.record_label_artist_balances;

create policy "record_label_balance_artist_read"
on public.record_label_artist_balances
for select
to authenticated
using (
  exists (
    select 1
    from public.record_label_artist_profiles ap
    where ap.id = artist_id
      and ap.user_id = (select auth.uid())
  )
);

-- ============================================================
-- TRANSACTION READ
-- ============================================================

drop policy if exists "record_label_transaction_artist_read"
  on public.record_label_transactions;

create policy "record_label_transaction_artist_read"
on public.record_label_transactions
for select
to authenticated
using (
  exists (
    select 1
    from public.record_label_artist_profiles ap
    where ap.id = artist_id
      and ap.user_id = (select auth.uid())
  )
);

-- ============================================================
-- GRANTS
-- ============================================================

grant select on public.record_label_artist_profiles
  to anon, authenticated;

grant select on public.record_label_albums
  to anon, authenticated;

grant select on public.record_label_tracks
  to anon, authenticated;

grant select on public.record_label_track_likes
  to anon, authenticated;

grant select, insert on public.record_label_applications
  to authenticated;

grant select, update on public.record_label_artist_profiles
  to authenticated;

grant select, insert, update on public.record_label_albums
  to authenticated;

grant select, insert, update on public.record_label_tracks
  to authenticated;

grant select, insert, delete on public.record_label_track_likes
  to authenticated;

grant select on public.record_label_contracts
  to authenticated;

grant select on public.record_label_artist_balances
  to authenticated;

grant select on public.record_label_transactions
  to authenticated;

commit;
