-- Add paid chat fields to stream_settings
ALTER TABLE "public"."stream_settings" ADD COLUMN IF NOT EXISTS "paid_chat_enabled" boolean DEFAULT false;
ALTER TABLE "public"."stream_settings" ADD COLUMN IF NOT EXISTS "paid_chat_type" text DEFAULT 'per_user'; -- 'per_user' or 'per_chat'
ALTER TABLE "public"."stream_settings" ADD COLUMN IF NOT EXISTS "paid_chat_price" integer DEFAULT 0; -- Price in coins

-- Create paid_chat_access table to track who has paid
CREATE TABLE IF NOT EXISTS "public"."paid_chat_access" (
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "stream_id" uuid NOT NULL REFERENCES "public"."streams"("id") ON DELETE CASCADE,
  "user_id" uuid NOT NULL REFERENCES "auth"."users"("id") ON DELETE CASCADE,
  "paid_at" timestamptz DEFAULT now(),
  "created_at" timestamptz DEFAULT now(),
  UNIQUE("stream_id", "user_id")
);

-- Create paid_chat_payments table to track payments
CREATE TABLE IF NOT EXISTS "public"."paid_chat_payments" (
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "stream_id" uuid NOT NULL REFERENCES "public"."streams"("id") ON DELETE CASCADE,
  "user_id" uuid NOT NULL REFERENCES "auth"."users"("id") ON DELETE CASCADE,
  "amount" integer NOT NULL,
  "payment_type" text NOT NULL, -- 'per_user' or 'per_chat'
  "created_at" timestamptz DEFAULT now()
);

-- Add RLS policies
ALTER TABLE "public"."paid_chat_access" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."paid_chat_payments" ENABLE ROW LEVEL SECURITY;

-- Users can read their own access
CREATE POLICY "Users can read own paid chat access" ON "public"."paid_chat_access" FOR SELECT
  USING (auth.uid() = user_id);

-- Broadcasters can manage access for their streams
CREATE POLICY "Broadcasters can manage paid chat access" ON "public"."paid_chat_access" FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM "public"."streams"
      WHERE "id" = "stream_id"
      AND "broadcaster_id" = auth.uid()
    )
  );

-- Users can insert their own payments
CREATE POLICY "Users can insert own paid chat payments" ON "public"."paid_chat_payments" FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Broadcasters can read payments for their streams
CREATE POLICY "Broadcasters can read paid chat payments" ON "public"."paid_chat_payments" FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM "public"."streams"
      WHERE "id" = "stream_id"
      AND "broadcaster_id" = auth.uid()
    )
  );

-- Add RLS policy for stream_settings (update if exists)
DROP POLICY IF EXISTS "Broadcasters can manage own stream settings" ON "public"."stream_settings";
CREATE POLICY "Broadcasters can manage own stream settings" ON "public"."stream_settings" FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM "public"."streams"
      WHERE "id" = "stream_id"
      AND "broadcaster_id" = auth.uid()
    )
  );