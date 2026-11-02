BEGIN;

DELETE FROM public.court_participants AS participant
WHERE participant.court_session_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.court_sessions AS session
    WHERE session.id = participant.court_session_id
  );

ALTER TABLE public.court_participants
  ADD CONSTRAINT court_participants_court_session_id_fkey
  FOREIGN KEY (court_session_id)
  REFERENCES public.court_sessions(id)
  ON DELETE CASCADE
  NOT VALID;

ALTER TABLE public.court_participants
  VALIDATE CONSTRAINT court_participants_court_session_id_fkey;

ALTER TABLE public.streams
  VALIDATE CONSTRAINT streams_user_profiles_fkey;

ALTER TABLE public.court_sessions
  VALIDATE CONSTRAINT court_sessions_judge_id_user_profiles_fkey;

DELETE FROM public.streams
WHERE status = 'starting'
  AND is_live = false
  AND ended_at IS NULL
  AND room_name IS NULL;

NOTIFY pgrst, 'reload schema';

COMMIT;
