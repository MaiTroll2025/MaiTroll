import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error('missing env');
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });

async function dumpFn(name) {
  // Try pg_proc (system catalog) via postgrest
  const { data, error } = await supabase
    .from('pg_proc')
    .select('proname, prosrc, prorettype, proargtypes, prosecute, proowner')
    .eq('proname', name);
  if (error) {
    console.log(`--- ${name} via pg_proc: ERROR:`, (error.message || '').slice(0, 120));
    return;
  }
  console.log(`--- ${name}: ${data?.length || 0} match(es)`);
  for (const row of data || []) {
    console.log('SOURCE_START>>>');
    console.log(row.prosrc);
    console.log('<<<SOURCE_END');
  }
}

// Supabase postgrest may expose pg_proc; also try a raw select just in case.
for (const n of ['find_random_battle_match', 'activate_random_battle', 'finish_random_battle', 'forfeit_random_battle']) {
  await dumpFn(n);
}
