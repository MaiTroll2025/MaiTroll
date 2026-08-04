const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envContent = fs.readFileSync('C:/Users/kainm/TC ONLY/TrollCity/.env', 'utf8');
const getEnv = (key) => {
  const match = envContent.match(new RegExp(key + '=(.+)'));
  return match ? match[1].trim() : null;
};

const supabaseUrl = getEnv('SUPABASE_URL');
const serviceRoleKey = getEnv('SUPABASE_SERVICE_ROLE_KEY');

const supabase = createClient(supabaseUrl, serviceRoleKey);

(async () => {
  try {
    // Try querying supabase_migrations schema
    const { data, error } = await supabase
      .schema('supabase_migrations')
      .from('schema_migrations')
      .select('version, name')
      .order('version', { ascending: true });
    
    if (error) {
      console.log('Error with schema query:', error.message);
    } else {
      console.log('Total remote versions:', data.length);
      const celebEntry = data.find(r => r.version === '20260815000001');
      console.log('Celeb migration in remote schema_migrations:', celebEntry ? 'YES (name: ' + celebEntry.name + ')' : 'NO');
      console.log('Last 5 versions:', data.slice(-5));
      
      // Check if there are versions NOT in the local files
      const localFiles = fs.readdirSync('C:/Users/kainm/TC ONLY/TrollCity/supabase/migrations')
        .filter(f => f.endsWith('.sql') && f.includes('_'))
        .map(f => f.split('_')[0]);
      
      const localVersions = new Set(localFiles);
      const remoteOnly = data.filter(r => !localVersions.has(r.version));
      console.log('Remote versions without local files:', remoteOnly.length);
      if (remoteOnly.length > 0) {
        console.log('First 10 remote-only versions:', remoteOnly.slice(0, 10).map(r => r.version));
      }
    }
    
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
})();
