import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error('missing env: SUPABASE_URL/VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });

const BOGUS = '00000000-0000-0000-0000-000000000000';
const BOGUS_USER = '11111111-1111-1111-1111-111111111111';

console.log('Checking RPC existence via find_random_battle_match...');
const { data, error } = await supabase.rpc('find_random_battle_match', {
  p_stream_id: BOGUS,
  p_broadcaster_id: BOGUS_USER,
});

if (error) {
  console.log('RPC ERROR:', JSON.stringify({ message: error.message, code: error.code, hint: error.hint }, null, 2));
  process.exit(2);
}
console.log('RPC OK -> result:', JSON.stringify(data, null, 2));
process.exit(0);
