import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

const OUTPUT_DIR = join(process.cwd(), 'supabase', 'migrations');

if (!existsSync(OUTPUT_DIR)) {
  mkdirSync(OUTPUT_DIR, { recursive: true });
}

const schema = readFileSync(join(process.cwd(), 'frontend_schema.sql'), 'utf8');

// Split by lines and look for CREATE TYPE statements
const lines = schema.split('\n');
const enums = new Map();
let currentEnum = null;
let currentEnumName = null;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  
  // Check if this line starts a CREATE TYPE
  const createTypeMatch = line.match(/CREATE\s+TYPE\s+(?:public\.)?(\w+)\s+AS\s+ENUM/);
  if (createTypeMatch) {
    // Save previous enum if exists
    if (currentEnum) {
      const fullEnum = currentEnum.join('\n').trim();
      if (!enums.has(currentEnumName)) {
        enums.set(currentEnumName, fullEnum);
      }
    }
    
    currentEnumName = createTypeMatch[1];
    currentEnum = [line];
    continue;
  }
  
  // If we're collecting an enum, add this line
  if (currentEnum) {
    currentEnum.push(line);
    
    // Check if this line ends the enum
    if (line.trim() === ');') {
      const fullEnum = currentEnum.join('\n').trim();
      if (!enums.has(currentEnumName)) {
        enums.set(currentEnumName, fullEnum);
      }
      currentEnum = null;
      currentEnumName = null;
    }
  }
}

// Save last enum if exists
if (currentEnum) {
  const fullEnum = currentEnum.join('\n').trim();
  if (!enums.has(currentEnumName)) {
    enums.set(currentEnumName, fullEnum);
  }
}

console.log(`Found ${enums.size} unique enums`);

// Create enum migration - ONLY enums, nothing else
let sql = '-- Enums\n';
sql += '-- Created before tables to avoid "type does not exist" errors\n\n';

for (const [name, definition] of Array.from(enums.entries()).sort((a, b) => a[0].localeCompare(b[0]))) {
  sql += definition + '\n\n';
}

writeFileSync(join(OUTPUT_DIR, '20260727180000_enums.sql'), sql);
console.log('Created: 20260727180000_enums.sql');
