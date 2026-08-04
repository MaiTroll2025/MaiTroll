-- Add is_admin_created and is_landlord_purchased columns to properties table
ALTER TABLE properties 
ADD COLUMN IF NOT EXISTS is_admin_created BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS is_landlord_purchased BOOLEAN DEFAULT FALSE;

-- Optional: Indexing for performance if these are used in filtering
CREATE INDEX IF NOT EXISTS idx_properties_is_admin_created ON properties(is_admin_created);
CREATE INDEX IF NOT EXISTS idx_properties_is_landlord_purchased ON properties(is_landlord_purchased);
