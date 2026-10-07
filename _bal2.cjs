const fs = require('fs');
const f = 'src/pages/admin/CoinPackPurchasesLedger.tsx';
const L = fs.readFileSync(f, 'utf8').split('\n');

const divOpen = /<div[\s>]/gi;
const divClose = /<\/div>/gi;
const sectionOpen = /<section[\s>]/gi;
const sectionClose = /<\/section>/gi;

let openDiv = 0, openSec = 0;
const events = [];

L.forEach((s, i) => {
  if (s.match(divOpen)) { openDiv++; events.push({ l: i+1, tag: 'div', open: true }); }
  if (s.match(divClose)) { openDiv--; events.push({ l: i+1, tag: 'div', open: false }); }
  if (s.match(sectionOpen)) { openSec++; events.push({ l: i+1, tag: 'section', open: true }); }
  if (s.match(sectionClose)) { openSec--; events.push({ l: i+1, tag: 'section', open: false }); }
});

console.log('End state: openDiv=', openDiv, 'openSec=', openSec);
console.log('\nDiv/section events in range 855-1092:');
events
  .filter(e => e.l >= 855 && e.l <= 1092)
  .forEach(e => {
    const indent = (L[e.l-1]||'').match(/^ */)[0].length;
    console.log(e.l.toString().padStart(4) + '|sp=' + indent.toString().padStart(2) + '|' + (e.open ? 'OPEN+' : 'CLOSE-') + '|' + (e.open ? '  ' : ' ') + '<' + e.tag + (e.open ? '' : '/') + '>');
  });
