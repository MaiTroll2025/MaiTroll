const fs = require('fs');
const f = 'src/pages/admin/CoinPackPurchasesLedger.tsx';
const L = fs.readFileSync(f, 'utf8').split('\n');

// Accurate tag counting using single-pass line scanner
function countTags(limit) {
  let divO = 0, divC = 0, sectionO = 0, sectionC = 0;
  const reDO = /<div[\s>]/gi, reDC = /<\/div>/gi;
  const _reSO = /<section[\s>]/gi, reSC = /<\/section>/g;

  for (let i = 0; i < limit; i++) {
    const s = L[i];
    reDO.lastIndex = 0; reDC.lastIndex = 0;
    const m = s.matchAll(reDO);
    for (const x of m) { if (!s.slice(Math.max(0, x.index-5), x.index+6).includes('/')) divO++; }
    // simple scan: all <div case
    reDC.lastIndex = 0;
    reSC.lastIndex = 0;

    // Actually use simpler approach:
    const m1 = (s.match(/<div[\s>]/gi) || []).length;
    const m2 = (s.match(/<\/div>/gi) || []).length;
    const m3 = (s.match(/<section[\s>]/gi) || []).length;
    const m4 = (s.match(/<\/section>/gi) || []).length;
    divO += m1; divC += m2;
    sectionO += m3; sectionC += m4;
  }
  return { divOpen: divO, divClose: divC, divNet: divO - divC,
           secOpen: sectionO, secClose: sectionC, secNet: sectionO - sectionC };
}

// Section: print balance curves for keep points
console.log('Searching for balanced window (divBal==0 && secBal==0)...');
for(let cut = 955; cut <= 965; cut++) {
  const stats = countTags(cut);
  if(stats.divNet === 0 && stats.secNet === 0) {
    console.log('*** BALANCED at line', cut+1, '(keep lines 0..', cut, ')');
  }
}
console.log('Line 957:', countTags(957));
console.log('Line 958:', countTags(958));
console.log('Line 959:', countTags(959));
console.log('Line 960:', countTags(960));
console.log('Line 961:', countTags(961));