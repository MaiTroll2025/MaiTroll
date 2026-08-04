import fs from 'fs';
import path from 'path';

const results = JSON.parse(fs.readFileSync('C:/Users/kainm/TC ONLY/Mai Troll/table_check_results.json', 'utf8'));
const missingTables = results.missingTables;
const missingSet = new Set(missingTables);

// Read frontend_schema.sql for ALTER TABLE statements about missing tables
const frontendSchema = fs.readFileSync('C:/Users/kainm/TC ONLY/Mai Troll/frontend_schema.sql', 'utf8');

// Search for ALTER TABLE statements that reference our missing tables
const alterRegex = new RegExp(
  `ALTER\\s+TABLE\\s+(?:IF\\s+EXISTS\\s+)?(?:public\\.)?(${missingTables.join('|')})\\s+`,
  'gi'
);
const alterMatches = new Map(); // tableName -> array of SQL statements
let m;
const altRegex = /ALTER\s+TABLE\s+(?:IF\s+EXISTS\s+)?(?:public\.)?(\w+)\s+(.+?);/gis;
while ((m = altRegex.exec(frontendSchema)) !== null) {
  const tableName = m[1].toLowerCase();
  if (missingSet.has(tableName)) {
    if (!alterMatches.has(tableName)) alterMatches.set(tableName, []);
    alterMatches.get(tableName).push(m[0].trim());
  }
}

// Also search all migration files for ALTER TABLE statements
const migrationDir = 'C:/Users/kainm/TC ONLY/Mai Troll/supabase/migrations';
const migrationFiles = fs.readdirSync(migrationDir).filter(f => f.endsWith('.sql'));

for (const file of migrationFiles) {
  const content = fs.readFileSync(path.join(migrationDir, file), 'utf8');
  let altM;
  const altRe = /ALTER\s+TABLE\s+(?:IF\s+EXISTS\s+)?(?:public\.)?(\w+)\s+(.+?);/gis;
  while ((altM = altRe.exec(content)) !== null) {
    const tableName = altM[1].toLowerCase();
    if (missingSet.has(tableName)) {
      if (!alterMatches.has(tableName)) alterMatches.set(tableName, []);
      alterMatches.get(tableName).push(`[migration: ${file}] ${altM[0].trim()}`);
    }
  }
}

// Search root-level SQL files too
const rootFiles = fs.readdirSync('C:/Users/kainm/TC ONLY/Mai Troll').filter(f => f.endsWith('.sql'));
for (const file of rootFiles) {
  const filePath = path.join('C:/Users/kainm/TC ONLY/Mai Troll', file);
  const content = fs.readFileSync(filePath, 'utf8');
  let altM;
  const altRe = /ALTER\s+TABLE\s+(?:IF\s+EXISTS\s+)?(?:public\.)?(\w+)\s+(.+?);/gis;
  while ((altM = altRe.exec(content)) !== null) {
    const tableName = altM[1].toLowerCase();
    if (missingSet.has(tableName)) {
      if (!alterMatches.has(tableName)) alterMatches.set(tableName, []);
      alterMatches.get(tableName).push(`[file: ${file}] ${altM[0].trim()}`);
    }
  }
}

console.log(`Tables with ALTER TABLE references in SQL files: ${alterMatches.size}`);

// Print all ALTER TABLE matches
for (const [table, statements] of [...alterMatches.entries()].sort()) {
  console.log(`\n=== ${table} (${statements.length} statements) ===`);
  for (const stmt of statements.slice(0, 5)) { // Limit to 5 per table
    console.log(`  ${stmt.substring(0, 200)}`);
  }
  if (statements.length > 5) console.log(`  ... and ${statements.length - 5} more`);
}

// Save all ALTER TABLE matches
fs.writeFileSync('C:/Users/kainm/TC ONLY/Mai Troll/alter_table_refs.json', JSON.stringify(
  Object.fromEntries([...alterMatches.entries()].map(([k,v]) => [k, v])), null, 2));
