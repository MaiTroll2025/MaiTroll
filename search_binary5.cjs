const fs = require('fs');
const buf = fs.readFileSync('C:/Users/kainm/AppData/Roaming/npm/node_modules/supabase/node_modules/@supabase/cli-windows-x64/bin/supabase.exe');
const content = buf.toString('latin1');

// Search for keyring service names
const keyringPatterns = ['getKeytarService', 'service:', 'serviceName', 'keytarService', 'supabase-cli', 'SupabaseCLI'];
keyringPatterns.forEach(p => {
  let pos = 0;
  let count = 0;
  while ((pos = content.indexOf(p, pos)) !== -1 && count < 3) {
    const start = Math.max(0, pos - 100);
    const end = Math.min(content.length, pos + 200);
    console.log(`Found "${p}" at offset ${pos}:`);
    console.log('  Context:', JSON.stringify(content.substring(start, end)));
    pos++;
    count++;
  }
});

// Search for "getAccessToken" function implementation
const getAccIdx = content.indexOf('getAccessToken');
if (getAccIdx >= 0) {
  const start = Math.max(0, getAccIdx - 100);
  const end = Math.min(content.length, getAccIdx + 300);
  console.log('\ngetAccessToken context:');
  console.log(JSON.stringify(content.substring(start, end)));
}

// Search for "linked-project.json" file
const lpIdx = content.indexOf('linked-project.json');
if (lpIdx >= 0) {
  const start = Math.max(0, lpIdx - 200);
  const end = Math.min(content.length, lpIdx + 300);
  console.log('\nlinked-project.json context:');
  console.log(JSON.stringify(content.substring(start, end)));
}
