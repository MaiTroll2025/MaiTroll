const fs = require('fs');
const content = fs.readFileSync('frontend_schema.sql', 'utf8');
const results = JSON.parse(fs.readFileSync('table_check_results.json', 'utf8'));
const missingLower = new Set(results.missingTables.map(t => t.toLowerCase()));

const lines = content.split('\n');

// CREATE INDEX for missing tables
let idxRefs = {};
for (let i = 0; i < lines.length; i++) {
  const upper = lines[i].toUpperCase().trim();
  if (upper.startsWith('CREATE') && upper.includes('INDEX')) {
    const match = lines[i].match(/CREATE\s+(?:UNIQUE\s+)?INDEX\s+(?:IF\s+NOT\s+EXISTS\s+)?\w+\s+ON\s+(?:public\.)?(\w+)/i);
    if (match) {
      const table = match[1].toLowerCase();
      if (missingLower.has(table)) {
        if (!idxRefs[table]) idxRefs[table] = [];
        idxRefs[table].push(lines[i].trim());
      }
    }
  }
}

// CREATE POLICY for missing tables
let polRefs = {};
for (let i = 0; i < lines.length; i++) {
  const upper = lines[i].toUpperCase().trim();
  if (upper.startsWith('CREATE') && upper.includes('POLICY')) {
    const match = lines[i].match(/CREATE\s+(?:OR\s+REPLACE\s+)?POLICY\s+"?[^"]*"?\s+ON\s+(?:public\.)?(\w+)/i);
    if (match) {
      const table = match[1].toLowerCase();
      if (missingLower.has(table)) {
        if (!polRefs[table]) polRefs[table] = [];
        polRefs[table].push(lines[i].trim());
      }
    }
  }
}

console.log('CREATE INDEX for missing tables:', Object.keys(idxRefs).length);
for (const [t, stmts] of Object.entries(idxRefs)) {
  console.log(t + ':', stmts.length, 'indexes');
  stmts.slice(0, 3).forEach(s => console.log('  ', s.substring(0, 200)));
}

console.log('\nCREATE POLICY for missing tables:', Object.keys(polRefs).length);
for (const [t, stmts] of Object.entries(polRefs)) {
  console.log(t + ':', stmts.length, 'policies');
  stmts.slice(0, 3).forEach(s => console.log('  ', s.substring(0, 200)));
}

// Save
fs.writeFileSync('C:/Users/kainm/TC ONLY/Mai Troll/idx_pol_refs.json', JSON.stringify({
  idxRefs,
  polRefs
}, null, 2));
console.log('\nSaved to idx_pol_refs.json');
