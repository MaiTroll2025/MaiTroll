import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

const OUTPUT_DIR = join(process.cwd(), 'supabase', 'migrations');

if (!existsSync(OUTPUT_DIR)) {
  mkdirSync(OUTPUT_DIR, { recursive: true });
}

const original = readFileSync(join(process.cwd(), 'frontend_schema.sql'), 'utf8');
const newTables = new Set();

// Read all existing table names from the 6 parts
for (let i = 1; i <= 6; i++) {
  const partNum = String(i).padStart(2, '0');
  const filePath = join(OUTPUT_DIR, `20260727180000_initial_schema_part${partNum}.sql`);
  try {
    const content = readFileSync(filePath, 'utf8');
    const tableRegex = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:public\.)?(\w+)\s*\(/gi;
    let match;
    while ((match = tableRegex.exec(content)) !== null) {
      newTables.add(match[1]);
    }
  } catch (e) {
    console.error(`Error reading part${partNum}:`, e.message);
  }
}

// Find missing tables in original schema
const originalTableRegex = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:public\.)?(\w+)\s*\(/gi;
const missingTables = [];
let match;

while ((match = originalTableRegex.exec(original)) !== null) {
  const tableName = match[1];
  if (!newTables.has(tableName)) {
    // Extract the full table definition
    const tableStart = match.index;
    let depth = 0;
    let tableEnd = tableStart;
    let foundOpening = false;
    
    for (let i = tableStart; i < original.length; i++) {
      if (original[i] === '(') {
        depth++;
        foundOpening = true;
      } else if (original[i] === ')') {
        depth--;
        if (foundOpening && depth === 0) {
          tableEnd = i + 1;
          break;
        }
      }
    }
    
    const tableDef = original.substring(tableStart, tableEnd);
    if (tableDef.includes(';')) {
      missingTables.push(tableDef);
    }
  }
}

console.log(`Found ${missingTables.length} missing tables`);

// Create missing tables migration
let sql = '-- Missing Tables\n';
sql += '-- These tables were in frontend_schema.sql but not in the 6-part split\n\n';

for (const tableDef of missingTables) {
  sql += tableDef + '\n\n';
}

writeFileSync(join(OUTPUT_DIR, '20260727180000_missing_tables.sql'), sql);
console.log('Created: 20260727180000_missing_tables.sql');
