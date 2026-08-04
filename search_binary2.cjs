const fs = require('fs');
const buf = fs.readFileSync('C:/Users/kainm/AppData/Roaming/npm/node_modules/supabase/node_modules/@supabase/cli-windows-x64/bin/supabase.exe');
const content = buf.toString('latin1');

// Search for any JWT-like strings (eyJ...)
let match;
const jwtRegex = /eyJ[A-Za-z0-9_-]+/g;
const found = [];
while ((match = jwtRegex.exec(content)) !== null) {
  found.push({ offset: match.index, token: match[0].substring(0, 100) });
}
console.log('JWT-like strings found:', found.length);
found.slice(0, 5).forEach(f => console.log('  offset:', f.offset, 'token:', f.token));

// Search for Supabase API token patterns (sb_secret_...)
const sbRegex = /sb_[a-z]+_[a-zA-Z0-9]+/g;
const sbFound = [];
while ((match = sbRegex.exec(content)) !== null) {
  sbFound.push({ offset: match.index, token: match[0].substring(0, 40) });
}
console.log('\nSupabase token patterns found:', sbFound.length);
sbFound.slice(0, 5).forEach(f => console.log('  offset:', f.offset, 'token:', f.f.token));

// Search for 'token' in context of project
const tokenContexts = [];
let pos = 0;
while ((pos = content.indexOf('token', pos)) !== -1) {
  const context = content.substring(Math.max(0, pos - 30), Math.min(content.length, pos + 80));
  if (context.toLowerCase().includes('access') || context.toLowerCase().includes('supabase')) {
    tokenContexts.push({ offset: pos, context: JSON.stringify(context) });
  }
  pos++;
}
console.log('\nToken contexts with access/supabase:', tokenContexts.length);
tokenContexts.slice(0, 10).forEach(t => console.log('  offset:', t.offset, 'context:', t.context));
