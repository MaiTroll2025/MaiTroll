/**
 * Orphan Table Analyzer
 * Scans all SQL files to find references to orphan tables from section 1.4
 * Categorizes them into: SAFE_TO_DROP, KEEP_REST_API, KEEP_FK_TARGET, KEEP_IN_FUNCTION, KEEP_IN_VIEW, KEEP_IN_TRIGGER
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const WORKSPACE = 'c:\\Users\\kainm\\TC ONLY\\Mai Troll';

// Read orphan tables from DATABASE_AUDIT_2026.md
function readOrphanTables() {
  const content = fs.readFileSync(path.join(WORKSPACE, 'DATABASE_AUDIT_2026.md'), 'utf8');
  const lines = content.split('\n');
  const tables = [];
  let inSection = false;
  
  for (const line of lines) {
    if (line.includes('### 1.4 Never Referenced (Orphan Tables)')) {
      inSection = true;
      continue;
    }
    if (inSection && line.startsWith('---')) break;
    if (inSection && line.startsWith('|') && !line.includes('Table') && !line.includes('---')) {
      const parts = line.split('|').map(s => s.trim()).filter(s => s);
      if (parts.length >= 2) {
        const tableName = parts[1].replace(/`/g, '');
        if (tableName) tables.push(tableName);
      }
    }
  }
  return tables;
}

// Get all SQL files recursively
function getAllSqlFiles(dir, files = []) {
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        getAllSqlFiles(fullPath, files);
      } else if (entry.name.endsWith('.sql')) {
        files.push(fullPath);
      }
    }
  } catch (e) {}
  return files;
}

// Read file content safely
function safeReadFile(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch (e) {
    return '';
  }
}

// Extract table references from SQL content
function findTableReferences(content, table) {
  const refs = {
    inFunction: false,
    inView: false,
    inTrigger: false,
    inFK: false,
    inRLS: false,
    functionNames: [],
    viewNames: [],
    triggerNames: [],
    fkSources: [],
    rlsPolicies: []
  };

  const lowerContent = content.toLowerCase();
  const lowerTable = table.toLowerCase();

  // Check for CREATE FUNCTION / CREATE OR REPLACE FUNCTION
  const funcRegex = /create\s+(or\s+replace\s+)?function\s+([\w.]+)/gi;
  let funcMatch;
  const functions = [];
  while ((funcMatch = funcRegex.exec(content)) !== null) {
    functions.push({ name: funcMatch[2], start: funcMatch.index });
  }
  
  // For each function, find its body and check if it references the table
  for (let i = 0; i < functions.length; i++) {
    const start = functions[i].start;
    const end = i + 1 < functions.length ? functions[i + 1].start : content.length;
    const body = content.substring(start, end).toLowerCase();
    if (body.includes(lowerTable)) {
      refs.inFunction = true;
      refs.functionNames.push(functions[i].name);
    }
  }

  // Check for CREATE VIEW / CREATE OR REPLACE VIEW / CREATE MATERIALIZED VIEW
  const viewRegex = /create\s+(or\s+replace\s+)?(materialized\s+)?view\s+([\w.]+)/gi;
  let viewMatch;
  const views = [];
  while ((viewMatch = viewRegex.exec(content)) !== null) {
    views.push({ name: viewMatch[3], start: viewMatch.index });
  }
  
  for (let i = 0; i < views.length; i++) {
    const start = views[i].start;
    const end = i + 1 < views.length ? views[i + 1].start : content.length;
    const body = content.substring(start, end).toLowerCase();
    if (body.includes(lowerTable)) {
      refs.inView = true;
      refs.viewNames.push(views[i].name);
    }
  }

  // Check for CREATE TRIGGER
  const triggerRegex = /create\s+(or\s+replace\s+)?trigger\s+([\w.]+)/gi;
  let triggerMatch;
  const triggers = [];
  while ((triggerMatch = triggerRegex.exec(content)) !== null) {
    triggers.push({ name: triggerMatch[2], start: triggerMatch.index });
  }
  
  for (let i = 0; i < triggers.length; i++) {
    const start = triggers[i].start;
    const end = i + 1 < triggers.length ? triggers[i + 1].start : content.length;
    const body = content.substring(start, end).toLowerCase();
    if (body.includes(lowerTable)) {
      refs.inTrigger = true;
      refs.triggerNames.push(triggers[i].name);
    }
  }

  // Check for REFERENCES (foreign key)
  const fkRegex = new RegExp(`references\\s+${table.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\(`, 'gi');
  if (fkRegex.test(content)) {
    refs.inFK = true;
    // Find which table has the FK
    const tableCreateRegex = /create\s+table\s+(if\s+not\s+exists\s+)?([\w.]+)/gi;
    let tableMatch;
    while ((tableMatch = tableCreateRegex.exec(content)) !== null) {
      const tStart = tableMatch.index;
      const tEnd = content.indexOf(';', tStart);
      const tableBody = content.substring(tStart, tEnd > 0 ? tEnd : tStart + 500);
      if (tableBody.toLowerCase().includes(lowerTable) && tableBody.match(fkRegex)) {
        refs.fkSources.push(tableMatch[2]);
      }
    }
  }

  // Check for RLS policies
  const rlsRegex = /create\s+policy\s+[\w'"]+\s+on\s+([\w.]+)/gi;
  let rlsMatch;
  while ((rlsMatch = rlsRegex.exec(content)) !== null) {
    if (rlsMatch[1].toLowerCase() === lowerTable) {
      refs.inRLS = true;
      refs.rlsPolicies.push(rlsMatch[0]);
    }
  }

  // Also check for ALTER TABLE ... ENABLE ROW LEVEL SECURITY
  const alterRlsRegex = new RegExp(`alter\\s+table\\s+${table.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s+enable\\s+row\\s+level\\s+security`, 'gi');
  if (alterRlsRegex.test(content)) {
    refs.inRLS = true;
    refs.rlsPolicies.push('ENABLE ROW LEVEL SECURITY');
  }

  return refs;
}

// Main analysis
async function main() {
  console.log('Reading orphan tables...');
  const orphanTables = readOrphanTables();
  console.log(`Found ${orphanTables.length} orphan tables`);
  
  console.log('Finding SQL files...');
  const sqlFiles = getAllSqlFiles(WORKSPACE);
  console.log(`Found ${sqlFiles.length} SQL files`);
  
  const results = {};
  for (const table of orphanTables) {
    results[table] = {
      inFunction: false,
      inView: false,
      inTrigger: false,
      inFK: false,
      inRLS: false,
      functionNames: new Set(),
      viewNames: new Set(),
      triggerNames: new Set(),
      fkSources: new Set(),
      rlsPolicies: new Set(),
      sourceFiles: new Set()
    };
  }
  
  // Scan each SQL file
  let fileCount = 0;
  for (const sqlFile of sqlFiles) {
    fileCount++;
    if (fileCount % 100 === 0) console.log(`Scanned ${fileCount}/${sqlFiles.length} files...`);
    
    const content = safeReadFile(sqlFile);
    if (!content) continue;
    
    for (const table of orphanTables) {
      const refs = findTableReferences(content, table);
      if (refs.inFunction) {
        results[table].inFunction = true;
        refs.functionNames.forEach(n => results[table].functionNames.add(n));
        results[table].sourceFiles.add(path.relative(WORKSPACE, sqlFile));
      }
      if (refs.inView) {
        results[table].inView = true;
        refs.viewNames.forEach(n => results[table].viewNames.add(n));
        results[table].sourceFiles.add(path.relative(WORKSPACE, sqlFile));
      }
      if (refs.inTrigger) {
        results[table].inTrigger = true;
        refs.triggerNames.forEach(n => results[table].triggerNames.add(n));
        results[table].sourceFiles.add(path.relative(WORKSPACE, sqlFile));
      }
      if (refs.inFK) {
        results[table].inFK = true;
        refs.fkSources.forEach(n => results[table].fkSources.add(n));
        results[table].sourceFiles.add(path.relative(WORKSPACE, sqlFile));
      }
      if (refs.inRLS) {
        results[table].inRLS = true;
        refs.rlsPolicies.forEach(n => results[table].rlsPolicies.add(n));
        results[table].sourceFiles.add(path.relative(WORKSPACE, sqlFile));
      }
    }
  }
  
  console.log(`\nScanned all ${fileCount} files. Categorizing...\n`);
  
  // Categorize
  const categories = {
    SAFE_TO_DROP: [],
    KEEP_REST_API: [],
    KEEP_FK_TARGET: [],
    KEEP_IN_FUNCTION: [],
    KEEP_IN_VIEW: [],
    KEEP_IN_TRIGGER: []
  };
  
  for (const table of orphanTables) {
    const r = results[table];
    const info = {
      table,
      functions: [...r.functionNames],
      views: [...r.viewNames],
      triggers: [...r.triggerNames],
      fkSources: [...r.fkSources],
      rlsPolicies: [...r.rlsPolicies],
      files: [...r.sourceFiles]
    };
    
    if (r.inRLS) {
      categories.KEEP_REST_API.push(info);
    } else if (r.inFK) {
      categories.KEEP_FK_TARGET.push(info);
    } else if (r.inFunction) {
      categories.KEEP_IN_FUNCTION.push(info);
    } else if (r.inView) {
      categories.KEEP_IN_VIEW.push(info);
    } else if (r.inTrigger) {
      categories.KEEP_IN_TRIGGER.push(info);
    } else {
      categories.SAFE_TO_DROP.push(info);
    }
  }
  
  // Output results
  console.log('=== ORPHAN TABLE ANALYSIS RESULTS ===\n');
  
  for (const [cat, items] of Object.entries(categories)) {
    console.log(`\n### ${cat} (${items.length} tables)\n`);
    for (const item of items) {
      console.log(`- \`${item.table}\``);
      if (item.functions.length) console.log(`  Functions: ${item.functions.join(', ')}`);
      if (item.views.length) console.log(`  Views: ${item.views.join(', ')}`);
      if (item.triggers.length) console.log(`  Triggers: ${item.triggers.join(', ')}`);
      if (item.fkSources.length) console.log(`  FK referenced by: ${item.fkSources.join(', ')}`);
      if (item.rlsPolicies.length) console.log(`  RLS policies: ${item.rlsPolicies.length}`);
    }
  }
  
  // Write detailed JSON
  const jsonOutput = {};
  for (const [cat, items] of Object.entries(categories)) {
    jsonOutput[cat] = items.map(i => ({
      table: i.table,
      functions: i.functions,
      views: i.views,
      triggers: i.triggers,
      fkSources: i.fkSources,
      rlsPolicies: i.rlsPolicies,
      files: i.files
    }));
  }
  
  fs.writeFileSync(
    path.join(WORKSPACE, '_orphan_analysis.json'),
    JSON.stringify(jsonOutput, null, 2)
  );
  
  console.log(`\n\nDetailed results written to _orphan_analysis.json`);
  
  // Summary
  console.log('\n=== SUMMARY ===');
  for (const [cat, items] of Object.entries(categories)) {
    console.log(`${cat}: ${items.length}`);
  }
}

main().catch(console.error);
