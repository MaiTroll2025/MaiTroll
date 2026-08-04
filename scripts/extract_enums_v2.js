import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

const OUTPUT_DIR = join(process.cwd(), 'supabase', 'migrations');

if (!existsSync(OUTPUT_DIR)) {
  mkdirSync(OUTPUT_DIR, { recursive: true });
}

const schema = readFileSync(join(process.cwd(), 'frontend_schema.sql'), 'utf8');

// Extract all CREATE TYPE statements
const enumRegex = /CREATE\s+TYPE\s+(?:public\.)?(\w+)\s+AS\s+ENUM\s*\(([\s\S]*?)\);/gi;
const enums = new Map();
let match;

while ((match = enumRegex.exec(schema)) !== null) {
  const enumName = match[1];
  const fullEnum = match[0].trim();
  
  // Skip duplicates - keep first occurrence
  if (!enums.has(enumName)) {
    enums.set(enumName, fullEnum);
  }
}

console.log(`Found ${enums.size} unique enums`);

// Create enum migration
let sql = '-- Enums\n';
sql += '-- Created before tables to avoid "type does not exist" errors\n\n';

for (const [name, definition] of Array.from(enums.entries()).sort((a, b) => a[0].localeCompare(b[0]))) {
  sql += definition + '\n\n';
}

writeFileSync(join(OUTPUT_DIR, '20260727180000_enums.sql'), sql);
console.log('Created: 20260727180000_enums.sql');
