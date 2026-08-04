import fs from 'fs';
import path from 'path';

const BASE = 'C:\\Users\\kainm\\TC ONLY\\maitroll';
const SUPABASE = path.join(BASE, 'supabase');

const frontendTables = fs.readFileSync(path.join(BASE, 'frontend_tables.txt'), 'utf8')
  .split('\n').map(l => l.trim()).filter(Boolean);
const frontendRPCs = fs.readFileSync(path.join(BASE, 'frontend_rpcs.txt'), 'utf8')
  .split('\n').map(l => l.trim()).filter(Boolean);
const frontendStorage = fs.readFileSync(path.join(BASE, 'frontend_storage.txt'), 'utf8')
  .split('\n').map(l => l.trim()).filter(Boolean);

const frontendStorageSet = new Set(frontendStorage.map(s => s.toLowerCase()));
const frontendTableSet = new Set(frontendTables.map(t => t.toLowerCase().replace(/[^a-z0-9_]/g, '')));
const frontendRPCSet = new Set(frontendRPCs.map(r => r.toLowerCase().replace(/[^a-z0-9_]/g, '')));

function collectSQLFiles(dir) {
  const results = [];
  if (!fs.existsSync(dir)) return results;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectSQLFiles(full));
    } else if (entry.name.endsWith('.sql')) {
      results.push(full);
    }
  }
  return results;
}

const migrationFiles = collectSQLFiles(path.join(SUPABASE, 'migrations'));
const policyFiles = collectSQLFiles(path.join(SUPABASE, 'policies'));
const sqlFiles = collectSQLFiles(path.join(SUPABASE, 'sql'));

const allFiles = [...migrationFiles, ...policyFiles, ...sqlFiles];
console.error(`Found ${allFiles.length} SQL files`);

let allSQL = '';
for (const file of allFiles) {
  try {
    allSQL += fs.readFileSync(file, 'utf8') + '\n';
  } catch (e) {
    console.error(`Error reading ${file}: ${e.message}`);
  }
}

function parseStatements(sql) {
  const stmts = [];
  let current = '';
  let i = 0;
  let inSingleQuote = false;
  let inDollarQuote = false;
  let dollarTag = '';
  let inLineComment = false;
  let inBlockComment = false;

  while (i < sql.length) {
    const ch = sql[i];
    const next = i + 1 < sql.length ? sql[i + 1] : '';

    if (!inSingleQuote && !inDollarQuote && !inBlockComment && !inLineComment) {
      if (ch === '-' && next === '-') { inLineComment = true; current += ch + next; i += 2; continue; }
      if (ch === '/' && next === '*') { inBlockComment = true; current += ch + next; i += 2; continue; }
    }
    if (inLineComment) { current += ch; if (ch === '\n') inLineComment = false; i++; continue; }
    if (inBlockComment) {
      current += ch;
      if (ch === '*' && next === '/') inBlockComment = false;
      i++; continue;
    }
    if (!inSingleQuote && ch === '$') {
      const dm = sql.slice(i).match(/^\$([a-zA-Z_]*)\$/);
      if (dm) {
        const tag = dm[1];
        if (!inDollarQuote) { inDollarQuote = true; dollarTag = tag; current += dm[0]; i += dm[0].length; continue; }
        else if (tag === dollarTag) { inDollarQuote = false; dollarTag = ''; current += dm[0]; i += dm[0].length; continue; }
      }
    }
    if (!inDollarQuote && !inBlockComment && ch === "'") {
      if (inSingleQuote) {
        if (next === "'") { current += ch + next; i += 2; continue; }
        else { inSingleQuote = false; current += ch; i++; continue; }
      } else { inSingleQuote = true; current += ch; i++; continue; }
    }
    if (ch === ';' && !inSingleQuote && !inDollarQuote && !inBlockComment) {
      const trimmed = current.trim();
      if (trimmed && trimmed.length > 5) stmts.push(trimmed);
      current = '';
      i++; continue;
    }
    current += ch;
    i++;
  }
  const last = current.trim();
  if (last && last.length > 5) stmts.push(last);
  return stmts;
}

const statements = parseStatements(allSQL);
console.error(`Parsed ${statements.length} SQL statements`);

function stripQuotes(s) { return s.replace(/^["']|["']$/g, ''); }
function norm(s) { return s.toLowerCase().replace(/[^a-z0-9_]/g, ''); }

function extractTableName(createStmt) {
  const pat1 = /CREATE\s+(?:OR\s+REPLACE\s+)?(?:TABLE|VIEW)\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:"?[^"\s]+"?\.)?(?:")([^"]+)"\s*\(/i;
  const m1 = createStmt.match(pat1);
  if (m1) return stripQuotes(m1[1]).toLowerCase();
  const pat2 = /CREATE\s+(?:OR\s+REPLACE\s+)?(?:TABLE|VIEW)\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:"?[^"\s]+"\.)?(["']?)([a-z][a-z0-9_-]*)\1\s*\(/i;
  const m2 = createStmt.match(pat2);
  if (m2) return stripQuotes(m2[2]).toLowerCase();
  const pat3 = /CREATE\s+(?:OR\s+REPLACE\s+)?(?:TABLE|VIEW)\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:"?[^"\s]+"\.)?(["']?)([a-z][a-z0-9_-]*)\1\s+AS\s+/i;
  const m3 = createStmt.match(pat3);
  if (m3) return stripQuotes(m3[2]).toLowerCase();
  return null;
}

function extractIndexTableName(createIdx) {
  const m = createIdx.match(/\bON\s+(?:"?[^"\s]+"?\.)?(["']?)([a-z][a-z0-9_-]*)\1\s*\(/i);
  if (m) return stripQuotes(m[2]).toLowerCase();
  return null;
}

function extractTriggerTableName(triggerStmt) {
  const m = triggerStmt.match(/\bON\s+(?:"?[^"\s]+"?\.)?(["']?)([a-z][a-z0-9_-]*)\1\s+(?:FOR|WHEN|EXECUTE)/i);
  if (m) return stripQuotes(m[2]).toLowerCase();
  const m2 = triggerStmt.match(/\bON\s+(?:"?[^"\s]+"?\.)?(["']?)([a-z][a-z0-9_-]*)\1\s*;/i);
  if (m2) return stripQuotes(m2[2]).toLowerCase();
  return null;
}

function extractFKFromCreate(createStmt) {
  const fks = [];
  const fkPat = /FOREIGN\s+KEY\s*\(([^)]+)\)\s*REFERENCES\s+(?:"?[^"\s]+"\.)?(["']?)([a-z][a-z0-9_-]*)\2/gi;
  let m;
  while ((m = fkPat.exec(createStmt)) !== null) {
    fks.push({ columns: m[1].split(',').map(c => c.trim().toLowerCase().replace(/["']/g, '')), refTable: m[3].toLowerCase() });
  }
  const colRefPat = /\bREFERENCES\s+(?:"?[^"\s]+"\.)?(["']?)([a-z][a-z0-9_-]*)\1\s*\(/gi;
  while ((m = colRefPat.exec(createStmt)) !== null) {
    const refTable = m[2].toLowerCase();
    const preceding = createStmt.slice(0, m.index);
    const lastParen = preceding.lastIndexOf('(');
    const lastClose = preceding.lastIndexOf(')');
    const colDef = preceding.slice(lastParen >= 0 && lastParen > lastClose ? lastParen : 0).trim();
    const colName = colDef.split(/\s+/).pop()?.toLowerCase();
    if (colName && colName !== 'references') {
      fks.push({ columns: [colName], refTable });
    }
  }
  return fks;
}

function extractFKFromAlter(alterStmt) {
  const fks = [];
  const fkPat = /FOREIGN\s+KEY\s*\(([^)]+)\)\s*REFERENCES\s+(?:"?[^"\s]+"\.)?(["']?)([a-z][a-z0-9_-]*)\2/gi;
  let m;
  while ((m = fkPat.exec(alterStmt)) !== null) {
    fks.push({ columns: m[1].split(',').map(c => c.trim().toLowerCase().replace(/["']/g, '')), refTable: m[3].toLowerCase() });
  }
  return fks;
}

function extractFunctionName(createFunc) {
  const m = createFunc.match(/CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:"?[^"\s]+"\.)?(["']?)([a-z][a-z0-9_-]*)\1\s*\(/i);
  if (m) return stripQuotes(m[2]).toLowerCase();
  return null;
}

function extractFunctionNameFromGrant(grantStmt) {
  const m = grantStmt.match(/ON\s+FUNCTION\s+(?:public\.)?(["']?)([a-z][a-z0-9_-]*)\1\s*\(/i);
  if (m) return stripQuotes(m[2]).toLowerCase();
  const m2 = grantStmt.match(/ON\s+FUNCTION\s+(?:public\.)?(["']?)([a-z][a-z0-9_-]*)\1\s*$/i);
  if (m2) return stripQuotes(m2[2]).toLowerCase();
  return null;
}

function extractStorageBucketName(stmt) {
  const m = stmt.match(/name\s*,\s*'(.*?)'/i) || stmt.match(/name\s*,\s*"(.*?)"/i);
  if (m) return m[1].toLowerCase();
  return null;
}

const extensions = [];
const createTables = [];
const createIndexes = [];
const alterFKs = [];
const triggers = [];
const functions = [];
const grants = [];
const comments = [];
const storageBuckets = [];

const allFKs = [];
const fkChildToParent = new Map();

console.error('Scanning statements...');

for (const stmt of statements) {
  const upper = stmt.toUpperCase();

  if (upper.startsWith('CREATE EXTENSION')) {
    extensions.push(stmt);
    continue;
  }

  if (upper.startsWith('CREATE TABLE') || upper.startsWith('CREATE OR REPLACE TABLE')) {
    const tbl = extractTableName(stmt);
    if (tbl && frontendTableSet.has(norm(tbl))) {
      createTables.push(stmt);
      const inlineFKs = extractFKFromCreate(stmt);
      for (const fk of inlineFKs) {
        allFKs.push({ childTable: tbl, fk });
        if (!fkChildToParent.has(tbl)) fkChildToParent.set(tbl, new Set());
        fkChildToParent.get(tbl).add(fk.refTable);
      }
    }
    continue;
  }

  if (upper.startsWith('CREATE UNIQUE INDEX') || upper.startsWith('CREATE INDEX')) {
    const tbl = extractIndexTableName(stmt);
    if (tbl && frontendTableSet.has(norm(tbl))) {
      createIndexes.push(stmt);
    }
    continue;
  }

  if (upper.startsWith('ALTER TABLE')) {
    const fks = extractFKFromAlter(stmt);
    if (fks.length > 0) {
      alterFKs.push(stmt);
      for (const fk of fks) {
        allFKs.push({ childTable: null, fk, stmt });
      }
    }
    continue;
  }

  if (upper.startsWith('CREATE OR REPLACE FUNCTION') || upper.startsWith('CREATE FUNCTION')) {
    const fn = extractFunctionName(stmt);
    if (fn && frontendRPCSet.has(norm(fn))) {
      functions.push(stmt);
    }
    continue;
  }

  if (upper.startsWith('GRANT')) {
    const fn = extractFunctionNameFromGrant(stmt);
    if (fn && frontendRPCSet.has(norm(fn))) {
      grants.push(stmt);
    }
    continue;
  }

  if (upper.startsWith('CREATE TRIGGER')) {
    const tbl = extractTriggerTableName(stmt);
    if (tbl && frontendTableSet.has(norm(tbl))) {
      triggers.push(stmt);
    }
    continue;
  }

  if (upper.startsWith('COMMENT ON')) {
    const tm = stmt.match(/COMMENT\s+ON\s+TABLE\s+(?:"?[^"\s]+"\.)?(["']?)([a-z][a-z0-9_-]*)\1\s+IS\s+/i);
    if (tm && frontendTableSet.has(norm(stripQuotes(tm[2])))) { comments.push(stmt); continue; }
    const fm = stmt.match(/COMMENT\s+ON\s+FUNCTION\s+(?:"?[^"\s]+"\.)?(["']?)([a-z][a-z0-9_-]*)\1\s*\(/i);
    if (fm && frontendRPCSet.has(norm(stripQuotes(fm[2])))) { comments.push(stmt); continue; }
    continue;
  }

  if (upper.includes('STORAGE.BUCKETS') || upper.includes('STORAGE.BUCKET')) {
    if (stmt.match(/(?:INSERT\s+INTO|UPDATE|DELETE\s+FROM)\s+storage\.buckets/i)) {
      const bn = extractStorageBucketName(stmt);
      if (bn && frontendStorageSet.has(bn)) storageBuckets.push(stmt);
    }
    continue;
  }
}

console.error(`Extensions: ${extensions.length}`);
console.error(`CREATE TABLEs: ${createTables.length}`);
console.error(`CREATE INDEXes: ${createIndexes.length}`);
console.error(`ALTER TABLE FKs: ${alterFKs.length}`);
console.error(`Functions: ${functions.length}`);
console.error(`GRANTs: ${grants.length}`);
console.error(`Triggers: ${triggers.length}`);
console.error(`Comments: ${comments.length}`);
console.error(`Storage: ${storageBuckets.length}`);
console.error(`All FK refs found: ${allFKs.length}`);

function dedupe(arr, keyFn) {
  const seen = new Set();
  const out = [];
  for (const item of arr) {
    const k = keyFn(item);
    if (!seen.has(k)) { seen.add(k); out.push(item); }
  }
  return out;
}

const dTables = dedupe(createTables, s => s.toLowerCase().replace(/\s+/g, ' '));
const dIndexes = dedupe(createIndexes, s => s.toLowerCase().replace(/\s+/g, ' '));
const dFKs = dedupe(alterFKs, s => s.toLowerCase().replace(/\s+/g, ' '));
const dFuncs = dedupe(functions, s => s.toLowerCase().replace(/\s+/g, ' '));
const dGrants = dedupe(grants, s => s.toLowerCase().replace(/\s+/g, ' '));
const dTriggers = dedupe(triggers, s => s.toLowerCase().replace(/\s+/g, ' '));
const dComments = dedupe(comments, s => s.toLowerCase().replace(/\s+/g, ' '));
const dStorage = dedupe(storageBuckets, s => s.toLowerCase().replace(/\s+/g, ' '));

function topoSortTables(tables, fkChildToParent) {
  const order = [];
  const visited = new Set();
  const visiting = new Set();

  function visit(t) {
    const l = t.toLowerCase();
    if (visited.has(l)) return;
    if (visiting.has(l)) { console.error(`  Circular dep: ${l}`); return; }
    visiting.add(l);
    const parents = fkChildToParent.get(t) || new Set();
    for (const p of parents) visit(p);
    visiting.delete(l);
    visited.add(l);
    order.push(l);
  }

  for (const t of tables) visit(t);
  return order;
}

const tableNames = dTables.map(s => extractTableName(s)).filter(Boolean);
const tableOrder = topoSortTables(tableNames, fkChildToParent);

const foundTableSet = new Set(tableNames.map(t => t.toLowerCase()));
const foundFuncSet = new Set();
for (const s of dFuncs) {
  const fn = extractFunctionName(s);
  if (fn) foundFuncSet.add(fn.toLowerCase());
}
const foundStorageSet = new Set();
for (const s of dStorage) {
  const bn = extractStorageBucketName(s);
  if (bn) foundStorageSet.add(bn);
}

const notFound = frontendTables.filter(t => !foundTableSet.has(norm(t)));
const notFoundRPCs = frontendRPCs.filter(r => !foundFuncSet.has(norm(r)));
const notFoundStorage = frontendStorage.filter(s => !foundStorageSet.has(s.toLowerCase()));

let output = '-- ============================================\n';
output += '-- Frontend Schema DDL\n';
output += '-- ============================================\n\n';

if (extensions.length > 0) {
  output += '-- Extensions\n';
  for (const ext of extensions) output += ext + ';\n\n';
}

output += '-- CREATE TABLE statements (dependency order)\n';
for (const t of tableOrder) {
  const stmt = dTables.find(s => extractTableName(s)?.toLowerCase() === t);
  if (stmt) output += stmt + ';\n\n';
}

if (dIndexes.length > 0) {
  output += '-- CREATE INDEX statements\n';
  for (const idx of dIndexes) output += idx + ';\n\n';
}

if (dFKs.length > 0) {
  output += '-- ALTER TABLE ADD FOREIGN KEY (dependency order)\n';
  const added = new Set();
  for (const t of tableOrder) {
    for (const stmt of dFKs) {
      const key = stmt.toLowerCase().replace(/\s+/g, ' ');
      if (added.has(key)) continue;
      const fks = extractFKFromAlter(stmt);
      for (const fk of fks) {
        if (fk.refTable === t) { output += stmt + ';\n\n'; added.add(key); break; }
      }
    }
  }
}

if (dTriggers.length > 0) {
  output += '-- Triggers\n';
  for (const trig of dTriggers) output += trig + ';\n\n';
}

if (dFuncs.length > 0) {
  output += '-- CREATE OR REPLACE FUNCTION (RPCs)\n';
  for (const fn of dFuncs) output += fn + ';\n\n';
}

if (dGrants.length > 0) {
  output += '-- GRANT statements\n';
  for (const gr of dGrants) output += gr + ';\n\n';
}

if (dComments.length > 0) {
  output += '-- Comments\n';
  for (const c of dComments) output += c + ';\n\n';
}

if (dStorage.length > 0) {
  output += '-- Storage buckets\n';
  for (const sb of dStorage) output += sb + ';\n\n';
}

fs.writeFileSync(path.join(BASE, 'frontend_schema.sql'), output);
console.error('Wrote frontend_schema.sql');
console.log(`TABLES_FOUND=${dTables.length}`);
console.log(`RPCs_FOUND=${dFuncs.length}`);
console.log(`FKs_COLLECTED=${allFKs.length + dFKs.length}`);
console.log(`TABLES_NOT_FOUND=${notFound.length}: ${notFound.slice(0, 15).join(', ')}${notFound.length > 15 ? ` ... (+${notFound.length - 15} more)` : ''}`);
console.log(`RPCs_NOT_FOUND=${notFoundRPCs.length}: ${notFoundRPCs.slice(0, 15).join(', ')}${notFoundRPCs.length > 15 ? ` ... (+${notFoundRPCs.length - 15} more)` : ''}`);
console.log(`STORAGE_NOT_FOUND=${notFoundStorage.length}: ${notFoundStorage.join(', ')}`);