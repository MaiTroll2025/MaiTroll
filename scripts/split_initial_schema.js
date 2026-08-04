import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

const INPUT_FILE = join(process.cwd(), 'supabase/migrations/20260727180000_initial_schema.sql');
const OUTPUT_DIR = join(process.cwd(), 'supabase/migrations');

if (!existsSync(OUTPUT_DIR)) {
  mkdirSync(OUTPUT_DIR, { recursive: true });
}

const content = readFileSync(INPUT_FILE, 'utf8');

// Split into sections by comment headers
const sections = content.split(/\n-- =+ /);

// Extract preamble (extensions, enums, sequences)
const preamble = sections[0] || '';

// Extract all CREATE TABLE statements with their preceding comments
const tableRegex = /--\s*Table:\s*(\w+)[\s\S]*?CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:public\.)?(\w+)\s*\(([\s\S]*?)\);/gi;
const tables = [];
let m;

while ((m = tableRegex.exec(content)) !== null) {
  const comment = m[0].match(/--\s*Table:\s*(\w+)/)?.[1] || m[2];
  const fullTable = m[0];
  tables.push({ comment: m[1], name: m[2], sql: fullTable });
}

console.log(`Found ${tables.length} tables`);

// Extract non-table SQL (functions, indexes, RLS, etc.)
const nonTableBlocks = [];
const blockRegex = /--\s*(Table:\s*\w+)?[\s\S]*?(CREATE\s+(?:OR\s+REPLACE\s+)?(?:FUNCTION|INDEX|VIEW|TRIGGER|POLICY|GRANT|ALTER\s+TABLE|DO\s+\$)[\s\S]*?;(?:\s*END\s*\$\$)?)/gi;
let lastIndex = 0;
let blockMatch;

// This is tricky - let's just extract everything that's not a CREATE TABLE
const lines = content.split('\n');
let currentBlock = [];
let currentType = 'other';
const blocks = [];

for (const line of lines) {
  const trimmed = line.trim();
  
  if (trimmed.match(/^CREATE\s+TABLE/)) {
    // Save any pending non-table block
    if (currentBlock.length > 0 && currentType !== 'table') {
      blocks.push({ type: currentType, sql: currentBlock.join('\n') });
    }
    currentBlock = [line];
    currentType = 'table';
  } else if (currentType === 'table' && trimmed.match(/^CREATE\s+TABLE/)) {
    // New table starting
    blocks.push({ type: 'table', sql: currentBlock.join('\n') });
    currentBlock = [line];
  } else {
    currentBlock.push(line);
    if (!trimmed.match(/^CREATE\s+TABLE/)) {
      currentType = 'other';
    }
  }
}

if (currentBlock.length > 0) {
  if (currentType === 'table') {
    blocks.push({ type: 'table', sql: currentBlock.join('\n') });
  } else {
    blocks.push({ type: 'other', sql: currentBlock.join('\n') });
  }
}

console.log(`Found ${blocks.length} blocks (${blocks.filter(b => b.type === 'table').length} tables, ${blocks.filter(b => b.type === 'other').length} other)`);

// Group tables into chunks of ~60
const CHUNK_SIZE = 60;
const tableBlocks = blocks.filter(b => b.type === 'table');
const otherBlocks = blocks.filter(b => b.type === 'other');

const chunks = [];
for (let i = 0; i < tableBlocks.length; i += CHUNK_SIZE) {
  chunks.push(tableBlocks.slice(i, i + CHUNK_SIZE));
}

console.log(`Splitting into ${chunks.length} chunks`);

// Write chunk migrations
for (let i = 0; i < chunks.length; i++) {
  const chunkNum = String(i + 1).padStart(2, '0');
  let sql = `-- Initial Schema Part ${chunkNum}\n`;
  sql += `-- Tables ${i * CHUNK_SIZE + 1} to ${Math.min((i + 1) * CHUNK_SIZE, tableBlocks.length)}\n\n`;
  
  for (const block of chunks[i]) {
    sql += block.sql + '\n\n';
  }
  
  // Add some non-table blocks to each chunk (distribute them)
  const otherIndex = i % otherBlocks.length;
  if (otherBlocks[otherIndex]) {
    sql += `-- Supporting objects\n`;
    sql += otherBlocks[otherIndex].sql + '\n\n';
  }
  
  const fileName = `20260727180000_initial_schema_part${chunkNum}.sql`;
  writeFileSync(join(OUTPUT_DIR, fileName), sql);
  console.log(`Created: ${fileName}`);
}

// Put remaining non-table blocks in the last chunk or a separate file
if (otherBlocks.length > chunks.length) {
  let sql = '-- Supporting Functions, Indexes, and Policies\n\n';
  for (let i = chunks.length; i < otherBlocks.length; i++) {
    sql += otherBlocks[i].sql + '\n\n';
  }
  writeFileSync(join(OUTPUT_DIR, '20260727180000_initial_schema_support.sql'), sql);
  console.log('Created: 20260727180000_initial_schema_support.sql');
}

// Remove the old large initial schema
// fs.unlinkSync(INPUT_FILE);
console.log('\nDone splitting initial schema');
