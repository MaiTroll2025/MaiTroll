import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://gejtbllazzighxwxudyu.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdlanRibGxhenppZ2h4d3h1ZHl1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NTE5NDk2MiwiZXhwIjoyMTAwNzcwOTYyfQ.cbE9pSa4QEilB6S3J4PyCfC8RiqVwlN2FSaEgUC8_H4';

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false }
});

async function inspectDatabase() {
  console.log('=== TABLES ===');
  const { data: tables, error: tablesError } = await supabase
    .from('pg_tables')
    .select('tablename')
    .eq('schemaname', 'public')
    .order('tablename');
  
  if (tablesError) {
    console.error('Tables error:', tablesError);
    return;
  }
  
  const tableNames = tables.map(t => t.tablename);
  console.log(`Found ${tableNames.length} tables:`);
  tableNames.forEach(t => console.log('  - ' + t));

  console.log('\n=== COLUMNS FOR KEY TABLES ===');
  const keyTables = ['user_profiles', 'streams', 'messages', 'gifts', 'coin_transactions', 
                     'applications', 'payout_requests', 'cashout_requests', 'earnings_payouts',
                     'officer_actions', 'officer_earnings', 'broadcaster_earnings', 'risk_events',
                     'user_risk_profile', 'revenue_settings', 'notifications', 'neighborhoods',
                     'neighborhood_members', 'houses', 'vehicles', 'car_insurances', 'troll_wheel_wins',
                     'troll_families', 'family_members', 'wall_posts', 'broadcasts', 'broadcast_gifts',
                     'battles', 'battle_participants', 'gift_items', 'stream_likes', 'stream_views'];
  
  for (const table of keyTables) {
    if (!tableNames.includes(table)) {
      console.log(`\n[${table}] MISSING`);
      continue;
    }
    
    const { data: cols, error: colsError } = await supabase
      .from('information_schema.columns')
      .select('column_name, data_type, is_nullable')
      .eq('table_schema', 'public')
      .eq('table_name', table)
      .order('ordinal_position');
    
    if (colsError) {
      console.log(`\n[${table}] Error:`, colsError.message);
      continue;
    }
    
    console.log(`\n[${table}] (${cols.length} columns)`);
    cols.forEach(c => {
      const nullable = c.is_nullable === 'YES' ? 'NULL' : 'NOT NULL';
      console.log(`  - ${c.column_name} (${c.data_type}) ${nullable}`);
    });
  }

  console.log('\n=== RLS POLICIES ===');
  const { data: policies, error: policiesError } = await supabase
    .from('pg_policies')
    .select('schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check')
    .eq('schemaname', 'public')
    .order('tablename, policyname');
  
  if (policiesError) {
    console.error('Policies error:', policiesError);
  } else {
    console.log(`Found ${policies.length} policies`);
    const byTable = {};
    policies.forEach(p => {
      if (!byTable[p.tablename]) byTable[p.tablename] = [];
      byTable[p.tablename].push(p);
    });
    Object.keys(byTable).sort().forEach(table => {
      console.log(`  [${table}]`);
      byTable[table].forEach(p => {
        console.log(`    - ${p.policyname} (${p.cmd})`);
      });
    });
  }

  console.log('\n=== ENUM TYPES ===');
  const { data: enums, error: enumsError } = await supabase
    .from('pg_type')
    .select('typname, typcategory')
    .eq('typnamespace', (await supabase.from('pg_namespace').select('oid').eq('nspname', 'public').single()).data?.oid);
  
  if (enumsError) {
    console.error('Enums error:', enumsError);
  } else {
    const enumTypes = enums.filter(e => e.typcategory === 'E');
    console.log(`Found ${enumTypes.length} enum types:`);
    enumTypes.forEach(e => console.log('  - ' + e.typname));
  }

  console.log('\n=== FUNCTIONS ===');
  const { data: funcs, error: funcsError } = await supabase
    .from('pg_proc')
    .select('proname')
    .eq('pronamespace', (await supabase.from('pg_namespace').select('oid').eq('nspname', 'public').single()).data?.oid)
    .order('proname');
  
  if (funcsError) {
    console.error('Functions error:', funcsError);
  } else {
    console.log(`Found ${funcs.length} functions:`);
    funcs.forEach(f => console.log('  - ' + f.proname));
  }

  console.log('\n=== MATERIALIZED VIEWS ===');
  const { data: views, error: viewsError } = await supabase
    .from('pg_matviews')
    .select('schemaname, matviewname')
    .eq('schemaname', 'public')
    .order('matviewname');
  
  if (viewsError) {
    console.error('Views error:', viewsError);
  } else {
    console.log(`Found ${views.length} materialized views:`);
    views.forEach(v => console.log('  - ' + v.matviewname));
  }
}

inspectDatabase().catch(console.error);
