BEGIN;

-- Restore columns read by current client and RPC code.
ALTER TABLE IF EXISTS public.user_profiles
  ADD COLUMN IF NOT EXISTS purchased_coins BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS id_document_url TEXT;

ALTER TABLE IF EXISTS public.user_active_items
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

ALTER TABLE IF EXISTS public.marketplace_items
  ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;

ALTER TABLE IF EXISTS public.maipiks_story_purchases
  ADD COLUMN IF NOT EXISTS creator_earnings_coins BIGINT NOT NULL DEFAULT 0;

ALTER TABLE IF EXISTS public.court_sessions
  ADD COLUMN IF NOT EXISTS judge_id UUID,
  ADD COLUMN IF NOT EXISTS judge_username TEXT;

ALTER TABLE IF EXISTS public.auction_shows
  ADD COLUMN IF NOT EXISTS auctioneer_id UUID;

DO $$
BEGIN
  IF to_regclass('public.auction_shows') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM pg_constraint
       WHERE conrelid = 'public.auction_shows'::regclass
         AND conname = 'auction_shows_auctioneer_id_user_profiles_fkey'
     ) THEN
    ALTER TABLE public.auction_shows
      ADD CONSTRAINT auction_shows_auctioneer_id_user_profiles_fkey
      FOREIGN KEY (auctioneer_id) REFERENCES public.user_profiles(id)
      ON DELETE SET NULL NOT VALID;
  END IF;

  IF to_regclass('public.court_sessions') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM pg_constraint
       WHERE conrelid = 'public.court_sessions'::regclass
         AND conname = 'court_sessions_judge_id_user_profiles_fkey'
     ) THEN
    ALTER TABLE public.court_sessions
      ADD CONSTRAINT court_sessions_judge_id_user_profiles_fkey
      FOREIGN KEY (judge_id) REFERENCES public.user_profiles(id)
      ON DELETE SET NULL NOT VALID;
  END IF;
END;
$$;

-- Support the Neighbor approvals and hiring pages on older databases.
CREATE TABLE IF NOT EXISTS public.neighbors_hiring (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID REFERENCES public.neighbors_businesses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  requirements TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  location TEXT,
  job_type TEXT NOT NULL DEFAULT 'full-time',
  pay_rate TEXT,
  owner_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  verified BOOLEAN NOT NULL DEFAULT false,
  approval_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (approval_status IN ('pending', 'approved', 'rejected')),
  approved_at TIMESTAMPTZ,
  rejected_at TIMESTAMPTZ,
  approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE IF EXISTS public.neighbors_businesses
  ADD COLUMN IF NOT EXISTS approval_status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS approved_by UUID,
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

ALTER TABLE IF EXISTS public.neighbors_events
  ADD COLUMN IF NOT EXISTS approval_status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS approved_by UUID,
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

ALTER TABLE IF EXISTS public.neighbors_hiring
  ADD COLUMN IF NOT EXISTS business_id UUID,
  ADD COLUMN IF NOT EXISTS title TEXT,
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS requirements TEXT,
  ADD COLUMN IF NOT EXISTS contact_email TEXT,
  ADD COLUMN IF NOT EXISTS contact_phone TEXT,
  ADD COLUMN IF NOT EXISTS location TEXT,
  ADD COLUMN IF NOT EXISTS job_type TEXT NOT NULL DEFAULT 'full-time',
  ADD COLUMN IF NOT EXISTS pay_rate TEXT,
  ADD COLUMN IF NOT EXISTS owner_user_id UUID,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS verified BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS approval_status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS approved_by UUID,
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

DO $$
BEGIN
  IF to_regclass('public.neighbors_businesses') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM pg_constraint
       WHERE conrelid = 'public.neighbors_businesses'::regclass
         AND conname = 'neighbors_businesses_owner_user_profiles_fkey'
     ) THEN
    ALTER TABLE public.neighbors_businesses
      ADD CONSTRAINT neighbors_businesses_owner_user_profiles_fkey
      FOREIGN KEY (owner_user_id) REFERENCES public.user_profiles(id)
      ON DELETE CASCADE NOT VALID;
  END IF;

  IF to_regclass('public.neighbors_events') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM pg_constraint
       WHERE conrelid = 'public.neighbors_events'::regclass
         AND conname = 'neighbors_events_creator_user_profiles_fkey'
     ) THEN
    ALTER TABLE public.neighbors_events
      ADD CONSTRAINT neighbors_events_creator_user_profiles_fkey
      FOREIGN KEY (created_by_user_id) REFERENCES public.user_profiles(id)
      ON DELETE CASCADE NOT VALID;
  END IF;

  IF to_regclass('public.neighbors_hiring') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM pg_constraint
       WHERE conrelid = 'public.neighbors_hiring'::regclass
         AND conname = 'neighbors_hiring_business_id_fkey'
     ) THEN
    ALTER TABLE public.neighbors_hiring
      ADD CONSTRAINT neighbors_hiring_business_id_fkey
      FOREIGN KEY (business_id) REFERENCES public.neighbors_businesses(id)
      ON DELETE CASCADE NOT VALID;
  END IF;

  IF to_regclass('public.neighbors_hiring') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM pg_constraint
       WHERE conrelid = 'public.neighbors_hiring'::regclass
         AND conname = 'neighbors_hiring_owner_user_profiles_fkey'
     ) THEN
    ALTER TABLE public.neighbors_hiring
      ADD CONSTRAINT neighbors_hiring_owner_user_profiles_fkey
      FOREIGN KEY (owner_user_id) REFERENCES public.user_profiles(id)
      ON DELETE CASCADE NOT VALID;
  END IF;

  IF to_regclass('public.neighbors_hiring') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM pg_constraint
       WHERE conrelid = 'public.neighbors_hiring'::regclass
         AND conname = 'neighbors_hiring_approval_status_check'
     ) THEN
    ALTER TABLE public.neighbors_hiring
      ADD CONSTRAINT neighbors_hiring_approval_status_check
      CHECK (approval_status IN ('pending', 'approved', 'rejected')) NOT VALID;
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_neighbors_hiring_active
  ON public.neighbors_hiring(is_active, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_neighbors_hiring_approval_status
  ON public.neighbors_hiring(approval_status);

ALTER TABLE public.neighbors_hiring ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS neighbors_businesses_read_staff_approvals ON public.neighbors_businesses;
CREATE POLICY neighbors_businesses_read_staff_approvals
  ON public.neighbors_businesses FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles p
      WHERE p.id = auth.uid()
        AND (p.is_admin = true OR p.role IN
          ('admin', 'owner', 'ceo', 'secretary', 'executive_secretary',
           'troll_city_secretary', 'lead_troll_officer', 'troll_officer'))
    )
  );

DROP POLICY IF EXISTS neighbors_events_read_staff_approvals ON public.neighbors_events;
CREATE POLICY neighbors_events_read_staff_approvals
  ON public.neighbors_events FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles p
      WHERE p.id = auth.uid()
        AND (p.is_admin = true OR p.role IN
          ('admin', 'owner', 'ceo', 'secretary', 'executive_secretary',
           'troll_city_secretary', 'lead_troll_officer', 'troll_officer'))
    )
  );

DROP POLICY IF EXISTS neighbors_hiring_read_active_or_staff ON public.neighbors_hiring;
CREATE POLICY neighbors_hiring_read_active_or_staff
  ON public.neighbors_hiring FOR SELECT
  USING (
    (is_active AND approval_status = 'approved')
    OR owner_user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.user_profiles p
      WHERE p.id = auth.uid()
        AND (p.is_admin = true OR p.role IN
          ('admin', 'owner', 'ceo', 'secretary', 'executive_secretary',
           'troll_city_secretary', 'lead_troll_officer', 'troll_officer'))
    )
  );

DROP POLICY IF EXISTS neighbors_hiring_insert_own ON public.neighbors_hiring;
CREATE POLICY neighbors_hiring_insert_own
  ON public.neighbors_hiring FOR INSERT
  TO authenticated
  WITH CHECK (owner_user_id = auth.uid());

DROP POLICY IF EXISTS neighbors_hiring_update_own ON public.neighbors_hiring;
CREATE POLICY neighbors_hiring_update_own
  ON public.neighbors_hiring FOR UPDATE
  TO authenticated
  USING (owner_user_id = auth.uid())
  WITH CHECK (owner_user_id = auth.uid());

DROP POLICY IF EXISTS neighbors_hiring_delete_own ON public.neighbors_hiring;
CREATE POLICY neighbors_hiring_delete_own
  ON public.neighbors_hiring FOR DELETE
  TO authenticated
  USING (owner_user_id = auth.uid());

GRANT SELECT ON public.neighbors_hiring TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.neighbors_hiring TO authenticated;

-- Restore the intended owner-only insert path for video uploads.
ALTER TABLE IF EXISTS public.user_profiles
  ADD COLUMN IF NOT EXISTS treelz_uploads_enabled BOOLEAN NOT NULL DEFAULT true;
DROP POLICY IF EXISTS treelz_posts_insert ON public.treelz_posts;
CREATE POLICY treelz_posts_insert
  ON public.treelz_posts FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.user_profiles p
      WHERE p.id = auth.uid()
        AND COALESCE(p.treelz_uploads_enabled, true)
    )
  );

-- Ensure the auction purchase/profile views have the columns and relationships
-- their current selects depend on.
CREATE TABLE IF NOT EXISTS public.auction_lots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auction_show_id UUID REFERENCES public.auction_shows(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  lot_number TEXT,
  barcode TEXT,
  starting_bid NUMERIC NOT NULL DEFAULT 0,
  current_highest_bid NUMERIC,
  image_url TEXT,
  image_urls TEXT[] NOT NULL DEFAULT '{}',
  quantity INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.auction_lots
  ADD COLUMN IF NOT EXISTS auction_show_id UUID,
  ADD COLUMN IF NOT EXISTS title TEXT,
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS lot_number TEXT,
  ADD COLUMN IF NOT EXISTS barcode TEXT,
  ADD COLUMN IF NOT EXISTS starting_bid NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS current_highest_bid NUMERIC,
  ADD COLUMN IF NOT EXISTS image_url TEXT,
  ADD COLUMN IF NOT EXISTS image_urls TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS quantity INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE TABLE IF NOT EXISTS public.auction_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auction_show_id UUID NOT NULL REFERENCES public.auction_shows(id) ON DELETE CASCADE,
  lot_id UUID REFERENCES public.auction_lots(id) ON DELETE SET NULL,
  winner_user_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  auctioneer_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  order_number TEXT UNIQUE,
  sale_amount NUMERIC NOT NULL DEFAULT 0,
  shipping_cost NUMERIC NOT NULL DEFAULT 0,
  payment_status TEXT NOT NULL DEFAULT 'pending',
  fulfillment_status TEXT NOT NULL DEFAULT 'pending',
  shipping_information_status TEXT,
  shipping_method TEXT,
  shipping_name TEXT,
  shipping_line1 TEXT,
  shipping_line2 TEXT,
  shipping_city TEXT,
  shipping_state TEXT,
  shipping_zip TEXT,
  shipping_carrier TEXT,
  carrier_name TEXT,
  carrier_code TEXT,
  tracking_number TEXT,
  estimated_delivery_at TIMESTAMPTZ,
  shipped_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  pickup_instructions TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.auction_orders
  ADD COLUMN IF NOT EXISTS auction_show_id UUID,
  ADD COLUMN IF NOT EXISTS lot_id UUID,
  ADD COLUMN IF NOT EXISTS winner_user_id UUID,
  ADD COLUMN IF NOT EXISTS auctioneer_id UUID,
  ADD COLUMN IF NOT EXISTS order_number TEXT,
  ADD COLUMN IF NOT EXISTS sale_amount NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS shipping_cost NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS fulfillment_status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS shipping_information_status TEXT,
  ADD COLUMN IF NOT EXISTS shipping_method TEXT,
  ADD COLUMN IF NOT EXISTS shipping_name TEXT,
  ADD COLUMN IF NOT EXISTS shipping_line1 TEXT,
  ADD COLUMN IF NOT EXISTS shipping_line2 TEXT,
  ADD COLUMN IF NOT EXISTS shipping_city TEXT,
  ADD COLUMN IF NOT EXISTS shipping_state TEXT,
  ADD COLUMN IF NOT EXISTS shipping_zip TEXT,
  ADD COLUMN IF NOT EXISTS shipping_carrier TEXT,
  ADD COLUMN IF NOT EXISTS carrier_name TEXT,
  ADD COLUMN IF NOT EXISTS carrier_code TEXT,
  ADD COLUMN IF NOT EXISTS tracking_number TEXT,
  ADD COLUMN IF NOT EXISTS estimated_delivery_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS shipped_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS pickup_instructions TEXT,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.auction_lots'::regclass
      AND conname = 'auction_lots_auction_show_id_fkey'
  ) THEN
    ALTER TABLE public.auction_lots
      ADD CONSTRAINT auction_lots_auction_show_id_fkey
      FOREIGN KEY (auction_show_id) REFERENCES public.auction_shows(id)
      ON DELETE CASCADE NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.auction_orders'::regclass
      AND conname = 'auction_orders_auction_show_id_fkey'
  ) THEN
    ALTER TABLE public.auction_orders
      ADD CONSTRAINT auction_orders_auction_show_id_fkey
      FOREIGN KEY (auction_show_id) REFERENCES public.auction_shows(id)
      ON DELETE CASCADE NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.auction_orders'::regclass
      AND conname = 'auction_orders_lot_id_fkey'
  ) THEN
    ALTER TABLE public.auction_orders
      ADD CONSTRAINT auction_orders_lot_id_fkey
      FOREIGN KEY (lot_id) REFERENCES public.auction_lots(id)
      ON DELETE SET NULL NOT VALID;
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_auction_orders_winner_created
  ON public.auction_orders(winner_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_auction_orders_show
  ON public.auction_orders(auction_show_id);

ALTER TABLE public.auction_lots ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS auction_lots_read_public ON public.auction_lots;
CREATE POLICY auction_lots_read_public
  ON public.auction_lots FOR SELECT
  USING (true);
DROP POLICY IF EXISTS auction_lots_manage_by_auctioneer ON public.auction_lots;
CREATE POLICY auction_lots_manage_by_auctioneer
  ON public.auction_lots FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.auction_shows s
      WHERE s.id = auction_show_id
        AND (
          s.auctioneer_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.user_profiles p
            WHERE p.id = auth.uid() AND p.is_admin = true
          )
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.auction_shows s
      WHERE s.id = auction_show_id
        AND (
          s.auctioneer_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.user_profiles p
            WHERE p.id = auth.uid() AND p.is_admin = true
          )
        )
    )
  );
GRANT SELECT ON public.auction_lots TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.auction_lots TO authenticated;

ALTER TABLE public.auction_orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS auction_orders_read_winner_or_auctioneer ON public.auction_orders;
CREATE POLICY auction_orders_read_winner_or_auctioneer
  ON public.auction_orders FOR SELECT
  TO authenticated
  USING (
    winner_user_id = auth.uid()
    OR auctioneer_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.user_profiles p
      WHERE p.id = auth.uid() AND p.is_admin = true
    )
  );
DROP POLICY IF EXISTS auction_orders_manage_auctioneer ON public.auction_orders;
CREATE POLICY auction_orders_manage_auctioneer
  ON public.auction_orders FOR ALL
  TO authenticated
  USING (
    auctioneer_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.user_profiles p
      WHERE p.id = auth.uid() AND p.is_admin = true
    )
  )
  WITH CHECK (
    auctioneer_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.user_profiles p
      WHERE p.id = auth.uid() AND p.is_admin = true
    )
  );
GRANT SELECT, INSERT, UPDATE ON public.auction_orders TO authenticated;

-- Keep the mission types accepted by the application in sync with the table
-- constraint; normalize legacy values before enforcing it.
DO $$
BEGIN
  IF to_regclass('public.user_league_missions') IS NOT NULL
     AND EXISTS (
       SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'user_league_missions'
         AND column_name = 'mission_type'
     ) THEN
    UPDATE public.user_league_missions
    SET mission_type = 'solo'
    WHERE mission_type IS NULL
       OR mission_type NOT IN ('solo', 'community', 'competitive', 'timed');

    ALTER TABLE public.user_league_missions
      DROP CONSTRAINT IF EXISTS user_league_missions_mission_type_check;
    ALTER TABLE public.user_league_missions
      ADD CONSTRAINT user_league_missions_mission_type_check
      CHECK (mission_type IN ('solo', 'community', 'competitive', 'timed'));
  END IF;
END;
$$;

-- Maintain report ordering inside the aggregate instead of applying ORDER BY
-- to the ungrouped outer query.
CREATE OR REPLACE FUNCTION public.list_reports(
  p_status_filter TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id UUID := auth.uid();
  v_actor_role TEXT;
  v_reports JSONB;
BEGIN
  IF v_actor_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false, 'code', 'UNAUTHENTICATED',
      'message', 'You must be signed in.', 'data', NULL
    );
  END IF;

  IF NOT public.is_modo_role(v_actor_id) THEN
    RETURN jsonb_build_object(
      'success', false, 'code', 'NOT_AUTHORIZED',
      'message', 'You do not have permission to list reports.', 'data', NULL
    );
  END IF;

  SELECT COALESCE(LOWER(role), LOWER(troll_role), 'user')
    INTO v_actor_role
    FROM public.user_profiles
    WHERE id = v_actor_id;

  SELECT jsonb_agg(
    jsonb_build_object(
      'report_id', r.id,
      'id', r.id,
      'reporter_id', r.reporter_id,
      'reporter_username', COALESCE(rp.username, rp.full_name, 'Unknown'),
      'reported_user_id', r.target_user_id,
      'reported_username', COALESCE(tp.username, tp.full_name, 'Unknown'),
      'target_user_id', r.target_user_id,
      'target_username', COALESCE(tp.username, tp.full_name, 'Unknown'),
      'report_reason', r.report_reason,
      'reason', r.report_reason,
      'report_details', r.report_details,
      'description', r.report_details,
      'stream_id', r.stream_id,
      'stream_title', s.title,
      'status', r.status,
      'resolved_by', r.resolved_by,
      'resolved_at', r.resolved_at,
      'created_at', r.created_at
    )
    ORDER BY r.created_at DESC
  )
  INTO v_reports
  FROM public.moderation_reports r
  LEFT JOIN public.user_profiles rp ON rp.id = r.reporter_id
  LEFT JOIN public.user_profiles tp ON tp.id = r.target_user_id
  LEFT JOIN public.streams s ON s.id = r.stream_id
  WHERE
    (p_status_filter IS NULL OR r.status = p_status_filter)
    AND (
      v_actor_role IN ('ceo', 'admin', 'lead_troll_officer', 'troll_officer', 'secretary')
      OR r.status IN ('pending', 'reviewing')
    );

  RETURN jsonb_build_object(
    'success', true, 'code', 'REPORTS_LISTED',
    'message', 'Reports retrieved.', 'data',
    jsonb_build_object('reports', COALESCE(v_reports, '[]'::jsonb))
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.list_reports(TEXT) TO authenticated, service_role;

-- Compatibility RPC used by older reward call sites.
CREATE OR REPLACE FUNCTION public.add_troll_coins(
  p_amount BIGINT,
  p_user_id UUID
)
RETURNS VOID
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT public.add_free_coins(p_user_id, p_amount);
$$;

GRANT EXECUTE ON FUNCTION public.add_troll_coins(BIGINT, UUID) TO authenticated, service_role;

-- Keep the court summons -> case embed explicit and available to PostgREST.
DO $$
BEGIN
  IF to_regclass('public.court_summons') IS NOT NULL
     AND to_regclass('public.court_cases') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM pg_constraint
       WHERE conrelid = 'public.court_summons'::regclass
         AND conname = 'court_summons_case_id_fkey'
     ) THEN
    ALTER TABLE public.court_summons
      ADD CONSTRAINT court_summons_case_id_fkey
      FOREIGN KEY (case_id) REFERENCES public.court_cases(id)
      ON DELETE CASCADE NOT VALID;
  END IF;
END;
$$;

NOTIFY pgrst, 'reload schema';

COMMIT;
