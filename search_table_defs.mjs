import fs from 'fs';
import path from 'path';

// Load missing tables
const missingTables = JSON.parse(fs.readFileSync('C:/Users/kainm/TC ONLY/Mai Troll/table_check_results.json', 'utf8'));
const missingSet = new Set(missingTables.missingTables);
console.log(`Missing tables to search for: ${missingSet.size}`);

// Walk through all .sql files in the project
const projectRoot = 'C:/Users/kainm/TC ONLY/Mai Troll';
const dirsToSearch = [
  projectRoot,
  path.join(projectRoot, 'supabase/migrations'),
  path.join(projectRoot, 'supabase/sql'),
  path.join(projectRoot, 'supabase/fixes'),
  path.join(projectRoot, 'scripts'),
  path.join(projectRoot, 'sql'),
  path.join(projectRoot, 'migrations'),
  path.join(projectRoot, 'db/migrations'),
  path.join(projectRoot, '.kilo/command'),
];

const sqlFiles = [];
function walkDir(dir) {
  if (!fs.existsSync(dir)) return;
  const items = fs.readdirSync(dir, { withFileTypes: true });
  for (const item of items) {
    const fullPath = path.join(dir, item.name);
    if (item.isDirectory() && item.name !== 'node_modules' && item.name !== '.git' && item.name !== 'dist' && item.name !== 'errors' && item.name !== 'error-logs' && item.name !== 'tatus' && item.name !== 'tmp') {
      walkDir(fullPath);
    } else if (item.isFile() && item.name.endsWith('.sql')) {
      sqlFiles.push(fullPath);
    }
  }
}

for (const dir of dirsToSearch) {
  walkDir(dir);
}
console.log(`Found ${sqlFiles.length} SQL files to search`);

// Search for CREATE TABLE statements
const foundDefinitions = {}; // tableName -> { filePath, sql, lines }
const foundAlterTable = {};  // tableName -> { filePath, sql }

for (const file of sqlFiles) {
  let content;
  try {
    content = fs.readFileSync(file, 'utf8');
  } catch (e) {
    continue;
  }

  // Find CREATE TABLE statements
  // Pattern: CREATE [TEMP] TABLE [IF NOT EXISTS] [schema.]table_name (...)
  const createTableRegex = /CREATE\s+(?:TEMP\s+|TEMPORARY\s+)?TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:public\.)?(\w+)\s*\(/gi;
  let m;
  while ((m = createTableRegex.exec(content)) !== null) {
    const tableName = m[1].toLowerCase();
    if (missingSet.has(tableName) || missingSet.has(m[1])) {
      // Extract the full CREATE TABLE statement by finding matching parentheses
      const startIdx = m.index;
      let depth = 0;
      let endIdx = -1;
      for (let i = m.index; i < content.length; i++) {
        if (content[i] === '(') depth++;
        if (content[i] === ')') {
          depth--;
          if (depth === 0) {
            endIdx = i + 1;
            break;
          }
        }
      }
      if (endIdx > startIdx) {
        // Also capture trailing semicolon or RLS/policy/index statements
        let stmtEnd = endIdx;
        // Look for semicolon
        while (stmtEnd < content.length && content[stmtEnd] !== ';') stmtEnd++;
        if (stmtEnd < content.length) stmtEnd++; // include semicolon
        const sqlBlock = content.substring(startIdx, endIdx + 1);

        if (!foundDefinitions[tableName]) {
          foundDefinitions[tableName] = { file, sql: sqlBlock, startLine: content.substring(0, m.index).split('\n').length };
        } else {
          // Keep the first one found
        }
      }
    }
  }

  // Also search for ALTER TABLE statements that add columns or FKs to missing tables
  if (content.includes('ALTER TABLE')) {
    // This is a broad search - we'll process later
  }
}

console.log(`\nFound CREATE TABLE definitions for ${Object.keys(foundDefinitions).length} missing tables:`);
const foundTables = Object.keys(foundDefinitions).sort();
const notFound = [...missingSet].filter(t => !foundDefinitions[t] && !foundDefinitions[t.toLowerCase()]).sort();

console.log('Found:', JSON.stringify(foundTables, null, 2));
console.log('\nNot found:', JSON.stringify(notFound, null, 2));
console.log(`\nFound: ${foundTables.length}, Not found: ${notFound.length}`);

// Save results
fs.writeFileSync('C:/Users/kainm/TC ONLY/Mai Troll/found_definitions.json', JSON.stringify({
  found: foundTables,
  notFound: notFound,
  details: Object.entries(foundDefinitions).map(([table, info]) => ({
    table,
    file: info.file,
    startLine: info.startLine,
    createTableSql: info.sql
  }))
}, null, 2));
