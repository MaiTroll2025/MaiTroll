-- Enums
-- Created before tables to avoid "type does not exist" errors

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ad_asset_type') THEN
    CREATE TYPE ad_asset_type AS ENUM ('square_post', 'portrait_story', 'landscape_promo', 'fallback_graphic');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ad_job_type') THEN
    CREATE TYPE ad_job_type AS ENUM ('image_ad', 'video_promo', 'caption_only', 'full_campaign');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ad_platform') THEN
    CREATE TYPE ad_platform AS ENUM ('x', 'instagram');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'appeal_category') THEN
    CREATE TYPE appeal_category AS ENUM (
        'non_delivery', 
        'not_as_described', 
        'damaged_item', 
        'seller_issue', 
        'buyer_issue', 
        'payment_issue',
        'other'
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'appeal_status') THEN
    CREATE TYPE appeal_status AS ENUM (
        'pending', 
        'under_review', 
        'approved', 
        'denied', 
        'escalated', 
        'withdrawn'
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'battle_status') THEN
    CREATE TYPE battle_status AS ENUM (
      'idle',
      'waiting_for_opponent',
      'pending_locked',
      'countdown',
      'active',
      'ended',
      'cancelled'
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'bug_alert_category') THEN
    CREATE TYPE bug_alert_category AS ENUM ('livekit', 'broadcast', 'auth', 'database', 'payment', 'chat', 'ui', 'performance', 'security', 'other');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'bug_alert_severity') THEN
    CREATE TYPE bug_alert_severity AS ENUM ('critical', 'high', 'medium', 'low', 'info');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'bug_alert_status') THEN
    CREATE TYPE bug_alert_status AS ENUM ('active', 'acknowledged', 'resolved', 'dismissed');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'court_case_status') THEN
    CREATE TYPE court_case_status AS ENUM (
                'pending', 'scheduled', 'in_session', 'resolved', 'closed',
                'dismissed', 'warrant_issued', 'inactive', 'appealed',
                'waiting', 'adjourned', 'summoned'
            );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'agency_application_status' AND typnamespace = 'public'::regnamespace) THEN
    CREATE TYPE public.agency_application_status AS ENUM ('pending', 'approved', 'rejected');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'agency_member_role' AND typnamespace = 'public'::regnamespace) THEN
    CREATE TYPE public.agency_member_role AS ENUM ('creator', 'leader', 'manager');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'agency_reward_status' AND typnamespace = 'public'::regnamespace) THEN
    CREATE TYPE public.agency_reward_status AS ENUM ('pending', 'available', 'claimed', 'expired', 'revoked');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'agency_reward_type' AND typnamespace = 'public'::regnamespace) THEN
    CREATE TYPE public.agency_reward_type AS ENUM ('bonus_coins', 'badge', 'exclusive_access', 'custom_role', 'merchandise', 'cash_payout', 'tier_milestone');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'agency_tier' AND typnamespace = 'public'::regnamespace) THEN
    CREATE TYPE public.agency_tier AS ENUM ('none', 'bronze', 'silver', 'gold', 'legend');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'agency_transaction_type' AND typnamespace = 'public'::regnamespace) THEN
    CREATE TYPE public.agency_transaction_type AS ENUM ('stream_hours', 'platform_share', 'verified_viewer', 'user_registration', 'tier_bonus', 'admin_adjustment', 'reward_redemption');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payout_batch_status' AND typnamespace = 'public'::regnamespace) THEN
    CREATE TYPE public.payout_batch_status AS ENUM ('open', 'locked', 'processing', 'completed', 'cancelled');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'task_cadence' AND typnamespace = 'public'::regnamespace) THEN
    CREATE TYPE public.task_cadence AS ENUM ('daily', 'weekly', 'monthly');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'task_metric_type' AND typnamespace = 'public'::regnamespace) THEN
    CREATE TYPE public.task_metric_type AS ENUM (
                'live_minutes',
                'live_sessions',
                'chat_messages',
                'unique_gifters',
                'returning_gifters',
                'no_strikes',
                'no_fraud',
                'gifts_sent',
                'gifts_received',
                'posts_made',
                'shares',
                'battles_won'
            );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tracking_event_status') THEN
    CREATE TYPE tracking_event_status AS ENUM (
            'label_created', 
            'accepted', 
            'in_transit', 
            'out_for_delivery', 
            'delivered', 
            'exception', 
            'returned'
        );
  END IF;
END $$;

-- ==================== SEQUENCES ====================
CREATE SEQUENCE IF NOT EXISTS public.beta_feedback_public_seq;
CREATE SEQUENCE IF NOT EXISTS public.zip_code_seq;
CREATE SEQUENCE IF NOT EXISTS public.auction_lot_number_seq;

-- ==================== TABLES ====================
-- Table: user_stats
CREATE TABLE IF NOT EXISTS public.user_stats (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    xp_total BIGINT DEFAULT 0,
    level INT DEFAULT 1,
    xp_to_next_level BIGINT DEFAULT 100,
    xp_progress FLOAT DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'battle_status') THEN
    CREATE TYPE battle_status AS ENUM (
      'idle',
      'waiting_for_opponent',
      'pending_locked',
      'countdown',
      'active',
      'ended',
      'cancelled'
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tracking_event_status') THEN
    CREATE TYPE tracking_event_status AS ENUM (
            'label_created', 
            'accepted', 
            'in_transit', 
            'out_for_delivery', 
            'delivered', 
            'exception', 
            'returned'
        );
  END IF;
END $$;
