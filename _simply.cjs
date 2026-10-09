const fs = require('fs');
const f = 'src/pages/admin/CoinPackPurchasesLedger.tsx';
const _L = fs.readFileSync(f, 'utf8').split('\n');

// ── Strategy: one-shot replace exactly the corrupt area ──
// Corrupt lines are 1049–1071 (1-based). After that the remaining JSX is correct borrow from backup.
// Actually: the closing tags ARE clean — just the middle content is corrupt.
// 
// Based on the backup file structural analysis:
//   - Line 860 opens <section className="space-y-3">  (table section)
//   - Line 961 closes it  ✓
//   - Line 961 then Expects a sibling JSX section if more content is there
//   - After our code ends at line 960, we just need the return closing
//
// The current broken file (1079 lines) shows:
//   961 = </section> of table
//   960 = END OF USEFUL JSX before notes/file-upload/schema
//
// The cleanest approach: start over from backup with only the 5-way fix applied

const backup = 'src/pages/admin/CoinPackPurchasesLedger.tsx.bak';
const B = fs.readFileSync(backup, 'utf8').split('\n');

// In backup (1132 lines):
//   760 = end of handleAttachmentUpload
//   770 = function start (notes, files, useEffects declare)
//   794 = useEffects for loading
//   980 = schema root
// We will apply the backup structure but replace the provider collocation block and prune unused crates

// Actually: the issue was always about the corrupted block from line 1049 (1-based) in the ORIGINAL file.
// The backup preserves the original state exactly (with corruption from line 1049 onward).
// 
// What are the actual ORIGINAL clean lines before corruption?
// Looking at backup lines [950..1048]:
const GOOD = [
  ...B.slice(0, 1048),    // lines 1-1048 (original clean)
];

// Now what should appear after 1048?
// We need to provide:
//   a) clean JSX sibling sections 
//   b) proper closing of those sections (no double-close)
//   c) return `  )` or `}` to close the component
const AFTER = [
  '        {/* ════ SCHEMA DISCOVERY & DATA SOURCES ════ */}',
  '        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">',
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
  '',
  // ─ Close remaining JSX —
  // But there IS no remaining JSX! The entire return block is already
  // inside the sections we just wrote. We need to forget the rest because 
  // the corruption was the tail of the return.
  // Close the component function body.
  // Notes/Files panels etc. are all inside the JSX `return(...)` — by removing
  // the rest of the return context and re-inserting a clean closing,
  // we need to also close the notes/file-upload conditional sections that we removed.
  // With line 1047 closing the file-upload conditional, we skip to section open.

  '        </section>',
  '      </div>',
  '    </div>',
  '      </div>',
  '  }',
  '',
  '// ════════════════════════════════════════════════════════════════════════════',
  '// FILE LIST VIEW (for per-purchase attachments displayed in the table)',
  '// ════════════════════════════════════════════════════════════════════════════',
];

// Test the count
console.log('Good section lines:', GOOD.length);
console.log('After section lines:', AFTER.length);
console.log('Total after merge:', GOOD.length + AFTER.length);

// Show exactly what line 1049 and 1050 should be
GOOD.slice(1070, 1087).forEach((s,i) => console.log((i+1071).toString().padStart(5)+'|'+JSON.stringify(s.trim()).slice(0,100)));
