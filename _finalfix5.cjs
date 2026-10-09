const fs = require('fs');
const f = 'src/pages/admin/CoinPackPurchasesLedger.tsx';
const L = fs.readFileSync(f, 'utf8').split('\n');
console.log('Current lines:', L.length);

// Lines to replace: 1072-1131 (1-based) which are 0-indexed 1071-1130
// Everything from "Source Alignment" InfoCard to the end of file

const _keepUpTo = 1071;   // keep lines 1-1071 (0-indexed 0-1070) — up to the grid opening
const _keepFrom = 961;    // no, keep lines 1-1071 means slice(0,1071) 

// actually: we want to keep [0, 1070] (0-indexed) → slice(0, 1071)
// then delete [1071, 1130]
// then append what's left

const before = L.slice(0, 1071);  // lines 1-1071
const replacement = [
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
  '          </div>',
  '        </section>',
  '',
  '        </section>',
  '      </div>',
  '    </div>',
  '        </div>',
  '  }',
  '',
  '// ════════════════════════════════════════════════════════════════════════════',
  '// FILE LIST VIEW (for per-purchase attachments displayed in the table)',
  '// ════════════════════════════════════════════════════════════════════════════',
  '',
].join('\n');

const final = [...before, ...replacement.split('\n')];
fs.writeFileSync(f, final.join('\n'), 'utf8');

const V = fs.readFileSync(f, 'utf8').split('\n');
console.log('Final file:', V.length, 'lines');

// Show boundary
console.log('\n--- Lines 1068-1080 ---');
for (let i = 1067; i < 1080; i++)
  console.log((i+1).toString().padStart(4) + '|sp=' + (V[i].match(/^ */)[0].length).toString().padStart(2) + '|' + JSON.stringify(V[i]).trim().slice(0,130));
