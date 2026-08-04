const fs = require('fs');
const buf = fs.readFileSync('C:/Users/kainm/AppData/Roaming/npm/node_modules/supabase/node_modules/@supabase/cli-windows-x64/bin/supabase.exe');
const content = buf.toString('latin1');

// Search for "linkedProjectCache" and nearby strings
const searchFor = ['linkedProjectCache', 'linked_project', 'linkedProject', '.supabase/profile'];
searchFor.forEach(term => {
  let pos = 0;
  let count = 0;
  while ((pos = content.indexOf(term, pos)) !== -1 && count < 5) {
    const start = Math.max(0, pos - 100);
    const end = Math.min(content.length, pos + 200);
    console.log(`Found "${term}" at offset ${pos}:`);
    console.log('  Context:', JSON.stringify(content.substring(start, end)));
    pos++;
    count++;
  }
});

// Search for the getAccessToken function - look for keyring patterns
const keyringPatterns = ['keytar', 'keyring', 'getPassword', 'Keytar', 'Keyring'];
keyringPatterns.forEach(p => {
  const idx = content.indexOf(p);
  if (idx >= 0) {
    console.log(`\nFound "${p}" at offset ${idx}`);
    const start = Math.max(0, idx - 100);
    const end = Math.min(content.length, idx + 200);
    console.log('Context:', JSON.stringify(content.substring(start, end)));
  }
});

// Search for the profile file format
const profilePatterns = ['supabase/.supabase', 'config.toml'];
profilePatterns.forEach(p => {
  let pos = 0;
  let count = 0;
  while ((pos = content.indexOf(p, pos)) !== -1 && count < 3) {
    const start = Math.max(0, pos - 50);
    const end = Math.min(content.length, pos + 100);
    console.log(`\nFound "${p}" at offset ${pos}:`);
    console.log('Context:', JSON.stringify(content.substring(start, end)));
    pos++;
    count++;
  }
});
