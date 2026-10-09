const fs = require('fs');
const f = 'src/pages/admin/CoinPackPurchasesLedger.tsx';
const L = fs.readFileSync(f, 'utf8').split('\n');

let openDiv = 0, openSec = 0;
const ev = [];

// Runtag at each line: any JSX div and section tags at that line
const divOpenRe = /<div[\s>/]/gi;
const divCloseRe = /<\/div>/g;
const secOpenRe = /<section[\s>/]/gi;
const secCloseRe = /<\/section>/g;

for (let i = 0; i < L.length; i++) {
  const s = L[i];

  let sm; divOpenRe.lastIndex = 0;
  while ((sm = divOpenRe.exec(s)) !== null) {
    openDiv++;
    ev.push({ line: i+1, tag: 'div', open: true, openingIt: sm[0] });
  }
  divOpenRe.lastIndex = 0;
  while ((sm = divCloseRe.exec(s)) !== null) {
    openDiv--;
    ev.push({ line: i+1, tag: 'div', open: false, openingIt: `</div>` });
  }

  secOpenRe.lastIndex = 0;
  while ((sm = secOpenRe.exec(s)) !== null) {
    openSec++;
    ev.push({ line: i+ 1, tag: 'section', open: true, openingIt: sm[0] });
  }
  secCloseRe.lastIndex = 0;
  while ((sm = secCloseRe.exec(s)) !== null) {
    openSec--;
    ev.push({ line: i+1, tag: 'section', open: false, openingIt: '</section>' });
  }
}

console.log('End state: openDiv=', openDiv, 'openSec=', openSec);

// Show where we go from balanced to unbalanced
let _maxBalDiv = 0, _maxBalSec = 0;
for (let i = 0; i < ev.length; i++) {
  const e = ev[i];
  // track running balance
  const _bal = openDiv; // we know the end value
  if (!e.open && openDiv <= 0) break;
  if (e.tag === 'div') _maxBalDiv = i;
}

function findLineOf(type, val) {
  for (let i = 0; i < L.length; i++)
    if (L[i] && L[i].includes(val)) return 'ln ' + (i+1);
  return 'not found';
}

console.log('\nLine "Source Alignment":', findLineOf('item', 'Source Alignment'));

// Show lines 1070-1084
console.log('\n--- Lines 1070-1084 ---');
for (let i = 1069; i < 1084; i++)
  console.log((i+1).toString().padStart(4) + '|sp=' + L[i].match(/^ */)[0].length + '|' + JSON.stringify(L[i]?.trim()).slice(0,110));
