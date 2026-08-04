import { Client } from 'pg';
import fs from 'fs';

const connectionString = process.env.DATABASE_URL || 
  'postgres://postgres:eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdlanRibGxhenppZ2h4d3h1ZHl1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NTE5NDk2MiwiZXhwIjoyMTAwNzcwOTYyfQ.cbE9pSa4QEilB6S3J4PyCfC8RiqVwlN2FSaEgUC8_H4@db.gejtbllazzighxwxudyu.supabase.co:5432/postgres';

async function main() {
  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  await client.connect();
  console.log('Connected to database.\n');

  // Parse fix_rls_errors.sql to get list of table names
  const rlsFile = fs.readFileSync('fix_rls_errors.sql', 'utf8');
  const tableRegex = /ALTER TABLE public\.(\w+) ENABLE ROW LEVEL SECURITY/g;
  const rlsTables = new Set();
  let match;
  while ((match = tableRegex.exec(rlsFile)) !== null) {
    rlsTables.add(match[1]);
  }

  console.log(`Tables in fix_rls_errors.sql: ${rlsTables.size}`);

  // Get all existing tables in public schema
  const result = await client.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
    ORDER BY table_name;
  `);
  const existingTables = new Set(result.rows.map(r => r.table_name));
  console.log(`Existing tables in database: ${existingTables.size}\n`);

  // Compare
  const missingTables = [];
  const existingTablesNeedingRLS = [];
  for (const table of rlsTables) {
    if (existingTables.has(table)) {
      existingTablesNeedingRLS.push(table);
    } else {
      missingTables.push(table);
    }
  }

  console.log('=== TABLES THAT EXIST (need RLS enabled) ===');
  console.log(JSON.stringify([...existingTablesNeedingRLS].sort(), null, 2));

  console.log('\n=== TABLES THAT ARE MISSING ===');
  console.log(JSON.stringify([...missingTables].sort(), null, 2));

  // Get RLS and policy status for existing tables that are in the list
  console.log('\n=== RLS AND POLICY STATUS FOR TABLES IN fix_rls_errors.sql THAT EXIST ===');
  const existingForRls = [...existingTablesNeedingRLS];
  if (existingForRls.length > 0) {
    const rlsResults = await client.query(`
      SELECT 
        t.tablename,
        t.relrowsecurity as rls_enabled,
        t.relforcerls as rls_forced,
        (SELECT COUNT(*) FROM pg_policies p WHERE p.tablename = t.tablename AND p.schemaname = 'public') as policy_count
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      JOIN pg_tables t ON t.tablename = c.relname
      WHERE t.schemaname = 'public'
        AND t.tablename = ANY($1)
      ORDER BY t.tablename;
    `, [existingForRls]);
    console.log(JSON.stringify(rlsResults.rows, null, 2));
  }

  await client.end();
}

main().catch(console.error);
