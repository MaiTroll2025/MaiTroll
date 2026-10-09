"use strict";
const fs = require('fs');
const file = 'src/pages/admin/CoinPackPurchasesLedger.tsx';
const L = fs.readFileSync(file, 'utf8').split('\n');

// Count JSX blocks that open with z banner divs/labels
// Basic approach: find JSX tag open/close pairs
function _tagAt(line) {
  return L[line-1] ? L[line-1].trim().replace(/\n/,'') : '';
}

// Count <div ` >` and </div>
let totalOpenDiv = 0, totalCloseDiv = 0;
L.forEach((s, i) => {
  const opens = (s.match(/<div[\s>/]/gi) || []).length;
  const closes = (s.match(/<\/div>/gi) || []).length;
  totalOpenDiv += opens; totalCloseDiv += closes;
  if (closes > 0) {
    console.log((i+1) + ' close </div>: ' + opens + ' opens, ' + closes + ' closes');
  }
});
console.log('\nTotal <div>:', totalOpenDiv, '</div>:', totalCloseDiv, 'gap:', totalOpenDiv - totalCloseDiv);
