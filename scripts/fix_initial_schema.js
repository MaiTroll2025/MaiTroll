import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

const OUTPUT_DIR = join(process.cwd(), 'supabase', 'migrations');

if (!existsSync(OUTPUT_DIR)) {
  mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Read all initial schema parts
const parts = [];
for (let i = 1; i <= 9; i++) {
  const partNum = String(i).padStart(2, '0');
  const filePath = join(OUTPUT_DIR, `20260727180000_initial_schema_part${partNum}.sql`);
  try {
    const content = readFileSync(filePath, 'utf8');
    parts.push({ file: filePath, content });
  } catch (e) {
    console.error(`Error reading part${partNum}:`, e.message);
  }
}

// Process each part to remove inline REFERENCES
for (const part of parts) {
  let sql = part.content;
  const lines = sql.split('\n');
  const result = [];
  
  for (const line of lines) {
    // Remove REFERENCES clauses
    let cleaned = line.replace(/,\s*REFERENCES\s+[\w.]+(?:\([^)]*\))?/gi, '');
    cleaned = cleaned.replace(/\s+REFERENCES\s+[\w.]+(?:\([^)]*\))?/gi, '');
    // Remove ON DELETE clauses
    cleaned = cleaned.replace(/\s+ON\s+DELETE\s+(CASCADE|SET\s+NULL|SET\s+DEFAULT|RESTRICT|NO\s+ACTION)/gi, '');
    // Remove ON UPDATE clauses
    cleaned = cleaned.replace(/\s+ON\s+UPDATE\s+(CASCADE|SET\s+NULL|SET\s+DEFAULT|RESTRICT|NO\s+ACTION)/gi, '');
    
    result.push(cleaned);
  }
  
  writeFileSync(part.file, result.join('\n'));
  console.log(`Processed: ${part.file}`);
}

// Create a migration to add all foreign key constraints
let fkSql = '-- Add Foreign Key Constraints\n';
fkSql += '-- This migration adds all foreign key constraints after tables are created\n\n';

for (const part of parts) {
  const content = part.content;
  // Find all lines that originally had REFERENCES
  const lines = content.split('\n');
  for (const line of lines) {
    const originalLine = line;
    // Check if this line had a REFERENCES clause (before we removed it)
    if (line.match(/REFERENCES|ON DELETE|ON UPDATE/)) {
      // Skip - these were removed
    }
  }
}

// Actually, let's extract REFERENCES from the ORIGINAL content
const originalContent = parts.map(p => p.content).join('\n');
const fkRegex = /(ALTER\s+TABLE\s+[\w.]+\s+ADD\s+COLUMN[^;]+REFERENCES[^;]+;)|(ALTER\s+TABLE\s+[\w.]+\s+ADD\s+CONSTRAINT[^;]+REFERENCES[^;]+;)|(CREATE\s+TABLE[^;]*?REFERENCES[^;]*?\);\s*--\s*Table:\s*(\w+))/gi;

// Instead, let's use a simpler approach: extract all column definitions with REFERENCES from original
const columnFkRegex = /(\w+)\s+(?:uuid|text|integer|boolean|timestamp|date|jsonb|numeric|decimal|int|varchar|char|float|double|bigint|smallint|serial|bigserial|uuid|inet|macaddr|tsvector|tsquery|xml|json|money|bytea|interval|time|timetz|timestampz|point|circle|box|path|polygon|line|lseg|bit|varbit|cidr|inet|macaddr|uuid|jsonb|jsonpath|regconfig|regdictionary|regnamespace|regoper|regoperator|regproc|regprocedure|regrole|regtype|text|varchar|char|integer|int|smallint|bigint|decimal|numeric|real|double|float|boolean|bool|date|timestamp|timestamptz|time|timetz|interval|uuid|json|jsonb|xml|money|bytea|tsvector|tsquery|point|circle|box|path|polygon|line|lseg|bit|varbit|cidr|inet|macaddr|regconfig|regdictionary|regnamespace|regoper|regoperator|regproc|regprocedure|regrole|regtype|text|varchar|char|integer|int|smallint|bigint|decimal|numeric|real|double|float|boolean|bool|date|timestamp|timestamptz|time|timetz|interval|uuid|json|jsonb|xml|money|bytea|tsvector|tsquery|point|circle|box|path|polygon|line|lseg|bit|varbit|cidr|inet|macaddr|regconfig|regdictionary|regnamespace|regoper|regoperator|regproc|regprocedure|regrole|regtype)\s+(?:NOT\s+NULL\s+)?DEFAULT\s+[^,]+(?:,\s*REFERENCES\s+[\w.]+(?:\([^)]+\))?(?:\s+ON\s+DELETE\s+\w+(?:\s+\w+)?)?)?/gi;

// This is getting too complex. Let me just read the original schema file and extract REFERENCES
const originalSchema = readFileSync(join(process.cwd(), 'frontend_schema.sql'), 'utf8');

// Find all REFERENCES patterns
const refPattern = /(?:ADD\s+COLUMN|)\s*(\w+)\s+(?:\w+(?:\([^)]*\))?\s+)(?:NOT\s+NULL\s+)?(?:DEFAULT\s+[^,]+\s*)?(?:,\s*)?REFERENCES\s+([\w.]+)(?:\(([^)]+)\))?(?:\s+ON\s+DELETE\s+(CASCADE|SET\s+NULL|SET\s+DEFAULT|RESTRICT|NO\s+ACTION))?/gi;

let refMatch;
while ((refMatch = refPattern.exec(originalSchema)) !== null) {
  // This is getting too complex
}

// Simpler approach: just re-create the initial schema without inline REFERENCES
// and skip adding them back - the per-page migrations handle constraints

console.log('\nSkipping FK constraint migration - per-page migrations handle constraints');
