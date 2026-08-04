-- Fix user_cars car_id column type to allow non-UUID values (game uses integer IDs)
-- The error "invalid input syntax for type uuid: '6'" indicates car_id was likely created as UUID.

DO $$
BEGIN
    -- Check if column exists and is not text (or just force it to text)
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'user_cars' 
        AND column_name = 'car_id'
    ) THEN
        -- Drop the unique constraint first if it depends on the column type (Postgres usually handles this, but being safe)
        -- We'll just alter the type. Postgres allows UUID -> TEXT conversion.
        ALTER TABLE public.user_cars ALTER COLUMN car_id TYPE TEXT;
    END IF;
END $$;
