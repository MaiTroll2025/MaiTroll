const assert = require('assert');
const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'supabase', 'functions', 'livekit-token', 'index.ts');
const content = fs.readFileSync(filePath, 'utf8');

assert(/const header = \{\s*alg:\s*['"]HS256['"],\s*typ:\s*['"]JWT['"]\s*\};/.test(content), 'Expected LiveKit token generator to define the JWT header');
assert(content.includes('const headerBase64 = base64Encode(encoder.encode(JSON.stringify(header)));'), 'Expected LiveKit token generator to serialize the JWT header');
assert(content.includes('const tokenExpiry = now + TOKEN_EXPIRY_SECONDS;'), 'Expected LiveKit token generator to use an absolute expiry timestamp');

console.log('LiveKit token regression checks passed');
