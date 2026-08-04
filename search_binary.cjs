const fs = require('fs');
const buf = fs.readFileSync('C:/Users/kainm/AppData/Roaming/npm/node_modules/supabase/node_modules/@supabase/cli-windows-x64/bin/supabase.exe');
const content = buf.toString('latin1');

const patterns = ['access_token', 'accessToken', 'Bearer ', 'login-role', 'SUPABASE_ACCESS'];
patterns.forEach(p => {
  const idx = content.indexOf(p);
  if (idx >= 0) {
    console.log('Found "' + p + '" at offset', idx);
    const start = Math.max(0, idx - 50);
    const end = Math.min(content.length, idx + 200);
    console.log('Context:', JSON.stringify(content.substring(start, end)));
  }
});

const profilePatterns = ['.supabase/profile', '.supabase\\\\profile'];
profilePatterns.forEach(p => {
  const idx = content.indexOf(p);
  if (idx >= 0) {
    console.log('Found "' + p + '" at offset', idx);
  }
});
