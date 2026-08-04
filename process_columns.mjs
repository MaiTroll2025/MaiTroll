import fs from 'fs';

// Read file and strip BOM
let raw = fs.readFileSync('C:/Users/kainm/column_info.json', 'utf8');
if (raw.charCodeAt(0) === 0xFEFF) {
  raw = raw.slice(1);
}
const s = JSON.parse(raw);
console.log('Total rows:', s.rows?.length);

// Also strip supabase status output that might be included
const lines = raw.split('\n').filter(l => {
  try { JSON.parse(l); return true; } catch { return false; }
});

// Actually let's just parse the raw content properly
const jsonStart = raw.indexOf('{');
const jsonContent = raw.substring(jsonStart);
// Find the matching end
let parsed;
try {
  parsed = JSON.parse(jsonContent);
} catch (e) {
  // Try to find the end of the JSON
  let end = jsonContent.lastIndexOf('}');
  parsed = JSON.parse(jsonContent.substring(0, end + 1));
}

console.log('Total column rows:', parsed.rows?.length);

// Get unique table names
const tables = new Set(parsed.rows?.map(r => r.table_name));
console.log('Unique tables:', tables.size);

// Load fix_rls_errors.sql tables
const rlsFile = fs.readFileSync('fix_rls_errors.sql', 'utf8');
const tableRegex = /ALTER TABLE public\.(\w+) ENABLE ROW LEVEL SECURITY/g;
const rlsTables = new Set();
let match;
while ((match = tableRegex.exec(rlsFile)) !== null) {
  rlsTables.add(match[1]);
}

// Find existing tables that are in fix_rls_errors.sql
const existingInRls = [...rlsTables].filter(t => tables.has(t));
const missingFromDb = [...rlsTables].filter(t => !tables.has(t));

console.log('\nExisting tables in fix_rls_errors.sql:', existingInRls.length);
console.log('Missing tables:', missingFromDb.length);
console.log('Missing tables list:', JSON.stringify(missingFromDb.sort(), null, 2));

// Save the missing tables list for further processing
fs.writeFileSync('missing_tables_list.json', JSON.stringify(missingFromDb.sort(), null, 2));
fs.writeFileSync('existing_tables_list.json', JSON.stringify(existingInRls.sort(), null, 2));
