BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$ BEGIN
  CREATE TYPE public.trocean_team AS ENUM ('tide','storm');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE public.trocean_match_status AS ENUM ('lobby','placement','active','paused','completed','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE public.trocean_attack_result AS ENUM ('miss','takedown','blocked');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.trocean_matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (char_length(name) BETWEEN 3 AND 80),
  created_by uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  status public.trocean_match_status NOT NULL DEFAULT 'lobby',
  visibility text NOT NULL DEFAULT 'public' CHECK (visibility IN ('public','private')),
  team_tide_name text NOT NULL DEFAULT 'Team Tide',
  team_storm_name text NOT NULL DEFAULT 'Team Storm',
  max_players integer NOT NULL DEFAULT 12 CHECK (max_players = 12),
  players_per_team integer NOT NULL DEFAULT 6 CHECK (players_per_team = 6),
  current_round integer NOT NULL DEFAULT 0,
  current_turn_number integer NOT NULL DEFAULT 0,
  current_turn_player_id uuid,
  turn_started_at timestamptz,
  turn_ends_at timestamptz,
  turn_seconds integer NOT NULL DEFAULT 30 CHECK (turn_seconds BETWEEN 10 AND 120),
  attack_cost bigint NOT NULL DEFAULT 50 CHECK (attack_cost >= 0),
  takedown_reward bigint NOT NULL DEFAULT 100 CHECK (takedown_reward >= 0),
  match_duration_minutes integer NOT NULL DEFAULT 15 CHECK (match_duration_minutes BETWEEN 5 AND 180),
  spectator_count integer NOT NULL DEFAULT 0,
  prize_pool bigint NOT NULL DEFAULT 0,
  winner_team public.trocean_team,
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.trocean_match_players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL REFERENCES public.trocean_matches(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  team public.trocean_team NOT NULL,
  team_slot integer NOT NULL CHECK (team_slot BETWEEN 1 AND 6),
  is_ready boolean NOT NULL DEFAULT false,
  is_connected boolean NOT NULL DEFAULT false,
  is_eliminated boolean NOT NULL DEFAULT false,
  eliminated_at timestamptz,
  eliminated_by uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  takedowns integer NOT NULL DEFAULT 0,
  attacks integer NOT NULL DEFAULT 0,
  misses integer NOT NULL DEFAULT 0,
  coins_spent bigint NOT NULL DEFAULT 0,
  coins_earned bigint NOT NULL DEFAULT 0,
  joined_at timestamptz NOT NULL DEFAULT now(),
  left_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(match_id,user_id),
  UNIQUE(match_id,team,team_slot)
);

ALTER TABLE public.trocean_matches
  DROP CONSTRAINT IF EXISTS trocean_matches_current_turn_player_id_fkey;
ALTER TABLE public.trocean_matches
  ADD CONSTRAINT trocean_matches_current_turn_player_id_fkey
  FOREIGN KEY (current_turn_player_id) REFERENCES public.trocean_match_players(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.trocean_player_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL REFERENCES public.trocean_matches(id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES public.trocean_match_players(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  tile_coordinate text NOT NULL CHECK (tile_coordinate ~ '^[A-L]([1-9]|1[0-2])$'),
  region_code text,
  is_locked boolean NOT NULL DEFAULT true,
  locked_at timestamptz NOT NULL DEFAULT now(),
  revealed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(match_id,player_id),
  UNIQUE(match_id,tile_coordinate)
);

CREATE TABLE IF NOT EXISTS public.trocean_attacks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL,
  match_id uuid NOT NULL REFERENCES public.trocean_matches(id) ON DELETE CASCADE,
  attacker_player_id uuid NOT NULL REFERENCES public.trocean_match_players(id) ON DELETE CASCADE,
  attacker_user_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  target_tile text NOT NULL CHECK (target_tile ~ '^[A-L]([1-9]|1[0-2])$'),
  result public.trocean_attack_result NOT NULL,
  target_player_id uuid REFERENCES public.trocean_match_players(id) ON DELETE SET NULL,
  coin_cost bigint NOT NULL DEFAULT 0,
  coin_reward bigint NOT NULL DEFAULT 0,
  round_number integer NOT NULL,
  turn_number integer NOT NULL,
  trump_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(match_id,request_id),
  UNIQUE(match_id,target_tile)
);

CREATE TABLE IF NOT EXISTS public.trocean_trumps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL REFERENCES public.trocean_matches(id) ON DELETE CASCADE,
  trump_type text NOT NULL,
  visibility text NOT NULL DEFAULT 'public' CHECK (visibility IN ('public','team','player')),
  team public.trocean_team,
  target_player_id uuid REFERENCES public.trocean_match_players(id) ON DELETE SET NULL,
  safe_message text NOT NULL,
  effect_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  starts_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.trocean_match_events (
  id bigint GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  match_id uuid NOT NULL REFERENCES public.trocean_matches(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  actor_user_id uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  public_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.trocean_player_stats (
  user_id uuid PRIMARY KEY REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  matches_played integer NOT NULL DEFAULT 0,
  matches_won integer NOT NULL DEFAULT 0,
  takedowns integer NOT NULL DEFAULT 0,
  attacks integer NOT NULL DEFAULT 0,
  misses integer NOT NULL DEFAULT 0,
  coins_spent bigint NOT NULL DEFAULT 0,
  coins_earned bigint NOT NULL DEFAULT 0,
  longest_survival_seconds integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.trocean_coin_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  match_id uuid NOT NULL REFERENCES public.trocean_matches(id) ON DELETE CASCADE,
  attack_id uuid REFERENCES public.trocean_attacks(id) ON DELETE SET NULL,
  amount bigint NOT NULL,
  transaction_type text NOT NULL CHECK (transaction_type IN ('trocean_attack_cost','trocean_takedown_reward','trocean_trump_bonus','trocean_match_reward','trocean_refund')),
  reference_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.trocean_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL REFERENCES public.trocean_matches(id) ON DELETE CASCADE,
  reported_by uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  reported_user_id uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  report_type text NOT NULL,
  details text,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','reviewing','resolved','dismissed')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_trocean_matches_status ON public.trocean_matches(status,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_trocean_players_match ON public.trocean_match_players(match_id,team,team_slot);
CREATE INDEX IF NOT EXISTS idx_trocean_attacks_match ON public.trocean_attacks(match_id,created_at);
CREATE INDEX IF NOT EXISTS idx_trocean_events_match ON public.trocean_match_events(match_id,created_at DESC);

ALTER TABLE public.trocean_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trocean_match_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trocean_player_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trocean_attacks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trocean_trumps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trocean_match_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trocean_player_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trocean_coin_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trocean_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS trocean_matches_public_read ON public.trocean_matches;
CREATE POLICY trocean_matches_public_read ON public.trocean_matches FOR SELECT USING (visibility='public' OR created_by=auth.uid() OR EXISTS (SELECT 1 FROM public.trocean_match_players p WHERE p.match_id=id AND p.user_id=auth.uid()));
DROP POLICY IF EXISTS trocean_players_public_read ON public.trocean_match_players;
CREATE POLICY trocean_players_public_read ON public.trocean_match_players FOR SELECT USING (true);
DROP POLICY IF EXISTS trocean_attacks_public_read ON public.trocean_attacks;
CREATE POLICY trocean_attacks_public_read ON public.trocean_attacks FOR SELECT USING (true);
DROP POLICY IF EXISTS trocean_trumps_public_read ON public.trocean_trumps;
CREATE POLICY trocean_trumps_public_read ON public.trocean_trumps FOR SELECT USING (visibility='public' OR (visibility='team' AND team=(SELECT p.team FROM public.trocean_match_players p WHERE p.match_id=trocean_trumps.match_id AND p.user_id=auth.uid())) OR target_player_id=(SELECT p.id FROM public.trocean_match_players p WHERE p.match_id=trocean_trumps.match_id AND p.user_id=auth.uid()));
DROP POLICY IF EXISTS trocean_events_public_read ON public.trocean_match_events;
CREATE POLICY trocean_events_public_read ON public.trocean_match_events FOR SELECT USING (true);
DROP POLICY IF EXISTS trocean_stats_public_read ON public.trocean_player_stats;
CREATE POLICY trocean_stats_public_read ON public.trocean_player_stats FOR SELECT USING (true);
DROP POLICY IF EXISTS trocean_reports_insert ON public.trocean_reports;
CREATE POLICY trocean_reports_insert ON public.trocean_reports FOR INSERT WITH CHECK (reported_by=auth.uid());

-- Intentionally no SELECT policy on trocean_player_locations or trocean_coin_transactions.

CREATE OR REPLACE FUNCTION public.trocean_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at=now(); RETURN NEW; END $$;
DROP TRIGGER IF EXISTS trocean_matches_touch ON public.trocean_matches;
CREATE TRIGGER trocean_matches_touch BEFORE UPDATE ON public.trocean_matches FOR EACH ROW EXECUTE FUNCTION public.trocean_touch_updated_at();
DROP TRIGGER IF EXISTS trocean_players_touch ON public.trocean_match_players;
CREATE TRIGGER trocean_players_touch BEFORE UPDATE ON public.trocean_match_players FOR EACH ROW EXECUTE FUNCTION public.trocean_touch_updated_at();

CREATE OR REPLACE FUNCTION public.create_trocean_lobby(p_name text, p_visibility text DEFAULT 'public')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_id uuid; BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  INSERT INTO public.trocean_matches(name,created_by,visibility) VALUES (btrim(p_name),auth.uid(),CASE WHEN p_visibility='private' THEN 'private' ELSE 'public' END) RETURNING id INTO v_id;
  RETURN jsonb_build_object('success',true,'match_id',v_id);
END $$;

CREATE OR REPLACE FUNCTION public.join_trocean_team(p_match_id uuid,p_team public.trocean_team,p_team_slot integer DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_slot integer; v_player uuid; BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  PERFORM 1 FROM public.trocean_matches WHERE id=p_match_id AND status='lobby' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Lobby unavailable'; END IF;
  IF EXISTS(SELECT 1 FROM public.trocean_match_players WHERE match_id=p_match_id AND user_id=auth.uid()) THEN RAISE EXCEPTION 'Already joined'; END IF;
  IF p_team_slot IS NULL THEN SELECT s INTO v_slot FROM generate_series(1,6) s WHERE NOT EXISTS(SELECT 1 FROM public.trocean_match_players p WHERE p.match_id=p_match_id AND p.team=p_team AND p.team_slot=s) ORDER BY s LIMIT 1; ELSE v_slot:=p_team_slot; END IF;
  IF v_slot IS NULL OR v_slot NOT BETWEEN 1 AND 6 THEN RAISE EXCEPTION 'Team is full'; END IF;
  INSERT INTO public.trocean_match_players(match_id,user_id,team,team_slot) VALUES(p_match_id,auth.uid(),p_team,v_slot) RETURNING id INTO v_player;
  INSERT INTO public.trocean_match_events(match_id,event_type,actor_user_id,public_payload) VALUES(p_match_id,'player_joined',auth.uid(),jsonb_build_object('team',p_team,'slot',v_slot));
  RETURN jsonb_build_object('success',true,'player_id',v_player,'team',p_team,'team_slot',v_slot);
END $$;

CREATE OR REPLACE FUNCTION public.choose_trocean_location(p_match_id uuid,p_selected_tile text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_player uuid; BEGIN
  IF p_selected_tile !~ '^[A-L]([1-9]|1[0-2])$' THEN RETURN jsonb_build_object('success',false,'location_locked',false,'error_code','invalid_tile'); END IF;
  SELECT id INTO v_player FROM public.trocean_match_players WHERE match_id=p_match_id AND user_id=auth.uid() AND is_eliminated=false;
  IF v_player IS NULL THEN RETURN jsonb_build_object('success',false,'location_locked',false,'error_code','not_a_player'); END IF;
  IF EXISTS(SELECT 1 FROM public.trocean_player_locations WHERE match_id=p_match_id AND player_id=v_player) THEN RETURN jsonb_build_object('success',false,'location_locked',true,'error_code','already_locked'); END IF;
  BEGIN INSERT INTO public.trocean_player_locations(match_id,player_id,user_id,tile_coordinate) VALUES(p_match_id,v_player,auth.uid(),upper(p_selected_tile));
  EXCEPTION WHEN unique_violation THEN RETURN jsonb_build_object('success',false,'location_locked',false,'error_code','tile_unavailable'); END;
  RETURN jsonb_build_object('success',true,'location_locked',true,'error_code',null);
END $$;

CREATE OR REPLACE FUNCTION public.set_trocean_ready(p_match_id uuid,p_ready boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF p_ready AND NOT EXISTS(SELECT 1 FROM public.trocean_player_locations l JOIN public.trocean_match_players p ON p.id=l.player_id WHERE p.match_id=p_match_id AND p.user_id=auth.uid()) THEN RAISE EXCEPTION 'Lock a hidden location first'; END IF;
  UPDATE public.trocean_match_players SET is_ready=p_ready WHERE match_id=p_match_id AND user_id=auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'Not in lobby'; END IF;
  RETURN jsonb_build_object('success',true,'ready',p_ready);
END $$;

CREATE OR REPLACE FUNCTION public.start_trocean_match(p_match_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_creator uuid; v_first uuid; BEGIN
  SELECT created_by INTO v_creator FROM public.trocean_matches WHERE id=p_match_id AND status='lobby' FOR UPDATE;
  IF v_creator IS NULL THEN RAISE EXCEPTION 'Lobby unavailable'; END IF;
  IF auth.uid()<>v_creator THEN RAISE EXCEPTION 'Only the creator may start'; END IF;
  IF (SELECT count(*) FROM public.trocean_match_players WHERE match_id=p_match_id)<>12 OR EXISTS(SELECT 1 FROM public.trocean_match_players WHERE match_id=p_match_id AND is_ready=false) THEN RAISE EXCEPTION 'All 12 hosts must be ready'; END IF;
  SELECT id INTO v_first FROM public.trocean_match_players WHERE match_id=p_match_id ORDER BY team_slot,team LIMIT 1;
  UPDATE public.trocean_matches SET status='active',current_round=1,current_turn_number=1,current_turn_player_id=v_first,turn_started_at=now(),turn_ends_at=now()+make_interval(secs=>turn_seconds),started_at=now() WHERE id=p_match_id;
  INSERT INTO public.trocean_match_events(match_id,event_type,public_payload) VALUES(p_match_id,'match_started',jsonb_build_object('current_player_id',v_first));
  RETURN jsonb_build_object('success',true);
END $$;

CREATE OR REPLACE FUNCTION public.trocean_advance_turn(p_match_id uuid,p_current_player uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_next uuid; v_round integer; BEGIN
  SELECT current_round INTO v_round FROM public.trocean_matches WHERE id=p_match_id FOR UPDATE;
  SELECT p.id INTO v_next FROM public.trocean_match_players p WHERE p.match_id=p_match_id AND p.is_eliminated=false AND p.id<>p_current_player ORDER BY CASE WHEN p.team=(SELECT team FROM public.trocean_match_players WHERE id=p_current_player) THEN 1 ELSE 0 END,p.team_slot,p.joined_at LIMIT 1;
  IF v_next IS NULL THEN RETURN NULL; END IF;
  UPDATE public.trocean_matches SET current_turn_player_id=v_next,current_turn_number=current_turn_number+1,current_round=CASE WHEN mod(current_turn_number,12)=0 THEN current_round+1 ELSE current_round END,turn_started_at=now(),turn_ends_at=now()+make_interval(secs=>turn_seconds) WHERE id=p_match_id;
  RETURN v_next;
END $$;

CREATE OR REPLACE FUNCTION public.submit_trocean_attack(p_match_id uuid,p_target_tile text,p_request_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_match public.trocean_matches%rowtype; v_attacker public.trocean_match_players%rowtype; v_target public.trocean_match_players%rowtype; v_target_location uuid; v_attack_id uuid; v_result public.trocean_attack_result; v_reward bigint:=0; v_username text; v_tide_left integer; v_storm_left integer; BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF p_target_tile !~ '^[A-L]([1-9]|1[0-2])$' THEN RAISE EXCEPTION 'Invalid tile'; END IF;
  SELECT * INTO v_match FROM public.trocean_matches WHERE id=p_match_id FOR UPDATE;
  IF v_match.status<>'active' THEN RAISE EXCEPTION 'Match is not active'; END IF;
  SELECT * INTO v_attacker FROM public.trocean_match_players WHERE id=v_match.current_turn_player_id AND user_id=auth.uid() FOR UPDATE;
  IF v_attacker.id IS NULL OR v_attacker.is_eliminated THEN RAISE EXCEPTION 'It is not your turn'; END IF;
  IF v_match.turn_ends_at<now() THEN RAISE EXCEPTION 'Turn expired'; END IF;
  IF EXISTS(SELECT 1 FROM public.trocean_attacks WHERE match_id=p_match_id AND target_tile=upper(p_target_tile)) THEN RAISE EXCEPTION 'Tile already attacked'; END IF;
  UPDATE public.user_profiles SET troll_coins=troll_coins-v_match.attack_cost WHERE id=auth.uid() AND troll_coins>=v_match.attack_cost;
  IF NOT FOUND THEN RAISE EXCEPTION 'Not enough Troll Coins'; END IF;
  SELECT l.id INTO v_target_location FROM public.trocean_player_locations l WHERE l.match_id=p_match_id AND l.tile_coordinate=upper(p_target_tile) AND EXISTS (SELECT 1 FROM public.trocean_match_players p WHERE p.id=l.player_id AND p.is_eliminated=false) LIMIT 1;
  IF v_target_location IS NOT NULL THEN
    SELECT * INTO v_target FROM public.trocean_match_players WHERE id=(SELECT player_id FROM public.trocean_player_locations WHERE id=v_target_location) AND is_eliminated=false LIMIT 1;
  END IF;
  IF v_target.id IS NULL OR v_target.team=v_attacker.team THEN v_result:='miss'; ELSE v_result:='takedown'; v_reward:=v_match.takedown_reward; UPDATE public.trocean_match_players SET is_eliminated=true,eliminated_at=now(),eliminated_by=auth.uid() WHERE id=v_target.id; UPDATE public.trocean_player_locations SET revealed_at=now() WHERE id=v_target_location; UPDATE public.user_profiles SET troll_coins=troll_coins+v_reward WHERE id=auth.uid(); SELECT username INTO v_username FROM public.user_profiles WHERE id=v_target.user_id; END IF;
  INSERT INTO public.trocean_attacks(request_id,match_id,attacker_player_id,attacker_user_id,target_tile,result,target_player_id,coin_cost,coin_reward,round_number,turn_number) VALUES(p_request_id,p_match_id,v_attacker.id,auth.uid(),upper(p_target_tile),v_result,v_target.id,v_match.attack_cost,v_reward,v_match.current_round,v_match.current_turn_number) RETURNING id INTO v_attack_id;
  INSERT INTO public.trocean_coin_transactions(user_id,match_id,attack_id,amount,transaction_type,reference_key) VALUES(auth.uid(),p_match_id,v_attack_id,-v_match.attack_cost,'trocean_attack_cost','attack:'||v_attack_id||':cost');
  IF v_reward>0 THEN INSERT INTO public.trocean_coin_transactions(user_id,match_id,attack_id,amount,transaction_type,reference_key) VALUES(auth.uid(),p_match_id,v_attack_id,v_reward,'trocean_takedown_reward','attack:'||v_attack_id||':reward'); END IF;
  UPDATE public.trocean_match_players SET attacks=attacks+1,misses=misses+CASE WHEN v_result='miss' THEN 1 ELSE 0 END,takedowns=takedowns+CASE WHEN v_result='takedown' THEN 1 ELSE 0 END,coins_spent=coins_spent+v_match.attack_cost,coins_earned=coins_earned+v_reward WHERE id=v_attacker.id;
  INSERT INTO public.trocean_match_events(match_id,event_type,actor_user_id,public_payload) VALUES(p_match_id,CASE WHEN v_result='takedown' THEN 'player_taken_down' ELSE 'attack_missed' END,auth.uid(),jsonb_build_object('tile',upper(p_target_tile),'result',v_result,'revealed_username',CASE WHEN v_result='takedown' THEN v_username ELSE null END,'coin_cost',v_match.attack_cost,'coin_reward',v_reward));
  SELECT count(*) FILTER(WHERE team='tide' AND is_eliminated=false),count(*) FILTER(WHERE team='storm' AND is_eliminated=false) INTO v_tide_left,v_storm_left FROM public.trocean_match_players WHERE match_id=p_match_id;
  IF v_tide_left=0 OR v_storm_left=0 THEN UPDATE public.trocean_matches SET status='completed',winner_team=CASE WHEN v_tide_left>0 THEN 'tide'::public.trocean_team ELSE 'storm'::public.trocean_team END,ended_at=now(),current_turn_player_id=null,turn_started_at=null,turn_ends_at=null WHERE id=p_match_id; ELSE PERFORM public.trocean_advance_turn(p_match_id,v_attacker.id); END IF;
  RETURN jsonb_build_object('success',true,'attack_id',v_attack_id,'result',v_result,'revealed_username',CASE WHEN v_result='takedown' THEN v_username ELSE null END,'coin_cost',v_match.attack_cost,'coin_reward',v_reward,'message',CASE WHEN v_result='takedown' THEN coalesce(v_username,'Opponent')||' was taken down!' ELSE 'Attack missed.' END);
END $$;

CREATE OR REPLACE FUNCTION public.get_trocean_public_state(p_match_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
SELECT jsonb_build_object(
 'match',to_jsonb(m),
 'players',coalesce((SELECT jsonb_agg(jsonb_build_object('id',p.id,'match_id',p.match_id,'user_id',p.user_id,'team',p.team,'team_slot',p.team_slot,'username',coalesce(u.username,'Unknown'),'avatar_url',u.avatar_url,'is_ready',p.is_ready,'is_connected',p.is_connected,'is_eliminated',p.is_eliminated,'takedowns',p.takedowns,'attacks',p.attacks,'misses',p.misses,'coins_spent',p.coins_spent,'coins_earned',p.coins_earned) ORDER BY p.team,p.team_slot) FROM public.trocean_match_players p LEFT JOIN public.user_profiles u ON u.id=p.user_id WHERE p.match_id=m.id),'[]'::jsonb),
 'attacks',coalesce((SELECT jsonb_agg(jsonb_build_object('id',a.id,'match_id',a.match_id,'attacker_user_id',a.attacker_user_id,'target_tile',a.target_tile,'result',a.result,'revealed_username',CASE WHEN a.result='takedown' THEN u.username ELSE null END,'coin_cost',a.coin_cost,'coin_reward',a.coin_reward,'round_number',a.round_number,'turn_number',a.turn_number,'created_at',a.created_at) ORDER BY a.created_at) FROM public.trocean_attacks a LEFT JOIN public.trocean_match_players tp ON tp.id=a.target_player_id LEFT JOIN public.user_profiles u ON u.id=tp.user_id WHERE a.match_id=m.id),'[]'::jsonb),
 'trumps',coalesce((SELECT jsonb_agg(to_jsonb(t) ORDER BY t.created_at) FROM public.trocean_trumps t WHERE t.match_id=m.id AND t.visibility='public'),'[]'::jsonb),
 'attacked_tiles',coalesce((SELECT jsonb_agg(jsonb_build_object('tile',a.target_tile,'result',a.result,'revealed_username',CASE WHEN a.result='takedown' THEN u.username ELSE null END)) FROM public.trocean_attacks a LEFT JOIN public.trocean_match_players tp ON tp.id=a.target_player_id LEFT JOIN public.user_profiles u ON u.id=tp.user_id WHERE a.match_id=m.id),'[]'::jsonb),
 'spectators',m.spectator_count)
FROM public.trocean_matches m WHERE m.id=p_match_id;
$$;

CREATE OR REPLACE FUNCTION public.get_trocean_private_player_state(p_match_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
SELECT jsonb_build_object('player_id',p.id,'own_tile',l.tile_coordinate,'location_locked',(l.id IS NOT NULL),'is_my_turn',(m.current_turn_player_id=p.id),'valid_actions',CASE WHEN m.current_turn_player_id=p.id AND m.status='active' AND p.is_eliminated=false THEN jsonb_build_array('attack') ELSE '[]'::jsonb END,'private_clue',null)
FROM public.trocean_match_players p JOIN public.trocean_matches m ON m.id=p.match_id LEFT JOIN public.trocean_player_locations l ON l.player_id=p.id WHERE p.match_id=p_match_id AND p.user_id=auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.get_trocean_games_dashboard()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
SELECT jsonb_build_object(
 'totals',jsonb_build_object('active_matches',(SELECT count(*) FROM public.trocean_matches WHERE status='active'),'open_lobbies',(SELECT count(*) FROM public.trocean_matches WHERE status='lobby' AND visibility='public'),'spectators',(SELECT coalesce(sum(spectator_count),0) FROM public.trocean_matches WHERE status='active'),'prize_pool',(SELECT coalesce(sum(prize_pool),0) FROM public.trocean_matches WHERE status='active')),
 'live_matches',coalesce((SELECT jsonb_agg(x) FROM (SELECT m.id,m.team_tide_name,m.team_storm_name,m.current_round,m.spectator_count spectators,(SELECT count(*) FROM public.trocean_match_players p WHERE p.match_id=m.id AND p.is_eliminated=false) hosts_remaining FROM public.trocean_matches m WHERE m.status='active' ORDER BY m.started_at DESC LIMIT 8)x),'[]'::jsonb),
 'open_lobbies',coalesce((SELECT jsonb_agg(x) FROM (SELECT m.id,m.name,m.attack_cost,(SELECT count(*) FROM public.trocean_match_players p WHERE p.match_id=m.id) joined_players,(SELECT count(*) FROM public.trocean_match_players p WHERE p.match_id=m.id AND p.is_ready) ready_players FROM public.trocean_matches m WHERE m.status='lobby' AND m.visibility='public' ORDER BY m.created_at DESC LIMIT 8)x),'[]'::jsonb),
 'leaderboard',coalesce((SELECT jsonb_agg(x) FROM (SELECT s.user_id,coalesce(u.username,'Unknown') username,s.matches_won wins,s.takedowns,CASE WHEN s.attacks=0 THEN 0 ELSE round((s.takedowns::numeric/s.attacks)*100) END accuracy FROM public.trocean_player_stats s LEFT JOIN public.user_profiles u ON u.id=s.user_id ORDER BY s.matches_won DESC,s.takedowns DESC LIMIT 10)x),'[]'::jsonb),
 'my_stats',coalesce((SELECT jsonb_build_object('wins',s.matches_won,'takedowns',s.takedowns,'accuracy',CASE WHEN s.attacks=0 THEN 0 ELSE round((s.takedowns::numeric/s.attacks)*100) END,'net_tc',s.coins_earned-s.coins_spent,'current_lobby',(SELECT m.name FROM public.trocean_matches m JOIN public.trocean_match_players p ON p.match_id=m.id WHERE p.user_id=auth.uid() AND m.status='lobby' ORDER BY p.joined_at DESC LIMIT 1),'active_match',(SELECT m.name FROM public.trocean_matches m JOIN public.trocean_match_players p ON p.match_id=m.id WHERE p.user_id=auth.uid() AND m.status='active' ORDER BY m.started_at DESC LIMIT 1)) FROM public.trocean_player_stats s WHERE s.user_id=auth.uid()),'{}'::jsonb));
$$;

GRANT EXECUTE ON FUNCTION public.create_trocean_lobby(text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.join_trocean_team(uuid,public.trocean_team,integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.choose_trocean_location(uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_trocean_ready(uuid,boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.start_trocean_match(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_trocean_attack(uuid,text,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_trocean_public_state(uuid) TO anon,authenticated;
GRANT EXECUTE ON FUNCTION public.get_trocean_private_player_state(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_trocean_games_dashboard() TO anon,authenticated;

COMMIT;
NOTIFY pgrst,'reload schema';
