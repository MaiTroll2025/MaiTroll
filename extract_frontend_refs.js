const fs = require('fs');
const path = require('path');

const src = path.resolve('src');
const tables = new Set();
const rpcs = new Set();
const columns = new Set();
const storageBuckets = new Set();

function scanFile(filePath) {
  const text = fs.readFileSync(filePath, 'utf-8');
  
  // .from('table')
  let m;
  const fromRe = /\.from\s*\(\s*['"`]([^'"`]+)['"`]/g;
  while ((m = fromRe.exec(text)) !== null) tables.add(m[1]);
  
  // .rpc('func')
  const rpcRe = /\.rpc\s*\(\s*['"`]([^'"`]+)['"`]/g;
  while ((m = rpcRe.exec(text)) !== null) rpcs.add(m[1]);
  
  // .storage.from('bucket')
  const storageRe = /\.storage\.from\s*\(\s*['"`]([^'"`]+)['"`]/g;
  while ((m = storageRe.exec(text)) !== null) storageBuckets.add(m[1]);
  
  // .select('col1, col2')
  const selectRe = /\.select\s*\(\s*['"`]([^'"`]+)['"`]/g;
  while ((m = selectRe.exec(text)) !== null) {
    const cols = m[1].split(',').map(c => c.trim().replace(/^\*+|\*+$/g, ''));
    cols.forEach(c => { if (c && !c.startsWith('count') && c.length > 0) columns.add(c); });
  }
  
  // .insert({col: ...}) and .update({col: ...})
  const insertUpdateRe = /\.(insert|update)\s*\(\s*\{[^}]*\b([A-Za-z_][A-Za-z0-9_]*)\s*:/g;
  while ((m = insertUpdateRe.exec(text)) !== null) columns.add(m[2]);
  
  // .eq('col', ...), .order('col'), .ilike('col'), etc.
  const queryRe = /\.(eq|order|ilike|like|neq|in|contains|overlaps|gt|gte|lt|lte|or|match|not)\s*\(\s*['"`]([^'"`]+)['"`]/g;
  while ((m = queryRe.exec(text)) !== null) {
    const col = m[2];
    if (col && col.length > 0) columns.add(col);
  }
}

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory() && entry.name !== 'node_modules' && entry.name !== 'dist' && entry.name !== '.git') {
      walk(full);
    } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
      scanFile(full);
    }
  }
}

walk(src);

// Also scan api/ and supabase/functions if needed
const apiDir = path.resolve('api');
if (fs.existsSync(apiDir)) walk(apiDir);

columns.delete('Array');
columns.delete('from');
columns.delete('key');
columns.delete('ref');

console.log('=== TABLES ===');
for (const t of [...tables].sort()) console.log(t);
console.log(`\nTotal tables: ${tables.size}`);

console.log('\n=== RPC FUNCTIONS ===');
for (const r of [...rpcs].sort()) console.log(r);
console.log(`\nTotal RPCs: ${rpcs.size}`);

console.log('\n=== STORAGE BUCKETS ===');
for (const s of [...storageBuckets].sort()) console.log(s);
console.log(`\nTotal storage buckets: ${storageBuckets.size}`);

console.log('\n=== COLUMNS ===');
for (const c of [...columns].sort()) console.log(c);
console.log(`\nTotal columns: ${columns.size}`);
