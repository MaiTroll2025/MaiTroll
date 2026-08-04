import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

const OUTPUT_DIR = join(process.cwd(), 'supabase', 'migrations');

if (!existsSync(OUTPUT_DIR)) {
  mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Read all SQL files in the project
const sqlFiles = [];
function findSqlFiles(dir, baseDir) {
  try {
    const entries = readdirSync(dir);
    for (const entry of entries) {
      const fullPath = join(dir, entry);
      const stat = statSync(fullPath);
      if (stat.isDirectory()) {
        if (!entry.includes('node_modules') && !entry.includes('worktree') && !entry.includes('backup') && !entry.includes('conflicted') && !entry.includes('__tests__')) {
          findSqlFiles(fullPath, baseDir);
        }
      } else if (entry.endsWith('.sql')) {
        const relativePath = fullPath.replace(baseDir + '\\', '').replace(baseDir + '/', '');
        sqlFiles.push({ path: fullPath, name: relativePath });
      }
    }
  } catch (e) {
    // skip
  }
}

findSqlFiles(process.cwd(), process.cwd());

// Filter to relevant files
const relevantFiles = sqlFiles.filter(f => {
  const parts = f.name.split(/[\\/]/);
  return parts[0] === 'src' || parts[0] === 'db' || parts[0] === 'database' || parts[0] === 'migrations' || 
         f.name.includes('complete_jail') || f.name.includes('UNIVERSAL_RLS') || f.name.includes('force_apply') || 
         f.name.includes('MISSING_OBJECTS') || f.name.includes('agency_schema') || f.name.includes('create_media_city_schema') || 
         f.name.includes('neighborhood_schema') || f.name.includes('fix_') || f.name.includes('FIX_') ||
         f.name.includes('create_') || f.name.includes('apply_') || f.name.includes('update_') ||
         f.name.includes('add_') || f.name.includes('seed_') || f.name.includes('run_') ||
         f.name.includes('validate_') || f.name.includes('optimize_') || f.name.includes('secure_') ||
         f.name.includes('enable_') || f.name.includes('drop_') || f.name.includes('rename_') ||
         f.name.includes('sync_') || f.name.includes('ensure_') || f.name.includes('allow_') ||
         f.name.includes('disable_') || f.name.includes('grant') || f.name.includes('install_') ||
         f.name.includes('setup_') || f.name.includes('generate_') || f.name.includes('parse_') ||
         f.name.includes('inspect_') || f.name.includes('_analyze') || f.name.includes('_clean') ||
         f.name.includes('_fix') || f.name.includes('_do') || f.name.includes('_final') ||
         f.name.includes('_scan') || f.name.includes('_show') || f.name.includes('_view') ||
         f.name.includes('_trace') || f.name.includes('_simply') || f.name.includes('_plan') ||
         f.name.includes('_restore') || f.name.includes('_bak') || f.name.includes('_count') ||
         f.name.includes('_divcount') || f.name.includes('_balance') || f.name.includes('_curves') ||
         f.name.includes('_cpybak') || f.name.includes('_debug') || f.name.includes('_diag') ||
         f.name.includes('_inspect') || f.name.includes('_parse') || f.name.includes('_parsecheck') ||
         f.name.includes('_findjsx') || f.name.includes('_find_my_role') || f.name.includes('_apply') ||
         f.name.includes('_stack');
});

console.log(`Found ${relevantFiles.length} relevant SQL files`);

// Read all SQL content
const allSql = [];
for (const file of relevantFiles) {
  try {
    const content = readFileSync(file.path, 'utf8');
    allSql.push({ name: file.name, content });
  } catch (e) {
    // skip
  }
}

// Extract page-specific SQL blocks
// Look for comments that indicate page/feature
const pageSqlBlocks = {};

const pageKeywords = {
  'auth': ['auth', 'signup', 'login', 'sign_up', 'signup_queue', 'register'],
  'home': ['home', 'feed', 'sidebar', 'live_grid', 'broadcast'],
  'profile': ['profile', 'user_profile', 'avatar', 'badge', 'frame'],
  'streams': ['stream', 'broadcast', 'viewer', 'chat', 'gift', 'seat', 'smoke'],
  'notifications': ['notification', 'alert', 'follow'],
  'coins': ['coin', 'purchase', 'payment', 'stripe', 'paypal', 'ledger'],
  'court': ['court', 'troll_court', 'judge', 'ruling', 'docket', 'summons'],
  'jail': ['jail', 'inmate', 'arrest', 'bail', 'prison'],
  'universe': ['universe', 'battle', 'showdown', 'round', 'team'],
  'academy': ['academy', 'course', 'teacher', 'student', 'classroom', 'quiz', 'assignment'],
  'church': ['church', 'prayer', 'sermon', 'pastor'],
  'agencies': ['agency', 'talent', 'roster', 'creator'],
  'treasury': ['treasury', 'payout', 'cashout', 'fast_pay'],
  'admin': ['admin', 'dashboard', 'moderation', 'bug_alert'],
  'tromail': ['tromail', 'email', 'mail'],
  'utromail': ['utromail', 'thread', 'message'],
  'auction': ['auction', 'lot', 'bid', 'bidder'],
  'family': ['family', 'troll_family', 'war', 'league'],
  'games': ['game', 'wheel', 'match', 'giveaway', 'pride'],
  'government': ['government', 'president', 'election', 'vote', 'law'],
  'insurance': ['insurance', 'policy', 'claim'],
  'housing': ['house', 'property', 'rent', 'lease', 'apartment'],
  'vehicles': ['vehicle', 'car', 'dealership', 'driver', 'license'],
  'marketplace': ['marketplace', 'item', 'order', 'seller', 'buyer'],
  'employees': ['employee', 'hr', 'payroll', 'shift', 'officer'],
  'xtrollz': ['xtrollz', 'application', 'moderation'],
  'shareathon': ['shareathon', 'submission', 'verification'],
  'call': ['call', 'call_minutes', 'agora'],
  'podcast': ['podcast', 'episode', 'rtc'],
  'notary': ['notary', 'document', 'stamp', 'signature'],
  'security': ['security', 'ban', 'risk', 'incident', 'rate_limit'],
  'call': ['call', 'call_minutes', 'agora'],
};

// Extract SQL blocks from files
for (const file of allSql) {
  const lines = file.content.split('\n');
  let currentBlock = [];
  let currentComment = '';
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    
    if (trimmed.startsWith('--')) {
      if (currentBlock.length > 0) {
        const blockSql = currentBlock.join('\n');
        const blockComment = currentComment;
        // Assign to pages based on keywords
        for (const [page, keywords] of Object.entries(pageKeywords)) {
          if (keywords.some(k => blockComment.toLowerCase().includes(k))) {
            if (!pageSqlBlocks[page]) pageSqlBlocks[page] = [];
            pageSqlBlocks[page].push({ sql: blockSql, comment: blockComment, source: file.name });
          }
        }
      }
      currentBlock = [line];
      currentComment = trimmed.replace(/^--\s*/, '');
    } else if (trimmed.length > 0) {
      currentBlock.push(line);
    }
  }
  
  // Don't forget the last block
  if (currentBlock.length > 0) {
    const blockSql = currentBlock.join('\n');
    const blockComment = currentComment;
    for (const [page, keywords] of Object.entries(pageKeywords)) {
      if (keywords.some(k => blockComment.toLowerCase().includes(k))) {
        if (!pageSqlBlocks[page]) pageSqlBlocks[page] = [];
        pageSqlBlocks[page].push({ sql: blockSql, comment: blockComment, source: file.name });
      }
    }
  }
}

// Deduplicate blocks within each page
for (const page of Object.keys(pageSqlBlocks)) {
  const seen = new Set();
  pageSqlBlocks[page] = pageSqlBlocks[page].filter(block => {
    const key = block.sql.trim();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// Create per-page migration files
const timestamp = '20260727180000';
let migrationCount = 0;

for (const [page, blocks] of Object.entries(pageSqlBlocks)) {
  if (blocks.length === 0) continue;
  
  const pageKey = page.toLowerCase();
  
  let sql = `-- Page: ${page}\n`;
  sql += `-- Migration: ${timestamp}_page_${pageKey}\n`;
  sql += `-- Source files: ${blocks.map(b => b.source).join(', ')}\n\n`;
  
  for (const block of blocks) {
    sql += `-- From: ${block.source}\n`;
    sql += block.sql + '\n\n';
  }
  
  const fileName = `${timestamp}_page_${pageKey}.sql`;
  const filePath = join(OUTPUT_DIR, fileName);
  writeFileSync(filePath, sql);
  console.log(`Created: ${fileName} (${blocks.length} blocks)`);
  migrationCount++;
}

console.log(`\nTotal per-page migrations created: ${migrationCount}`);
