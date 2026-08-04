const sql = 'CREATE TABLE IF NOT EXISTS "public"."family_members" (';
const pat2 = /CREATE\s+(?:OR\s+REPLACE\s+)?(?:TABLE|VIEW)\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:"?[^"\s]+"\.)?(["']?)([a-z][a-z0-9_-]*)\1\s*\(/i;
const m = sql.match(pat2);
console.log('pat2 match:', m ? m[2] : 'none');

function extractTableName(createStmt) {
  const pat1 = /CREATE\s+(?:OR\s+REPLACE\s+)?(?:TABLE|VIEW)\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:"?[^"\s]+"?\.)?(?:")([^"]+)"\s*\(/i;
  const m1 = createStmt.match(pat1);
  if (m1) return m1[1].toLowerCase();
  const m2 = createStmt.match(/CREATE\s+(?:OR\s+REPLACE\s+)?(?:TABLE|VIEW)\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:"?[^"\s]+"\.)?(["']?)([a-z][a-z0-9_-]*)\1\s*\(/i);
  if (m2) return m2[2].toLowerCase();
  const m3 = createStmt.match(/CREATE\s+(?:OR\s+REPLACE\s+)?(?:TABLE|VIEW)\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:"?[^"\s]+"\.)?(["']?)([a-z][a-z0-9_-]*)\1\s+AS\s+/i);
  if (m3) return m3[2].toLowerCase();
  return null;
}

console.log('extractTableName:', extractTableName(sql));

const patterns = [
  'CREATE TABLE IF NOT EXISTS "public"."family_members" (',
  'CREATE TABLE IF NOT EXISTS "public"."user_profiles" (',
  'CREATE TABLE IF NOT EXISTS public.user_stats (',
  'CREATE TABLE IF NOT EXISTS public."user_stats" (',
  'CREATE TABLE "payout_requests" (',
  'CREATE TABLE IF NOT EXISTS "public"."ad-assets" (',
  'CREATE TABLE IF NOT EXISTS "public"."family-banners" (',
  'CREATE VIEW active_safety_alerts_view AS',
];

for (const p of patterns) {
  console.log(extractTableName(p), '  <--', p.substring(0, 80));
}