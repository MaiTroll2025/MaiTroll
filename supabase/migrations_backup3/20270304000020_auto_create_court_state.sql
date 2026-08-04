
-- Function to automatically create a court_session_state row
CREATE OR REPLACE FUNCTION public.auto_create_court_session_state()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.court_session_state (case_id)
    VALUES (NEW.id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to call the function after a new court_case is created
CREATE TRIGGER on_court_case_created
AFTER INSERT ON public.court_cases
FOR EACH ROW
EXECUTE FUNCTION public.auto_create_court_session_state();

-- Reload PostgREST schema
NOTIFY pgrst, 'reload schema';
