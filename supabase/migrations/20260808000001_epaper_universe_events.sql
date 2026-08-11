-- Migration: EPaper — Universe Events Edition (newspaper aggregation).
-- Adds a single read-only RPC that UNIONs all "newsworthy" real-time events
-- from across Troll City into one feed for the newspaper page:
--   • Scheduled Mai Sing Off shows          (mai_singoff_sessions)
--   • Active/upcoming championships        (mai_singoff_championships)
--   • Live/upcoming battles                (battle_sessions)
--   • Arrests / jail incidents             (public.jail)
--   • Universe tournaments                 (universe_events)
--   • Universe Showdown battles            (universe_showdown_battles)
-- Plus the story feed remains separate (epaper_stories via get_epaper_stories).
-- Date: 2026-08-08

-- =========================================================================
-- 1. Uniform event shape
--    id            text (stable public id)
--    event_type    show | championship | battle | arrest | universe | showdown
--    title         headline
--    subtitle      supporting line (participants, reason, venue, …)
--    status        display status
--    occurs_at     sortable timestamp (scheduled/started/created)
--    meta          jsonb (extra fields for the UI, e.g. prize, release_time)
--    route         client-side navigation target
-- =========================================================================

create or replace function public.epaper_get_universe_events(p_limit integer default 40)
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_json json;
begin
  with all_events as (
    -- Scheduled Mai Sing Off shows
    select
      'show'::text as event_type,
      s.id::text as id,
      coalesce(s.title, 'Mai Sing Off') as title,
      coalesce(h.display_name, 'Host TBA') as subtitle,
      s.status as status,
      s.scheduled_at as occurs_at,
      jsonb_build_object(
        'room_name', s.room_name,
        'host_id', s.host_id,
        'kind', 'show'
      ) as meta,
      '/mai-sing-off/live/' || s.id as route
    from public.mai_singoff_sessions s
    left join public.user_profiles h on h.id = s.host_id
    where s.status = 'scheduled' and s.scheduled_at >= now()

    union all

    -- Active/upcoming championships
    select
      'championship'::text as event_type,
      c.id::text as id,
      c.name as title,
      case when c.status = 'active' then 'Season ' || coalesce(c.season_number::text, '?') || ' — LIVE NOW'
           else 'Season ' || coalesce(c.season_number::text, '?') || ' — upcoming' end as subtitle,
      c.status as status,
      coalesce(c.start_at, c.created_at) as occurs_at,
      jsonb_build_object(
        'season_number', c.season_number,
        'grand_prize_coins', c.grand_prize_coins,
        'grand_prize_description', c.grand_prize_description,
        'entries_limit', c.entries_limit,
        'kind', 'championship'
      ) as meta,
      '/mai-sing-off?view=championship' as route
    from public.mai_singoff_championships c
    where c.status in ('upcoming','active')

    union all

    -- Live/upcoming battles
    select
      'battle'::text as event_type,
      b.id::text as id,
      'Troll Battle' as title,
      'Stream ' || coalesce(b.stream_id_a, '?') || ' vs Stream ' || coalesce(b.stream_id_b, '?') as subtitle,
      b.status as status,
      coalesce(b.started_at, b.created_at) as occurs_at,
      jsonb_build_object(
        'stream_id_a', b.stream_id_a,
        'stream_id_b', b.stream_id_b,
        'score_a', b.score_a,
        'score_b', b.score_b,
        'winner', b.winner,
        'kind', 'battle'
      ) as meta,
      '/live' as route
    from public.battle_sessions b
    where b.status in ('pre_battle','active')
      and coalesce(b.started_at, b.created_at) >= now() - interval '6 hours'

    union all

    -- Arrests / jail incidents
    (
      select
        'arrest'::text as event_type,
        j.id::text as id,
        case when p.display_name is not null then p.display_name || ' arrested'
             else 'Troll arrested' end as title,
        coalesce(j.reason, 'Booked into Troll City jail') as subtitle,
        case when j.release_time > now() then 'incarcerated' else 'released' end as status,
        j.created_at as occurs_at,
        jsonb_build_object(
          'user_id', j.user_id,
          'release_time', j.release_time,
          'kind', 'arrest'
        ) as meta,
        '/jail' as route
      from public.jail j
      left join public.user_profiles p on p.id = j.user_id
      order by j.created_at desc
      limit 20
    )

    union all

    -- Universe tournaments
    select
      'universe'::text as event_type,
      ue.id::text as id,
      ue.title as title,
      case when ue.status = 'active' then 'Live now'
           when ue.status = 'registration_open' then 'Registration open'
           else ue.status end as subtitle,
      ue.status as status,
      ue.scheduled_start as occurs_at,
      jsonb_build_object(
        'event_date', ue.event_date,
        'timezone', ue.timezone,
        'kind', 'universe'
      ) as meta,
      '/universe' as route
    from public.universe_events ue
    where ue.status <> 'cancelled'
      and ue.scheduled_start >= now() - interval '6 hours'

    union all

    -- Universe Showdown battles
    select
      'showdown'::text as event_type,
      usb.id::text as id,
      'Universe Showdown' as title,
      usb.status as subtitle,
      usb.status as status,
      usb.scheduled_start as occurs_at,
      jsonb_build_object(
        'capacity', usb.capacity,
        'registered_count', usb.registered_count,
        'guest_count', usb.guest_count,
        'kind', 'showdown'
      ) as meta,
      '/universe' as route
    from public.universe_showdown_battles usb
    where usb.status in ('open','full','sealed','active')
      and usb.scheduled_start >= now() - interval '6 hours'
  )
  select coalesce(json_agg(
    json_build_object(
      'id', e.id,
      'event_type', e.event_type,
      'title', e.title,
      'subtitle', e.subtitle,
      'status', e.status,
      'occurs_at', e.occurs_at,
      'meta', e.meta,
      'route', e.route
    ) order by e.occurs_at asc nulls last
  ), '[]'::json)
  into v_json
  from (
    select * from all_events
    order by occurs_at asc nulls last
    limit greatest(least(p_limit, 100), 1)
  ) e;

  return v_json;
end;
$$;

-- =========================================================================
-- 2. Grants
-- =========================================================================

grant execute on function public.epaper_get_universe_events(integer) to authenticated, anon;

-- Backward-compatible zero-arg wrapper for convenience.
create or replace function public.epaper_get_universe_events()
returns json
language sql
stable
security definer
set search_path = public
as $$
  select public.epaper_get_universe_events(40);
$$;

grant execute on function public.epaper_get_universe_events() to authenticated, anon;

