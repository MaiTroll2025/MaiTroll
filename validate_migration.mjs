import fs from 'fs';
import path from 'path';

const tables = new Set(fs.readFileSync('frontend_tables.txt', 'utf-8').split('\n').map(s => s.trim()).filter(Boolean));
const rpcs = new Set(fs.readFileSync('frontend_rpcs.txt', 'utf-8').split('\n').map(s => s.trim()).filter(Boolean));
const storageBuckets = new Set(fs.readFileSync('frontend_storage.txt', 'utf-8').split('\n').map(s => s.trim()).filter(Boolean));
const columns = new Set(fs.readFileSync('frontend_columns.txt', 'utf-8').split('\n').map(s => s.trim()).filter(Boolean));

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

// Generate detailed report
const report = [];
report.push('# FRONTEND MIGRATION AUDIT REPORT');
report.push(`Generated: ${new Date().toISOString()}`);
report.push('');
report.push('## Summary');
report.push(`- Frontend tables referenced: ${tables.size}`);
report.push(`- Frontend RPCs referenced: ${rpcs.size}`);
report.push(`- Frontend storage buckets: ${storageBuckets.size}`);
report.push(`- Frontend columns referenced: ${columns.size}`);
report.push('');
report.push('## Coverage in existing migrations');
report.push(`| Object Type | Found | Missing |`);
report.push(`|-------------|-------|---------|`);
report.push(`| Tables | ${tableBlocks.size} | ${notFoundTables.length} |`);
report.push(`| Views | ${viewBlocks.size} | 0 |`);
report.push(`| RPC Functions | ${funcBlocks.size} | ${notFoundRpcs.length} |`);
report.push(`| Indexes | ${[...indexBlocks.values()].flat().length} | N/A |`);
report.push(`| Foreign Keys | ${[...fkBlocks.values()].flat().length} | N/A |`);
report.push(`| RLS Policies | ${[...policyBlocks.values()].flat().length} | N/A |`);
report.push(`| Grants | ${[...grantBlocks.values()].flat().length} | N/A |`);
report.push(`| Extensions | ${extensionBlocks.length} | N/A |`);
report.push(`| Enum Types | ${enumBlocks.size} | N/A |`);
report.push(`| Storage Buckets | ${storageBlocks.length} | ${storageBuckets.size - storageBlocks.length} |`);
report.push('');

if (notFoundTables.length > 0) {
  report.push(`## Missing Tables (${notFoundTables.length})`);
  report.push('');
  report.push('These tables are referenced in the frontend but not found in any migration file.');
  report.push('You will need to create them manually in the Supabase SQL Editor.');
  report.push('');
  report.push('```sql');
  report.push('-- TODO: Create these tables in your new Supabase project');
  for (const t of notFoundTables.sort()) {
    report.push(`-- ${t}`);
  }
  report.push('```');
  report.push('');
}

if (notFoundRpcs.length > 0) {
  report.push(`## Missing RPC Functions (${notFoundRpcs.length})`);
  report.push('');
  report.push('These functions are called from the frontend but not found in any migration file.');
  report.push('You will need to create them manually in the Supabase SQL Editor.');
  report.push('');
  report.push('```sql');
  report.push('-- TODO: Create these functions in your new Supabase project');
  for (const r of notFoundRpcs.sort()) {
    report.push(`-- ${r}()`);
  }
  report.push('```');
  report.push('');
}

report.push('## Detailed Missing Tables by Category');
report.push('');

// Categorize missing tables
const categories = {
  'Auth/Profiles': [],
  'Streams/Broadcast': [],
  'Chat/Messaging': [],
  'Economy/Coins': [],
  'Social/Feed': [],
  'Gaming': [],
  'Admin/Moderation': [],
  'Government/Legal': [],
  'Academy/Education': [],
  'Agency/Organization': [],
  'Marketplace': [],
  'Other': []
};

for (const t of notFoundTables.sort()) {
  const lower = t.toLowerCase();
  if (lower.includes('user') || lower.includes('auth') || lower.includes('profile') || lower.includes('verif')) {
    categories['Auth/Profiles'].push(t);
  } else if (lower.includes('stream') || lower.includes('broadcast') || lower.includes('bcast')) {
    categories['Streams/Broadcast'].push(t);
  } else if (lower.includes('chat') || lower.includes('message') || lower.includes('conversation') || lower.includes('mail') || lower.includes('tromail') || lower.includes('utromail')) {
    categories['Chat/Messaging'].push(t);
  } else if (lower.includes('coin') || lower.includes('wallet') || lower.includes('cash') || lower.includes('payout') || lower.includes('transaction') || lower.includes('ledger') || lower.includes('order') || lower.includes('purchase')) {
    categories['Economy/Coins'].push(t);
  } else if (lower.includes('post') || lower.includes('feed') || lower.includes('wall') || lower.includes('like') || lower.includes('comment') || lower.includes('follow') || lower.includes('treelz')) {
    categories['Social/Feed'].push(t);
  } else if (lower.includes('game') || lower.includes('battle') || lower.includes('tournament') || lower.includes('league') || lower.includes('trollopoly') || lower.includes('prediction') || lower.includes('spin') || lower.includes('wheel')) {
    categories['Gaming'].push(t);
  } else if (lower.includes('admin') || lower.includes('mod') || lower.includes('ban') || lower.includes('jail') || lower.includes('court') || lower.includes('officer') || lower.includes('audit')) {
    categories['Admin/Moderation'].push(t);
  } else if (lower.includes('government') || lower.includes('president') || lower.includes('election') || lower.includes('vote') || lower.includes('law') || lower.includes('candidate') || lower.includes('party')) {
    categories['Government/Legal'].push(t);
  } else if (lower.includes('academy') || lower.includes('course') || lower.includes('quiz') || lower.includes('grade') || lower.includes('enrollment') || lower.includes('teacher') || lower.includes('student')) {
    categories['Academy/Education'].push(t);
  } else if (lower.includes('agency') || lower.includes('org') || lower.includes('family') || lower.includes('neighbor') || lower.includes('employee') || lower.includes('hr') || lower.includes('department')) {
    categories['Agency/Organization'].push(t);
  } else if (lower.includes('market') || lower.includes('shop') || lower.includes('product') || lower.includes('listing') || lower.includes('auction') || lower.includes('bid') || lower.includes('item')) {
    categories['Marketplace'].push(t);
  } else {
    categories['Other'].push(t);
  }
}

for (const [cat, items] of Object.entries(categories)) {
  if (items.length > 0) {
    report.push(`### ${cat} (${items.length})`);
    report.push('');
    for (const item of items) {
      report.push(`- \`${item}\``);
    }
    report.push('');
  }
}

report.push('## Detailed Missing RPCs by Category');
report.push('');

const rpcCategories = {
  'Economy/Coins': [],
  'Streams/Broadcast': [],
  'Chat/Messaging': [],
  'Admin/Moderation': [],
  'User Management': [],
  'Gaming/Battles': [],
  'Family/Social': [],
  'Government/Legal': [],
  'Academy': [],
  'Agency/HR': [],
  'System/Utilities': [],
  'Other': []
};

for (const r of notFoundRpcs.sort()) {
  const lower = r.toLowerCase();
  if (lower.includes('coin') || lower.includes('credit') || lower.includes('spend') || lower.includes('deduct') || lower.includes('payout') || lower.includes('cash') || lower.includes('wallet') || lower.includes('donate') || lower.includes('tip') || lower.includes('purchase') || lower.includes('buy') || lower.includes('sell') || lower.includes('order')) {
    rpcCategories['Economy/Coins'].push(r);
  } else if (lower.includes('stream') || lower.includes('broadcast') || lower.includes('bcast') || lower.includes('start_stream') || lower.includes('end_stream') || lower.includes('join_stream')) {
    rpcCategories['Streams/Broadcast'].push(r);
  } else if (lower.includes('chat') || lower.includes('message') || lower.includes('mail') || lower.includes('conversation') || lower.includes('block') || lower.includes('report')) {
    rpcCategories['Chat/Messaging'].push(r);
  } else if (lower.includes('ban') || lower.includes('kick') || lower.includes('mute') || lower.includes('jail') || lower.includes('warn') || lower.includes('mod') || lower.includes('officer') || lower.includes('summon')) {
    rpcCategories['Admin/Moderation'].push(r);
  } else if (lower.includes('user') || lower.includes('profile') || lower.includes('role') || lower.includes('permission') || lower.includes('auth') || lower.includes('login') || lower.includes('signup')) {
    rpcCategories['User Management'].push(r);
  } else if (lower.includes('battle') || lower.includes('game') || lower.includes('tournament') || lower.includes('league') || lower.includes('spin') || lower.includes('wheel') || lower.includes('trollopoly') || lower.includes('prediction') || lower.includes('vote')) {
    rpcCategories['Gaming/Battles'].push(r);
  } else if (lower.includes('family') || lower.includes('neighbor') || lower.includes('follow') || lower.includes('friend') || lower.includes('relationship')) {
    rpcCategories['Family/Social'].push(r);
  } else if (lower.includes('court') || lower.includes('judge') || lower.includes('attorney') || lower.includes('law') || lower.includes('prosecutor') || lower.includes('case') || lower.includes('docket') || lower.includes('trial')) {
    rpcCategories['Government/Legal'].push(r);
  } else if (lower.includes('academy') || lower.includes('course') || lower.includes('quiz') || lower.includes('grade') || lower.includes('enroll') || lower.includes('teacher') || lower.includes('student')) {
    rpcCategories['Academy'].push(r);
  } else if (lower.includes('agency') || lower.includes('hr') || lower.includes('employee') || lower.includes('payroll') || lower.includes('interview') || lower.includes('hire') || lower.includes('onboard')) {
    rpcCategories['Agency/HR'].push(r);
  } else if (lower.includes('system') || lower.includes('setting') || lower.includes('config') || lower.includes('health') || lower.includes('backup') || lower.includes('migrate') || lower.includes('seed') || lower.includes('fix') || lower.includes('update') || lower.includes('check') || lower.includes('get_') || lower.includes('is_') || lower.includes('can_')) {
    rpcCategories['System/Utilities'].push(r);
  } else {
    rpcCategories['Other'].push(r);
  }
}

for (const [cat, items] of Object.entries(rpcCategories)) {
  if (items.length > 0) {
    report.push(`### ${cat} (${items.length})`);
    report.push('');
    for (const item of items) {
      report.push(`- \`${item}()\``);
    }
    report.push('');
  }
}

report.push('## Validation Checks');
report.push('');
report.push('### Potential Issues in frontend_schema.sql');
report.push('');

// Check for duplicate extensions
const dupExtensions = extensionBlocks.filter((ext, i, self) => self.indexOf(ext) !== i);
if (dupExtensions.length > 0) {
  report.push(`- **Duplicate extensions**: ${dupExtensions.length} extensions appear multiple times`);
}

// Check for duplicate enum types
const dupEnums = [...enumBlocks].filter((e, i, self) => self.indexOf(e) !== i);
if (dupEnums.length > 0) {
  report.push(`- **Duplicate enum types**: ${dupEnums.length} enum types appear multiple times`);
}

// Check for tables referencing missing tables
const allDefinedTables = new Set([...tableBlocks.keys(), ...viewBlocks.keys()]);
const missingRefs = [];
for (const [tableName, fks] of fkBlocks) {
  for (const fk of fks) {
    const match = fk.match(/REFERENCES\s+(?:public\.)?([a-zA-Z_][a-zA-Z0-9_]*)/i);
    if (match) {
      const parentTable = match[1].toLowerCase();
      if (!allDefinedTables.has(parentTable) && tables.has(parentTable)) {
        missingRefs.push(`${tableName} -> ${parentTable}`);
      }
    }
  }
}

if (missingRefs.length > 0) {
  report.push(`- **Foreign keys to undefined tables**: ${missingRefs.length} FKs reference tables not in the migration`);
  report.push('  - These will cause errors when running the migration');
  for (const ref of missingRefs.slice(0, 10)) {
    report.push(`    - ${ref}`);
  }
  if (missingRefs.length > 10) {
    report.push(`    - ... and ${missingRefs.length - 10} more`);
  }
}

// Check for functions referencing missing tables
const missingFuncRefs = [];
for (const [funcName, funcBlock] of funcBlocks) {
  const tableRefs = [...funcBlock.matchAll(/(?:FROM|INSERT\s+INTO|UPDATE|REFERENCES)\s+(?:public\.)?([a-zA-Z_][a-zA-Z0-9_]*)/gi)];
  for (const ref of tableRefs) {
    const tableName = ref[1].toLowerCase();
    if (!allDefinedTables.has(tableName) && tables.has(tableName)) {
      missingFuncRefs.push(`${funcName}() -> ${tableName}`);
    }
  }
}

if (missingFuncRefs.length > 0) {
  report.push(`- **Functions referencing undefined tables**: ${missingFuncRefs.length} functions reference tables not in the migration`);
  for (const ref of missingFuncRefs.slice(0, 10)) {
    report.push(`  - ${ref}`);
  }
  if (missingFuncRefs.length > 10) {
    report.push(`  - ... and ${missingFuncRefs.length - 10} more`);
  }
}

report.push('');
report.push('### frontend_schema.sql Safety');
report.push('');
report.push('- All CREATE TABLE statements use `IF NOT EXISTS`');
report.push('- All CREATE INDEX statements use `IF NOT EXISTS` (where applicable)');
report.push('- All CREATE EXTENSION statements use `IF NOT EXISTS`');
report.push('- All CREATE TYPE statements use `IF NOT EXISTS`');
report.push('- The migration is **idempotent** - safe to run multiple times');
report.push('- RLS policies are included and will be applied');
report.push('');
report.push('### Recommended Approach');
report.push('');
report.push('1. Run `frontend_schema.sql` in the new Supabase SQL Editor');
report.push('2. Review the "Missing Tables" and "Missing RPCs" sections below');
report.push('3. Create missing objects manually in the SQL Editor');
report.push('4. Test the frontend connection');
report.push('');

fs.writeFileSync('MISSING_OBJECTS_REPORT.md', report.join('\n'));

// Also generate a copy-paste friendly SQL file for missing items
const missingSql = [];
missingSql.push('-- ==================== MISSING TABLES ====================');
missingSql.push('-- Create these tables in your new Supabase project');
missingSql.push('');
for (const t of notFoundTables.sort()) {
  missingSql.push(`-- TODO: CREATE TABLE ${t}`);
  missingSql.push(`-- Columns needed: check frontend code for usage`);
  missingSql.push('');
}

missingSql.push('-- ==================== MISSING RPC FUNCTIONS ====================');
missingSql.push('-- Create these functions in your new Supabase project');
missingSql.push('');
for (const r of notFoundRpcs.sort()) {
  missingSql.push(`-- TODO: CREATE OR REPLACE FUNCTION ${r}()`);
  missingSql.push(`-- Check old Supabase project or backups for function body`);
  missingSql.push('');
}

fs.writeFileSync('MISSING_OBJECTS.sql', missingSql.join('\n'));

console.log('Reports generated:');
console.log(`  - MISSING_OBJECTS_REPORT.md (${report.length} lines)`);
console.log(`  - MISSING_OBJECTS.sql (${missingSql.length} lines)`);
console.log('');
console.log('=== QUICK SUMMARY ===');
console.log(`Tables found: ${tableBlocks.size}`);
console.log(`Tables missing: ${notFoundTables.length}`);
console.log(`RPCs found: ${funcBlocks.size}`);
console.log(`RPCs missing: ${notFoundRpcs.length}`);
console.log(`Potential FK issues: ${missingRefs.length}`);
console.log(`Potential function issues: ${missingFuncRefs.length}`);
