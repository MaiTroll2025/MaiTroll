const { Client } = require('pg');
const fs = require('fs');

const envContent = fs.readFileSync('C:/Users/kainm/TC ONLY/TrollCity/.env', 'utf8');
const match = envContent.match(/SUPABASE_SERVICE_ROLE_KEY=(.+)/);
const serviceRoleKey = match ? match[1].trim() : null;

if (!serviceRoleKey) {
  console.error('Could not find SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

const migrationSql = fs.readFileSync(
  'C:/Users/kainm/TC ONLY/TrollCity/supabase/migrations/20260815000001_create_celeb_system.sql',
  'utf8'
);

const connectionString = `postgresql://postgres:${serviceRoleKey}@db.gejtbllazzighxwxudyu.supabase.co:5432/postgres`;

(async () => {
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('Connecting to database...');
    await client.connect();
    console.log('Connected. Executing migration...');
    await client.query(migrationSql);
    console.log('Migration executed successfully!');

    const cols = await client.query(
      "SELECT column_name FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'celeb_role'"
    );
    console.log('celeb_role column exists:', cols.rows.length > 0);

    const tables = await client.query(
      "SELECT tablename FROM pg_tables WHERE tablename IN ('celeb_applications','celeb_verification_documents','celeb_profiles','celeb_external_links','celeb_products','celeb_cashout_tiers','celeb_cashout_requests','celeb_audit_logs','celeb_battle_queue')"
    );
    console.log('New tables created:', tables.rows.length);

    await client.end();
    console.log('Done!');
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    console.error(err.stack);
    try { await client.end(); } catch (e) {}
    process.exit(1);
  }
})();
