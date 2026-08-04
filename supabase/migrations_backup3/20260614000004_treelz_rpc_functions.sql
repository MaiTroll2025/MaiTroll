-- Treelz RPC Functions

-- Increment likes count
CREATE OR REPLACE FUNCTION increment_treelz_likes(p_post_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE treelz_posts SET likes_count = likes_count + 1, updated_at = NOW() WHERE id = p_post_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Decrement likes count
CREATE OR REPLACE FUNCTION decrement_treelz_likes(p_post_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE treelz_posts SET likes_count = GREATEST(likes_count - 1, 0), updated_at = NOW() WHERE id = p_post_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Increment comments count
CREATE OR REPLACE FUNCTION increment_treelz_comments(p_post_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE treelz_posts SET comments_count = comments_count + 1, updated_at = NOW() WHERE id = p_post_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Increment saves count
CREATE OR REPLACE FUNCTION increment_treelz_saves(p_post_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE treelz_posts SET saves_count = saves_count + 1, updated_at = NOW() WHERE id = p_post_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Decrement saves count
CREATE OR REPLACE FUNCTION decrement_treelz_saves(p_post_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE treelz_posts SET saves_count = GREATEST(saves_count - 1, 0), updated_at = NOW() WHERE id = p_post_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Increment shares count
CREATE OR REPLACE FUNCTION increment_treelz_shares(p_post_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE treelz_posts SET shares_count = shares_count + 1, updated_at = NOW() WHERE id = p_post_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Record view analytics
CREATE OR REPLACE FUNCTION record_treelz_view(
  p_post_id UUID,
  p_watch_seconds INTEGER,
  p_completed BOOLEAN
)
RETURNS void AS $$
DECLARE
  v_current_views INTEGER;
  v_current_rate NUMERIC;
BEGIN
  SELECT views_count, completion_rate INTO v_current_views, v_current_rate
  FROM treelz_posts WHERE id = p_post_id;

  UPDATE treelz_posts
  SET
    views_count = views_count + 1,
    watch_time_seconds = watch_time_seconds + p_watch_seconds,
    completion_rate = CASE
      WHEN v_current_views = 0 THEN CASE WHEN p_completed THEN 100 ELSE 0 END
      ELSE ((v_current_rate * v_current_views) + CASE WHEN p_completed THEN 100 ELSE 0 END) / (v_current_views + 1)
    END,
    updated_at = NOW()
  WHERE id = p_post_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Send treelz tip (reuses spend_coins pattern)
CREATE OR REPLACE FUNCTION send_treelz_tip(
  p_from_user_id UUID,
  p_to_user_id UUID,
  p_post_id UUID,
  p_amount BIGINT
)
RETURNS void AS $$
DECLARE
  v_from_balance BIGINT;
BEGIN
  -- Check balance
  SELECT troll_coins INTO v_from_balance FROM user_profiles WHERE id = p_from_user_id;
  IF v_from_balance < p_amount THEN
    RAISE EXCEPTION 'Insufficient balance';
  END IF;

  -- Deduct from sender
  UPDATE user_profiles SET troll_coins = troll_coins - p_amount WHERE id = p_from_user_id;

  -- Credit receiver
  UPDATE user_profiles SET troll_coins = troll_coins + p_amount WHERE id = p_to_user_id;

  -- Record transaction for sender
  INSERT INTO coin_transactions (user_id, amount, type, source, description, related_post_id)
  VALUES (p_from_user_id, -p_amount, 'spend', 'treelz_tip', 'Treelz tip to user', p_post_id);

  -- Record transaction for receiver
  INSERT INTO coin_transactions (user_id, amount, type, source, description, related_post_id)
  VALUES (p_to_user_id, p_amount, 'earn', 'treelz_tip', 'Received Treelz tip', p_post_id);

  -- Record tip
  INSERT INTO treelz_tips (from_user_id, to_user_id, post_id, amount)
  VALUES (p_from_user_id, p_to_user_id, p_post_id, p_amount);

  -- Update post stats
  UPDATE treelz_posts
  SET
    gifts_received = gifts_received + 1,
    coins_received = coins_received + p_amount,
    updated_at = NOW()
  WHERE id = p_post_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Stream promotion: create a treelz post from a live stream
CREATE OR REPLACE FUNCTION promote_stream_to_treelz(
  p_user_id UUID,
  p_stream_id TEXT,
  p_video_url TEXT,
  p_thumbnail_url TEXT
)
RETURNS UUID AS $$
DECLARE
  v_post_id UUID;
BEGIN
  INSERT INTO treelz_posts (user_id, video_url, thumbnail_url, caption, is_live_promotion, live_stream_id, video_duration_seconds, status)
  VALUES (p_user_id, p_video_url, p_thumbnail_url, '🔴 Live Now!', true, p_stream_id, 15, 'active')
  RETURNING id INTO v_post_id;

  RETURN v_post_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
