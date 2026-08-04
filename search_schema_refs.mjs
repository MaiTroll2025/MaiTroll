import fs from 'fs';
import path from 'path';

// Load missing tables
const results = JSON.parse(fs.readFileSync('C:/Users/kainm/TC ONLY/Mai Troll/table_check_results.json', 'utf8'));
const missingTables = results.missingTables;
const missingSet = new Set(missingTables.map(t => t.toLowerCase()));

// Read frontend_schema.sql
const frontendSchema = fs.readFileSync('C:/Users/kainm/TC ONLY/Mai Troll/frontend_schema.sql', 'utf8');

// Search for ALTER TABLE ... ADD/ALTER COLUMN statements for missing tables
const alterMatchRegex = /ALTER\s+TABLE\s+(?:IF\s+(?:EXISTS|NOT)\s+)?(?:public\.)?(\w+)\s+(.+?);/gis;
const alterTableRefs = new Map(); // tableName -> array of statements

let m;
while ((m = alterMatchRegex.exec(frontendSchema)) !== null) {
  const tableName = m[1].toLowerCase();
  if (missingSet.has(tableName)) {
    if (!alterTableRefs.has(tableName)) alterTableRefs.set(tableName, []);
    alterTableRefs.get(tableName).push(m[0].trim());
  }
}

// Search for CREATE INDEX statements for missing tables
const indexRegex = /CREATE\s+(?:UNIQUE\s+)?INDEX\s+(?:IF\s+NOT\s+EXISTS\s+)?\w+\s+ON\s+(?:public\.)?(\w+)\s*\((.+?)\);/gis;
const indexRefs = new Map();
let idxM;
while ((idxM = indexRegex.exec(frontendSchema)) !== null) {
  const tableName = idxM[1].toLowerCase();
  if (missingSet.has(tableName)) {
    if (!indexRefs.has(tableName)) indexRefs.set(tableName, []);
    indexRefs.get(tableName).push(idxM[0].trim());
  }
}

// Search for CREATE POLICY statements for missing tables
const policyRegex = /CREATE\s+(?:OR\s+REPLACE\s+)?POLICY\s+"?[^"]*"?\s+ON\s+(?:public\.)?(\w+)\s+(?:FOR\s+\w+)?/gis;
const policyRefs = new Map();
let polM;
while ((polM = policyRegex.exec(frontendSchema)) !== null) {
  const tableName = polM[1].toLowerCase();
  if (missingSet.has(tableName)) {
    if (!policyRefs.has(tableName)) policyRefs.set(tableName, []);
    policyRefs.get(tableName).push(polM[0].trim());
  }
}

// Search for GRANT statements for missing tables
const grantRegex = /GRANT\s+.+\s+ON\s+(?:TABLE\s+)?(?:public\.)?(\w+)\s+/gis;
const grantRefs = new Map();
let grantM;
while ((grantM = grantRegex.exec(frontendSchema)) !== null) {
  const tableName = grantM[1].toLowerCase();
  if (missingSet.has(tableName) && !grantRefs.has(tableName)) {
    grantRefs.set(tableName, grantM[0].trim());
  }
}

// Also search root SQL files
const rootFiles = fs.readdirSync('C:/Users/kainm/TC ONLY/Mai Troll').filter(f => f.endsWith('.sql'));
for (const file of rootFiles) {
  const content = fs.readFileSync(path.join('C:/Users/kainm/TC ONLY/Mai Troll', file), 'utf8');
  
  while ((m = alterMatchRegex.exec(content)) !== null) {
    const tableName = m[1].toLowerCase();
    if (missingSet.has(tableName)) {
      if (!alterTableRefs.has(tableName)) alterTableRefs.set(tableName, []);
      alterTableRefs.get(tableName).push(`[file: ${file}] ${m[0].trim()}`);
    }
  }
  
  let idxM2;
  while ((idxM2 = indexRegex.exec(content)) !== null) {
    const tableName = idxM2[1].toLowerCase();
    if (missingSet.has(tableName)) {
      if (!indexRefs.has(tableName)) indexRefs.set(tableName, []);
      indexRefs.get(tableName).push(`[file: ${file}] ${idxM2[0].trim()}`);
    }
  }
  
  let polM2;
  while ((polM2 = policyRegex.exec(content)) !== null) {
    const tableName = polM2[1].toLowerCase();
    if (missingSet.has(tableName)) {
      if (!policyRefs.has(tableName)) policyRefs.set(tableName, []);
      policyRefs.get(tableName).push(`[file: ${file}] ${polM2[0].trim()}`);
    }
  }
}

console.log('Tables with ALTER TABLE refs:', alterTableRefs.size);
console.log('Tables with CREATE INDEX refs:', indexRefs.size);
console.log('Tables with CREATE POLICY refs:', policyRefs.size);
console.log('Tables with GRANT refs:', grantRefs.size);

// Save results
fs.writeFileSync('C:/Users/kainm/TC ONLY/Mai Troll/schema_refs.json', JSON.stringify({
  alterTableRefs: Object.fromEntries([...alterTableRefs.entries()].map(([k,v]) => [k, v])),
  indexRefs: Object.fromEntries([...indexRefs.entries()].map(([k,v]) => [k, v])),
  policyRefs: Object.fromEntries([...policyRefs.entries()].map(([k,v]) => [k, v])),
  grantRefs: Object.fromEntries([...grantRefs.entries()].map(([k,v]) => [k, v])),
}, null, 2));
console.log('Saved to schema_refs.json');
console.log('\nTables with ALTER TABLE refs:');
for (const [table, stmts] of [...alterTableRefs.entries()].sort()) {
  console.log(`  ${table}: ${stmts.length} statements`);
}
