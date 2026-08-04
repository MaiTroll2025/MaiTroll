-- Troll Us Game System - Database migrations
-- Creates the game system for broadcast integration

-- Games table
CREATE TABLE IF NOT EXISTS games (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL DEFAULT 'troll_us',
  host_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stream_id UUID NOT NULL REFERENCES streams(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'lobby' CHECK (status IN ('lobby', 'live', 'ended')),
  current_round INTEGER DEFAULT 0,
  winner_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_games_stream_id ON games(stream_id);
CREATE INDEX idx_games_status ON games(status);

-- Game players table
CREATE TABLE IF NOT EXISTS game_players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  seat_index INTEGER,
  role TEXT,
  is_eliminated BOOLEAN DEFAULT false,
  is_seated BOOLEAN DEFAULT false,
  is_muted BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(game_id, user_id)
);

CREATE INDEX idx_game_players_game_id ON game_players(game_id);
CREATE INDEX idx_game_players_seat ON game_players(game_id, seat_index);

-- Game votes table
CREATE TABLE IF NOT EXISTS game_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  round INTEGER NOT NULL,
  voter_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_game_votes_round ON game_votes(game_id, round);

-- Account deletion reasons table
CREATE TABLE IF NOT EXISTS account_deletion_reasons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reason TEXT NOT NULL,
  awareness_confirmed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add universal battle columns to streams table
ALTER TABLE streams ADD COLUMN IF NOT EXISTS battle_category TEXT;
ALTER TABLE streams ADD COLUMN IF NOT EXISTS battle_mode TEXT DEFAULT 'none';
ALTER TABLE streams ADD COLUMN IF NOT EXISTS battle_format TEXT;
ALTER TABLE streams ADD COLUMN IF NOT EXISTS battle_status TEXT DEFAULT 'waiting';
ALTER TABLE streams ADD COLUMN IF NOT EXISTS team_a_members UUID[] DEFAULT '{}';
ALTER TABLE streams ADD COLUMN IF NOT EXISTS team_b_members UUID[] DEFAULT '{}';
ALTER TABLE streams ADD COLUMN IF NOT EXISTS battle_start_time TIMESTAMPTZ;
ALTER TABLE streams ADD COLUMN IF NOT EXISTS battle_end_time TIMESTAMPTZ;
ALTER TABLE streams ADD COLUMN IF NOT EXISTS side_a_score BIGINT DEFAULT 0;
ALTER TABLE streams ADD COLUMN IF NOT EXISTS side_b_score BIGINT DEFAULT 0;
ALTER TABLE streams ADD COLUMN IF NOT EXISTS winner_side TEXT;

-- Create index for universal battle queries
CREATE INDEX idx_streams_battle_mode ON streams(battle_mode) WHERE battle_mode = 'universal';

-- Enable RLS
ALTER TABLE games ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE account_deletion_reasons ENABLE ROW LEVEL SECURITY;

-- Games policies
CREATE POLICY "Anyone can read games" ON games FOR SELECT USING (true);
CREATE POLICY "Host can manage game" ON games FOR ALL USING (
  auth.uid() = host_id
);

-- Game players policies  
CREATE POLICY "Players can read game players" ON game_players FOR SELECT USING (true);
CREATE POLICY "Game participants can manage" ON game_players FOR ALL USING (
  EXISTS (SELECT 1 FROM games WHERE games.id = game_players.game_id AND games.host_id = auth.uid())
);

-- Game votes policies
CREATE POLICY " Anyone can read votes" ON game_votes FOR SELECT USING (true);
CREATE POLICY "Game host can manage votes" ON game_votes FOR ALL USING (
  EXISTS (SELECT 1 FROM games g 
    JOIN game_players gp ON gp.game_id = g.id 
    WHERE g.id = game_votes.game_id AND gp.user_id = auth.uid() AND gp.role = 'troll')
  OR EXISTS (SELECT 1 FROM games WHERE games.id = game_votes.game_id AND games.host_id = auth.uid())
);

-- Account deletion policies
CREATE POLICY "Anyone can read deletion reasons" ON account_deletion_reasons FOR SELECT WITH CHECK (true);
CREATE POLICY "Users can insert deletion reasons" ON account_deletion_reasons FOR INSERT WITH CHECK (auth.uid() = user_id OR user_id IS NULL);
CREATE POLICY "Admins can delete users" ON account_deletion_reasons FOR DELETE USING (
  EXISTS (SELECT 1 FROM user_profiles WHERE user_id = auth.uid() AND role = 'admin')
);