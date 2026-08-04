const fs = require('fs');

// Test extractTableName on various real-world SQL patterns
function extractTableName(createStmt) {
  const pat1 = /CREATE\s+(?:OR\s+REPLACE\s+)?(?:TABLE|VIEW)\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:"?[^"\s]+"?\.)?(?:")([^"]+)"\s*\(/i;
  const m1 = createStmt.match(pat1);
  if (m1) return m1[1].toLowerCase();
  const pat2 = /CREATE\s+(?:OR\s+REPLACE\s+)?(?:TABLE|VIEW)\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:"?[^"\s]+"\.)?(["']?)([a-z][a-z0-9_-]*)\1\s*\(/i;
  const m2 = createStmt.match(pat2);
  if (m2) return m2[2].toLowerCase();
  const pat3 = /CREATE\s+(?:OR\s+REPLACE\s+)?(?:TABLE|VIEW)\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:"?[^"\s]+"\.)?(["']?)([a-z][a-z0-9_-]*)\1\s+AS\s+/i;
  const m3 = createStmt.match(pat3);
  if (m3) return m3[2].toLowerCase();
  return null;
}

const tests = [
  'CREATE TABLE IF NOT EXISTS "public"."family_members" (',
  'CREATE TABLE IF NOT EXISTS "public"."user_profiles" (',
  'CREATE TABLE IF NOT EXISTS public.user_stats (',
  'CREATE TABLE IF NOT EXISTS public."user_stats" (',
  'CREATE TABLE "payout_requests" (',
  'CREATE TABLE IF NOT EXISTS "public"."ad-assets" (',
  'CREATE TABLE IF NOT EXISTS "public"."family-banners" (',
  'CREATE VIEW active_safety_alerts_view AS',
  'CREATE TABLE IF NOT EXISTS academy_categories (',
  'CREATE TABLE IF NOT EXISTS "academy_categories" (',
  'CREATE TABLE IF NOT EXISTS "public"."academy_categories" (',
  'CREATE TABLE payouts (',
  'CREATE TABLE IF NOT EXISTS payouts (',
];

for (const t of tests) {
  const result = extractTableName(t);
  console.log((result || 'NULL').padEnd(25), '  <--', t.substring(0, 80));
}

// Count how many patterns from each type exist in the baseline
const content = fs.readFileSync('supabase/migrations/20230101000000_baseline.sql', 'utf8');
const patterns = {
  'quoted_public_dot_quoted_table': /CREATE\s+(?:OR\s+REPLACE\s+)?(?:TABLE|VIEW)\s+(?:IF\s+NOT\s+EXISTS\s+)?"public"\."([a-z][a-z0-9_-]*)"/gi,
  'unquoted_public_dot_quoted_table': /CREATE\s+(?:OR\s+REPLACE\s+)?(?:TABLE|VIEW)\s+(?:IF\s+NOT\s+EXISTS\s+)?public\."([a-z][a-z0-9_-]*)"/gi,
  'quoted_public_dot_unquoted_table': /CREATE\s+(?:OR\s+REPLACE\s+)?(?:TABLE|VIEW)\s+(?:IF\s+NOT\s+EXISTS\s+)?"public"\.([a-z][a-z0-9_-]*)/gi,
  'unquoted_public_dot_unquoted_table': /CREATE\s+(?:OR\s+REPLACE\s+)?(?:TABLE|VIEW)\s+(?:IF\s+NOT\s+EXISTS\s+)?public\.([a-z][a-z0-9_-]*)/gi,
  'no_schema_quoted_table': /CREATE\s+(?:OR\s+REPLACE\s+)?(?:TABLE|VIEW)\s+(?:IF\s+NOT\s+EXISTS\s+)?"([a-z][a-z0-9_-]*)"/gi,
  'no_schema_unquoted_table': /CREATE\s+(?:OR\s+REPLACE\s+)?(?:TABLE|VIEW)\s+(?:IF\s+NOT\s+EXISTS\s+)?([a-z][a-z0-9_-]*)\s*\(/gi,
};

for (const [name, re] of Object.entries(patterns)) {
  const all = content.match(re) || [];
  console.log(`\n${name}: ${all.length} matches`);
  const unique = new Set(all.map(m => {
    const r = re.exec(m);
    return r ? (r[1] || r[2] || '?') : '?';
  }));
  console.log('  Examples:', [...unique].slice(0, 5).join(', '));
}