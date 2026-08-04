import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

const INPUT_FILE = join(process.cwd(), 'supabase/migrations/20260727180000_initial_schema.sql');
const OUTPUT_DIR = join(process.cwd(), 'supabase/migrations');

if (!existsSync(OUTPUT_DIR)) {
  mkdirSync(OUTPUT_DIR, { recursive: true });
}

const content = readFileSync(INPUT_FILE, 'utf8');

// Extract all CREATE TABLE statements with their preceding comment
const tableRegex = /(--\s*Table:\s*\w+[\s\S]*?)(?=--\s*Table:\s*\w+|\Z)/gi;
const tables = [];
let m;

while ((m = tableRegex.exec(content)) !== null) {
  const tableMatch = m[0].match(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:public\.)?(\w+)/);
  if (tableMatch) {
    tables.push({
      name: tableMatch[1],
      sql: m[0].trim()
    });
  }
}

console.log(`Found ${tables.length} tables`);

// Extract everything that's not a table block
const tableBlocks = new Set();
for (const t of tables) {
  tableBlocks.add(t.sql);
}

const lines = content.split('\n');
const nonTableLines = [];
let inTableBlock = false;

for (const line of lines) {
  const trimmed = line.trim();
  if (trimmed.startsWith('-- Table:')) {
    inTableBlock = true;
  } else if (trimmed.startsWith('-- Table:') && inTableBlock) {
    inTableBlock = false;
  }
  
  if (!inTableBlock) {
    nonTableLines.push(line);
  }
}

const nonTableSql = nonTableLines.join('\n');

// Split tables into chunks of 50
const CHUNK_SIZE = 50;
const chunks = [];
for (let i = 0; i < tables.length; i += CHUNK_SIZE) {
  chunks.push(tables.slice(i, i + CHUNK_SIZE));
}

console.log(`Splitting into ${chunks.length} chunks`);

// Write chunk migrations
for (let i = 0; i < chunks.length; i++) {
  const chunkNum = String(i + 1).padStart(2, '0');
  let sql = `-- Initial Schema Part ${chunkNum}\n`;
  sql += `-- Tables ${i * CHUNK_SIZE + 1} to ${Math.min((i + 1) * CHUNK_SIZE, tables.length)}\n\n`;
  
  for (const table of chunks[i]) {
    sql += table.sql + '\n\n';
  }
  
  const fileName = `20260727180000_initial_schema_part${chunkNum}.sql`;
  writeFileSync(join(OUTPUT_DIR, fileName), sql);
  console.log(`Created: ${fileName} (${chunks[i].length} tables)`);
}

// Write non-table SQL to a separate file
writeFileSync(join(OUTPUT_DIR, '20260727180000_initial_schema_support.sql'), nonTableSql);
console.log('Created: 20260727180000_initial_schema_support.sql');

// Remove old large file
import { unlinkSync } from 'fs';
unlinkSync(INPUT_FILE);
console.log('Removed old initial_schema.sql');
