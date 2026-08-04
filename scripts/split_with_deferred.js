import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const OUTPUT_DIR = join(process.cwd(), 'supabase', 'migrations');

// Read original frontend_schema.sql
const original = readFileSync(join(process.cwd(), 'frontend_schema.sql'), 'utf8');

// Split into table blocks
const tableBlocks = [];
const blockRegex = /(--\s*Table:\s*\w+[\s\S]*?)(?=--\s*Table:\s*\w+|\Z)/gi;
let m;

while ((m = blockRegex.exec(original)) !== null) {
  tableBlocks.push(m[0]);
}

console.log(`Found ${tableBlocks.length} table blocks`);

// Chunk into groups of 50
const CHUNK_SIZE = 50;
const chunks = [];
for (let i = 0; i < tableBlocks.length; i += CHUNK_SIZE) {
  chunks.push(tableBlocks.slice(i, i + CHUNK_SIZE));
}

console.log(`Splitting into ${chunks.length} chunks`);

// Write chunk migrations with DEFERRED constraints
for (let i = 0; i < chunks.length; i++) {
  const chunkNum = String(i + 1).padStart(2, '0');
  let sql = `-- Initial Schema Part ${chunkNum}\n`;
  sql += `-- Tables ${i * CHUNK_SIZE + 1} to ${Math.min((i + 1) * CHUNK_SIZE, tableBlocks.length)}\n`;
  sql += `BEGIN;\n`;
  sql += `SET CONSTRAINTS ALL DEFERRED;\n\n`;
  
  for (const block of chunks[i]) {
    sql += block + '\n\n';
  }
  
  sql += `COMMIT;\n`;
  
  const fileName = `20260727180000_initial_schema_part${chunkNum}.sql`;
  writeFileSync(join(OUTPUT_DIR, fileName), sql);
  console.log(`Created: ${fileName} (${chunks[i].length} tables)`);
}

console.log('\nDone');
