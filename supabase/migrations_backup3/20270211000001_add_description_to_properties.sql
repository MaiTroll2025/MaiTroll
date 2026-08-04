-- Add description and image_url columns to properties table if they are missing
-- This fixes the "Could not find the 'description' column" error

DO $$
BEGIN
    -- Add description column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'properties' AND column_name = 'description') THEN
        ALTER TABLE public.properties ADD COLUMN description TEXT;
    END IF;

    -- Add image_url column (commonly used with description)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'properties' AND column_name = 'image_url') THEN
        ALTER TABLE public.properties ADD COLUMN image_url TEXT;
    END IF;
    
    -- Add amenities column if missing (useful for frontend display)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'properties' AND column_name = 'amenities') THEN
        ALTER TABLE public.properties ADD COLUMN amenities TEXT[] DEFAULT '{}';
    END IF;
END $$;
