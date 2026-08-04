import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

const OUTPUT_DIR = join(process.cwd(), 'supabase', 'migrations');

if (!existsSync(OUTPUT_DIR)) {
  mkdirSync(OUTPUT_DIR, { recursive: true });
}

const PAGES_DIR = join(process.cwd(), 'src/pages');

// Scan all page files
const pageFiles = [];
function scanPages(dir) {
  try {
    const entries = readdirSync(dir);
    for (const entry of entries) {
      const fullPath = join(dir, entry);
      const stat = statSync(fullPath);
      if (stat.isDirectory()) {
        scanPages(fullPath);
      } else if (entry.endsWith('.tsx') || entry.endsWith('.ts') || entry.endsWith('.jsx')) {
        const relativePath = fullPath.replace(PAGES_DIR + '\\', '').replace(PAGES_DIR + '/', '');
        pageFiles.push({
          path: fullPath,
          name: relativePath,
          componentName: entry.replace(/\.(tsx|ts|jsx)$/, '')
        });
      }
    }
  } catch (e) {
    // skip
  }
}

scanPages(PAGES_DIR);

console.log(`Found ${pageFiles.length} page files`);

// Read initial schema to get all tables
const initialSchema = readFileSync(join(OUTPUT_DIR, '20260727180000_initial_schema.sql'), 'utf8');
const tableRegex = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:public\.)?(\w+)\s*\(/gi;
const initialTables = new Set();
let match;
while ((match = tableRegex.exec(initialSchema)) !== null) {
  initialTables.add(match[1]);
}

// Read missing tables
const missingSchema = readFileSync(join(OUTPUT_DIR, '20260727180000_missing_tables.sql'), 'utf8');
const missingTableRegex = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:public\.)?(\w+)\s*\(/gi;
while ((match = missingTableRegex.exec(missingSchema)) !== null) {
  initialTables.add(match[1]);
}

const allTables = new Set(initialTables);

// For each page, find table references
const timestamp = '20260727180000';
let migrationCount = 0;

for (const page of pageFiles.sort((a, b) => a.name.localeCompare(b.name))) {
  try {
    const content = readFileSync(page.path, 'utf8');
    const tables = new Set();
    const functions = new Set();
    
    // Find table references
    const fromRegex = /\.from\(['"`]([^'"`]+)['"`]\)/g;
    let m;
    while ((m = fromRegex.exec(content)) !== null) {
      tables.add(m[1]);
    }
    
    // Find RPC references
    const rpcRegex = /\.rpc\(['"`]([^'"`]+)['"`]/g;
    while ((m = rpcRegex.exec(content)) !== null) {
      functions.add(m[1]);
    }
    
    const pageKey = page.name.replace(/\.(tsx|ts|jsx)$/, '').replace(/[\/\\]/g, '_').replace(/[^a-zA-Z0-9_]/g, '_');
    
    let sql = `-- Page: ${page.name}\n`;
    sql += `-- Component: ${page.componentName}\n`;
    sql += `-- Migration: ${timestamp}_page_${pageKey}\n`;
    
    const existingTables = Array.from(tables).filter(t => allTables.has(t));
    const missingTableList = Array.from(tables).filter(t => !allTables.has(t));
    
    if (existingTables.length > 0) {
      sql += `-- Tables (in schema): ${existingTables.join(', ')}\n`;
    }
    if (missingTableList.length > 0) {
      sql += `-- Tables (missing): ${missingTableList.join(', ')}\n`;
    }
    if (functions.size > 0) {
      sql += `-- RPC functions: ${Array.from(functions).join(', ')}\n`;
    }
    sql += '\n';
    
    if (existingTables.length === 0 && functions.size === 0 && missingTableList.length === 0) {
      sql += `-- This page does not directly query any database tables.\n`;
      sql += `-- It may use data through parent components, hooks, or contexts.\n`;
    }
    
    const fileName = `${timestamp}_page_${pageKey}.sql`;
    const filePath = join(OUTPUT_DIR, fileName);
    writeFileSync(filePath, sql);
    migrationCount++;
  } catch (e) {
    console.error(`Error processing ${page.name}:`, e.message);
  }
}

console.log(`\nTotal page migrations created: ${migrationCount}`);
