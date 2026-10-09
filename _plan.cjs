const fs = require('fs');
const f = 'src/pages/admin/CoinPackPurchasesLedger.tsx';
const orig = fs.readFileSync(f, 'utf8');
const L = orig.split('\n');

/**
 * Replace lines 1049–1071 (1-based) with a clean Schema section.
 * Those lines currently contain: <div className="grid..."> + <InfoCard label="Source Alignment"...> + corruption.
 * The close </div> and </section> for the schema section are inserted, then we close the purchase table JSX.
 */
const _cleanSchema = [
  // replace lines 1049-1070 (1-based 1049..1070)
  // The opening <div className="grid..."> (at this point) is at indent 12 and should be kept+closed
  // Since 1071 is the grid opening, we only need content for 1072-1099
  '',  // 1049 blank
  '',  // 1050 blank
  '',  // 1051 blank
  '',  // 1052 blank
  '',  // 1053 blank
  '',  // 1054 blank
  '',  // 1055 blank
  '',  // 1056 blank
  '',  // 1057 blank
  '',  // 1058 blank
  '',  // 1059 blank
  '',  // 1060 blank
  '',  // 1061 blank
  '',  // 1062 blank
  '',  // 1063 blank
  '',  // 1064 blank
  '',  // 1065 blank
  '',  // 1066 blank
  '',  // 1067 blank
  '',  // 1068 blank
  '',  // 1069 blank
  '',  // 1070 blank
];

const _SchemaHeader = [
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
  // Close the purchase table section
  '        </section>',
  '      </div>',
  '    </div>',
  '        </div>',
  '  }',
  
];

console.log('Total open div in result should be 2 (correct for the two self-close divs in bodydiv) + 2 section closes = correct');

// Check what's at line 1071 currently
console.log('Line 1071:', JSON.stringify(L[1070]));
console.log('Line 1072:', JSON.stringify(L[1071]));
console.log('Line 1073:', JSON.stringify(L[1072]));
