-- Migration: Create stream_engagement_users table for unique-user tracking
-- One row per participating user per stream instead of one row per action

CREATE TABLE IF NOT EXISTS public.stream_engagement_users (
    stream_type text NOT NULL,
    stream_id uuid NOT NULL,
    user_id uuid NOT NULL,
    has_liked boolean NOT NULL DEFAULT false,
    has_reacted boolean NOT NULL DEFAULT false,
    has_chatted boolean NOT NULL DEFAULT false,
    has_gifted boolean NOT NULL DEFAULT false,
    like_count bigint NOT NULL DEFAULT 0,
    reaction_count bigint NOT NULL DEFAULT 0,
    message_count bigint NOT NULL DEFAULT 0,
    gift_count bigint NOT NULL DEFAULT 0,
    gift_coins bigint NOT NULL DEFAULT 0,
    first_activity_at timestamptz NOT NULL DEFAULT now(),
    last_activity_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (stream_type, stream_id, user_id)
);

CREATE INDEX IF NOT EXISTS stream_engagement_users_stream_lookup_idx
ON public.stream_engagement_users (stream_type, stream_id);

CREATE INDEX IF NOT EXISTS stream_engagement_users_user_lookup_idx
ON public.stream_engagement_users (user_id);