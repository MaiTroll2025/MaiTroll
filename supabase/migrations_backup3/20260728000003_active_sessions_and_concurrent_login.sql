CREATE TABLE IF NOT EXISTS "public"."active_sessions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "session_id" "uuid" NOT NULL,
    "device_info" "jsonb" DEFAULT '{}'::"jsonb",
    "ip_address" "text",
    "user_agent" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "last_active" timestamp with time zone DEFAULT "now"(),
    "is_active" boolean DEFAULT true
);


ALTER TABLE "public"."active_sessions" OWNER TO "postgres";


COMMENT ON TABLE "public"."active_sessions" IS 'Tracks active user sessions to prevent concurrent logins from different devices';


DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'active_sessions_user_id_fkey'
  ) THEN
    ALTER TABLE ONLY "public"."active_sessions"
      ADD CONSTRAINT "active_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;
  END IF;
END $$;


CREATE INDEX IF NOT EXISTS "idx_active_sessions_is_active" ON "public"."active_sessions" USING "btree" ("is_active");


CREATE INDEX IF NOT EXISTS "idx_active_sessions_session_id" ON "public"."active_sessions" USING "btree" ("session_id");


CREATE INDEX IF NOT EXISTS "idx_active_sessions_user_id" ON "public"."active_sessions" USING "btree" ("user_id");


ALTER TABLE "public"."active_sessions" ENABLE ROW LEVEL SECURITY;


DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
    AND tablename = 'active_sessions'
    AND policyname = 'Allow session management for authenticated users'
  ) THEN
    CREATE POLICY "Allow session management for authenticated users" ON "public"."active_sessions" TO "authenticated" USING (("auth"."uid"() = "user_id"));
  END IF;
END $$;


DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
    AND tablename = 'active_sessions'
    AND policyname = 'Allow session reads for service role'
  ) THEN
    CREATE POLICY "Allow session reads for service role" ON "public"."active_sessions" FOR SELECT TO "authenticated" USING (true);
  END IF;
END $$;


GRANT ALL ON TABLE "public"."active_sessions" TO "anon";
GRANT ALL ON TABLE "public"."active_sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."active_sessions" TO "service_role";


CREATE OR REPLACE FUNCTION "public"."check_concurrent_login"("p_user_id" "uuid", "p_current_session_id" "uuid") 
RETURNS TABLE (
    has_concurrent_login BOOLEAN,
    original_session_id UUID,
    original_device_info TEXT,
    original_last_active TIMESTAMPTZ
)
LANGUAGE "plpgsql"
SECURITY DEFINER
SET "search_path" TO 'public', 'extensions'
AS $$
DECLARE
    original_session RECORD;
BEGIN
    SELECT 
        session_id,
        device_info,
        last_active INTO original_session
    FROM active_sessions
    WHERE user_id = p_user_id
      AND session_id != p_current_session_id
      AND is_active = TRUE
      AND created_at > NOW() - INTERVAL '30 minutes'
    ORDER BY created_at ASC
    LIMIT 1;
    
    IF original_session.session_id IS NOT NULL THEN
        RETURN QUERY SELECT 
            TRUE,
            original_session.session_id,
            original_session.device_info,
            original_session.last_active;
    ELSE
        RETURN QUERY SELECT 
            FALSE,
            NULL::UUID,
            NULL::TEXT,
            NULL::TIMESTAMPTZ;
    END IF;
END;
$$;


ALTER FUNCTION "public"."check_concurrent_login"("p_user_id" "uuid", "p_current_session_id" "uuid") OWNER TO "postgres";


REVOKE ALL ON FUNCTION "public"."check_concurrent_login"("p_user_id" "uuid", "p_current_session_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."check_concurrent_login"("p_user_id" "uuid", "p_current_session_id" "uuid") TO "service_role";
GRANT ALL ON FUNCTION "public"."check_concurrent_login"("p_user_id" "uuid", "p_current_session_id" "uuid") TO "authenticated";