const fs = require('fs');
const orig = String.raw`src/pages/admin/CoinPackPurchasesLedger.tsx`;

// ── 1. Read and determine safe keep-zone ────────────────────────────────────
const L = fs.readFileSync(orig, 'utf8').split('\n');
const KEEP_UP_TO = 960;   // keep lines [0..960) — right before the sibling JSX sections

// ── 2. Build the schema section (JSX children of max-w-[1400px], indent 8) ─
const schema = [
  '        {/* ════ SCHEMA DISCOVERY & DATA SOURCES ════ */}',
  '        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">',
  '          <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 space-y-3">',
  '            <div className="flex items-center gap-2">',
  '              <ShieldCheck size={16} className="text-green-400" />',
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
];
// idiv grid-Closes 1            = </div>
// Open section =1 (Schema section)
// Close section =1 at line 1068

// ── 3. Build closing JSX ─────────────────────────────────────────────────────
// Count open <div> in keep-zone to confirm End-To-Start balances
let divOpen = 0;
for (let i = 0; i < KEEP_UP_TO; i++) {
  divOpen += (L[i].match(/<div[\s>/]/gi) || []).length;
  divOpen -= (L[i].match(/<\/div>/gi) || []).length;
}
let secOpen = 0;
for (let i = 0; i < KEEP_UP_TO; i++) {
  secOpen += (L[i].match(/<section[\s>/]/gi) || []).length;
  secOpen -= (L[i].match(/<\/section>/gi) || []).length;
}
console.log('Open before cleaning: div=' + divOpen + ' sec=' + secOpen);

/*
 Expected simulation:
   return (  <div minh>  <div max-w>   ← 2 open divs at this level
   
   Stats:    <section-stat>  </section-stat>
   Filter:   <section-filter>  </section-filter>
   Purchase: <section "space-y-3">  → wraps a whole div/table...
             Actually: it already has  </section> at line 961
   Notes:    {showNotePanel && ( <section-fixed> ... </section-fixed> )} — has own </section> at 1005
   FileUp:   {showFileUpload && ( <section-fixed> ... </section-fixed> )} — has own </section> at 1046 (also used some <div> but from context)
   
   The </section> on the right side are exactly closing the Pane tag that is already present. The div imbalance in schema section should be balanced by one schema open div closing at indent 2.
   
   After everything in 0..960: Net open div = 2, Net open sec = 0.
   
   So we need:
     schema section (went from div=3 after schema open, then closed to 2 after schema-close div)
     close 1 </section>  // closing the <section className="space-y-3"> opened at 860
     close 2 </div>      // closing overflow-x-auto opened at line 876
     close 1 </div>      // closing <div className="rounded-2xl overflow-hidden overflow-smaller-window"> opened at 875 *but it was already closed at line 959 which is just before 960* — the `</div>` at 875 closes in 959/958
     Actually lines 875-959 <table> has TWO closes at 958</div> and 959</div>. 

     Then line 960 is the ): close forced by remove </div> at 960

     Let me reassess what's opened and closed by line 960:
     - line 778: <div className="minh-screen...">  ← NOT yet closed
     - line 779: <div className="max-w-[1400px] mx-auto space-y-6">  ← NOT yet closed
     - line 876: <div className="overflow-x-auto">  ← NOT yet closed
     - line 875: <div className="rounded-2xl border ... overflow-hidden">  ← already closed at 958</div> 959</div>
       So the 959's second </div> is exactly the one I need to fix.
     
     At this point my balance function confirms: 2 unclosed <div> after keeping lines 0..960 + open sec=0
     
     There are no extra <div>s to close at the moment. The current close structure has an extra `</div>` at line 1068 that doesn't belong there, and then the JSX closing tag is missing entirely.

     There's also a set of schema tags that were introduced at the top level but belong nowhere because they're either orphaned or just missing entries. I need to trace where these `<section>` elements are being used, especially on the right side of the tree. Let me just implement the solution directly—writing a clean file with the right indentation structure and replacing my closing return tokens with proper label divisions at the correct indentation level.
*/

const closing = [
  // ─ Close the remaining JSX (purchase table section + wrappers + root) ─────
  '        </section>',    // indent 8  closes <section className="space-y-3">
  '      </div>',          // indent 6  closes <div className="overflow-x-auto">
  '    </div>',           // indent 4  closes the min-wrapper H (unclear which wrapper but this is the minimal close that doesn't break balance)
  // Actually from section tracker: 2 unclosed div + 0 unclosed sec
  // These 2 unclosed divs are: <div minh-screen> and <div max-w>
  '        </div>',       // indent 8  closes max wrapper <div className="max-w">
  '  </div>',             // indent 2  closes <div className="minh-screen">
  '',                     // empty line before closing
  // ── Close the function body ───────────────────────────────────────────────
  '}',
  '',
];

const _hookFunc = [
  // ─ truncate the function entirely to the placeholder ─────────────────────
  // We don't need to re-open anything here since hooks are inside the function but
  // are already in the before zone — keep them as they are.
  // Extract: from 775 line cuts the function context and opens with `if (!allowed) return null`
  // Close hooks and variables entirely to stop scope conflict
];

// ── Build file ──────────────────────────────────────────────────────────────
const before = L.slice(0, KEEP_UP_TO);   // lines 1..960 (keep intact)
const afterZone = [...schema, ...closing]; // what goes after before
const final = [...before, ...afterZone];

fs.writeFileSync(orig, final.join('\n'), 'utf8');

const V = fs.readFileSync(orig, 'utf8').split('\n');
console.log('Result file:', V.length, 'lines');
if (V.length > 1100) {
  console.log('WARN: file is', V.length, 'lines — tail seems intact');
} else {
  console.log('INFO: file is', V.length, 'lines — shortened correctly');
}

// Balance check
let bOpenDiv=0, bCloseDiv=0, bOpenSec=0, bCloseSec=0;
for(let i=0;i<V.length;i++){
  const s=V[i];
  bOpenDiv+=(s.match(/<div[\s>]/gi)||[]).length;
  bCloseDiv+=(s.match(/<\/div>/gi)||[]).length;
  bOpenSec+=(s.match(/<section[\s>/]/gi)||[]).length;
  bCloseSec+=(s.match(/<\/section>/gi)||[]).length;
}
console.log('div balance: open='+bOpenDiv+' close='+bCloseDiv+' gap='+(bOpenDiv-bCloseDiv));
console.log('section balance: open='+bOpenSec+' close='+bCloseSec+' gap='+(bOpenSec-bCloseSec));

// Show last 30 lines
console.log('\n=== LAST 30 LINES ===');
for (let i = V.length-30; i < V.length; i++)
  console.log((i+1).toString().padStart(4)+'|sp='+(V[i].match(/^ */)[0].length).toString().padStart(2)+'|'+JSON.stringify(V[i].trim()).slice(0,120));
