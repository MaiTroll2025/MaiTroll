const fs = require('fs');
const code = fs.readFileSync('src/components/broadcast/ModActionsPopup.tsx', 'utf8');
const lines = code.split('\n');
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  const matches = line.match(/"/g);
  if (matches && matches.length % 2 !== 0) {
    console.log('Odd quotes at line ' + (i+1) + ': ' + line.substring(0, 80));
  }
}
