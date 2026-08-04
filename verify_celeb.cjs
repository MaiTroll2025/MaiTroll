const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envContent = fs.readFileSync('C:/Users/kainm/TC ONLY/TrollCity/.env', 'utf8');
const getEnv = (key) => {
  const match = envContent.match(new RegExp(key + '=(.+)'));
  return match ? match[1].trim() : null;
};

const supabaseUrl = getEnv('SUPABASE_URL');
const serviceRoleKey = getEnv('SUPABASE_SERVICE_ROLE_KEY');

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  db: { schema: 'public' },
  fetch: require('node-fetch'),
});

(async () => {
  try {
    // Check if celeb tables exist
    const tables = ['celeb_applications', 'celeb_profiles', 'celeb_products', 
                    'celeb_cashout_tiers', 'celeb_cashout_requests', 'celeb_audit_logs'];
    
    for (const table of tables) {
      const { data, error } = await supabase.from(table).select('count', { count: 'exact', head: true });
      if (error) {
        console.log(`Table ${table}: ERROR - ${error.message}`);
      } else {
        console.log(`Table ${table}: EXISTS`);
      }
    }
    
    // Check if celeb_role column exists on user_profiles
    const { data: profiles, error: profilesError } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('celeb_role', 'host')
      .limit(1);
    
    if (profilesError) {
      if (profilesError.message.includes('column') && profilesError.message.includes('does not exist')) {
        console.log('user_profiles.celeb_role: DOES NOT EXIST');
      } else {
        console.log('user_profiles.celeb_role check: ERROR -', profilesError.message);
      }
    } else {
      console.log('user_profiles.celeb_role: EXISTS');
    }
    
    // Check if the RPC function exists
    const { data: rpcData, error: rpcError } = await supabase.rpc('get_celeb_applications', {
      p_status: 'all',
      p_limit: 1,
      p_offset: 0
    });
    if (rpcError) {
      console.log('get_celeb_applications RPC: ERROR -', rpcError.message);
    } else {
      console.log('get_celeb_applications RPC: EXISTS');
    }
    
    process.exit(0);
  } catch (err) {
    console.error('Fatal error:', err.message);
    process.exit(1);
  }
})();
