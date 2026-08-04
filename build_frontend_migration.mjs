import fs from 'fs';
import path from 'path';

const tables = new Set(fs.readFileSync('frontend_tables.txt', 'utf-8').split('\n').map(s => s.trim()).filter(Boolean));
const rpcs = new Set(fs.readFileSync('frontend_rpcs.txt', 'utf-8').split('\n').map(s => s.trim()).filter(Boolean));
const storageBuckets = new Set(fs.readFileSync('frontend_storage.txt', 'utf-8').split('\n').map(s => s.trim()).filter(Boolean));

const dirs = [
  path.resolve('supabase/migrations'),
  path.resolve('supabase/migrations_backup'),
  path.resolve('supabase/migrations_conflicted_backup'),
  path.resolve('db/migrations'),
  path.resolve('database/migrations'),
  path.resolve('supabase/policies'),
  path.resolve('supabase/sql'),
];

const migrationSql = [];
for (const dir of dirs) {
  if (!fs.existsSync(dir)) continue;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const subEntries = fs.readdirSync(full, { withFileTypes: true });
      for (const sub of subEntries) {
        const subFull = path.join(full, sub.name);
        if (sub.isFile() && (sub.name.endsWith('.sql') || sub.name.endsWith('.SQL'))) {
          migrationSql.push(fs.readFileSync(subFull, 'utf-8'));
        }
      }
    } else if (entry.isFile() && (entry.name.endsWith('.sql') || entry.name.endsWith('.SQL'))) {
      migrationSql.push(fs.readFileSync(full, 'utf-8'));
    }
  }
}

const allSql = migrationSql.join('\n');

// Find all CREATE TABLE blocks
const createTableRe = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:public\.)?([a-zA-Z_][a-zA-Z0-9_]*)\s*\([\s\S]*?\);/gi;
const tableBlocks = new Map();
let tm;
while ((tm = createTableRe.exec(allSql)) !== null) {
  const tableName = tm[1].toLowerCase();
  if (tables.has(tableName)) {
    tableBlocks.set(tableName, tm[0]);
  }
}

// Find CREATE VIEW blocks
const createViewRe = /CREATE\s+(?:OR\s+REPLACE\s+)?(?:MATERIALIZED\s+)?VIEW\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:public\.)?([a-zA-Z_][a-zA-Z0-9_]*)\s+AS\s+[\s\S]*?;/gi;
const viewBlocks = new Map();
let vm;
while ((vm = createViewRe.exec(allSql)) !== null) {
  const viewName = vm[1].toLowerCase();
  if (tables.has(viewName)) {
    viewBlocks.set(viewName, vm[0]);
  }
}

// Find CREATE OR REPLACE FUNCTION blocks
const createFuncRe = /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+(?:public\.)?([a-zA-Z_][a-zA-Z0-9_]*)\s*\([\s\S]*?\$\$\s*;/gi;
const funcBlocks = new Map();
let fm;
while ((fm = createFuncRe.exec(allSql)) !== null) {
  const funcName = fm[1].toLowerCase();
  if (rpcs.has(funcName)) {
    funcBlocks.set(funcName, fm[0]);
  }
}

const createFuncRe2 = /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+(?:public\.)?([a-zA-Z_][a-zA-Z0-9_]*)\s*\([\s\S]*?LANGUAGE\s+\w+[^$]*AS\s+\$[^$]+\$[\s\S]*?\$\$\s*;/gi;
let fm2;
while ((fm2 = createFuncRe2.exec(allSql)) !== null) {
  const funcName = fm2[1].toLowerCase();
  if (rpcs.has(funcName) && !funcBlocks.has(funcName)) {
    funcBlocks.set(funcName, fm2[0]);
  }
}

// Find CREATE INDEX statements
const createIndexRe = /CREATE\s+(?:UNIQUE\s+)?INDEX\s+(?:IF\s+NOT\s+EXISTS\s+)?([^\s]+)\s+ON\s+(?:public\.)?([a-zA-Z_][a-zA-Z0-9_]*)\s*(?:USING\s+\w+\s+)?\([\s\S]*?\);/gi;
const indexBlocks = new Map();
let im;
while ((im = createIndexRe.exec(allSql)) !== null) {
  const tableName = im[2].toLowerCase();
  if (tables.has(tableName)) {
    if (!indexBlocks.has(tableName)) indexBlocks.set(tableName, []);
    indexBlocks.get(tableName).push(im[0]);
  }
}

// Find ALTER TABLE ADD FOREIGN KEY
const fkRe = /ALTER\s+TABLE\s+(?:public\.)?([a-zA-Z_][a-zA-Z0-9_]*)\s+ADD\s+CONSTRAINT\s+[^\s]+\s+FOREIGN\s+KEY\s*\([^)]+\)\s+REFERENCES\s+(?:public\.)?([a-zA-Z_][a-zA-Z0-9_]*)\s*\([^)]+\)[^;]*;/gi;
const fkBlocks = new Map();
let fkm;
while ((fkm = fkRe.exec(allSql)) !== null) {
  const childTable = fkm[1].toLowerCase();
  const parentTable = fkm[2].toLowerCase();
  // Only include FK if child table is in our set AND parent table is explicitly created in our migration
  const childInSet = tables.has(childTable) || viewBlocks.has(childTable);
  const parentInSet = tableBlocks.has(parentTable) || viewBlocks.has(parentTable);
  if (childInSet && parentInSet) {
    if (!fkBlocks.has(childTable)) fkBlocks.set(childTable, []);
    fkBlocks.get(childTable).push(fkm[0]);
  }
}

// Find GRANT statements
const grantRe = /GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+(?:public\.)?([a-zA-Z_][a-zA-Z0-9_]*)\s*\([^)]+\)\s+TO\s+[^;]+;/gi;
const grantBlocks = new Map();
let gm;
while ((gm = grantRe.exec(allSql)) !== null) {
  const funcName = gm[1].toLowerCase();
  if (rpcs.has(funcName)) {
    if (!grantBlocks.has(funcName)) grantBlocks.set(funcName, []);
    grantBlocks.get(funcName).push(gm[0]);
  }
}

// Find RLS policies for frontend tables
const policyRe = /CREATE\s+POLICY\s+[^\s]+\s+ON\s+(?:public\.)?([a-zA-Z_][a-zA-Z0-9_]*)\s+FOR\s+[^;]+;/gi;
const policyBlocks = new Map();
let pm;
while ((pm = policyRe.exec(allSql)) !== null) {
  const tableName = pm[1].toLowerCase();
  if (tables.has(tableName)) {
    if (!policyBlocks.has(tableName)) policyBlocks.set(tableName, []);
    policyBlocks.get(tableName).push(pm[0]);
  }
}

// Find ENABLE ROW LEVEL SECURITY statements for frontend tables
const enableRlsRe = /ALTER\s+TABLE\s+(?:public\.)?([a-zA-Z_][a-zA-Z0-9_]*)\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY;/gi;
const enableRlsBlocks = new Set();
let er;
while ((er = enableRlsRe.exec(allSql)) !== null) {
  const tableName = er[1].toLowerCase();
  if (tables.has(tableName)) {
    enableRlsBlocks.add(tableName);
  }
}

// Find extensions
const extensionRe = /CREATE\s+EXTENSION\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:pgcrypto|uuid-ossp|pg_stat_statements|timescaledb|postgis|citext|unaccent|btree_gin|btree_gist|supabase_vault|wrappers|pgsodium|pgtap|pg_cron|plpgsql)\s*(?:WITH\s+SCHEMA\s+\w+)?\s*;/gi;
const extensionBlocks = [];
let em;
while ((em = extensionRe.exec(allSql)) !== null) {
  extensionBlocks.push(em[0]);
}

// Find enum types
const enumRe = /CREATE\s+(?:OR\s+REPLACE\s+)?TYPE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:public\.)?([a-zA-Z_][a-zA-Z0-9_]*)\s+AS\s+ENUM\s*\([^)]+\)/gi;
const enumBlocks = new Set();
let enumm;
while ((enumm = enumRe.exec(allSql)) !== null) {
  enumBlocks.add(enumm[0]);
}

// Find storage bucket creation
const storageRe = /INSERT\s+INTO\s+storage\.buckets\s*\([^)]+\)\s*VALUES\s*\([^)]+\)\s*ON\s+CONFLICT[^;]*;/gi;
const storageBlocks = [];
let sm;
while ((sm = storageRe.exec(allSql)) !== null) {
  if (storageBuckets.size > 0) {
    const lower = sm[0].toLowerCase();
    for (const bucket of storageBuckets) {
      if (lower.includes(`'${bucket.toLowerCase()}'`) || lower.includes(`"${bucket.toLowerCase()}"`)) {
        storageBlocks.push(sm[0]);
        break;
      }
    }
  }
}

// Find sequences that frontend tables use
const sequenceRe = /CREATE\s+SEQUENCE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:public\.)?([a-zA-Z_][a-zA-Z0-9_]*)/gi;
const sequenceBlocks = new Set();
let sqm;
while ((sqm = sequenceRe.exec(allSql)) !== null) {
  sequenceBlocks.add(sqm[0]);
}

const notFoundTables = [...tables].filter(t => !tableBlocks.has(t) && !viewBlocks.has(t));
const notFoundRpcs = [...rpcs].filter(r => !funcBlocks.has(r));

// Build output
const output = [];

// Extensions
if (extensionBlocks.length > 0) {
  output.push('-- ==================== EXTENSIONS ====================');
  output.push(...new Set(extensionBlocks));
  output.push('');
}

// Enum types
if (enumBlocks.size > 0) {
  output.push('-- ==================== ENUM TYPES ====================');
  for (const e of [...enumBlocks].sort()) {
    output.push(e);
  }
  output.push('');
}

// Sequences
if (sequenceBlocks.size > 0) {
  output.push('-- ==================== SEQUENCES ====================');
  for (const s of [...sequenceBlocks].sort()) {
    output.push(s);
  }
  output.push('');
}

// Determine table order
const allTableNames = new Set([...tableBlocks.keys(), ...viewBlocks.keys()]);
const fkParentTables = new Set();
for (const [_, fks] of fkBlocks) {
  for (const fk of fks) {
    const match = fk.match(/REFERENCES\s+(?:public\.)?([a-zA-Z_][a-zA-Z0-9_]*)/i);
    if (match) fkParentTables.add(match[1].toLowerCase());
  }
}

const orderedTables = [];
const remaining = new Set(allTableNames);
for (const t of remaining) {
  if (!fkParentTables.has(t)) {
    orderedTables.push(t);
  }
}
for (const t of remaining) {
  if (!orderedTables.includes(t)) {
    orderedTables.push(t);
  }
}

// Tables
output.push('-- ==================== TABLES ====================');
for (const t of orderedTables) {
  if (tableBlocks.has(t)) {
    output.push(`-- Table: ${t}`);
    output.push(tableBlocks.get(t));
    output.push('');
  }
}

// Views
output.push('-- ==================== VIEWS ====================');
for (const t of [...viewBlocks.keys()].sort()) {
  output.push(`-- View: ${t}`);
  output.push(viewBlocks.get(t));
  output.push('');
}

// Enable RLS
if (enableRlsBlocks.size > 0) {
  output.push('-- ==================== ENABLE RLS ====================');
  for (const t of [...enableRlsBlocks].sort()) {
    output.push(`ALTER TABLE IF EXISTS public.${t} ENABLE ROW LEVEL SECURITY;`);
  }
  output.push('');
}

// Indexes
output.push('-- ==================== INDEXES ====================');
const allIndexes = [];
for (const [t, idxs] of indexBlocks) {
  allIndexes.push(...new Set(idxs));
}
if (allIndexes.length > 0) {
  output.push(...allIndexes);
  output.push('');
}

// Foreign Keys
output.push('-- ==================== FOREIGN KEYS ====================');
const allFks = [];
for (const [t, fks] of fkBlocks) {
  allFks.push(...new Set(fks));
}
if (allFks.length > 0) {
  output.push(...allFks);
  output.push('');
}

// Functions
output.push('-- ==================== FUNCTIONS ====================');
for (const r of [...rpcs].sort()) {
  if (funcBlocks.has(r)) {
    output.push(`-- Function: ${r}`);
    output.push(funcBlocks.get(r));
    output.push('');
  }
}

// Grants
output.push('-- ==================== FUNCTION GRANTS ====================');
const allGrants = [];
for (const [r, grants] of grantBlocks) {
  allGrants.push(...new Set(grants));
}
if (allGrants.length > 0) {
  output.push(...allGrants);
  output.push('');
}

// Policies
output.push('-- ==================== RLS POLICIES ====================');
const allPolicies = [];
for (const [t, policies] of policyBlocks) {
  allPolicies.push(...policies);
}
if (allPolicies.length > 0) {
  output.push(...allPolicies);
  output.push('');
}

// Storage buckets
output.push('-- ==================== STORAGE BUCKETS ====================');
if (storageBlocks.length > 0) {
  output.push(...new Set(storageBlocks));
  output.push('');
}

const finalSql = output.join('\n');
fs.writeFileSync('frontend_schema.sql', finalSql);

console.log(`\n=== SUMMARY ===`);
console.log(`Extensions: ${extensionBlocks.length}`);
console.log(`Enum types: ${enumBlocks.size}`);
console.log(`Sequences: ${sequenceBlocks.size}`);
console.log(`Tables found: ${tableBlocks.size} (plus ${viewBlocks.size} views)`);
console.log(`RPCs found: ${funcBlocks.size}`);
console.log(`Indexes found: ${allIndexes.length}`);
console.log(`FKs found: ${allFks.length}`);
console.log(`Grants found: ${allGrants.length}`);
console.log(`Policies found: ${allPolicies.length}`);
console.log(`RLS enabled: ${enableRlsBlocks.size}`);
console.log(`Storage buckets found: ${storageBlocks.length}`);

console.log(`\n=== NOT FOUND TABLES (${notFoundTables.length}) ===`);
for (const t of notFoundTables.slice(0, 100)) console.log(t);
if (notFoundTables.length > 100) console.log(`... and ${notFoundTables.length - 100} more`);

console.log(`\n=== NOT FOUND RPCS (${notFoundRpcs.length}) ===`);
for (const r of notFoundRpcs.slice(0, 100)) console.log(r);
if (notFoundRpcs.length > 100) console.log(`... and ${notFoundRpcs.length - 100} more`);

console.log(`\nOutput file: frontend_schema.sql (${finalSql.length} chars, ~${finalSql.split('\n').length} lines)`);
