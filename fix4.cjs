const fs = require('fs');
const path = require('path');

const replacements = [
  { from: 'Mai Troll_', to: 'MaiTroll_' },
];

const srcDir = 'src';
const files = [];

function walkDir(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkDir(fullPath);
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name);
      if (['.ts', '.tsx', '.js', '.jsx'].includes(ext)) {
        files.push(fullPath);
      }
    }
  }
}

walkDir(srcDir);

let totalChanges = 0;
for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  let original = content;
  for (const repl of replacements) {
    content = content.split(repl.from).join(repl.to);
  }
  if (content !== original) {
    fs.writeFileSync(file, content);
    totalChanges++;
    console.log('Fixed: ' + file);
  }
}

console.log('\nTotal files modified: ' + totalChanges);