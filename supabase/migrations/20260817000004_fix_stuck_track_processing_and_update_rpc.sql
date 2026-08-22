-- Fix stuck track processing status and update dashboard RPC
-- Run this migration to update tracks that were left in "processing" state
-- and ensure the artist dashboard counts them properly.

-- 1. Update existing stuck processing tracks to published
update public.record_label_tracks
set status = 'published', updated_at = now()
where status = 'processing';

-- 2. Update the artist dashboard RPC to count both published and processing tracks
create or replace function public.get_mai_artist_dashboard(
  p_user_id uuid
)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_artist_id uuid;
  v_result jsonb;
begin
  select id into v_artist_id
  from public.record_label_artist_profiles
  where user_id = p_user_id
  limit 1;

  if not found then
    return jsonb_build_object('success', false, 'error', 'Not an artist');
  end if;

  select jsonb_build_object(
    'success', true,
    'artist_id', v_artist_id,
    'stats', (
      select jsonb_build_object(
        'total_tracks', count(*) filter (where status in ('published', 'processing')),
        'total_albums', count(*) filter (where status = 'published'),
        'total_likes', coalesce(sum(like_count), 0),
        'total_plays', coalesce(sum(play_count), 0),
        'total_tips', coalesce(sum(tip_coins), 0)
      )
      from public.record_label_tracks
      where artist_id = v_artist_id
    ),
    'balance', (
      select jsonb_build_object(
        'available_coins', available_coins,
        'pending_coins', pending_coins,
        'lifetime_artist_coins', lifetime_artist_coins,
        'lifetime_gross_coins', lifetime_gross_coins
      )
      from public.record_label_artist_balances
      where artist_id = v_artist_id
    ),
    'contract', (
      select jsonb_build_object(
        'id', id,
        'contract_number', contract_number,
        'tier', tier,
        'artist_split_bps', artist_split_bps,
        'label_split_bps', label_split_bps,
        'status', status,
        'effective_at', effective_at,
        'probation_ends_at', probation_ends_at,
        'terms_version', terms_version
      )
      from public.record_label_contracts
      where artist_id = v_artist_id
        and status in ('pending_signature', 'pending_notarization', 'active')
      order by created_at desc
      limit 1
    )
  ) into v_result;

  return v_result;
end;
$$;
