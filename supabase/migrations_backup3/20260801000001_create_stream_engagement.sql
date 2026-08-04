-- Migration: Create shared stream_engagement table
-- Stream types: broadcast, hytrogame, podcast
-- One row per live stream/session for consolidated engagement counters

CREATE TABLE IF NOT EXISTS public.stream_engagement (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    stream_type text NOT NULL,
    stream_id uuid NOT NULL,
    total_likes bigint NOT NULL DEFAULT 0,
    total_reactions bigint NOT NULL DEFAULT 0,
    total_messages bigint NOT NULL DEFAULT 0,
    total_gifts bigint NOT NULL DEFAULT 0,
    total_gift_coins bigint NOT NULL DEFAULT 0,
    unique_likers integer NOT NULL DEFAULT 0,
    unique_reactors integer NOT NULL DEFAULT 0,
    unique_chatters integer NOT NULL DEFAULT 0,
    unique_gifters integer NOT NULL DEFAULT 0,
    last_like_at timestamptz,
    last_reaction_at timestamptz,
    last_message_at timestamptz,
    last_gift_at timestamptz,
    is_finalized boolean NOT NULL DEFAULT false,
    finalized_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT stream_engagement_unique UNIQUE (stream_type, stream_id)
);

CREATE INDEX IF NOT EXISTS stream_engagement_stream_lookup_idx
ON public.stream_engagement (stream_type, stream_id);

CREATE INDEX IF NOT EXISTS stream_engagement_updated_at_idx
ON public.stream_engagement (updated_at DESC);