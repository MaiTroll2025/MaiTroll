-- TroMail Office Suite

CREATE TABLE IF NOT EXISTS office_folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  parent_folder_id UUID REFERENCES office_folders(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS office_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  folder_id UUID REFERENCES office_folders(id) ON DELETE SET NULL,
  is_admin_document BOOLEAN DEFAULT false,
  is_read_only BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS office_document_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES office_documents(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS office_spreadsheets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  folder_id UUID REFERENCES office_folders(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS office_spreadsheet_cells (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  spreadsheet_id UUID NOT NULL REFERENCES office_spreadsheets(id) ON DELETE CASCADE,
  sheet_name TEXT NOT NULL,
  cell_reference TEXT NOT NULL,
  row_index INTEGER NOT NULL DEFAULT 0,
  col_index INTEGER NOT NULL DEFAULT 0,
  value TEXT,
  formula TEXT,
  style_json JSONB DEFAULT '{}'::jsonb,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS office_shared_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id UUID NOT NULL,
  file_type TEXT NOT NULL CHECK (file_type IN ('document', 'spreadsheet')),
  owner_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  shared_with_user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  permission_level TEXT NOT NULL CHECK (permission_level IN ('owner', 'editor', 'viewer')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS office_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  file_type TEXT NOT NULL CHECK (file_type IN ('document', 'spreadsheet')),
  description TEXT,
  content_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_public BOOLEAN DEFAULT true,
  created_by UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE office_folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE office_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE office_document_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE office_spreadsheets ENABLE ROW LEVEL SECURITY;
ALTER TABLE office_spreadsheet_cells ENABLE ROW LEVEL SECURITY;
ALTER TABLE office_shared_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE office_templates ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX IF NOT EXISTS office_spreadsheet_cells_unique_ref
  ON office_spreadsheet_cells(spreadsheet_id, sheet_name, cell_reference);

CREATE UNIQUE INDEX IF NOT EXISTS office_shared_files_unique_share
  ON office_shared_files(file_id, file_type, shared_with_user_id);

CREATE INDEX IF NOT EXISTS office_documents_owner_updated_idx ON office_documents(owner_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS office_documents_folder_idx ON office_documents(folder_id);
CREATE INDEX IF NOT EXISTS office_spreadsheets_owner_updated_idx ON office_spreadsheets(owner_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS office_spreadsheet_cells_spreadsheet_idx ON office_spreadsheet_cells(spreadsheet_id);
CREATE INDEX IF NOT EXISTS office_shared_files_recipient_idx ON office_shared_files(shared_with_user_id);
CREATE INDEX IF NOT EXISTS office_templates_public_idx ON office_templates(is_public, file_type, created_at DESC);

CREATE POLICY "office_folders_owner_select" ON office_folders
  FOR SELECT USING (owner_id = auth.uid());

CREATE POLICY "office_folders_owner_insert" ON office_folders
  FOR INSERT WITH CHECK (owner_id = auth.uid());

CREATE POLICY "office_folders_owner_update" ON office_folders
  FOR UPDATE USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

CREATE POLICY "office_folders_owner_delete" ON office_folders
  FOR DELETE USING (owner_id = auth.uid());

CREATE POLICY "office_documents_select" ON office_documents
  FOR SELECT USING (
    owner_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM office_shared_files sf
      WHERE sf.file_id = office_documents.id
      AND sf.file_type = 'document'
      AND sf.shared_with_user_id = auth.uid()
    )
  );

CREATE POLICY "office_documents_insert" ON office_documents
  FOR INSERT WITH CHECK (owner_id = auth.uid());

CREATE POLICY "office_documents_update" ON office_documents
  FOR UPDATE USING (
    owner_id = auth.uid()
    OR (
      is_admin_document = false
      AND EXISTS (
        SELECT 1 FROM office_shared_files sf
        WHERE sf.file_id = office_documents.id
        AND sf.file_type = 'document'
        AND sf.shared_with_user_id = auth.uid()
        AND sf.permission_level = 'editor'
      )
    )
  ) WITH CHECK (
    owner_id = auth.uid()
    OR (
      is_admin_document = false
      AND EXISTS (
        SELECT 1 FROM office_shared_files sf
        WHERE sf.file_id = office_documents.id
        AND sf.file_type = 'document'
        AND sf.shared_with_user_id = auth.uid()
        AND sf.permission_level = 'editor'
      )
    )
  );

CREATE POLICY "office_documents_delete" ON office_documents
  FOR DELETE USING (owner_id = auth.uid() AND is_admin_document = false);

CREATE POLICY "office_document_versions_select" ON office_document_versions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM office_documents d
      WHERE d.id = office_document_versions.document_id
      AND (
        d.owner_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM office_shared_files sf
          WHERE sf.file_id = d.id
          AND sf.file_type = 'document'
          AND sf.shared_with_user_id = auth.uid()
        )
      )
    )
  );

CREATE POLICY "office_document_versions_insert" ON office_document_versions
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM office_documents d
      WHERE d.id = office_document_versions.document_id
      AND (
        d.owner_id = auth.uid()
        OR (
          d.is_admin_document = false
          AND EXISTS (
            SELECT 1 FROM office_shared_files sf
            WHERE sf.file_id = d.id
            AND sf.file_type = 'document'
            AND sf.shared_with_user_id = auth.uid()
            AND sf.permission_level = 'editor'
          )
        )
      )
    )
  );

CREATE POLICY "office_spreadsheets_select" ON office_spreadsheets
  FOR SELECT USING (
    owner_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM office_shared_files sf
      WHERE sf.file_id = office_spreadsheets.id
      AND sf.file_type = 'spreadsheet'
      AND sf.shared_with_user_id = auth.uid()
    )
  );

CREATE POLICY "office_spreadsheets_insert" ON office_spreadsheets
  FOR INSERT WITH CHECK (owner_id = auth.uid());

CREATE POLICY "office_spreadsheets_update" ON office_spreadsheets
  FOR UPDATE USING (
    owner_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM office_shared_files sf
      WHERE sf.file_id = office_spreadsheets.id
      AND sf.file_type = 'spreadsheet'
      AND sf.shared_with_user_id = auth.uid()
      AND sf.permission_level = 'editor'
    )
  ) WITH CHECK (
    owner_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM office_shared_files sf
      WHERE sf.file_id = office_spreadsheets.id
      AND sf.file_type = 'spreadsheet'
      AND sf.shared_with_user_id = auth.uid()
      AND sf.permission_level = 'editor'
    )
  );

CREATE POLICY "office_spreadsheets_delete" ON office_spreadsheets
  FOR DELETE USING (owner_id = auth.uid());

CREATE POLICY "office_spreadsheet_cells_select" ON office_spreadsheet_cells
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM office_spreadsheets s
      WHERE s.id = office_spreadsheet_cells.spreadsheet_id
      AND (
        s.owner_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM office_shared_files sf
          WHERE sf.file_id = s.id
          AND sf.file_type = 'spreadsheet'
          AND sf.shared_with_user_id = auth.uid()
        )
      )
    )
  );

CREATE POLICY "office_spreadsheet_cells_insert" ON office_spreadsheet_cells
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM office_spreadsheets s
      WHERE s.id = office_spreadsheet_cells.spreadsheet_id
      AND (
        s.owner_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM office_shared_files sf
          WHERE sf.file_id = s.id
          AND sf.file_type = 'spreadsheet'
          AND sf.shared_with_user_id = auth.uid()
          AND sf.permission_level = 'editor'
        )
      )
    )
  );

CREATE POLICY "office_spreadsheet_cells_update" ON office_spreadsheet_cells
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM office_spreadsheets s
      WHERE s.id = office_spreadsheet_cells.spreadsheet_id
      AND (
        s.owner_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM office_shared_files sf
          WHERE sf.file_id = s.id
          AND sf.file_type = 'spreadsheet'
          AND sf.shared_with_user_id = auth.uid()
          AND sf.permission_level = 'editor'
        )
      )
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM office_spreadsheets s
      WHERE s.id = office_spreadsheet_cells.spreadsheet_id
      AND (
        s.owner_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM office_shared_files sf
          WHERE sf.file_id = s.id
          AND sf.file_type = 'spreadsheet'
          AND sf.shared_with_user_id = auth.uid()
          AND sf.permission_level = 'editor'
        )
      )
    )
  );

CREATE POLICY "office_spreadsheet_cells_delete" ON office_spreadsheet_cells
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM office_spreadsheets s
      WHERE s.id = office_spreadsheet_cells.spreadsheet_id
      AND s.owner_id = auth.uid()
    )
  );

CREATE POLICY "office_shared_files_select" ON office_shared_files
  FOR SELECT USING (owner_id = auth.uid() OR shared_with_user_id = auth.uid());

CREATE POLICY "office_shared_files_insert" ON office_shared_files
  FOR INSERT WITH CHECK (owner_id = auth.uid());

CREATE POLICY "office_shared_files_update" ON office_shared_files
  FOR UPDATE USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

CREATE POLICY "office_shared_files_delete" ON office_shared_files
  FOR DELETE USING (owner_id = auth.uid());

CREATE POLICY "office_templates_select" ON office_templates
  FOR SELECT USING (is_public = true OR created_by = auth.uid());

CREATE POLICY "office_templates_insert" ON office_templates
  FOR INSERT WITH CHECK (created_by = auth.uid());

CREATE POLICY "office_templates_update" ON office_templates
  FOR UPDATE USING (created_by = auth.uid()) WITH CHECK (created_by = auth.uid());

CREATE POLICY "office_templates_delete" ON office_templates
  FOR DELETE USING (created_by = auth.uid());
