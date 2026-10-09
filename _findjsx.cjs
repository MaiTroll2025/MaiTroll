const fs = require('fs');
const f = 'src/pages/admin/CoinPackPurchasesLedger.tsx';
const lines = fs.readFileSync(f, 'utf8').split('\n');
console.log('Total lines:', lines.length);

// Looking for JSX tags by scanning for <TAG 
function findJSX(_limit) {
  const results = [];
  const _re = /<(?:([A-Z][a-zA-Z]*)\b[^>]*>|(\/[A-Z][a-zA-Z]*))(?:[\s])>/g;
  // Actually just scan for <{a-zA-Z}...> and </{a-zA-Z}...>
  const reOpen = /<([A-Z][a-zA-Z]*)\b[^>]*?>/g;
  const reClose = /<\/([A-Z][a-zA-Z]*)>/g;
  
  for (let i = 0; i < lines.length; i++) {
    const s = lines[i];
    let m;
    while ((m = reOpen.exec(s)) !== null) {
      // Check if self-closing
      if (s.slice(m.index).match(/<[A-Z][a-zA-Z]*\b[^>]*?\/>/)) continue;
      if (m[1].length < 2) continue;
      results.push({line:i+1, tag:m[1], open:true});
    }
    while ((m = reClose.exec(s)) !== null) {
      if (m[1].length < 2) continue;
      results.push({line:i+1, tag:m[1], open:false});
    }
  }
  
  // Print only JSX-related lines after 960 onwards
  function tagString(a){return a.open ? '<'+a.tag+'>' : '</'+a.tag+'>';}
  console.log('\n=== JSX TAGS (after line 955) ===');
  const seen = {}; let _done=0;
  for (const a of results) {
    if(a.line < 955) continue;
    const str = a.line+'| '+tagString(a);
    if(!seen[str]) { seen[str]=true; console.log(str+' at line '+a.line); _done++; }
  }
  return results;
}
const r = findJSX(9999);
console.log('\nTotal JSX open+close after 955:', r.filter(x=>x.line>=955).length);
