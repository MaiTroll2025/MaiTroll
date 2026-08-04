import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

const OUTPUT_DIR = join(process.cwd(), 'supabase', 'migrations');

if (!existsSync(OUTPUT_DIR)) {
  mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Read original frontend_schema.sql
const original = readFileSync(join(process.cwd(), 'frontend_schema.sql'), 'utf8');

// Split into table blocks
const tableBlocks = [];
const blockRegex = /(--\s*Table:\s*\w+)[\s\S]*?CREATE\s+(?:TABLE\s+IF\s+NOT\s+EXISTS\s+)?(?:public\.)?(\w+)\s*\(([\s\S]*?)\);/gi;
let m;

while ((m = blockRegex.exec(original)) !== null) {
  const tableName = m[2];
  const fullBlock = m[0];
  tableBlocks.push({ name: tableName, sql: fullBlock });
}

console.log(`Found ${tableBlocks.length} tables`);

// Build dependency graph
const dependencies = new Map();
for (const block of tableBlocks) {
  const deps = new Set();
  const refRegex = /REFERENCES\s+public\.(\w+)/gi;
  let refMatch;
  while ((refMatch = refRegex.exec(block.sql)) !== null) {
    deps.add(refMatch[1]);
  }
  dependencies.set(block.name, deps);
}

// Topological sort
const sorted = [];
const visited = new Set();
const visiting = new Set();

function visit(tableName) {
  if (visited.has(tableName)) return;
  if (visiting.has(tableName)) {
    console.warn(`Circular dependency detected: ${tableName}`);
    return;
  }
  
  visiting.add(tableName);
  
  const deps = dependencies.get(tableName) || new Set();
  for (const dep of deps) {
    if (dependencies.has(dep)) {
      visit(dep);
    }
  }
  
  visiting.delete(tableName);
  visited.add(tableName);
  sorted.push(tableName);
}

for (const block of tableBlocks) {
  visit(block.name);
}

console.log(`Sorted ${sorted.length} tables`);

// Create a map from table name to block
const blockMap = new Map();
for (const block of tableBlocks) {
  blockMap.set(block.name, block.sql);
}

// Split into 6 chunks
const CHUNK_SIZE = Math.ceil(sorted.length / 6);
const chunks = [];
for (let i = 0; i < sorted.length; i += CHUNK_SIZE) {
  const chunkTables = sorted.slice(i, i + CHUNK_SIZE);
  const chunkSql = chunkTables.map(name => {
    let sql = blockMap.get(name);
    // Remove inline REFERENCES
    const lines = sql.split('\n');
    const cleaned = lines.map(line => {
      let cleaned = line;
      cleaned = cleaned.replace(/,\s*REFERENCES\s+[\w.]+(?:\([^)]+\))?/gi, '');
      cleaned = cleaned.replace(/\s+REFERENCES\s+[\w.]+(?:\([^)]+\))?/gi, '');
      cleaned = cleaned.replace(/\s+ON\s+DELETE\s+(?:CASCADE|SET\s+NULL|SET\s+DEFAULT|RESTRICT|NO\s+ACTION)/gi, '');
      cleaned = cleaned.replace(/\s+ON\s+UPDATE\s+(?:CASCADE|SET\s+NULL|SET\s+DEFAULT|RESTRICT|NO\s+ACTION)/gi, '');
      return cleaned;
    }).join('\n');
    return cleaned;
  }).join('\n\n');
  chunks.push({ tables: chunkTables, sql: chunkSql });
}

console.log(`Splitting into ${chunks.length} chunks`);

// Write chunk migrations
for (let i = 0; i < chunks.length; i++) {
  const chunkNum = String(i + 1).padStart(2, '0');
  let sql = `-- Initial Schema Part ${chunkNum}\n`;
  sql += `-- Tables ${i * CHUNK_SIZE + 1} to ${Math.min((i + 1) * CHUNK_SIZE, sorted.length)}\n`;
  sql += `-- Dependency-ordered: tables are created after their dependencies\n`;
  sql += `-- Note: Foreign key constraints are defined in per-page migrations\n\n`;
  
  sql += chunks[i].sql + '\n';
  
  const fileName = `20260727180000_initial_schema_part${chunkNum}.sql`;
  writeFileSync(join(OUTPUT_DIR, fileName), sql);
  console.log(`Created: ${fileName} (${chunks[i].tables.length} tables)`);
}

console.log('\nDone - created 6 chunks with REFERENCES removed');
