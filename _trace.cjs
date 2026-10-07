"use strict";
const fs = require('fs');
const file = 'src/pages/admin/CoinPackPurchasesLedger.tsx';
const L = fs.readFileSync(file, 'utf8').split('\n');

const events = [];
let open = [];

for (let i = 0; i < L.length; i++) {
  const line = i + 1;
  const s = L[i];
  const match = s.match(/<\/?([A-Za-z][A-Za-z0-9:]*) | <(input|img|br|hr|area|base|col|embed|link|meta|param|source|track|wbr)[\s>]/g);
  
  // match any JSX tag
  const re = /[<]([A-Za-z][A-Za-z0-9:-]*)/g;   // open
  const re2 = /<\/([A-Za-z][A-Za-z0-9:-]*)>/g; // close
  const re3 = /<([A-Za-z][A-Za-z0-9:-]*)[^>]*\//g; // self-close: <.../>
  const re4 = /<([A-Za-z][A-Za-z0-9:-]*)>/g;      // open or close
  
  let m;
  while ((m = re4.exec(s)) !== null) {
    const tag = m[1];
    events.push({ line, tag, indent: Math.floor(m.index / 2) }); 
  }
}

// Hard-code the critical scanning: scan only from lines 777 to end
console.log('=== JSX TAGS 1040 to 1076 ===');
let depth = 0;
let stack = [];
for (let idx = 1039; idx < 1076; idx++) {
  const Lidx = idx + 1;
  const s = L[idx];
  if (!s.trim() || s.trim().startsWith('//') || s.trim().startsWith('/*') || s.trim().startsWith('*') || s.trim() === '}' || s.trim() === '}' || s.trim() === '=>' || s.includes('{') || s.includes('}') || s.includes('showFileUpload') || s.includes('showNotePanel')) continue;
  
  // find all <tag or </tag
  const reOpen = /<([A-Za-z][A-Za-z0-9:]*)>/g;
  const reClose = /<\/([A-Za-z][A-Za-z0-9:]*)>/g;
  
  // walk string char by char to find <tag and </tag without regex overlap
  const entries = [];
  let pos = 0;
  while (pos < s.length) {
    const nextOpen = s.indexOf('<', pos);
    const nextClose = s.indexOf('</', pos);
    if (nextOpen < 0 && nextClose < 0) break;
    
    let k, isClose = false;
    if (nextClose >= 0 && (nextOpen < 0 || nextClose < nextOpen)) {
      k = nextClose + 2;
      isClose = true;
    } else {
      k = nextOpen + 1;
      isClose = false;
    }
    
    // extract tag name
    let tagName = '';
    while (k < s.length && /[A-Za-z0-9:-]/.test(s[k])) {
      tagName += s[k];
      k++;
    }
    if (tagName) {
      entries.push({ tag: tagName, isClose, pos: isClose ? nextClose : nextOpen });
    }
    pos = k;
  }
  
  for (const e of entries) {
    const spaces = s.match(/^ */)[0].length;
    if (e.isClose) { /* ignore */ }
    else if (depth > 0) {
      console.log('  open  <' + e.tag + '> at line ' + Lidx + ' indent ' + spaces);
    }
  }
}

console.log('\n=== CLOSE DIVS/SECTIONS in 1048-1076 ===');
for (let idx = 1047; idx < 1076; idx++) {
  const Lidx = idx + 1;
  const s = L[idx];
  const re = /<\/([A-Za-z][A-Za-z0-9:]*)>/g;
  let m;
  while ((m = re.exec(s)) !== null) {
    console.log((Lidx).toString().padStart(4)+' | CLOSE </'+m[1]+'> at indent '+(s.match(/^ */)[0].length));
  }
}
console.log('\n=== OPEN DIVS in 870-1047 ===');
for (let idx = 869; idx < 1047; idx++) {
  const Lidx = idx + 1;
  const s = L[idx];
  const re = /<([div|section])[ >]/gi; // just <div  or <section
  let m = null;
  re.lastIndex = 0;
  while ((m = re.exec(s)) !== null && m[1]) {
    const indent = s.match(/^ */)[0].length;
    console.log((Lidx).toString().padStart(4)+' | OPEN <'+m[1]+'> at indent '+indent);
  }
}
