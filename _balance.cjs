"use strict";
const fs = require('fs');
const file = 'src/pages/admin/CoinPackPurchasesLedger.tsx';
const L = fs.readFileSync(file, 'utf8').split('\n');

let _running = 0;
const ents = [];
for (let i = 0; i < L.length; i++) {
  const s = L[i];
  let _m, pos = 0;
  while (pos < s.length) {
    const a = s.indexOf('<', pos);
    const c = s.indexOf('</', pos);
    let k, isClose = false;
    if (c >= 0 && (a < 0 || c < a)) { k = c + 2; isClose = true; }
    else if (a >= 0) { k = a + 1; isClose = false; }
    else break;
    let tag = '';
    while (k < s.length && /[A-Za-z0-9:-]/.test(s[k])) { tag += s[k]; k++; }
    if (tag && tag !== '' && tag.length > 1) { // [A-Z] check for tag names (at least 2 char)
      // Only track if starts with uppercase letter (real JSX tag, not some text)
      if (/^[A-Z]/.test(tag)) {
        ents.push({ ln: i+1, tag, isClose, dir: isClose ? -1 : +1 });
      }
    }
    pos = k;
  }
}

// Find the longest balanced-prefix
let maxBal = -1;
let stack = [];
for (let i = 0; i < ents.length; i++) {
  if (!stack.length) maxBal = i;
  const e = ents[i];
  if (e.isClose) {
    if (!stack.length || stack[stack.length-1].tag !== e.tag) {
      // Mismatch or extra-close
      if (!stack.length) {
        console.log('EXTRA CLOSE at line ' + e.ln + ': </' + e.tag + '> with empty stack (maxBal so far:', maxBal, ')');
        break;
      }
    } else {
      stack.pop();
    }
  } else {
    stack.push(e);
  }
}

console.log('Total tracked JSX tags:', ents.length);
console.log('Max balanced prefix ends at:', maxBal, '→ line', ents[maxBal] ? ents[maxBal].ln : 'end');
console.log('Excess opens at end:', stack.map(x => x.ln + ':' + x.tag));

// Show first 60 tracked JSX open tags
console.log('\nFirst 40 tracked JSX tags:');
ents.slice(0, 40).forEach(e => {
  const sp = L[e.ln-1] ? L[e.ln-1].match(/^ */)[0].length : '?';
  console.log((e.ln).toString().padStart(4) + '|sp=' + sp + '|' + (e.isClose ? '<--' : '-->') + '|' + (e.isClose ? '</' : '<') + e.tag + '>');
});
