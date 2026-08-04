-- Fix: ensure office_shared_files has file_type column (may be missing from earlier migration runs)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'office_shared_files' AND column_name = 'file_type'
  ) THEN
    ALTER TABLE office_shared_files ADD COLUMN file_type TEXT NOT NULL DEFAULT 'document';
  END IF;
END $$;

-- Fix: ensure office_templates has file_type column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'office_templates' AND column_name = 'file_type'
  ) THEN
    ALTER TABLE office_templates ADD COLUMN file_type TEXT NOT NULL DEFAULT 'document';
  END IF;
END $$;
