import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const OUTPUT_DIR = join(process.cwd(), 'supabase', 'migrations');

// Read the original frontend_schema.sql
const original = readFileSync(join(process.cwd(), 'frontend_schema.sql'), 'utf8');

// Split into table blocks
const tableBlocks = [];
const blockRegex = /(--\s*Table:\s*\w+[\s\S]*?)(?=--\s*Table:\s*\w+|\Z)/gi;
let m;

while ((m = blockRegex.exec(original)) !== null) {
  tableBlocks.push(m[0]);
}

console.log(`Found ${tableBlocks.length} table blocks`);

// For each table, extract:
// 1. The table definition without REFERENCES
// 2. Any ALTER TABLE or inline REFERENCES that should be added later

const tablesWithoutFk = [];
const fkConstraints = [];

for (const block of tableBlocks) {
  const tableMatch = block.match(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:public\.)?(\w+)/);
  if (!tableMatch) continue;
  
  const tableName = tableMatch[1];
  
  // Remove REFERENCES from the CREATE TABLE
  let tableDef = block;
  
  // Extract column definitions
  const lines = block.split('\n');
  const cleanLines = [];
  const fkLines = [];
  
  for (const line of lines) {
    let cleaned = line;
    
    // Match column definitions with REFERENCES
    // Pattern: column_name type [NOT NULL] [DEFAULT value] [,] [REFERENCES table(column) [ON DELETE action]]
    const colMatch = line.match(/^(\s*\w+\s+(?:\w+(?:\([^)]*\))?\s+)(?:NOT\s+NULL\s+)?(?:DEFAULT\s+[^,]+\s*)?)(,?\s*REFERENCES\s+[\w.]+(?:\([^)]+\))?(?:\s+ON\s+DELETE\s+(?:CASCADE|SET\s+NULL|SET\s+DEFAULT|RESTRICT|NO\s+ACTION))?)$/i);
    
    if (colMatch) {
      // Remove the REFERENCES part
      cleaned = colMatch[1].replace(/,\s*$/, '') + (colMatch[1].endsWith(',') ? '' : ',');
      
      // Create ALTER TABLE statement
      const fkLine = colMatch[2].trim();
      if (fkLine) {
        fkConstraints.push({
          table: tableName,
          constraint: `ALTER TABLE public.${tableName} ADD COLUMN ${cleaned.trim()} ${fkLine};`
        });
      }
    }
    
    // Remove ON DELETE from inline constraints
    cleaned = cleaned.replace(/\s+ON\s+DELETE\s+(?:CASCADE|SET\s+NULL|SET\s+DEFAULT|RESTRICT|NO\s+ACTION)/gi, '');
    
    cleanLines.push(cleaned);
  }
  
  tablesWithoutFk.push(cleanLines.join('\n'));
}

// Write tables without FK
let sql = tablesWithoutFk.join('\n\n');
writeFileSync(join(OUTPUT_DIR, '20260727180000_initial_schema_tables.sql'), sql);
console.log('Created: 20260727180000_initial_schema_tables.sql');

// Write FK constraints as ALTER TABLE statements
let fkSql = '-- Add Foreign Key Constraints\n';
fkSql += '-- This migration adds foreign key constraints after all tables are created\n\n';

for (const fk of fkConstraints) {
  fkSql += `-- ${fk.table}\n`;
  fkSql += fk.constraint + '\n\n';
}

writeFileSync(join(OUTPUT_DIR, '20260727180000_initial_schema_fk.sql'), fkSql);
console.log(`Created: 20260727180000_initial_schema_fk.sql (${fkConstraints.length} constraints)`);
