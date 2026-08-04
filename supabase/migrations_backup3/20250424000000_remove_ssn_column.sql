-- Remove full SSN column for security - only keep last 4 digits (ssn_last4)
-- This prevents storage of full Social Security Numbers which pose a security risk

-- Drop column if exists
ALTER TABLE IF EXISTS "public"."user_tax_info" DROP COLUMN IF EXISTS "ssn";

-- Comment: This column was removed to reduce PII storage and improve security.
-- Tax reporting now relies on EIN (for businesses) or ssn_last4 (last 4 digits only)
