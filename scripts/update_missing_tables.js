import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join } from 'path';

const initialSchema = readFileSync(join(process.cwd(), 'supabase/migrations/20260727180000_initial_schema.sql'), 'utf8');
const missingPath = join(process.cwd(), 'supabase/migrations/20260727180000_missing_tables.sql');

// Find all tables in initial schema
const initialTables = new Set();
const tableRegex = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:public\.)?(\w+)\s*\(/gi;
let match;
while ((match = tableRegex.exec(initialSchema)) !== null) {
  initialTables.add(match[1]);
}

// Find all per-page migration files
const migrationsDir = join(process.cwd(), 'supabase/migrations');
const files = readdirSync(migrationsDir).filter(f => f.endsWith('.sql') && f.includes('page_'));

let missingSql = '-- Additional tables found in per-page migrations\n\n';

for (const file of files) {
  const content = readFileSync(join(migrationsDir, file), 'utf8');
  
  // Extract CREATE TABLE blocks
  const createTableRegex = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:public\.)?(\w+)\s*\(([\s\S]*?)\);/gi;
  let m;
  while ((m = createTableRegex.exec(content)) !== null) {
    const tableName = m[1];
    if (!initialTables.has(tableName)) {
      missingSql += `-- Table: ${tableName} (from ${file})\n`;
      missingSql += m[0] + '\n\n';
    }
  }
}

writeFileSync(missingPath, missingSql);
console.log('Updated missing tables migration');
