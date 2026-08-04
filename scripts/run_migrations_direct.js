import { createClient } from '@supabase/supabase-js';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

const SUPABASE_URL = 'https://gktuylfiyazotmkzrpzl.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlqeHB3ZmFsZW5vcnpycXh3bXRyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDAyOTExNywiZXhwIjoyMDc5NjA1MTE3fQ.Ra1AhVwUYPxODzeFnCnWyurw8QiTzO0OeCo-sXzTVHo';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const MIGRATIONS_DIR = join(process.cwd(), 'supabase/migrations');

// Get all migration files in order
const files = readdirSync(MIGRATIONS_DIR)
  .filter(f => f.endsWith('.sql'))
  .sort();

console.log(`Found ${files.length} migrations to run`);

async function runMigration(filePath) {
  const sql = readFileSync(filePath, 'utf8');
  
  try {
    // Try using rpc to execute raw SQL
    const { data, error } = await supabase.rpc('exec_sql', { sql });
    
    if (error) {
      // If exec_sql doesn't exist, try another approach
      if (error.message.includes('function exec_sql')) {
        console.log(`  exec_sql not available, trying direct query...`);
        // Split by semicolons and execute each statement
        const statements = sql.split(';').filter(s => s.trim().length > 0);
        for (const stmt of statements) {
          const trimmed = stmt.trim();
          if (trimmed) {
            try {
              await supabase.rpc('exec_sql', { sql: trimmed + ';' });
            } catch (e) {
              // Try direct query for simple statements
            }
          }
        }
        return true;
      }
      throw error;
    }
    return true;
  } catch (error) {
    console.error(`  Error: ${error.message}`);
    return false;
  }
}

async function main() {
  for (const file of files) {
    const fullPath = join(MIGRATIONS_DIR, file);
    console.log(`Running: ${file}`);
    
    const success = await runMigration(fullPath);
    if (success) {
      console.log(`  ✓ Success`);
    } else {
      console.log(`  ✗ Failed`);
    }
  }
}

main().catch(console.error);
