const fs = require('fs');
const f = 'src/pages/admin/CoinPackPurchasesLedger.tsx';
const orig = fs.readFileSync('src/pages/admin/CoinPackPurchasesLedger.tsx.bak', 'utf8');
fs.writeFileSync(f, orig);
console.log('Wrote from backup to working file, bytes:', orig.length);

// After copying, correctly analyze the copy (not backup which was saved from a corrupted file)
const L = orig.split('\n');
console.log('Lines:', L.length);

// Show the section/tags structure we care about
function getDivs() {
  const opens=[], closes=[];
  for (let i = 0; i < L.length; i++) {
    let s = L[i];
    let p = 0;
    while ((p = s.indexOf('<div', p)) !== -1) {
      if (/[\s>/]/.test(s[p+4]||'')) opens.push(i+1);
      p += 4;
    }
    p = 0;
    while ((p = s.indexOf('</div>', p)) !== -1) { closes.push(i+1); p += 6; }
  }
  let running = opens.length - closes.length;
  console.log('\n<div> opens:', opens.length, 'closes:', closes.length, 'diff:', running);
}
getDivs();

// Also: find the EXACT list of `<div` line numbers
function showDivSections(_title) {
  const map = [];
  for (let i = 0; i < L.length; i++) {
    let s = L[i]; let p = 0;
    let _nOpen = 0;
    while ((p = s.indexOf('<div', p)) !== -1) {
      if (/[\s>/]/.test(s[p+4]||'')) { _nOpen++; map.push({line: i+1, indent: s.length - s.trimStart().length, raw:s.trimStart().slice(0,60), desc:'OPEN'}); }
      p += 4;
    }
    p = 0;
    let _nClose = 0;
    while ((p = s.indexOf('</div>', p)) !== -1) { _nClose++; map.push({line:i+1, indent:s.length-s.trimStart().length, raw:s.trimStart().slice(0,60), desc:'CLOSE'}); p+=6; }
  }
  console.log('\n| Line | Ind | Desc | Context');
  console.log('|------|-----|------|-------');
  for (const e of map) {
    console.log('| ' + e.line + ' | ' + e.indent + ' | ' + e.desc + ' | ' + JSON.stringify(e.raw).slice(0,50));
  }
}
showDivSections('BEFORE REPLACE');
