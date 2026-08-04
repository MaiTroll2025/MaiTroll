const { execSync } = require('child_process');

// Read from Windows Credential Manager using cmdkey
// These were the entries found:
// LegacyGeneric:target=Supabase CLI:supabase (User: supabase)
// LegacyGeneric:target=Supabase:CLI:supabase (User: supabase)

const targets = [
  'Supabase CLI:supabase',
  'Supabase:CLI:supabase',
  'supabase:cli',
  'SupabaseCLI:supabase',
];

const entries = execSync('cmdkey /list', { encoding: 'utf8' });
console.log('All Supabase-related entries:');
const lines = entries.split('\n');
lines.forEach(line => {
  if (line.toLowerCase().includes('supabase')) {
    console.log('  ' + line.trim());
  }
});

// Try to read the password using PowerShell + Windows Credential Manager
for (const target of targets) {
  try {
    const psResult = execSync(
      `powershell -Command "Add-Type -AssemblyName System.Runtime.InteropServices; ` +
      `$cred = New-Object System.Net.NetworkCredential; ` +
      `[void][System.Reflection.Assembly]::LoadWithPartialName('System.Windows.Forms'); " 2>&1`,
      { encoding: 'utf8', timeout: 5000 }
    );
    console.log(psResult);
  } catch(e) {
    // Try another approach
  }
}

// Use a simpler approach - try cmdkey with generic target
console.log('\n--- Trying cmdkey show ---');
for (const target of ['Supabase CLI:supabase', 'Supabase:CLI:supabase']) {
  try {
    const result = execSync(`cmdkey /list:${target}`, { encoding: 'utf8', timeout: 5000 });
    console.log(`\nTarget ${target}:`);
    console.log(result);
  } catch(e) {
    console.log(`\nTarget ${target}: ${e.message}`);
  }
}
