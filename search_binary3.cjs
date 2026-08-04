const fs = require('fs');
const buf = fs.readFileSync('C:/Users/kainm/AppData/Roaming/npm/node_modules/supabase/node_modules/@supabase/cli-windows-x64/bin/supabase.exe');
const content = buf.toString('latin1');

// Search for any JWT-like patterns more thoroughly
// JWT format: eyJ...eyJ...signature (base64url)
const fullJwtRegex = /eyJ[A-Za-z0-9_-]*\.eyJ[A-Za-z0-9_-]*\.[A-Za-z0-9_-]*/g;
let match;
const fullTokens = [];
while ((match = fullJwtRegex.exec(content)) !== null) {
  fullTokens.push({ offset: match.index, token: match[0] });
}
console.log('Full JWT tokens found:', fullTokens.length);
fullTokens.slice(0, 5).forEach(t => console.log('  offset:', t.offset, 'token:', t.token));

// Search for Supabase API key patterns (sb_...)
const sbRegex = /sb_[a-z]+_[a-zA-Z0-9_-]+/g;
const sbFound = [];
while ((match = sbRegex.exec(content)) !== null) {
  sbFound.push({ offset: match.index, token: match[0] });
}
console.log('\nSupabase API keys found:', sbFound.length);
sbFound.slice(0, 5).forEach(f => console.log('  offset:', f.offset, 'token:', f.token));

// Search for "supabase" profile with token
const profileRegex = /supabase.*token/gi;
const profileMatches = [];
while ((match = profileRegex.exec(content)) !== null) {
  profileMatches.push({ offset: match.index, context: match[0] });
}
console.log('\nProfile/token matches:', profileMatches.length);
profileMatches.slice(0, 10).forEach(m => console.log('  offset:', m.offset, 'match:', m.context));

// Search for "cli/login" endpoint and nearby tokens
const loginIdx = content.indexOf('cli/login');
if (loginIdx >= 0) {
  const start = Math.max(0, loginIdx - 500);
  const end = Math.min(content.length, loginIdx + 500);
  const context = content.substring(start, end);
  console.log('\nLogin endpoint context (searching for tokens nearby):');
  // Search for anything that looks like a token in this region
  const tokenRegex = /[A-Za-z0-9_-]{40,}/g;
  let tm;
  const tokens = [];
  while ((tm = tokenRegex.exec(context)) !== null) {
    if (tm.index < 500) tokens.push(context.substring(tm.index, tm.index + Math.min(80, tm[0].length)));
  }
  tokens.slice(0, 10).forEach(t => console.log('  possible token:', t.substring(0, 40)));
}
