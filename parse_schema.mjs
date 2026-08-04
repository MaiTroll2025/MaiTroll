import fs from 'fs';

const schema = JSON.parse(fs.readFileSync('C:/Users/kainm/Mai Troll_schema.json', 'utf8'));

// Extract table names from paths: "/table_name" entries (not "/" and not "/rpc/function_name")
const paths = Object.keys(schema.paths || {});
const tablePaths = paths.filter(p => {
  if (p === '/') return false;
  // Filter out non-table paths (like /rpc/function_name, etc.)
  const parts = p.split('/');
  if (parts.length === 2 && parts[1].length > 0) return true;
  return false;
});
const tableNames = tablePaths.map(p => p.substring(1));

// Sort and dedupe
const allTables = new Set(tableNames);

console.log(`Total tables exposed via REST API: ${allTables.size}`);

// Parse fix_rls_errors.sql to get expected table names
const rlsFile = fs.readFileSync('fix_rls_errors.sql', 'utf8');
const tableRegex = /ALTER TABLE public\.(\w+) ENABLE ROW LEVEL SECURITY/g;
const rlsTables = new Set();
let match;
while ((match = tableRegex.exec(rlsFile)) !== null) {
  rlsTables.add(match[1]);
}

console.log(`Tables in fix_rls_errors.sql: ${rlsTables.size}\n`);

// Compare
const existingTables = [];
const missingTables = [];
const extraTables = [];

for (const table of rlsTables) {
  if (allTables.has(table)) {
    existingTables.push(table);
  } else {
    missingTables.push(table);
  }
}

for (const table of allTables) {
  if (!rlsTables.has(table)) {
    extraTables.push(table);
  }
}

console.log(`=== Tables that EXIST (in fix_rls_errors.sql AND in DB): ${existingTables.length} ===`);
console.log(JSON.stringify(existingTables.sort(), null, 2));

console.log(`\n=== Tables that are MISSING (in fix_rls_errors.sql but NOT in DB): ${missingTables.length} ===`);
console.log(JSON.stringify(missingTables.sort(), null, 2));

console.log(`\n=== Tables in DB but NOT in fix_rls_errors.sql: ${extraTables.length} ===`);
console.log(JSON.stringify(extraTables.sort(), null, 2));

// Save results
const output = {
  existingTables: existingTables.sort(),
  missingTables: missingTables.sort(),
  extraTables: extraTables.sort(),
  allExistingTables: [...allTables].sort()
};
fs.writeFileSync('C:/Users/kainm/TC ONLY/Mai Troll/table_check_results.json', JSON.stringify(output, null, 2));
console.log('\nResults saved to table_check_results.json');
