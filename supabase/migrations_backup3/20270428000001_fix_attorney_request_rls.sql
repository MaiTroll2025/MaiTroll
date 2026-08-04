-- Fix attorney_cases RLS to allow inmates to request attorney
-- This migration adds an INSERT policy for victims to create attorney cases

ALTER TABLE public.attorney_cases ENABLE ROW LEVEL SECURITY;

-- Allow inmates (victims) to create attorney cases for themselves
CREATE POLICY "Inmates can request attorney" ON public.attorney_cases
  FOR INSERT WITH CHECK (
    victim_id = auth.uid()
  );

-- Also allow viewing own attorney cases explicitly (though Anyone can view already)
-- but for clarity, we can keep existing view policy.
