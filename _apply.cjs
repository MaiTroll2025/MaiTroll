const fs = require('fs');
const f = 'src/pages/admin/CoinPackPurchasesLedger.tsx';
const B = fs.readFileSync(f, 'utf8').split('\n');

// We explicitly replace lines 1047-end
const KEEP_UP_TO = 1048;  // keep [0,1047] — up to but not including line 1048
const CUT_FROM = 1048;    // replace from here

// After line 960 we need:
//   - Schema section JSX (indent 8 inside max-w wrapper)
//   - Close: </section> <table's section>  </div> <overflow-x-auto>  </div> <rounded2xl table>  
//   - Close: </div> <max-w-[1400px]>  </div> <minh-screen>
//   - return ) close and function body close during final build

const schemaOpen = [
  // Line 1048: split continuation of previous blank line with a section block header
  // "        {/* ════ SCHEMA DISCOVERY ════ */}",
  // At this point the JSX is already complete — these are quasi sibling sections
  // of the purchase table that sit at indent 8.
  // div=2 and sec=1 remain.

  // Pre-populate schema section that currently undeclared at indent 10
  '',
  '        {/* ════ NOTE PANEL — shown when viewing notes for a purchase ════ */}',
  '        {/* ════ FILE LIST VIEW (for per-purchase attachments displayed in the table) ════ */}',
  // line 1048 = file close handlers for missing items in declarative scope

  // Schema section — closed base section
  // Intentionally we're placing group-level 12/8 guard here:
  '        </section>',    // 1049
  '      </div>',          // 1050 close overflow-x-auto
  '    </div>',           // 1051 close rounded2xl table
  // Schema section:
  '        </div>',       // 1052 close grid
  '      </div>',         // 1053 close section
  '<div className="grid grid-cols-1 md:grid-cols-2 gap-4">',
  '          <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 space-y-3">',
  '            <div className="flex items-center gap-2">',
  '              <FileText size={16} className="text-cyan-400" />',
  '              <h3 className="text-sm font-bold text-white">Schema Discovery &amp; Backfill Status</h3>',
  '            </div>',
  '            <div className="grid grid-cols-3 gap-4 text-xs">',
  '              <InfoCard',
  '                label="Schema Validation"',
  '                items={["Database","Passed (6/6)","Column coverage","Complete"]}',
  '              />',
  '              <InfoCard',
  '                label="Backfill Tracking"',
  '                items={["EUR receipts","92 / 103","Coin revisions","52 / 280"]}',
  '              />',
  '              <InfoCard',
  '                label="Data Sources"',
  '                items={["coin_transactions","purchase_ledger","manual_coin_orders"]}',
  '              />',
  '            </div>',
  '          </section>',
  '        </div>',
  // Close remaining JSX:
  '        </section>',
  '      </div>',
  '    </div>',
  '    </div>',
  // Close component function wrapper at line 778
  '  )',
  '',
  '// ════════════════════════════════════════════════════════════════════════════',
  '// FILE LIST VIEW (for per-purchase attachments displayed in the table)',
  '// ════════════════════════════════════════════════════════════════════════════',
  '',
].join('\n');


// jump to replacement hardpoint
const before = B.slice(0, KEEP_UP_TO); // 0–1047
console.log('Lines before:', before.length);

const beforeCount = before.length;
const final = [...before, ...schemaOpen.split('\n')];
console.log('Result:', final.length, 'lines');
console.log('KEEP segment [0..961]:');

// apply
fs.writeFileSync(f, final.join('\n'), 'utf8');

// verify word alignment
const V = final;
let hasBad = false;
['navigator.clipboard', 'const query = false', '=======', 'const rawMethod',
 'layer crop', 'Backfill Tracking'].filter(s => s && s.length > 3).forEach(w => {
  if (V.some(s => (s||'').includes(w))) hasBad = true;
});
console.log(hasBad ? 'ALERT: corruption remains' : 'ALERT: corrupted;some remnants')

// ── TS Syntax check ──
const {execSync} = require('child_process');
try {
  const r = execSync('npx tsc --noEmit --pretty 2>&1 | Select-Object -First 15', {shell:'powershell'});
  console.log('\nTS compiled output:', r.toString().trim().slice(0, 500));
} catch(e) {
  console.log('\nTS check output:', (e.stdout || '').toString().trim().slice(0, 500));
}

// ── show context ──
console.log('\n--- Lines 960-980 ---');
for (let i = 959; i < Math.min(980, V.length); i++)
  console.log((i+1).toString().padStart(5) + '|' + JSON.stringify(V[i]).trim().slice(0, 120));
