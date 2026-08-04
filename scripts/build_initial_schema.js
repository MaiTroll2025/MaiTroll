import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

const OUTPUT_DIR = join(process.cwd(), 'supabase', 'migrations');

if (!existsSync(OUTPUT_DIR)) {
  mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Read frontend_schema.sql
const frontendSchema = readFileSync(join(process.cwd(), 'frontend_schema.sql'), 'utf8');

// Find all SQL files in the project
const sqlFiles = [];
function findSqlFiles(dir, baseDir) {
  try {
    const entries = readdirSync(dir);
    for (const entry of entries) {
      const fullPath = join(dir, entry);
      const stat = statSync(fullPath);
      if (stat.isDirectory()) {
        if (!entry.includes('node_modules') && !entry.includes('worktree') && !entry.includes('backup') && !entry.includes('conflicted')) {
          findSqlFiles(fullPath, baseDir);
        }
      } else if (entry.endsWith('.sql')) {
        const relativePath = fullPath.replace(baseDir + '\\', '').replace(baseDir + '/', '');
        sqlFiles.push(relativePath);
      }
    }
  } catch (e) {
    // skip
  }
}

findSqlFiles(process.cwd(), process.cwd());

// Filter to only include files in the project root, src, db, database, migrations
const relevantSqlFiles = sqlFiles.filter(f => {
  const parts = f.split(/[\\/]/);
  return parts[0] === 'src' || parts[0] === 'db' || parts[0] === 'database' || parts[0] === 'migrations' || f.includes('complete_jail') || f.includes('UNIVERSAL_RLS') || f.includes('force_apply') || f.includes('MISSING_OBJECTS') || f.includes('agency_schema') || f.includes('create_media_city_schema') || f.includes('neighborhood_schema');
});

console.log(`Found ${relevantSqlFiles.length} relevant SQL files`);

// Extract all CREATE TABLE statements
const allTableDefs = {};
const tableRegex = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:public\.)?(\w+)\s*\(([\s\S]*?)\);/gi;

function extractTables(content, source) {
  let match;
  const tables = {};
  while ((match = tableRegex.exec(content)) !== null) {
    const tableName = match[1];
    if (!allTableDefs[tableName]) {
      tables[tableName] = {
        sql: match[0],
        source: source
      };
    }
  }
  return tables;
}

// Extract from frontend_schema.sql
const frontendTables = extractTables(frontendSchema, 'frontend_schema.sql');
Object.assign(allTableDefs, frontendTables);

// Extract from other SQL files
for (const sqlFile of relevantSqlFiles) {
  if (sqlFile === 'frontend_schema.sql') continue;
  try {
    const content = readFileSync(join(process.cwd(), sqlFile), 'utf8');
    const tables = extractTables(content, sqlFile);
    for (const [name, def] of Object.entries(tables)) {
      if (!allTableDefs[name]) {
        allTableDefs[name] = def;
      }
    }
  } catch (e) {
    // skip
  }
}

console.log(`Total unique tables found: ${Object.keys(allTableDefs).length}`);

// Find tables that are in frontend_schema.sql
const frontendTableNames = new Set(Object.keys(frontendTables));

// Find missing tables (in code but not in frontend_schema)
const codeTableNames = new Set();
const codeFiles = [];
function findCodeFiles(dir, baseDir) {
  try {
    const entries = readdirSync(dir);
    for (const entry of entries) {
      const fullPath = join(dir, entry);
      const stat = statSync(fullPath);
      if (stat.isDirectory()) {
        if (!entry.includes('node_modules') && !entry.includes('worktree') && !entry.includes('__tests__')) {
          findCodeFiles(fullPath, baseDir);
        }
      } else if ((entry.endsWith('.tsx') || entry.endsWith('.ts') || entry.endsWith('.jsx') || entry.endsWith('.js')) && !entry.includes('.test.')) {
        const relativePath = fullPath.replace(baseDir + '\\', '').replace(baseDir + '/', '');
        codeFiles.push(relativePath);
        try {
          const content = readFileSync(fullPath, 'utf8');
          const regex = /\.from\(['"`]([^'"`]+)['"`]\)/g;
          let m;
          while ((m = regex.exec(content)) !== null) {
            codeTableNames.add(m[1]);
          }
        } catch {}
      }
    }
  } catch (e) {
    // skip
  }
}

findCodeFiles(join(process.cwd(), 'src'), join(process.cwd(), 'src'));

console.log(`Tables referenced in code: ${codeTableNames.size}`);

const missingTables = Array.from(codeTableNames).filter(t => !frontendTableNames.has(t));
console.log(`Missing from frontend_schema.sql: ${missingTables.length}`);

// Create comprehensive initial schema
let initialSql = `-- ==================== INITIAL SCHEMA ====================\n`;
initialSql += `-- Generated from frontend_schema.sql and project SQL files\n`;
initialSql += `-- This migration creates all tables needed by the frontend\n\n`;

// Add tables from frontend_schema.sql
const frontendTableNamesArray = Object.keys(frontendTables).sort();
initialSql += `-- ==================== CORE TABLES ====================\n\n`;
for (const tableName of frontendTableNamesArray) {
  initialSql += `-- Table: ${tableName} (from frontend_schema.sql)\n`;
  initialSql += allTableDefs[tableName].sql + '\n\n';
}

// Add missing tables
if (missingTables.length > 0) {
  initialSql += `-- ==================== MISSING TABLES ====================\n\n`;
  for (const tableName of missingTables.sort()) {
    if (allTableDefs[tableName]) {
      initialSql += `-- Table: ${tableName} (from ${allTableDefs[tableName].source})\n`;
      initialSql += allTableDefs[tableName].sql + '\n\n';
    } else {
      initialSql += `-- MISSING: ${tableName} - not found in any SQL file\n`;
    }
  }
}

const initialPath = join(OUTPUT_DIR, '20260727180000_initial_schema.sql');
writeFileSync(initialPath, initialSql);
console.log(`\nCreated initial schema: ${initialPath}`);
console.log(`Total tables: ${Object.keys(allTableDefs).length}`);
