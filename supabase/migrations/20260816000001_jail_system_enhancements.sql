-- ============================================================================
-- JAIL SYSTEM ENHANCEMENTS
-- Adds missing fields, creates jail_requests and jail_messages tables
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. ADD MISSING COLUMNS TO JAIL TABLE
-- ============================================================================

ALTER TABLE public.jail
  ADD COLUMN IF NOT EXISTS severity TEXT DEFAULT 'moderate' CHECK (severity = ANY (ARRAY['minor','moderate','serious','severe'])),
  ADD COLUMN IF NOT EXISTS arrested_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS court_date DATE,
  ADD COLUMN IF NOT EXISTS case_id TEXT;

-- ============================================================================
-- 2. CREATE JAIL_REQUESTS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.jail_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  jail_id UUID NOT NULL REFERENCES public.jail(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  request_type TEXT NOT NULL CHECK (request_type = ANY (ARRAY['attorney','admin','appeal'])),
  message TEXT DEFAULT '',
  status TEXT DEFAULT 'pending' CHECK (status = ANY (ARRAY['pending','reviewing','approved','rejected','fulfilled'])),
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_jail_requests_jail_id ON public.jail_requests (jail_id);
CREATE INDEX IF NOT EXISTS idx_jail_requests_user_id ON public.jail_requests (user_id);
CREATE INDEX IF NOT EXISTS idx_jail_requests_status ON public.jail_requests (status);

-- ============================================================================
-- 3. CREATE JAIL_MESSAGES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.jail_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  jail_id UUID NOT NULL REFERENCES public.jail(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipient_type TEXT NOT NULL CHECK (recipient_type = ANY (ARRAY['attorney','admin'])),
  recipient_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_jail_messages_jail_id ON public.jail_messages (jail_id);
CREATE INDEX IF NOT EXISTS idx_jail_messages_sender_id ON public.jail_messages (sender_id);
CREATE INDEX IF NOT EXISTS idx_jail_messages_recipient ON public.jail_messages (recipient_type, recipient_id);

-- ============================================================================
-- 4. ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE public.jail_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jail_messages ENABLE ROW LEVEL SECURITY;

-- Users can view their own requests
DROP POLICY IF EXISTS "Users can view own jail requests" ON public.jail_requests;
CREATE POLICY "Users can view own jail requests" ON public.jail_requests FOR SELECT USING (user_id = auth.uid());

-- Users can create their own requests
DROP POLICY IF EXISTS "Users can create jail requests" ON public.jail_requests;
CREATE POLICY "Users can create jail requests" ON public.jail_requests FOR INSERT WITH CHECK (user_id = auth.uid());

-- Staff can view and manage all requests
DROP POLICY IF EXISTS "Staff can manage jail requests" ON public.jail_requests;
CREATE POLICY "Staff can manage jail requests" ON public.jail_requests FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid()
    AND (
      is_admin = true
      OR is_attorney = true
      OR role IN ('admin','attorney','secretary','lead_troll_officer','troll_officer','prosecutor')
    )
  )
);

-- Users can view messages in their jail record
DROP POLICY IF EXISTS "Users can view own jail messages" ON public.jail_messages;
CREATE POLICY "Users can view own jail messages" ON public.jail_messages FOR SELECT USING (
  sender_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.jail
    WHERE jail.id = jail_messages.jail_id
    AND jail.user_id = auth.uid()
  )
);

-- Users can create their own messages
DROP POLICY IF EXISTS "Users can create jail messages" ON public.jail_messages;
CREATE POLICY "Users can create jail messages" ON public.jail_messages FOR INSERT WITH CHECK (sender_id = auth.uid());

-- Staff can view and manage all messages
DROP POLICY IF EXISTS "Staff can manage jail messages" ON public.jail_messages;
CREATE POLICY "Staff can manage jail messages" ON public.jail_messages FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid()
    AND (
      is_admin = true
      OR is_attorney = true
      OR role IN ('admin','attorney','secretary','lead_troll_officer','troll_officer','prosecutor')
    )
  )
);

COMMIT;
