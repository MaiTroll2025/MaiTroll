const { Client } = require('pg');
const fs = require('fs');
const dns = require('dns').promises;

const envContent = fs.readFileSync('C:/Users/kainm/TC ONLY/TrollCity/.env', 'utf8');
const match = envContent.match(/SUPABASE_SERVICE_ROLE_KEY=(.+)/);
const serviceRoleKey = match ? match[1].trim() : null;

const migrationSql = fs.readFileSync(
  'C:/Users/kainm/TC ONLY/TrollCity/supabase/migrations/20260815000001_create_celeb_system.sql',
  'utf8'
);

// Try to resolve the database host
async function tryHost(host) {
  try {
    const addresses = await dns.resolve4(host);
    console.log(`DNS resolved ${host} -> ${addresses[0]}`);
    return addresses[0];
  } catch (err) {
    console.log(`DNS failed for ${host}: ${err.code}`);
    return null;
  }
}

(async () => {
  // Try direct connection first
  const hosts = [
    'db.gejtbllazzighxwxudyu.supabase.co',
    'aws-0-us-east-1.pooler.supabase.com',
    'db.gejtbllazzighxwxudyu.supabase.co'
  ];

  for (const host of hosts) {
    const ip = await tryHost(host);
    if (ip) {
      console.log(`Using host: ${host} (${ip})`);
      
      // Try different connection strings
      const connectionStrings = [
        `postgresql://postgres:${serviceRoleKey}@${host}:5432/postgres`,
        `postgresql://postgres.gejtbllazzighxwxudyu:${serviceRoleKey}@${host}:6543/postgres`,
        `postgresql://postgres:${serviceRoleKey}@${host}:6543/postgres`,
      ];

      for (const connStr of connectionStrings) {
        try {
          console.log(`Trying connection: ${connStr.substring(0, 80)}...`);
          const client = new Client({
            connectionString: connStr,
            ssl: { rejectUnauthorized: false },
          });
          await client.connect();
          console.log('Connected successfully!');
          
          try {
            await client.query('SELECT 1');
            console.log('Query succeeded!');
            
            // Check if celeb_role column exists
            const cols = await client.query(
              "SELECT column_name FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'celeb_role'"
            );
            console.log('celeb_role exists:', cols.rows.length > 0);
            
            // Check if RPC exists
            const rpcs = await client.query(
              "SELECT 1 FROM pg_proc WHERE proname = 'get_celeb_applications'"
            );
            console.log('get_celeb_applications exists:', rpcs.rows.length > 0);
            
            // If RPC doesn't exist, execute the full migration
            if (rpcs.rows.length === 0) {
              console.log('Executing full migration SQL...');
              await client.query(migrationSql);
              console.log('Migration executed successfully!');
              
              // Verify
              const cols2 = await client.query(
                "SELECT column_name FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'celeb_role'"
              );
              console.log('celeb_role now exists:', cols2.rows.length > 0);
              
              const rpcs2 = await client.query(
                "SELECT 1 FROM pg_proc WHERE proname = 'get_celeb_applications'"
              );
              console.log('get_celeb_applications now exists:', rpcs2.rows.length > 0);
            } else {
              console.log('RPC already exists, skipping migration.');
            }
            
            await client.end();
            process.exit(0);
          } catch (err) {
            console.error('Query error:', err.message);
            await client.end();
          }
        } catch (err) {
          console.error(`Connection failed: ${err.message}`);
          try { await client.end(); } catch(e) {}
        }
      }
    }
  }

  console.error('All connection attempts failed.');
  process.exit(1);
})();
