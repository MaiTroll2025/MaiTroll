const fs = require('fs');
const bak = 'src/pages/admin/CoinPackPurchasesLedger.tsx.bak';
const f   = 'src/pages/admin/CoinPackPurchasesLedger.tsx';

// 1. Always start from backup
fs.copyFileSync(bak, f);

const L = fs.readFileSync(f, 'utf8').split('\n');
const depthMap = [];   // [{line, indent, openOrClose, rawTag}] — track JSX tags
function scanDivSecOnly() {
  let running = 0;   // total unclosed div+section count (0=balanced)
  for (let i = 0; i < L.length; i++) {
    const s = (L[i] || '').replace(/\r/g, '');
    const re = /<([A-Za-z][A-Za-z0-9:-]*)\b/gi;
    const rc = /<\/([A-Za-z][A-Za-z0-9:-]*)>/g; // closer
    let m;
    re.lastIndex = 0; rc.lastIndex = 0;
    let opens=0, closes=0;
    while ((m = re.exec(s)) !== null) {
      // skip self-closing <.../>
      if (s.slice(m.index).match(/<\s*[A-Za-z][A-Za-z0-9:-]*\s*\/>/)) continue;
      opens++;
      depthMap.push({ line:i+1, indent:L[i].match(/^ */)[0].length, change:+1, tag:m[1], raw:s });
    }
    re.lastIndex = 0;
    rc.lastIndex = 0;
    while ((m = rc.exec(s)) !== null) {
      closes++;
      depthMap.push({ line:i+1, indent:L[i].match(/^ */)[0].length, change:-1, tag:m[1], raw:s });
    }
    running += opens-closes;
    if (running < 0) {
      console.log('UNBALANCED CLOSE at line', i+1, 'raw:', JSON.stringify(s.trim()).slice(0,80));
    }
  }
  console.log('Final running balance div+section:', running);
  console.log('   open=', L.join().match(/<div[\s>]/gi)?.length);
  console.log('       =', L.join().match(/<\/div>/g)?.length);
}
scanDivSecOnly();

// Now check what happens when we keep up to a specific line
for (let kUP = 955; kUP <= 960; kUP++) {
  let divBal = 0, secBal = 0;
  for (let i = 0; i < kUP; i++) {
    const s = (L[i] || '').trim();
    divBal += (s.match(/<div[\s>]/g)||[]).length - (s.match(/<\/div>/g)||[]).length;
    secBal += (s.match(/<section[\s>]/g)||[]).length - (s.match(/<\/section>/g)||[]).length;
  }
  console.log('keepUp='+kUP + ' | divBal='+divBal+' secBal='+secBal);
}
// Keep the one where both are balanced:
// Pick kUP=960: divBal=0 secBal=0
