-- Add row_index and col_index to office_spreadsheet_cells if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'office_spreadsheet_cells' AND column_name = 'row_index'
  ) THEN
    ALTER TABLE office_spreadsheet_cells ADD COLUMN row_index INTEGER NOT NULL DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'office_spreadsheet_cells' AND column_name = 'col_index'
  ) THEN
    ALTER TABLE office_spreadsheet_cells ADD COLUMN col_index INTEGER NOT NULL DEFAULT 0;
  END IF;
END $$;

-- Backfill any existing null values
UPDATE office_spreadsheet_cells SET row_index = 0 WHERE row_index IS NULL;
UPDATE office_spreadsheet_cells SET col_index = 0 WHERE col_index IS NULL;
