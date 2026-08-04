const assert = require('assert');
const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'supabase', 'functions', 'livekit-token', 'index.ts');
const content = fs.readFileSync(filePath, 'utf8');

assert(content.includes('const header = { alg: "HS256", typ: "JWT" };'), 'Expected LiveKit token generator to define the JWT header');
assert(content.includes('const headerBase64 = base64Encode(encoder.encode(JSON.stringify(header)));'), 'Expected LiveKit token generator to serialize the JWT header');

console.log('LiveKit token header regression check passed');
