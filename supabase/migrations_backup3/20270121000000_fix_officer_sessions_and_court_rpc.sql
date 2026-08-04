-- Fix officer_work_sessions missing updated_at column (Fix for 42703)
ALTER TABLE public.officer_work_sessions 
ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Create get_current_court_session RPC (Fix for PGRST202)
CREATE OR REPLACE FUNCTION public.get_current_court_session()
RETURNS TABLE (
    id UUID,
    status text,
    started_by UUID,
    started_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        cs.id,
        cs.status,
        cs.started_by,
        cs.started_at,
        cs.ended_at
    FROM court_sessions cs
    WHERE cs.status IN ('waiting', 'live', 'active', 'scheduled')
    ORDER BY cs.created_at DESC
    LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.get_current_court_session() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_current_court_session() TO service_role;
