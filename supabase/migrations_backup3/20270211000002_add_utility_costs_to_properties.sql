-- Add electric_cost and water_cost columns to properties table
ALTER TABLE properties 
ADD COLUMN IF NOT EXISTS electric_cost INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS water_cost INTEGER DEFAULT 0;

-- Optional: Update existing records to split utility_cost if it exists (assuming utility_cost was the total)
-- This is a best-effort migration to populate the new columns from the legacy one
UPDATE properties 
SET 
  electric_cost = COALESCE(utility_cost, 0) / 2,
  water_cost = COALESCE(utility_cost, 0) / 2
WHERE utility_cost IS NOT NULL AND (electric_cost IS NULL OR electric_cost = 0);
