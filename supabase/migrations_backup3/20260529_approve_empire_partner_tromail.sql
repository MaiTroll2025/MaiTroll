-- Update approve_empire_partner function to send Tromail notification and set job_title
CREATE OR REPLACE FUNCTION "public"."approve_empire_partner"("p_application_id" "uuid", "p_reviewer_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions'
    AS $$
DECLARE
   v_user_id uuid;
   v_username text;
BEGIN
   -- Get user_id from application
   SELECT user_id INTO v_user_id
   FROM empire_applications
   WHERE id = p_application_id AND status = 'pending';

   IF v_user_id IS NULL THEN
     RAISE EXCEPTION 'Application not found or already processed';
   END IF;

   -- Update application status
   UPDATE empire_applications
   SET
     status = 'approved',
     reviewed_by = p_reviewer_id,
     reviewed_at = NOW()
   WHERE id = p_application_id;

   -- Update user profile with multiple fields for proper access control
   UPDATE user_profiles
   SET
     is_empire_partner = true,
     empire_partner = true,
     partner_status = 'approved',
     role = 'empire_partner',
     job_title = 'empire_partner'
   WHERE id = v_user_id;

   -- Update or insert empire_partners table entry
   INSERT INTO empire_partners (user_id, status, approved_at)
   VALUES (v_user_id, 'approved', NOW())
   ON CONFLICT (user_id)
   DO UPDATE SET
     status = 'approved',
     approved_at = NOW();

   -- Send Tromail notification about dashboard access
   SELECT username INTO v_username FROM user_profiles WHERE id = v_user_id;
   
   PERFORM send_tromail_message(
     p_sender_user_id := p_reviewer_id,
     p_sender_role := '',
     p_sender_tromail_address := '',
     p_subject := 'Empire Partner Application Approved',
     p_body := 'Your Empire Partner application has been approved! You now have access to the RTC Admin Monitor dashboard at /rtcadminmonitor. Welcome to the Empire Partner program.',
     p_is_admin_email := true,
     p_is_important := true,
     p_recipient_user_ids := ARRAY[v_user_id],
     p_recipient_roles := ARRAY['']
   );
END;
$$;

ALTER FUNCTION "public"."approve_empire_partner"("p_application_id" "uuid", "p_reviewer_id" "uuid") OWNER TO "postgres";

COMMENT ON FUNCTION "public"."approve_empire_partner"("p_application_id" "uuid", "p_reviewer_id" "uuid") IS 'Approves an Empire Partner application and updates user profile';