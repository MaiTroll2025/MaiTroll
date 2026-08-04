const fs = require('fs');
const content = fs.readFileSync('migrations/20260731_create_all_missing_tables.sql', 'utf8');

// Basic SQL validation checks
const issues = [];

// Check balanced CREATE TABLE statements
const createTableRegex = /CREATE TABLE IF NOT EXISTS\s+(?:public\.)?(\w+)\s*\([\s\S]*?\);/gi;
let m;
let createTableCount = 0;
while ((m = createTableRegex.exec(content)) !== null) {
  createTableCount++;
}
console.log('Balanced CREATE TABLE statements:', createTableCount);

// Check for REFERENCES to user_profiles and auth.users
const userProfilesRefs = (content.match(/REFERENCES\s+(?:public\.)?user_profiles/gi) || []).length;
console.log('References to user_profiles:', userProfilesRefs);

const authUsersRefs = (content.match(/REFERENCES\s+auth\.users/gi) || []).length;
console.log('References to auth.users:', authUsersRefs);

// Verify the file has the right structure (PART 1-5)
const parts = ['PART 1: CREATE TABLE', 'PART 2: Add any missing columns', 'PART 3: Enable Row Level Security', 'PART 4: Create indexes', 'PART 5: Create Row Level Security policies'];
for (const part of parts) {
  if (content.includes(part)) console.log('Found:', part);
  else issues.push('Missing section: ' + part);
}

// Check for common issues
const lines = content.split('\n');
let unclosedParens = 0;
for (let i = 0; i < lines.length; i++) {
  const open = (lines[i].match(/\(/g) || []).length;
  const close = (lines[i].match(/\)/g) || []).length;
  unclosedParens += open - close;
}
console.log('Unclosed paren difference:', unclosedParens);

// Check for empty statements
const emptyStmts = (content.match(/;;/g) || []).length;
console.log('Double semicolons:', emptyStmts);

if (issues.length > 0) console.log('Issues:', issues);
else console.log('All sections present.');
