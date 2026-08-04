import { readFileSync, writeFileSync, mkdirSync, existsSync, unlinkSync } from 'fs';
import { join } from 'path';

const OUTPUT_DIR = join(process.cwd(), 'supabase', 'migrations');

if (!existsSync(OUTPUT_DIR)) {
  mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Read all current migration files
const files = [
  '20260727180000_initial_schema_part01.sql',
  '20260727180000_initial_schema_part02.sql',
  '20260727180000_initial_schema_part03.sql',
  '20260727180000_initial_schema_part04.sql',
  '20260727180000_initial_schema_part05.sql',
  '20260727180000_initial_schema_part06.sql',
  '20260727180000_missing_tables.sql',
  '20260727180000_initial_schema_support.sql',
];

const contents = [];
for (const file of files) {
  const path = join(OUTPUT_DIR, file);
  if (existsSync(path)) {
    const content = readFileSync(path, 'utf8');
    if (content.trim()) {
      contents.push({ file, content });
    }
  }
}

// Also include per-page migrations
const pageFiles = [
  '20260727180000_page_academy.sql',
  '20260727180000_page_agencies.sql',
  '20260727180000_page_auth.sql',
  '20260727180000_page_coins.sql',
  '20260727180000_page_court.sql',
  '20260727180000_page_employees.sql',
  '20260727180000_page_family.sql',
  '20260727180000_page_home.sql',
  '20260727180000_page_jail.sql',
  '20260727180000_page_marketplace.sql',
  '20260727180000_page_notifications.sql',
  '20260727180000_page_streams.sql',
  '20260727180000_page_treasury.sql',
];

for (const file of pageFiles) {
  const path = join(OUTPUT_DIR, file);
  if (existsSync(path)) {
    const content = readFileSync(path, 'utf8');
    if (content.trim()) {
      contents.push({ file, content });
    }
  }
}

console.log(`Found ${contents.length} migration files to consolidate`);

// Consolidate into 6 files
const CHUNK_SIZE = Math.ceil(contents.length / 6);
const chunks = [];
for (let i = 0; i < contents.length; i += CHUNK_SIZE) {
  chunks.push(contents.slice(i, i + CHUNK_SIZE));
}

console.log(`Consolidating into ${chunks.length} files`);

// Remove old individual files
for (const file of files) {
  try { unlinkSync(join(OUTPUT_DIR, file)); } catch (e) {}
}
for (const file of pageFiles) {
  try { unlinkSync(join(OUTPUT_DIR, file)); } catch (e) {}
}

// Write consolidated files
for (let i = 0; i < chunks.length; i++) {
  const chunkNum = String(i + 1).padStart(2, '0');
  let sql = `-- Consolidated Migration Part ${chunkNum}\n`;
  sql += `-- Contains ${chunks[i].length} migration blocks\n\n`;
  
  for (const item of chunks[i]) {
    sql += `-- ========== ${item.file} ==========\n\n`;
    sql += item.content + '\n\n';
  }
  
  const fileName = `20260727180000_consolidated_part${chunkNum}.sql`;
  writeFileSync(join(OUTPUT_DIR, fileName), sql);
  console.log(`Created: ${fileName} (${chunks[i].length} blocks)`);
}

console.log('\nDone - created 6 consolidated migration files');
