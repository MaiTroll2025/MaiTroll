-- Court Participants Table
-- Tracks participants in court sessions with their roles and queue position

CREATE TABLE IF NOT EXISTS public.court_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    court_session_id UUID REFERENCES court_sessions(id) ON DELETE CASCADE,
    user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
    role TEXT DEFAULT 'observer' CHECK (role IN ('judge', 'prosecutor', 'defendant', 'attorney', 'witness', 'observer', 'bailiff', 'clerk')),
    box_number INTEGER, -- Which box they're in (null = not in a box)
    queue_position INTEGER, -- Position in queue (null = not in queue)
    is_hand_raised BOOLEAN DEFAULT false,
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Allow public read
CREATE POLICY "Public can view court participants" ON court_participants FOR SELECT USING (true);

-- Grant permissions
GRANT SELECT ON public.court_participants TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.court_participants TO authenticated;

-- Indexes
CREATE INDEX idx_court_participants_session ON court_participants(court_session_id);
CREATE INDEX idx_court_participants_queue ON court_participants(court_session_id, queue_position) WHERE queue_position IS NOT NULL;

-- Add box_number to court_sessions if not exists
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'court_sessions' AND column_name = 'box_number'
    ) THEN
        ALTER TABLE court_sessions ADD COLUMN box_number INTEGER DEFAULT 2;
    END IF;
END $$;

-- Update max_boxes default to 4
ALTER TABLE court_sessions ALTER COLUMN max_boxes SET DEFAULT 4;