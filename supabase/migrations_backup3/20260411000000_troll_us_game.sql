-- Troll Us Game Tables
-- Werewolf-style social deduction game

-- Main games table
CREATE TABLE IF NOT EXISTS games (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type VARCHAR(50) NOT NULL DEFAULT 'troll_us',
    status VARCHAR(50) NOT NULL DEFAULT 'lobby', -- lobby, live, ended
    host_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    stream_id UUID REFERENCES streams(id) ON DELETE CASCADE,
    current_round INTEGER DEFAULT 0,
    prize_pool INTEGER DEFAULT 2000,
    winner_team VARCHAR(20),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ
);

-- Game players table
CREATE TABLE IF NOT EXISTS game_players (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    seat_index INTEGER,
    role VARCHAR(20), -- troll, hunter (hidden from other players)
    is_eliminated BOOLEAN DEFAULT FALSE,
    is_seated BOOLEAN DEFAULT FALSE,
    is_muted BOOLEAN DEFAULT FALSE,
    is_alive BOOLEAN DEFAULT TRUE,
    has_voted BOOLEAN DEFAULT FALSE,
    votes_received INTEGER DEFAULT 0,
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(game_id, user_id)
);

-- Game votes table
CREATE TABLE IF NOT EXISTS game_votes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    voter_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    target_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    round_number INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(game_id, voter_id, round_number)
);

-- Enable RLS
ALTER TABLE games ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_votes ENABLE ROW LEVEL SECURITY;

-- RLS Policies for games
CREATE POLICY "Games are viewable by participants" ON games
    FOR SELECT USING (true);

CREATE POLICY "Host can manage games" ON games
    FOR ALL USING (auth.uid() = host_id);

-- RLS Policies for game_players
CREATE POLICY "Players can view game players" ON game_players
    FOR SELECT USING (true);

CREATE POLICY "Game participants can manage their status" ON game_players
    FOR ALL USING (auth.uid() = user_id);

-- RLS Policies for game_votes
CREATE POLICY "Votes viewable during game" ON game_votes
    FOR SELECT USING (true);

CREATE POLICY "Players can submit votes" ON game_votes
    FOR INSERT WITH CHECK (auth.uid() = voter_id);

-- Function to get player's role (only returns current user's role)
CREATE OR REPLACE FUNCTION get_my_role(p_game_id UUID, p_user_id UUID)
RETURNS VARCHAR(20) AS $$
DECLARE
    v_role VARCHAR(20);
BEGIN
    SELECT role INTO v_role
    FROM game_players
    WHERE game_id = p_game_id AND user_id = p_user_id;
    
    RETURN v_role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to initialize a Troll Us game
CREATE OR REPLACE FUNCTION create_troll_us_game(p_stream_id UUID, p_host_id UUID)
RETURNS UUID AS $$
DECLARE
    v_game_id UUID;
BEGIN
    INSERT INTO games (type, status, host_id, stream_id, prize_pool)
    VALUES ('troll_us', 'lobby', p_host_id, p_stream_id, 2000)
    RETURNING id INTO v_game_id;
    
    -- Add host as first player
    INSERT INTO game_players (game_id, user_id, seat_index, is_seated)
    VALUES (v_game_id, p_host_id, 0, true);
    
    RETURN v_game_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to join game seat
CREATE OR REPLACE FUNCTION join_game_seat(p_game_id UUID, p_user_id UUID, p_seat_index INTEGER)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE game_players 
    SET is_seated = true, seat_index = p_seat_index
    WHERE game_id = p_game_id AND user_id = p_user_id;
    
    RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to start game and assign roles
CREATE OR REPLACE FUNCTION start_troll_us_game(p_game_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_player_count INTEGER;
    v_troll_index INTEGER;
    v_player_ids UUID[];
    v_random_offset INTEGER;
BEGIN
    -- Get all seated players
    SELECT array_agg(user_id), COUNT(*)
    INTO v_player_ids, v_player_count
    FROM game_players
    WHERE game_id = p_game_id AND is_seated = true;
    
    IF v_player_count < 3 THEN
        RAISE EXCEPTION 'Need at least 3 players to start';
    END IF;
    
    -- Randomly select troll (1 in every 3-6 players)
    v_random_offset := floor(random() * v_player_count)::int;
    
    -- Update game status
    UPDATE games 
    SET status = 'live', current_round = 1, started_at = NOW()
    WHERE id = p_game_id;
    
    -- Assign roles: 1 troll, rest hunters
    FOR i IN 0..v_player_count-1 LOOP
        UPDATE game_players
        SET role = CASE 
            WHEN i = v_random_offset THEN 'troll' 
            ELSE 'hunter' 
        END,
        is_alive = true,
        is_eliminated = false,
        is_muted = false,
        votes_received = 0,
        has_voted = false
        WHERE game_id = p_game_id AND user_id = v_player_ids[i+1];
    END LOOP;
    
    RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to submit vote
CREATE OR REPLACE FUNCTION submit_game_vote(p_game_id UUID, p_voter_id UUID, p_target_id UUID, p_round INTEGER)
RETURNS BOOLEAN AS $$
BEGIN
    -- Check voter is not eliminated
    IF EXISTS (
        SELECT 1 FROM game_players 
        WHERE game_id = p_game_id AND user_id = p_voter_id AND is_eliminated = true
    ) THEN
        RAISE EXCEPTION 'Eliminated players cannot vote';
    END IF;
    
    -- Insert or update vote
    INSERT INTO game_votes (game_id, voter_id, target_id, round_number)
    VALUES (p_game_id, p_voter_id, p_target_id, p_round)
    ON CONFLICT (game_id, voter_id, round_number) 
    DO UPDATE SET target_id = p_target_id;
    
    -- Mark voter as voted
    UPDATE game_players
    SET has_voted = true
    WHERE game_id = p_game_id AND user_id = p_voter_id;
    
    -- Increment vote count for target
    UPDATE game_players
    SET votes_received = votes_received + 1
    WHERE game_id = p_game_id AND user_id = p_target_id;
    
    RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to eliminate player
CREATE OR REPLACE FUNCTION eliminate_player(p_game_id UUID, p_player_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE game_players
    SET is_eliminated = true, is_muted = true, is_alive = false
    WHERE game_id = p_game_id AND user_id = p_player_id;
    
    RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to end round and check win conditions
CREATE OR REPLACE FUNCTION end_troll_us_round(p_game_id UUID)
RETURNS VARCHAR(20) AS $$
DECLARE
    v_eliminated_id UUID;
    v_troll_alive BOOLEAN;
    v_hunters_alive INTEGER;
    v_result VARCHAR(20);
BEGIN
    -- Get player with most votes
    SELECT user_id INTO v_eliminated_id
    FROM game_players
    WHERE game_id = p_game_id AND is_seated = true
    ORDER BY votes_received DESC
    LIMIT 1;
    
    -- Eliminate the player
    IF v_eliminated_id IS NOT NULL THEN
        PERFORM eliminate_player(p_game_id, v_eliminated_id);
    END IF;
    
    -- Check if troll is eliminated
    SELECT EXISTS (
        SELECT 1 FROM game_players
        WHERE game_id = p_game_id AND role = 'troll' AND is_eliminated = false
    ) INTO v_troll_alive;
    
    -- Count remaining hunters
    SELECT COUNT(*) INTO v_hunters_alive
    FROM game_players
    WHERE game_id = p_game_id AND role = 'hunter' AND is_eliminated = false;
    
    -- Determine result
    IF NOT v_troll_alive THEN
        -- Troll eliminated - hunters win
        UPDATE games
        SET status = 'ended', winner_team = 'hunters', ended_at = NOW()
        WHERE id = p_game_id;
        v_result := 'hunters_win';
    ELSIF v_hunters_alive <= 2 THEN
        -- Only 2 or fewer hunters left - troll wins
        UPDATE games
        SET status = 'ended', winner_team = 'troll', ended_at = NOW()
        WHERE id = p_game_id;
        v_result := 'troll_win';
    ELSE
        -- Continue to next round
        UPDATE games
        SET current_round = current_round + 1
        WHERE id = p_game_id;
        
        -- Reset votes for next round
        UPDATE game_players
        SET has_voted = false, votes_received = 0
        WHERE game_id = p_game_id AND is_eliminated = false;
        
        v_result := 'continue';
    END IF;
    
    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to distribute prize pool
CREATE OR REPLACE FUNCTION distribute_prize(p_game_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_prize_pool INTEGER;
    v_winner_count INTEGER;
    v_prize_per_player INTEGER;
    v_winner_team VARCHAR(20);
BEGIN
    -- Get prize pool and winner
    SELECT prize_pool, winner_team INTO v_prize_pool, v_winner_team
    FROM games WHERE id = p_game_id;
    
    IF v_winner_team IS NULL THEN
        RETURN false;
    END IF;
    
    -- Get winner count
    SELECT COUNT(*) INTO v_winner_count
    FROM game_players
    WHERE game_id = p_game_id AND role = v_winner_team AND is_eliminated = false;
    
    IF v_winner_count = 0 THEN
        RETURN false;
    END IF;
    
    -- Calculate per-player prize
    v_prize_per_player := v_prize_pool / v_winner_count;
    
    -- Distribute to winners (add to troll_coins)
    UPDATE user_profiles up
    SET troll_coins = troll_coins + v_prize_per_player
    FROM game_players gp
    WHERE gp.game_id = p_game_id 
    AND gp.role = v_winner_team 
    AND gp.is_eliminated = false
    AND up.user_id = gp.user_id;
    
    RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add stream column for game mode (if not exists)
-- This allows switching broadcast between normal/game mode
ALTER TABLE streams ADD COLUMN IF NOT EXISTS broadcast_mode VARCHAR(20) DEFAULT 'normal';
ALTER TABLE streams ADD COLUMN IF NOT EXISTS active_game_id UUID REFERENCES games(id) ON DELETE SET NULL;
