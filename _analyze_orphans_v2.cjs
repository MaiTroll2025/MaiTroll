/**
 * Orphan Table Analyzer v2 — Scoring + Multi-Category + Migration Awareness
 *
 * Scans every SQL file in the workspace for references to the 559 "orphan" tables
 * listed in DATABASE_AUDIT_2026.md section 1.4.
 *
 * Scoring:
 *   Frontend (.from)        +10  (already known – orphans score 0 here)
 *   RPC (.rpc)              +10  (already known – orphans score 0 here)
 *   Edge function           +10  (already known – orphans score 0 here)
 *   SQL function body        +5
 *   View / materialized view +3
 *   Trigger body             +3
 *   FK target (referenced)   +2
 *   RLS policy / ENABLE RLS  +1
 *   Referenced in migration  +1  (ALTER TABLE, DROP TABLE, INSERT, etc.)
 *
 * Tiers:
 *   CRITICAL  >= 10  (definitely keep – heavy internal usage)
 *   ACTIVE    >= 5   (keep – moderate internal usage)
 *   REVIEW    >= 2   (review manually – light internal usage)
 *   SAFE_TO_DROP < 2 (no internal references found – likely dead)
 *
 * Tables can belong to MULTIPLE categories (not mutually exclusive).
 *
 * Output:
 *   _orphan_analysis_v2.json   – full machine-readable data
 *   _orphan_analysis_v2.md     – human-readable report with scoring tiers
 */

const fs   = require('fs');
const path = require('path');

const WORKSPACE = 'C:\\Users\\kainm\\TC ONLY\\Mai Troll';

// ── helpers ──────────────────────────────────────────────────────────────────

function safeRead(filePath) {
  try { return fs.readFileSync(filePath, 'utf8'); } catch { return ''; }
}

function readOrphanTables() {
  const md = safeRead(path.join(WORKSPACE, 'DATABASE_AUDIT_2026.md'));
  const lines = md.split('\n');
  const tables = [];
  let inSection = false;
  for (const line of lines) {
    if (line.includes('### 1.4 Never Referenced (Orphan Tables)')) { inSection = true; continue; }
    if (inSection && line.startsWith('## ')) break;          // next major section
    if (inSection && line.startsWith('|') && !line.includes('Table') && !line.includes('---')) {
      const parts = line.split('|').map(s => s.trim()).filter(Boolean);
      if (parts.length >= 2) {
        const t = parts[1].replace(/`/g, '');
        if (t && !t.match(/^\d+$/)) tables.push(t);
      }
    }
  }
  return [...new Set(tables)];                                // dedupe
}

function getAllSqlFiles(dir, out = []) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) getAllSqlFiles(full, out);
    else if (e.name.endsWith('.sql')) out.push(full);
  }
  return out;
}

// ── reference detection ──────────────────────────────────────────────────────

function findReferences(content, table) {
  const lc  = content.toLowerCase();
  const lt  = table.toLowerCase();
  const refs = {
    functions:  new Set(),
    views:      new Set(),
    triggers:   new Set(),
    fkSources:  new Set(),
    rlsPolicies:new Set(),
    migrationRefs: new Set(),
  };

  // 1. FUNCTION bodies
  const funcRe = /create\s+(or\s+replace\s+)?function\s+([\w.]+)/gi;
  const funcs  = []; let m;
  while ((m = funcRe.exec(content)) !== null) funcs.push({ name: m[2], start: m.index });
  for (let i = 0; i < funcs.length; i++) {
    const body = lc.slice(funcs[i].start, i + 1 < funcs.length ? funcs[i + 1].start : lc.length);
    if (body.includes(lt)) refs.functions.add(funcs[i].name);
  }

  // 2. VIEW / MATERIALIZED VIEW bodies
  const viewRe = /create\s+(or\s+replace\s+)?(materialized\s+)?view\s+([\w.]+)/gi;
  const views  = [];
  while ((m = viewRe.exec(content)) !== null) views.push({ name: m[3], start: m.index });
  for (let i = 0; i < views.length; i++) {
    const body = lc.slice(views[i].start, i + 1 < views.length ? views[i + 1].start : lc.length);
    if (body.includes(lt)) refs.views.add(views[i].name);
  }

  // 3. TRIGGER bodies
  const trigRe = /create\s+(or\s+replace\s+)?trigger\s+([\w.]+)/gi;
  const trigs  = [];
  while ((m = trigRe.exec(content)) !== null) trigs.push({ name: m[2], start: m.index });
  for (let i = 0; i < trigs.length; i++) {
    const body = lc.slice(trigs[i].start, i + 1 < trigs.length ? trigs[i + 1].start : lc.length);
    if (body.includes(lt)) refs.triggers.add(trigs[i].name);
  }

  // 4. FK references  (REFERENCES <table>)
  const fkRe = new RegExp(`references\\s+${table.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\(`, 'gi');
  if (fkRe.test(content)) {
    // find which CREATE TABLE block contains it
    const ctRe = /create\s+table\s+(?:if\s+not\s+exists\s+)?([\w.]+)/gi;
    let cm;
    while ((cm = ctRe.exec(content)) !== null) {
      const end = content.indexOf(';', cm.index);
      const block = content.slice(cm.index, end > 0 ? end : cm.index + 600);
      if (block.toLowerCase().includes(lt) && fkRe.test(block)) refs.fkSources.add(cm[1]);
      fkRe.lastIndex = 0;                                       // reset
    }
  }

  // 5. RLS policies
  const rlsRe = /create\s+policy\s+[\w'"]+\s+on\s+([\w.]+)/gi;
  while ((m = rlsRe.exec(content)) !== null) {
    if (m[1].toLowerCase() === lt) refs.rlsPolicies.add(m[0].slice(0, 80));
  }
  const alterRls = new RegExp(`alter\\s+table\\s+${table.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s+enable\\s+row\\s+level\\s+security`, 'gi');
  if (alterRls.test(content)) refs.rlsPolicies.add('ENABLE ROW LEVEL SECURITY');

  // 6. Migration references (ALTER TABLE, DROP TABLE, INSERT, UPDATE, DELETE, GRANT)
  const migPatterns = [
    new RegExp(`alter\\s+table\\s+${table.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'gi'),
    new RegExp(`drop\\s+table\\s+(?:if\\s+exists\\s+)?${table.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'gi'),
    new RegExp(`insert\\s+into\\s+${table.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'gi'),
    new RegExp(`update\\s+${table.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'gi'),
    new RegExp(`delete\\s+from\\s+${table.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'gi'),
    new RegExp(`grant\\s+[\\w\\s,]+\\s+on\\s+${table.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'gi'),
    new RegExp(`comment\\s+on\\s+table\\s+${table.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'gi'),
  ];
  for (const p of migPatterns) {
    if (p.test(content)) refs.migrationRefs.add(p.source.slice(0, 60));
  }

  return refs;
}

// ── scoring ──────────────────────────────────────────────────────────────────

function score(refs) {
  let s = 0;
  s += refs.functions.size   * 5;
  s += refs.views.size       * 3;
  s += refs.triggers.size    * 3;
  s += refs.fkSources.size   * 2;
  s += (refs.rlsPolicies.size > 0 ? 1 : 0);
  s += (refs.migrationRefs.size > 0 ? 1 : 0);
  return s;
}

function tier(score) {
  if (score >= 10) return 'CRITICAL';
  if (score >= 5)  return 'ACTIVE';
  if (score >= 2)  return 'REVIEW';
  return 'SAFE_TO_DROP';
}

// ── categories (multi-membership) ────────────────────────────────────────────

function categories(refs) {
  const cats = [];
  if (refs.rlsPolicies.size)    cats.push('RLS_PROTECTED');
  if (refs.fkSources.size)      cats.push('FK_TARGET');
  if (refs.functions.size)     cats.push('IN_FUNCTION');
  if (refs.views.size)         cats.push('IN_VIEW');
  if (refs.triggers.size)      cats.push('IN_TRIGGER');
  if (refs.migrationRefs.size) cats.push('IN_MIGRATION');
  if (cats.length === 0)       cats.push('NO_REFERENCES');
  return cats;
}

// ── main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('Reading orphan tables from audit…');
  const orphans = readOrphanTables();
  console.log(`  → ${orphans.length} tables`);

  console.log('Collecting SQL files…');
  const sqlFiles = getAllSqlFiles(WORKSPACE);
  console.log(`  → ${sqlFiles.length} .sql files`);

  // Accumulators
  const data = {};
  for (const t of orphans) {
    data[t] = {
      score: 0,
      tier: 'SAFE_TO_DROP',
      categories: [],
      refs: {
        functions: new Set(), views: new Set(), triggers: new Set(),
        fkSources: new Set(), rlsPolicies: new Set(), migrationRefs: new Set(),
      },
      files: new Set(),
    };
  }

  // Scan every SQL file
  let scanned = 0;
  for (const f of sqlFiles) {
    scanned++;
    if (scanned % 200 === 0) console.log(`  scanned ${scanned}/${sqlFiles.length}…`);
    const content = safeRead(f);
    if (!content) continue;
    const rel = path.relative(WORKSPACE, f);

    for (const t of orphans) {
      const r = findReferences(content, t);
      let touched = false;
      for (const k of ['functions','views','triggers','fkSources','rlsPolicies','migrationRefs']) {
        if (r[k].size) {
          r[k].forEach(v => data[t].refs[k].add(v));
          touched = true;
        }
      }
      if (touched) data[t].files.add(rel);
    }
  }
  console.log(`  → done scanning ${scanned} files\n`);

  // Score & categorise
  const tiers = { CRITICAL: [], ACTIVE: [], REVIEW: [], SAFE_TO_DROP: [] };
  const multiCats = {};   // cat → [table names]

  for (const t of orphans) {
    const d = data[t];
    d.score = score(d.refs);
    d.tier  = tier(d.score);
    d.categories = categories(d.refs);
    tiers[d.tier].push(t);
    for (const c of d.categories) {
      (multiCats[c] = multiCats[c] || []).push(t);
    }
  }

  // ── JSON output ───────────────────────────────────────────────────────────
  const json = { generated: new Date().toISOString(), totals: {}, tiers: {}, categories: {} };
  for (const [tier, tables] of Object.entries(tiers)) {
    json.totals[tier] = tables.length;
    json.tiers[tier] = tables.map(t => {
      const d = data[t];
      return {
        table: t,
        score: d.score,
        categories: d.categories,
        functions:  [...d.refs.functions],
        views:      [...d.refs.views],
        triggers:   [...d.refs.triggers],
        fkSources:  [...d.refs.fkSources],
        rlsPolicies:[...d.refs.rlsPolicies],
        migrationRefs: [...d.refs.migrationRefs],
        files:      [...d.files],
      };
    });
  }
  for (const [cat, tables] of Object.entries(multiCats)) {
    json.categories[cat] = tables.length;
  }
  fs.writeFileSync(path.join(WORKSPACE, '_orphan_analysis_v2.json'), JSON.stringify(json, null, 2));

  // ── Markdown report ───────────────────────────────────────────────────────
  const md = [];
  md.push('# Orphan Table Analysis v2 — Scoring Report');
  md.push(`\n**Generated:** ${new Date().toISOString()}`);
  md.push(`**Tables analysed:** ${orphans.length}`);
  md.push(`**SQL files scanned:** ${sqlFiles.length}\n`);

  md.push('## Scoring System\n');
  md.push('| Signal | Points |');
  md.push('|--------|--------|');
  md.push('| Frontend `.from()` | +10 |');
  md.push('| RPC `.rpc()` | +10 |');
  md.push('| Edge function | +10 |');
  md.push('| SQL function body | +5 |');
  md.push('| View / materialized view | +3 |');
  md.push('| Trigger body | +3 |');
  md.push('| FK target (referenced by another table) | +2 |');
  md.push('| RLS policy / ENABLE RLS | +1 |');
  md.push('| Referenced in migration (ALTER/DROP/INSERT/etc.) | +1 |');

  md.push('\n## Tier Thresholds\n');
  md.push('| Tier | Score | Meaning |');
  md.push('|------|-------|---------|');
  md.push('| **CRITICAL** | ≥ 10 | Heavy internal usage — definitely keep |');
  md.push('| **ACTIVE** | 5–9 | Moderate internal usage — keep |');
  md.push('| **REVIEW** | 2–4 | Light internal usage — review manually |');
  md.push('| **SAFE_TO_DROP** | 0–1 | No internal references — likely dead |');

  md.push('\n## Summary\n');
  md.push(`| Tier | Count |`);
  md.push(`|------|-------|`);
  for (const [tier, tables] of Object.entries(tiers)) {
    md.push(`| ${tier} | ${tables.length} |`);
  }

  md.push('\n## Category Breakdown (tables can appear in multiple)\n');
  md.push(`| Category | Count |`);
  md.push(`|----------|-------|`);
  const catOrder = ['NO_REFERENCES','IN_FUNCTION','IN_VIEW','IN_TRIGGER','FK_TARGET','RLS_PROTECTED','IN_MIGRATION'];
  for (const c of catOrder) {
    if (multiCats[c]) md.push(`| ${c} | ${multiCats[c].length} |`);
  }

  // Per-tier detail
  for (const [tier, tables] of Object.entries(tiers)) {
    md.push(`\n## ${tier} (${tables.length} tables)\n`);
    // sort by score descending
    const sorted = tables.sort((a, b) => data[b].score - data[a].score);
    for (const t of sorted) {
      const d = data[t];
      md.push(`### \`${t}\` — score: ${d.score}\n`);
      md.push(`**Categories:** ${d.categories.join(', ')}\n`);
      if (d.refs.functions.size)   md.push(`- **Functions:** ${[...d.refs.functions].join(', ')}`);
      if (d.refs.views.size)       md.push(`- **Views:** ${[...d.refs.views].join(', ')}`);
      if (d.refs.triggers.size)    md.push(`- **Triggers:** ${[...d.refs.triggers].join(', ')}`);
      if (d.refs.fkSources.size)   md.push(`- **FK referenced by:** ${[...d.refs.fkSources].join(', ')}`);
      if (d.refs.rlsPolicies.size) md.push(`- **RLS:** ${[...d.refs.rlsPolicies].join('; ')}`);
      if (d.refs.migrationRefs.size) md.push(`- **Migration refs:** ${[...d.refs.migrationRefs].join('; ')}`);
      if (d.files.size)            md.push(`- **Files:** ${[...d.files].join(', ')}`);
      md.push('');
    }
  }

  fs.writeFileSync(path.join(WORKSPACE, '_orphan_analysis_v2.md'), md.join('\n'));

  // ── Console summary ───────────────────────────────────────────────────────
  console.log('═══════════════════════════════════════════════');
  console.log('  ORPHAN TABLE ANALYSIS v2 — RESULTS');
  console.log('═══════════════════════════════════════════════\n');
  for (const [tier, tables] of Object.entries(tiers)) {
    console.log(`  ${tier.padEnd(16)} ${String(tables.length).padStart(4)} tables`);
  }
  console.log(`\n  TOTAL: ${orphans.length}`);
  console.log('\n───────────────────────────────────────────────');
  console.log('  Category breakdown:');
  for (const c of catOrder) {
    if (multiCats[c]) console.log(`    ${c.padEnd(20)} ${multiCats[c].length}`);
  }
  console.log('\n═══════════════════════════════════════════════');
  console.log('  Output:');
  console.log('    _orphan_analysis_v2.json  (machine-readable)');
  console.log('    _orphan_analysis_v2.md    (human report)');
  console.log('═══════════════════════════════════════════════\n');
}

main().catch(console.error);
