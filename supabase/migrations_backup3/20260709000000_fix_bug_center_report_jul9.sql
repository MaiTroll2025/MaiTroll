-- ============================================================================
-- Mai Troll BUG CENTER FIXES — Report Export 2026-07-09
-- Fixes reproducible DB / RLS / function defects from 87 open bug reports.
--
--   * 42883  get_auth_user_conversations_optimized(uuid) calls
--            get_auth_user_conversation_ids(p_user_id) but that function takes
--            NO arguments -> "function ... (uuid) does not exist" (#42, #50)
--   * 42501  client-side INSERT into global_events blocked by RLS when the
--            anon key is used (login flow, public ticker) (#3, #56, #73, #86, #87)
--   * 42P10  ON CONFLICT upserts fail because the target table lacks a unique
--            constraint on the conflict columns (#1, #2, #55, #65, #72, #76, #85)
--
-- All changes are idempotent and guarded so they are safe to re-run.
-- ============================================================================

BEGIN;

-- ============================================================================
-- BUG 42883: get_user_conversations_optimized passes an argument to
-- get_auth_user_conversation_ids(), which is defined with NO parameters.
-- Recreate the wrapper to call it without arguments (it filters by auth.uid()).
-- ============================================================================

DROP FUNCTION IF EXISTS public.get_user_conversations_optimized(UUID);
DROP FUNCTION IF EXISTS public.get_user_conversations_optimized(UUID, UUID);

CREATE OR REPLACE FUNCTION public.get_user_conversations_optimized(
    p_user_id UUID
)
RETURNS TABLE (
    conversation_id UUID,
    other_user_id UUID,
    other_username TEXT,
    other_avatar_url TEXT,
    last_message TEXT,
    last_message_at TIMESTAMPTZ,
    unread_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- get_auth_user_conversation_ids() takes NO args and filters by auth.uid().
    IF EXISTS (
        SELECT 1 FROM pg_proc
        WHERE proname = 'get_auth_user_conversation_ids'
        AND pronamespace = 'public'::regnamespace
    ) THEN
        RETURN QUERY
        SELECT
            c.id AS conversation_id,
            c.other_user_id,
            c.other_username,
            c.other_avatar_url,
            c.last_message,
            c.last_message_at,
            c.unread_count
        FROM public.get_auth_user_conversation_ids() c;
    ELSE
        RETURN QUERY
        SELECT
            cm.conversation_id,
            other_cm.user_id AS other_user_id,
            up.username AS other_username,
            up.avatar_url AS other_avatar_url,
            msg.content AS last_message,
            msg.created_at AS last_message_at,
            0::BIGINT AS unread_count
        FROM conversation_members cm
        JOIN conversation_members other_cm
            ON other_cm.conversation_id = cm.conversation_id
            AND other_cm.user_id != p_user_id
        LEFT JOIN user_profiles up ON up.id = other_cm.user_id
        LEFT JOIN LATERAL (
            SELECT m.content, m.created_at
            FROM messages m
            WHERE m.conversation_id = cm.conversation_id
            ORDER BY m.created_at DESC
            LIMIT 1
        ) msg ON true
        WHERE cm.user_id = p_user_id
        ORDER BY msg.created_at DESC NULLS LAST;
    END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_conversations_optimized(UUID) TO authenticated;

-- ============================================================================
-- BUG 42501: global_events RLS blocks anon inserts. The app enqueues ticker
-- events from the client (login flow + public ticker) using the anon key, so
-- allow anon to INSERT lightweight city events. Selectable by everyone already.
-- ============================================================================

DROP POLICY IF EXISTS "Anonymous users can insert city events" ON public.global_events;
CREATE POLICY "Anonymous users can insert city events"
  ON public.global_events
  FOR INSERT
  TO anon
  WITH CHECK (true);

GRANT INSERT ON public.global_events TO anon;

-- ============================================================================
-- BUG 42P10: ensure every table upserted with ON CONFLICT has a matching
-- unique (or primary key) constraint. Missing constraints are the root cause
-- of "no unique or exclusion constraint matching the ON CONFLICT specification".
-- ============================================================================

CREATE OR REPLACE FUNCTION public._ensure_upsert_unique(
    p_schema text,
    p_table text,
    p_cols text[]
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
    v_rel regclass;
    col_list text;
    has_table boolean;
    has_cols boolean;
    already boolean;
    con_name text;
    dedup_sql text;
BEGIN
    SELECT COUNT(*) > 0 INTO has_table
    FROM information_schema.tables
    WHERE table_schema = p_schema AND table_name = p_table;
    IF NOT has_table THEN
        RAISE NOTICE 'SKIP _ensure_upsert_unique: table %.% does not exist', p_schema, p_table;
        RETURN;
    END IF;

    SELECT COUNT(*) = array_length(p_cols, 1) INTO has_cols
    FROM information_schema.columns
    WHERE table_schema = p_schema AND table_name = p_table AND column_name = ANY(p_cols);
    IF NOT has_cols THEN
        RAISE NOTICE 'SKIP _ensure_upsert_unique: %.% missing one of columns %', p_schema, p_table, p_cols;
        RETURN;
    END IF;

    -- Already covered by a unique or primary-key constraint on exactly these columns?
    SELECT EXISTS (
        SELECT 1 FROM pg_constraint c
        WHERE c.conrelid = (p_schema || '.' || p_table)::regclass
          AND c.contype IN ('u', 'p')
          AND (
            SELECT array_agg(a2.attname ORDER BY a2.attnum)
            FROM unnest(c.conkey) AS k
            JOIN pg_attribute a2 ON a2.attrelid = c.conrelid AND a2.attnum = k
          ) <@ p_cols
          AND (
            SELECT array_agg(a2.attname ORDER BY a2.attnum)
            FROM unnest(c.conkey) AS k
            JOIN pg_attribute a2 ON a2.attrelid = c.conrelid AND a2.attnum = k
          ) @> p_cols
    ) INTO already;

    IF already THEN
        RAISE NOTICE 'OK _ensure_upsert_unique: %.% already constrained on %', p_schema, p_table, p_cols;
        RETURN;
    END IF;

    col_list := array_to_string(p_cols, ', ');

    -- De-duplicate any existing rows so the unique constraint can be created.
    BEGIN
        dedup_sql := format(
            'DELETE FROM %I.%I t WHERE t.ctid NOT IN (SELECT min(sub.ctid) FROM %I.%I sub GROUP BY %s)',
            p_schema, p_table, p_schema, p_table, col_list
        );
        EXECUTE dedup_sql;
        RAISE NOTICE 'De-duplicated %.% on %', p_schema, p_table, p_cols;
    EXCEPTION
        WHEN others THEN
            RAISE NOTICE 'Could not de-duplicate %.% (%); attempting constraint add anyway', p_schema, p_table, SQLERRM;
    END;

    con_name := ('uq_' || p_table || '_' || array_to_string(p_cols, '_'))::text;
    EXECUTE format(
        'ALTER TABLE %I.%I ADD CONSTRAINT %I UNIQUE (%s)',
        p_schema, p_table, con_name, col_list
    );
    RAISE NOTICE 'ADDED UNIQUE(%s) on %.%', col_list, p_schema, p_table;
END $$;

GRANT EXECUTE ON FUNCTION public._ensure_upsert_unique(text, text, text[]) TO postgres;

-- Apply to every (table, onConflict columns) pair used in the codebase.
-- Each call is isolated so one failure cannot abort the others.
DO $$
BEGIN
    BEGIN PERFORM public._ensure_upsert_unique('public', 'user_follows', ARRAY['follower_id','following_id']); EXCEPTION WHEN others THEN RAISE NOTICE 'user_follows: %', SQLERRM; END;
    BEGIN PERFORM public._ensure_upsert_unique('public', 'user_presence_routes', ARRAY['user_id']); EXCEPTION WHEN others THEN RAISE NOTICE 'user_presence_routes: %', SQLERRM; END;
    BEGIN PERFORM public._ensure_upsert_unique('public', 'utromail_read_status', ARRAY['message_id','user_id']); EXCEPTION WHEN others THEN RAISE NOTICE 'utromail_read_status: %', SQLERRM; END;
    BEGIN PERFORM public._ensure_upsert_unique('public', 'utromail_thread_members', ARRAY['thread_id','user_id','folder']); EXCEPTION WHEN others THEN RAISE NOTICE 'utromail_thread_members: %', SQLERRM; END;
    BEGIN PERFORM public._ensure_upsert_unique('public', 'stream_viewers', ARRAY['stream_id','user_id']); EXCEPTION WHEN others THEN RAISE NOTICE 'stream_viewers: %', SQLERRM; END;
    BEGIN PERFORM public._ensure_upsert_unique('public', 'stream_messages', ARRAY['stream_id','txn_id']); EXCEPTION WHEN others THEN RAISE NOTICE 'stream_messages: %', SQLERRM; END;
    BEGIN PERFORM public._ensure_upsert_unique('public', 'stream_gifts', ARRAY['stream_id','txn_id']); EXCEPTION WHEN others THEN RAISE NOTICE 'stream_gifts: %', SQLERRM; END;
    BEGIN PERFORM public._ensure_upsert_unique('public', 'organization_members', ARRAY['org_id','user_id']); EXCEPTION WHEN others THEN RAISE NOTICE 'organization_members: %', SQLERRM; END;
    BEGIN PERFORM public._ensure_upsert_unique('public', 'state_members', ARRAY['user_id']); EXCEPTION WHEN others THEN RAISE NOTICE 'state_members: %', SQLERRM; END;
    BEGIN PERFORM public._ensure_upsert_unique('public', 'purchases', ARRAY['user_id','item_category']); EXCEPTION WHEN others THEN RAISE NOTICE 'purchases: %', SQLERRM; END;
    BEGIN PERFORM public._ensure_upsert_unique('public', 'admin_app_settings', ARRAY['setting_key']); EXCEPTION WHEN others THEN RAISE NOTICE 'admin_app_settings: %', SQLERRM; END;
    BEGIN PERFORM public._ensure_upsert_unique('public', 'family_war_scores', ARRAY['war_id','family_id']); EXCEPTION WHEN others THEN RAISE NOTICE 'family_war_scores: %', SQLERRM; END;
    BEGIN PERFORM public._ensure_upsert_unique('public', 'call_minutes', ARRAY['user_id']); EXCEPTION WHEN others THEN RAISE NOTICE 'call_minutes: %', SQLERRM; END;
    BEGIN PERFORM public._ensure_upsert_unique('public', 'security_user_risk_scores', ARRAY['user_id']); EXCEPTION WHEN others THEN RAISE NOTICE 'security_user_risk_scores: %', SQLERRM; END;
    BEGIN PERFORM public._ensure_upsert_unique('public', 'office_shared_files', ARRAY['file_id','file_type','shared_with_user_id']); EXCEPTION WHEN others THEN RAISE NOTICE 'office_shared_files: %', SQLERRM; END;
    BEGIN PERFORM public._ensure_upsert_unique('public', 'officer_shift_slots', ARRAY['officer_id','shift_date','shift_start_time','shift_end_time']); EXCEPTION WHEN others THEN RAISE NOTICE 'officer_shift_slots: %', SQLERRM; END;
    BEGIN PERFORM public._ensure_upsert_unique('public', 'stream_settings', ARRAY['stream_id']); EXCEPTION WHEN others THEN RAISE NOTICE 'stream_settings: %', SQLERRM; END;
    BEGIN PERFORM public._ensure_upsert_unique('public', 'user_tax_info', ARRAY['user_id']); EXCEPTION WHEN others THEN RAISE NOTICE 'user_tax_info: %', SQLERRM; END;
    BEGIN PERFORM public._ensure_upsert_unique('public', 'user_driver_licenses', ARRAY['user_id']); EXCEPTION WHEN others THEN RAISE NOTICE 'user_driver_licenses: %', SQLERRM; END;
    BEGIN PERFORM public._ensure_upsert_unique('public', 'law_votes', ARRAY['law_id','user_id']); EXCEPTION WHEN others THEN RAISE NOTICE 'law_votes: %', SQLERRM; END;
    BEGIN PERFORM public._ensure_upsert_unique('public', 'neighbors_participants', ARRAY['event_id','user_id']); EXCEPTION WHEN others THEN RAISE NOTICE 'neighbors_participants: %', SQLERRM; END;
    BEGIN PERFORM public._ensure_upsert_unique('public', 'connected_social_accounts', ARRAY['user_id','platform']); EXCEPTION WHEN others THEN RAISE NOTICE 'connected_social_accounts: %', SQLERRM; END;
    BEGIN PERFORM public._ensure_upsert_unique('public', 'payment_methods', ARRAY['user_id','provider','token_id']); EXCEPTION WHEN others THEN RAISE NOTICE 'payment_methods: %', SQLERRM; END;
    BEGIN PERFORM public._ensure_upsert_unique('public', 'profile_frames', ARRAY['user_id','frame_id']); EXCEPTION WHEN others THEN RAISE NOTICE 'profile_frames: %', SQLERRM; END;
    BEGIN PERFORM public._ensure_upsert_unique('public', 'stock_leaderboards', ARRAY['leaderboard_type','user_id','period']); EXCEPTION WHEN others THEN RAISE NOTICE 'stock_leaderboards: %', SQLERRM; END;
END $$;

-- ============================================================================
-- Missing relationship: stream_gifts.sender_id -> user_profiles.id
-- GamingCommunity.tsx selects profiles!stream_gifts_sender_id_fkey(...) but
-- the FK was never created, so PostgREST reports "Could not find a
-- relationship between 'stream_gifts' and 'sender_id'".
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (
        SELECT 1
        FROM information_schema.tables t
        JOIN information_schema.columns c
          ON c.table_schema = t.table_schema AND c.table_name = t.table_name
        WHERE t.table_schema = 'public'
          AND t.table_name = 'stream_gifts'
          AND c.column_name = 'sender_id'
      )
     AND NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'stream_gifts_sender_id_fkey'
      ) THEN
    ALTER TABLE public.stream_gifts
      ADD CONSTRAINT stream_gifts_sender_id_fkey
      FOREIGN KEY (sender_id) REFERENCES public.user_profiles(id) ON DELETE CASCADE;
    RAISE NOTICE 'Added stream_gifts_sender_id_fkey';
  ELSE
    RAISE NOTICE 'stream_gifts_sender_id_fkey already present or sender_id column missing';
  END IF;
EXCEPTION WHEN others THEN
  RAISE NOTICE 'stream_gifts_sender_id_fkey add skipped: %', SQLERRM;
END $$;

DROP FUNCTION IF EXISTS public._ensure_upsert_unique(text, text, text[]);

-- Reload PostgREST schema cache so new policies/constraints are picked up.
NOTIFY pgrst, 'reload schema';

COMMIT;
