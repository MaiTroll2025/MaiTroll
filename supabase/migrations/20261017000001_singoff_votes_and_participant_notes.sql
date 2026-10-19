create table if not exists public.mai_singoff_participant_notes (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.mai_singoff_sessions(id) on delete cascade,
  participant_user_id uuid not null references public.user_profiles(id) on delete cascade,
  author_user_id uuid not null references public.user_profiles(id) on delete cascade,
  note text not null default '',
  updated_at timestamptz not null default now(),
  unique (session_id, participant_user_id, author_user_id),
  check (char_length(note) <= 2000)
);

alter table public.mai_singoff_participant_notes enable row level security;

create or replace function public.singoff_get_participant_note(
  p_session_id uuid,
  p_participant_user_id uuid
) returns json
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_note text;
begin
  if v_user_id is null then
    return json_build_object('success', false, 'error', 'authentication required');
  end if;

  if not (
    public.singoff_can_manage_session(p_session_id, v_user_id)
    or public.singoff_is_active_judge(p_session_id, v_user_id)
    or exists (
      select 1
      from public.mai_singoff_participants p
      where p.session_id = p_session_id
        and p.user_id = v_user_id
        and p.role in ('host','host_judge')
        and p.position in ('host_stage','host_judge')
    )
  ) then
    return json_build_object('success', false, 'error', 'a seated host or judge is required');
  end if;

  if not exists (
    select 1
    from public.mai_singoff_participants p
    where p.session_id = p_session_id
      and p.user_id = p_participant_user_id
  ) then
    return json_build_object('success', false, 'error', 'participant is not in this show');
  end if;

  select n.note into v_note
  from public.mai_singoff_participant_notes n
  where n.session_id = p_session_id
    and n.participant_user_id = p_participant_user_id
    and n.author_user_id = v_user_id;

  return json_build_object('success', true, 'note', coalesce(v_note, ''));
end;
$$;

create or replace function public.singoff_save_participant_note(
  p_session_id uuid,
  p_participant_user_id uuid,
  p_note text
) returns json
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_note text := coalesce(p_note, '');
begin
  if v_user_id is null then
    return json_build_object('success', false, 'error', 'authentication required');
  end if;

  if char_length(v_note) > 2000 then
    return json_build_object('success', false, 'error', 'notes must be 2,000 characters or fewer');
  end if;

  if not (
    public.singoff_can_manage_session(p_session_id, v_user_id)
    or public.singoff_is_active_judge(p_session_id, v_user_id)
    or exists (
      select 1
      from public.mai_singoff_participants p
      where p.session_id = p_session_id
        and p.user_id = v_user_id
        and p.role in ('host','host_judge')
        and p.position in ('host_stage','host_judge')
    )
  ) then
    return json_build_object('success', false, 'error', 'a seated host or judge is required');
  end if;

  if not exists (
    select 1
    from public.mai_singoff_participants p
    where p.session_id = p_session_id
      and p.user_id = p_participant_user_id
  ) then
    return json_build_object('success', false, 'error', 'participant is not in this show');
  end if;

  insert into public.mai_singoff_participant_notes (
    session_id,
    participant_user_id,
    author_user_id,
    note,
    updated_at
  )
  values (p_session_id, p_participant_user_id, v_user_id, v_note, now())
  on conflict (session_id, participant_user_id, author_user_id) do update
    set note = excluded.note,
        updated_at = excluded.updated_at;

  return json_build_object('success', true, 'note', v_note);
end;
$$;

create or replace function public.singoff_submit_decision(
  p_session_id uuid,
  p_round_id uuid,
  p_judge_id uuid,
  p_challenger_id uuid,
  p_decision text,
  p_is_mai_winner boolean default false
) returns json
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_role text;
  v_position text;
  v_round public.mai_singoff_rounds%rowtype;
  v_decision text;
begin
  if v_user_id is null or p_judge_id <> v_user_id then
    return json_build_object('success', false, 'error', 'vote identity must match the signed-in user');
  end if;

  select p.role, p.position
  into v_role, v_position
  from public.mai_singoff_participants p
  where p.session_id = p_session_id
    and p.user_id = v_user_id;

  if not found
     or v_position not in ('judge_1','judge_2','judge_3','judge_4','host_judge','ceo')
     or v_role not in ('judge','host_judge','ceo_judge') then
    return json_build_object('success', false, 'error', 'enter an authorized judge seat before voting');
  end if;

  select *
  into v_round
  from public.mai_singoff_rounds r
  where r.id = p_round_id
    and r.session_id = p_session_id
  for update;

  if not found or v_round.status <> 'active' then
    return json_build_object('success', false, 'error', 'voting is not open for this round');
  end if;

  if p_challenger_id not in (v_round.challenger_a_id, v_round.challenger_b_id) then
    return json_build_object('success', false, 'error', 'participant is not competing in this round');
  end if;

  if p_is_mai_winner then
    if v_position <> 'ceo' and not public.singoff_is_staff(v_user_id) then
      return json_build_object('success', false, 'error', 'only the CEO seat or staff can award Mai Winner');
    end if;
    v_decision := 'mai_winner';
    if exists (
      select 1
      from public.mai_singoff_decisions d
      where d.session_id = p_session_id
        and d.round_id = p_round_id
        and d.decision = 'mai_winner'
        and d.challenger_id <> p_challenger_id
    ) then
      return json_build_object('success', false, 'error', 'a Mai Winner is already declared for another participant');
    end if;
  elsif p_decision in ('yes','no') then
    v_decision := p_decision;
  else
    return json_build_object('success', false, 'error', 'vote must be yes or no');
  end if;

  insert into public.mai_singoff_decisions
    (session_id, round_id, judge_id, challenger_id, decision)
  values
    (p_session_id, p_round_id, v_user_id, p_challenger_id, v_decision)
  on conflict (session_id, round_id, judge_id, challenger_id) do update
    set decision = excluded.decision,
        created_at = now();

  return json_build_object('success', true, 'decision', v_decision);
end;
$$;

revoke all on function public.singoff_get_participant_note(uuid, uuid) from public, anon;
revoke all on function public.singoff_save_participant_note(uuid, uuid, text) from public, anon;
revoke all on function public.singoff_submit_decision(uuid, uuid, uuid, uuid, text, boolean) from public, anon;
grant execute on function public.singoff_get_participant_note(uuid, uuid) to authenticated;
grant execute on function public.singoff_save_participant_note(uuid, uuid, text) to authenticated;
grant execute on function public.singoff_submit_decision(uuid, uuid, uuid, uuid, text, boolean) to authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1
       from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = 'mai_singoff_sessions'
     ) then
    execute 'alter publication supabase_realtime add table public.mai_singoff_sessions';
  end if;
end;
$$;
