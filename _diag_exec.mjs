import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error('missing env');
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });

const candidates = ['exec_sql', 'exec', 'rpc_exec', 'sql', 'run_sql', 'query', 'execute_sql', 'raw_sql', 'sql_exec', 'execsql'];

for (const name of candidates) {
  const { data, error } = await supabase.rpc(name, { query: 'SELECT 1' });
  if (error) {
    console.log(`${name}: NOT PRESENT ->`, (error.message || '').slice(0, 80));
  } else {
    console.log(`${name}: PRESENT ->`, JSON.stringify(data));
  }
}
