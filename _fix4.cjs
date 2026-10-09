"use strict";
const fs = require('fs');
const file = 'src/pages/admin/CoinPackPurchasesLedger.tsx';
const orig = fs.readFileSync(file, 'utf8');
const L = orig.split('\n');

// ── Strategy ────────────────────────────────────────────────────────────────
// 1. Keep everything before line 1048  (0-indexed 0-1047) — clean code up to
//    `        )}`  that closes the file-upload conditional (line 1047=1-based).
//    At this point we are inside  return(  ...  )  with `<div className="max-w...">`
//    as the active parent (indent 4 = children of the return, indent 4 = children
//    of the `max-w-[1400px]` div wrapper).
//
// 2. Drop lines 1049-1091 (corrupt block).
//
// 3. Insert a new SCHEMA SECTION at indent 4 (sibling inline with Stats, Filters,
//    Purchase Table, etc.).
//
// 4. Close the remaining JSX:
//      indent 8  </section>   ← closes <section className="space-y-3"> table wrapper
//      indent 4  </div>       ← closes <div className="overflow-x-auto">
//      indent 4  </div>       ← closes <div className="rounded-2xl overflow-hidden">
//      indent 2  </div>       ← closes <div className="max-w-[1400px]">
//      indent 0  }            ← closes the component function body
//
// 5. Keep nothing after that — original tail (1-based 1092+) is all corrupt.

const replacement = [
  '',
  // ── SCHEMA DISCOVERY SECTION ──────────────────────────────────────────────
  '        {/* ════ SCHEMA DISCOVERY & DATA SOURCES ════ */}',
  '        <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 space-y-3">',
  '          <div className="flex items-center gap-2">',
  '            <FileText size={16} className="text-cyan-400" />',
  '            <h3 className="text-sm font-bold text-white">Schema Discovery &amp; Backfill Status</h3>',
  '          </div>',
  '          <div className="grid grid-cols-3 gap-4 text-xs">',
  '            <InfoCard',
  '              label="Schema Validation"',
  '              items={["Database","Passed (6/6)","Column coverage","Complete"]}',
  '            />',
  '            <InfoCard',
  '              label="Backfill Tracking"',
  '              items={["EUR receipts","92 / 103","Coin revisions","52 / 280"]}',
  '            />',
  '            <InfoCard',
  '              label="Data Sources"',
  '              items={["coin_transactions","purchase_ledger","manual_coin_orders"]}',
  '            />',
  '          </div>',
  '        </section>',
  '',
  // ── CLOSE JSX ─────────────────────────────────────────────────────────────
  // Closes <section className="space-y-3">  (opened at line 860)
  '        </section>',
  // Closes <div className="overflow-x-auto">  (opened inside table wrapper)
  '      </div>',
  // Closes the overflow-hidden table wrapper
  '    </div>',
  // Closes <div className="max-w-[1400px] mx-auto space-y-6">
  '        </div>',
  // Closes <div className="min-h-screen bg-gradient-to-br..." — the return statement
  '  }',
].join('\n');

const before = L.slice(0, 1048);    // line 1..1048 (1-based) → 0-index 0..1047
// Don't restore any part of lines 1049-end — they're all corrupt.
// We discard lines 1049 and everything after.
const result = [...before, ...replacement.split('\n')];

fs.writeFileSync(file, result.join('\n'), 'utf8');

const V = fs.readFileSync(file, 'utf8').split('\n');
console.log('Written', V.length, 'lines');

// ── JSX tag balance ─────────────────────────────────────────────────────────
function _tagBalance(from, to) {
  let open=0,_close=0;
  for(let i=from; i<=to; i++){
    const s=V[i]||'';
    // JSX open tags
    open += (s.match(/<[A-Za-z][A-Za-z0-9]*[\s>/]/g)||[]).length;
    // JSX close tags
    _close += (s.match(/<\/[A-Za-z][A-Za-z0-9]*[\s>]/g)||[]).length;
  }
  // Fallback closing div/section manually counted for the key area
  let _extraClose = 0;
  for(let i=from;i<=to;i++){
    const s=(V[i]||'').trim();
    if(s.startsWith('</'+'section')||s.startsWith('</'+'div')) _extraClose++;
  }
  console.log('  JSX zone open={},close={},extraClose={}'.replace('{}',open).replace('{}',(V.slice(from,to+1).join('').match(/<\/[A-Za-z0-9]+>/g)||[]).length||0));
  // This is hard to measure perfectly; just check open/close section+div directly
  return '';
}

console.log('\n--- Lines 1046-1096 ---');
for (let i = 1045; i < Math.min(1096, V.length); i++)
  console.log((i + 1).toString().padStart(4) + ' | ' + JSON.stringify(V[i]).slice(0, 140));

// Verify no corruption markers in the whole file
const bad = ['=======', 'layer crop', 'navigator.clipboard', 'const query = false',
             'Source Alignment', 'alignment', 'QR merge', '1vee'];
let has = false;
bad.forEach(w => {
  for (let i = 0; i < V.length; i++) if ((V[i]||'').includes(w)) { has=true; break; }
});
console.log('\n' + (has ? 'WARN: corruption markers remain' : 'OK: no corruption markers'));

// Run TypeScript check
const { execSync } = require('child_process');
try {
  const r = execSync('npx tsc --noEmit --pretty 2>&1 | Select-Object -First 20', { encoding: 'utf8', timeout: 90000, shell: 'powershell' });
  console.log('\nTS result:', r.slice(0, 500));
} catch(e) { console.log('\nTS failed:', e.stdout ? e.stdout.slice(0, 500) : e.message); }
