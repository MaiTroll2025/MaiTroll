import fs from 'fs';

const content = fs.readFileSync('C:/Users/kainm/TC ONLY/Mai Troll/frontend_schema.sql', 'utf8');
const createTableRegex = /CREATE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:public\.)?(\w+)\s*\(/gi;
const tables = new Set();
let m;
while ((m = createTableRegex.exec(content)) !== null) {
  tables.add(m[1]);
}

// Load missing tables
const results = JSON.parse(fs.readFileSync('C:/Users/kainm/TC ONLY/Mai Troll/table_check_results.json', 'utf8'));
const missingTables = results.missingTables;
const missingSet = new Set(missingTables);

console.log(`Total CREATE TABLE statements in frontend_schema.sql: ${tables.size}`);

const foundInFrontend = [];
const notFoundInFrontend = [];
for (const t of missingSet) {
  if (tables.has(t)) foundInFrontend.push(t);
  else notFoundInFrontend.push(t);
}

console.log(`\nMissing tables FOUND in frontend_schema.sql: ${foundInFrontend.length}`);
console.log(JSON.stringify(foundInFrontend.sort(), null, 2));

console.log(`\nMissing tables NOT in frontend_schema.sql: ${notFoundInFrontend.length}`);
console.log(JSON.stringify(notFoundInFrontend.sort(), null, 2));

// Save frontend table list
fs.writeFileSync('C:/Users/kainm/TC ONLY/Mai Troll/frontend_schema_tables.json', JSON.stringify([...tables].sort(), null, 2));
