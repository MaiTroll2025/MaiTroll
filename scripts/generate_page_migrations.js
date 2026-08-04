import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

const SCHEMA_FILE = join(process.cwd(), 'frontend_schema.sql');
const SRC_DIR = join(process.cwd(), 'src');
const OUTPUT_DIR = join(process.cwd(), 'supabase', 'migrations');

// Read schema
const schema = readFileSync(SCHEMA_FILE, 'utf8');

// Extract table definitions
const tables = {};
const tableRegex = /CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+public\.(\w+)\s*\(([\s\S]*?)\);/gi;
let match;
while ((match = tableRegex.exec(schema)) !== null) {
  tables[match[1]] = `CREATE TABLE IF NOT EXISTS public.${match[1]} (\n${match[2]}\n);`;
}

// Extract CREATE TABLE without IF NOT EXISTS
const tableRegex2 = /CREATE\s+TABLE\s+public\.(\w+)\s*\(([\s\S]*?)\);/gi;
while ((match = tableRegex2.exec(schema)) !== null) {
  if (!tables[match[1]]) {
    tables[match[1]] = `CREATE TABLE public.${match[1]} (\n${match[2]}\n);`;
  }
}

// Extract enum types
const enums = {};
const enumRegex = /CREATE\s+TYPE\s+(?:public\.)?(\w+)\s+AS\s+ENUM\s*\(([\s\S]*?)\);/gi;
while ((match = enumRegex.exec(schema)) !== null) {
  enums[match[1]] = `CREATE TYPE ${match[1]} AS ENUM (\n${match[2]}\n);`;
}

// Extract functions
const functions = {};
const funcRegex = /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.(\w+)\s*\(([\s\S]*?)\)\s*LANGUAGE/gi;
while ((match = funcRegex.exec(schema)) !== null) {
  functions[match[1]] = match[0];
}

// Extract indexes
const indexes = [];
const indexRegex = /CREATE\s+(?:UNIQUE\s+)?INDEX\s+(?:IF\s+NOT\s+EXISTS\s+)?(\w+)\s+ON\s+public\.(\w+)\s*\(([^)]+)\)/gi;
while ((match = indexRegex.exec(schema)) !== null) {
  indexes.push({
    name: match[1],
    table: match[2],
    sql: match[0]
  });
}

console.log(`Found ${Object.keys(tables).length} tables`);
console.log(`Found ${Object.keys(enums).length} enums`);
console.log(`Found ${Object.keys(functions).length} functions`);
console.log(`Found ${indexes.length} indexes`);

// Function to search a file for table references
function searchFileForTables(filePath) {
  try {
    const content = readFileSync(filePath, 'utf8');
    const found = [];
    for (const tableName of Object.keys(tables)) {
      const regex = new RegExp(`\\.from\\(['"]${tableName}['"]\\)`, 'gi');
      if (regex.test(content)) {
        found.push(tableName);
      }
    }
    return found;
  } catch {
    return [];
  }
}

// Function to search a file for RPC references
function searchFileForFunctions(filePath) {
  try {
    const content = readFileSync(filePath, 'utf8');
    const found = [];
    for (const funcName of Object.keys(functions)) {
      if (content.includes(`supabase.rpc('${funcName}')`) || content.includes(`rpc('${funcName}')`)) {
        found.push(funcName);
      }
    }
    return found;
  } catch {
    return [];
  }
}

// Scan ALL of src/ for files with table/function references
const allFiles = [];

function scanDirectory(dir, baseDir) {
  try {
    const entries = readdirSync(dir);
    for (const entry of entries) {
      const fullPath = join(dir, entry);
      const stat = statSync(fullPath);
      if (stat.isDirectory()) {
        scanDirectory(fullPath, baseDir);
      } else if (entry.endsWith('.tsx') || entry.endsWith('.ts') || entry.endsWith('.jsx')) {
        const tablesFound = searchFileForTables(fullPath);
        const functionsFound = searchFileForFunctions(fullPath);
        if (tablesFound.length > 0 || functionsFound.length > 0) {
          const relativePath = fullPath.replace(baseDir + '\\', '').replace(baseDir + '/', '');
          allFiles.push({
            path: fullPath,
            name: relativePath,
            tables: tablesFound,
            functions: functionsFound
          });
        }
      }
    }
  } catch (e) {
    // Directory doesn't exist
  }
}

scanDirectory(SRC_DIR, SRC_DIR);

console.log(`\nFound ${allFiles.length} files with DB references`);

// Determine shared tables (used by >2 files)
const tableUsageCount = {};
for (const file of allFiles) {
  for (const table of file.tables) {
    tableUsageCount[table] = (tableUsageCount[table] || 0) + 1;
  }
}

const sharedTables = new Set();
for (const [table, count] of Object.entries(tableUsageCount)) {
  if (count > 2) {
    sharedTables.add(table);
  }
}

// Determine shared functions
const functionUsageCount = {};
for (const file of allFiles) {
  for (const func of file.functions) {
    functionUsageCount[func] = (functionUsageCount[func] || 0) + 1;
  }
}

const sharedFunctions = new Set();
for (const [func, count] of Object.entries(functionUsageCount)) {
  if (count > 2) {
    sharedFunctions.add(func);
  }
}

// Find enums used by tables
const getEnumsForTables = (tableList) => {
  const result = new Set();
  for (const table of tableList) {
    const tableSql = tables[table] || '';
    for (const [enumName] of Object.entries(enums)) {
      if (tableSql.includes(enumName)) {
        result.add(enumName);
      }
    }
  }
  return Array.from(result);
};

// Find indexes for tables
const getIndexesForTables = (tableList) => {
  return indexes.filter(idx => tableList.includes(idx.table));
};

// Generate migration files
if (!existsSync(OUTPUT_DIR)) {
  mkdirSync(OUTPUT_DIR, { recursive: true });
}

const timestamp = '20260727180000';
let migrationCount = 0;

// Create core migration with shared tables
let coreSql = `-- Core schema shared across multiple files\n\n`;

// Core enums
const coreEnums = new Set();
for (const table of sharedTables) {
  const tableSql = tables[table] || '';
  for (const [enumName] of Object.entries(enums)) {
    if (tableSql.includes(enumName)) {
      coreEnums.add(enumName);
    }
  }
}

for (const enumName of Array.from(coreEnums).sort()) {
  coreSql += enums[enumName] + '\n\n';
}

// Core tables
for (const table of Array.from(sharedTables).sort()) {
  if (tables[table]) {
    coreSql += `-- Table: ${table}\n`;
    coreSql += tables[table] + '\n\n';
  }
}

// Core indexes
const coreIndexes = getIndexesForTables(Array.from(sharedTables));
for (const idx of coreIndexes) {
  coreSql += idx.sql + ';\n';
}

// Core functions
for (const funcName of Array.from(sharedFunctions).sort()) {
  if (functions[funcName]) {
    coreSql += functions[funcName] + '\n\n';
  }
}

// Enable RLS on core tables
coreSql += '\n-- Enable RLS on core tables\n';
for (const table of Array.from(sharedTables).sort()) {
  coreSql += `ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY;\n`;
}

const corePath = join(OUTPUT_DIR, `${timestamp}_core_schema.sql`);
writeFileSync(corePath, coreSql);
console.log(`Created: ${timestamp}_core_schema.sql (${sharedTables.size} tables, ${sharedFunctions.size} functions)`);
migrationCount++;

// Create per-file migrations for files with unique tables/functions
for (const file of allFiles.sort((a, b) => {
  const aUnique = a.tables.filter(t => !sharedTables.has(t)).length + a.functions.filter(f => !sharedFunctions.has(f)).length;
  const bUnique = b.tables.filter(t => !sharedTables.has(t)).length + b.functions.filter(f => !sharedFunctions.has(f)).length;
  return bUnique - aUnique;
})) {
  const uniqueTables = file.tables.filter(t => !sharedTables.has(t));
  const uniqueFunctions = file.functions.filter(f => !sharedFunctions.has(f));
  
  if (uniqueTables.length === 0 && uniqueFunctions.length === 0) continue;
  
  const fileKey = file.name.replace(/\.(tsx|ts|jsx)$/, '').replace(/[\/\\]/g, '_').replace(/[^a-zA-Z0-9_]/g, '_');
  
  let sql = `-- File: ${file.name}\n`;
  sql += `-- Migration: ${timestamp}_file_${fileKey}\n\n`;
  
  // Enums for this file's unique tables
  const fileEnums = getEnumsForTables(uniqueTables);
  for (const enumName of fileEnums) {
    sql += enums[enumName] + '\n\n';
  }
  
  // Tables
  for (const table of uniqueTables.sort()) {
    if (tables[table]) {
      sql += `-- Table: ${table}\n`;
      sql += tables[table] + '\n\n';
    }
  }
  
  // Indexes
  const fileIndexes = getIndexesForTables(uniqueTables);
  for (const idx of fileIndexes) {
    sql += idx.sql + ';\n';
  }
  
  // Functions
  for (const funcName of uniqueFunctions) {
    if (functions[funcName]) {
      sql += functions[funcName] + '\n\n';
    }
  }
  
  // Enable RLS
  if (uniqueTables.length > 0) {
    sql += '\n-- Enable RLS\n';
    for (const table of uniqueTables.sort()) {
      sql += `ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY;\n`;
    }
  }
  
  const fileName = `${timestamp}_file_${fileKey}.sql`;
  const filePath = join(OUTPUT_DIR, fileName);
  writeFileSync(filePath, sql);
  console.log(`Created: ${fileName} (${uniqueTables.length} tables, ${uniqueFunctions.length} functions)`);
  migrationCount++;
}

console.log(`\nTotal migrations created: ${migrationCount + 1}`);
