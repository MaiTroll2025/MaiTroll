-- Add is_battle column to streams table if it doesn't exist
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'streams' AND column_name = 'is_battle') THEN 
        ALTER TABLE streams ADD COLUMN is_battle BOOLEAN DEFAULT false; 
    END IF; 
END $$;
