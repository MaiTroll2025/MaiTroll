const fs = require('fs');
const path = require('path');

const migrationsDir = path.join('supabase', 'migrations');

const requestedFiles = [
  '20230101000000_baseline.sql',
  '20240101_xp_system.sql',
  '20240130000001_add_banner_notifications.sql',
  '20240321000000_fix_extension_and_materialized_view.sql',
  '20240321000001_fix_rls_policies.sql',
  '20240321000002_fix_all_search_paths.sql',
  '20240410120000_add_facebook_platform.sql',
  '20240410130000_fix_signup_coins.sql',
  '20240415000001_create_support_tickets.sql',
  '20240523000000_mobile_error_logs.sql',
  '20240525000001_kick_church_member.sql',
  '20250201100000_broadcast_overhaul.sql',
  '20250201120000_fix_universe_event_schema.sql',
  '20250202100000_broadcast_overhaul.sql',
  '20250202110000_paid_features.sql',
  '20250202120000_moderation.sql',
  '20250202120001_unify_gift_rpc.sql',
  '20250202130000_battles.sql',
  '20250202140000_battle_scoring.sql',
  '20250204_soft_delete_messages.sql',
  '20250211000000_pay_bank_loan.sql',
  '20250424000000_rls_performance_optimization.sql',
  '20250424000000_remove_ssn_column.sql',
  '20250425000000_saved_streams.sql',
  '20250425000001_troll_court_evidence.sql',
  '20250425000002_fix_is_online_rls.sql',
];

function parseFile(filename) {
  const filepath = path.join(migrationsDir, filename);
  let rawContent;
  try {
    rawContent = fs.readFileSync(filepath, 'utf-8');
  } catch (_e) {
    return { error: `File not found: ${filepath}` };
  }

  const content = rawContent;
  const tablesCreated = [];
  const viewsCreated = [];
  const matViewsCreated = [];
  const functionsCreated = [];
  const proceduresCreated = [];
  const triggersCreated = [];
  const policies = [];
  const indexesCreated = [];
  const typesCreated = [];
  const enumsCreated = [];
  const storageBuckets = [];
  const extensions = [];
  const sequences = [];
  const grants = [];

  // Use a line-by-line approach with better matching
  const lines = content.split('\n');

  for (const line of lines) {
    const l = line.trim();

    // Skip comments and empty lines
    if (l.startsWith('--') || l.startsWith('/*') || l.startsWith('*') || l === '') continue;

    // CREATE TABLE
    let m = l.match(/^CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([a-zA-Z_][a-zA-Z0-9_]*)/i);
    if (m) { tablesCreated.push(m[1]); continue; }

    // CREATE VIEW
    m = l.match(/^CREATE\s+(?:OR\s+REPLACE\s+)?VIEW\s+([a-zA-Z_][a-zA-Z0-9_]*)/i);
    if (m) { viewsCreated.push(m[1]); continue; }

    // CREATE MATERIALIZED VIEW
    m = l.match(/^CREATE\s+MATERIALIZED\s+VIEW\s+(?:IF\s+NOT\s+EXISTS\s+)?([a-zA-Z_][a-zA-Z0-9_]*)/i);
    if (m) { matViewsCreated.push(m[1]); continue; }

    // CREATE FUNCTION
    m = l.match(/^CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+([a-zA-Z_][a-zA-Z0-9_]*)/i);
    if (m) { functionsCreated.push(m[1]); continue; }

    // CREATE PROCEDURE
    m = l.match(/^CREATE\s+(?:OR\s+REPLACE\s+)?PROCEDURE\s+([a-zA-Z_][a-zA-Z0-9_]*)/i);
    if (m) { proceduresCreated.push(m[1]); continue; }

    // CREATE TRIGGER
    m = l.match(/^CREATE\s+(?:OR\s+REPLACE\s+)?TRIGGER\s+([a-zA-Z_][a-zA-Z0-9_]*)/i);
    if (m) { triggersCreated.push(m[1]); continue; }

    // CREATE POLICY
    m = l.match(/^CREATE\s+POLICY\s+['"]?([a-zA-Z_][a-zA-Z0-9_]*)['"]?/i);
    if (m) { policies.push(m[1]); continue; }

    // CREATE INDEX
    m = l.match(/^CREATE\s+(?:UNIQUE\s+)?INDEX\s+(?:IF\s+NOT\s+EXISTS\s+)?([a-zA-Z_][a-zA-Z0-9_]*)/i);
    if (m) { indexesCreated.push(m[1]); continue; }

    // CREATE TYPE (not enum)
    m = l.match(/^CREATE\s+TYPE\s+([a-zA-Z_][a-zA-Z0-9_]*)\s+AS\s+(?!ENUM)/i);
    if (m) { typesCreated.push(m[1]); continue; }

    // CREATE TYPE ... AS ENUM
    m = l.match(/^CREATE\s+TYPE\s+([a-zA-Z_][a-zA-Z0-9_]*)\s+AS\s+ENUM/i);
    if (m) { enumsCreated.push(m[1]); continue; }

    // EXTENSION
    m = l.match(/^CREATE\s+EXTENSION\s+(?:IF\s+NOT\s+EXISTS\s+)?([a-zA-Z_][a-zA-Z0-9_]*)/i);
    if (m) { extensions.push(m[1]); continue; }

    // SEQUENCE
    m = l.match(/^CREATE\s+SEQUENCE\s+(?:IF\s+NOT\s+EXISTS\s+)?([a-zA-Z_][a-zA-Z0-9_]*)/i);
    if (m) { sequences.push(m[1]); continue; }

    // storage bucket - match patterns
    m = l.match(/create_bucket\s*\(\s*'([^']+)'/i) || l.match(/insert\s+into\s+storage\.buckets/i);
    if (m && m[1]) { storageBuckets.push(m[1]); continue; }

    // GRANT ON TABLE
    m = l.match(/^GRANT\s+([A-Z]+\s*(?:,\s*[A-Z]+)*)\s+ON\s+(?:TABLE\s+)?([a-zA-Z_][a-zA-Z0-9_]*)\s+/i);
    if (m) { grants.push({ privilege: m[1].trim(), object: m[2] }); continue; }
  }

  // Extract storage buckets from INSERT INTO storage.buckets
  const bucketRegex = /INSERT\s+INTO\s+storage\.buckets[\s\S]{0,300}?\(\s*'([^']+)'/gi;
  let bm;
  while ((bm = bucketRegex.exec(content)) !== null) {
    if (!storageBuckets.includes(bm[1])) storageBuckets.push(bm[1]);
  }

  return {
    filename,
    tablesCreated,
    viewsCreated,
    matViewsCreated,
    functionsCreated,
    proceduresCreated,
    triggersCreated,
    policies,
    indexesCreated,
    typesCreated,
    enumsCreated,
    storageBuckets,
    extensions,
    sequences,
    grants,
  };
}

const results = {};
for (const f of requestedFiles) {
  results[f] = parseFile(f);
}

let totalTables = 0, totalFuncs = 0;
for (const [_file, data] of Object.entries(results)) {
  if (!data.error) {
    totalTables += data.tablesCreated.length;
    totalFuncs += data.functionsCreated.length;
  }
}
console.log(`Total Tables: ${totalTables}, Total Functions: ${totalFuncs}`);

for (const [file, data] of Object.entries(results)) {
  console.log(`\n=== ${file} ===`);
  if (data.error) { console.log(`  ${data.error}`); continue; }
  if (data.tablesCreated.length) console.log(`  TABLES: ${data.tablesCreated.join(', ')}`);
  if (data.viewsCreated.length) console.log(`  VIEWS: ${data.viewsCreated.join(', ')}`);
  if (data.matViewsCreated.length) console.log(`  MATVIEWS: ${data.matViewsCreated.join(', ')}`);
  if (data.functionsCreated.length) console.log(`  FUNCTIONS: ${data.functionsCreated.join(', ')}`);
  if (data.proceduresCreated.length) console.log(`  PROCEDURES: ${data.proceduresCreated.join(', ')}`);
  if (data.triggersCreated.length) console.log(`  TRIGGERS: ${data.triggersCreated.join(', ')}`);
  if (data.policies.length) console.log(`  POLICIES: ${data.policies.join(', ')}`);
  if (data.indexesCreated.length) console.log(`  INDEXES: ${data.indexesCreated.join(', ')}`);
  if (data.typesCreated.length) console.log(`  TYPES: ${data.typesCreated.join(', ')}`);
  if (data.enumsCreated.length) console.log(`  ENUMS: ${data.enumsCreated.join(', ')}`);
  if (data.storageBuckets.length) console.log(`  STORAGE: ${data.storageBuckets.join(', ')}`);
  if (data.extensions.length) console.log(`  EXTENSIONS: ${data.extensions.join(', ')}`);
  if (data.sequences.length) console.log(`  SEQUENCES: ${data.sequences.join(', ')}`);
  if (!data.tablesCreated.length && !data.viewsCreated.length && !data.functionsCreated.length && !data.triggersCreated.length && !data.policies.length && !data.indexesCreated.length) {
    console.log(`  (no new objects - migration only modifies existing DB)`);
  }
}
