import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname);

const SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  'diagnostic_outputs',
  '.kilo',
  'worktrees',
  'build',
  '.next',
  'out',
]);

const ALLOWED_EXTENSIONS = new Set([
  'ts', 'tsx', 'js', 'jsx', 'json', 'toml', 'yaml', 'yml',
  'md', 'env', 'env.example', 'xml', 'properties', 'java',
  'kt', 'swift', 'plist', 'config', 'html', 'css', 'scss',
  'cjs', 'mjs', 'ps1', 'sql', 'gradle', 'pbxproj', 'xcconfig'
]);

// Helper: check if path should be skipped
function shouldSkip(dirPath) {
  const parts = dirPath.split(path.sep);
  return parts.some(part => SKIP_DIRS.has(part));
}

// Exact string replacements (safe, no ambiguity)
const EXACT_REPLACEMENTS = [
  ['maitroll.com', 'maitroll.com'],
  ['maitroll.com', 'maitroll.com'],
  ['maitroll', 'maitroll'],
  ['maitroll', 'maitroll'],
  ['maitroll', 'maitroll'],
  ['maitroll', 'maitroll'],
  ['maitroll', 'maitroll'],
  ['maitroll2', 'maitroll2'],
  ['ma-city', 'ma-city'],
  ['@maitrollapp', '@maitrollapp'],
  ['maitroll-management-team-meetin', 'maitroll-management-team-meetin'],
  ['com.maitroll.app', 'com.maitroll.app'],
  ['MA_CITY_PROMO_SECRET', 'MA_CITY_PROMO_SECRET'],
  ['ma_city_promo_secret', 'ma_city_promo_secret'],
  ['maitrollWall', 'maitrollWall'],
  ['@tromail.maitroll', '@tromail.maitroll'],
  ['maitroll.app', 'maitroll.app'],
  ['https://maitroll.app', 'https://maitroll.app'],
];

// Regex-based replacements (need pattern matching)
const REGEX_REPLACEMENTS = [
  // "maitroll" standalone word, excluding table-like patterns and internal identifiers
  // Match maitroll when it's NOT followed by _word (table pattern) or part of larger word
  {
    from: /\bMai Troll\b/g,
    to: (match, offset, string) => {
      const after = string.slice(offset + match.length, offset + match.length + 5);
      // Skip if followed by _ (likely table name like Mai Troll_shops)
      if (after.startsWith('_')) return match;
      // Skip if part of a larger identifier pattern like maitroll- or maitroll.
      // Actually word boundary handles this
      return 'maitroll';
    }
  },
  // "mai_city" standalone
  {
    from: /\bmai_troll_city\b/g,
    to: 'mai_city'
  },
  // "ma-city" standalone (only in user-facing contexts, not table names)
  // Skip if followed by _word pattern
  {
    from: /\btroll-city\b/g,
    to: (match, offset, string) => {
      const after = string.slice(offset + match.length, offset + match.length + 5);
      if (after.startsWith('_')) return match;
      return 'ma-city';
    }
  },
  // "ma_city" standalone (only in user-facing contexts, not table names)
  {
    from: /\btroll_city\b/g,
    to: (match, offset, string) => {
      const after = string.slice(offset + match.length, offset + match.length + 5);
      if (after.startsWith('_')) return match;
      return 'ma_city';
    }
  },
  // Case-insensitive occurrences in strings/comments for specific patterns
  {
    from: /\bMai Troll-prod\b/gi,
    to: 'maitroll-prod'
  },
  {
    from: /\bMai Troll2025\b/gi,
    to: 'maitroll2025'
  },
  // In string contexts, catch remaining variations
  {
    from: /\bMai City\b/g,
    to: 'maitroll'
  },
];

// Additional patterns for specific context matching
const CONTEXT_REPLACEMENTS = [
  // In title tags, meta descriptions, etc.
  {
    from: /maitroll(\s*["""'`]?)/gi,
    to: 'maitroll$1'
  },
];

const stats = {
  filesChanged: 0,
  filesSkipped: 0,
  skipReasons: {},
  replacements: {},
  samples: []
};

function countReplacement(str) {
  stats.replacements[str] = (stats.replacements[str] || 0) + 1;
}

function addSample(file, original, replaced) {
  if (stats.samples.length < 8) {
    stats.samples.push({ file, original: original.trim(), replaced: replaced.trim() });
  }
}

function processFile(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    const original = content;
    let changed = false;
    let localSamples = [];

    // Apply exact replacements
    for (const [from, to] of EXACT_REPLACEMENTS) {
      if (content.includes(from)) {
        const before = content;
        content = content.split(from).join(to);
        if (content !== before) {
          changed = true;
          countReplacement(`${from} → ${to}`);
          if (localSamples.length < 3) {
            localSamples.push({ from, to, context: before.split(from)[0].slice(-60) });
          }
        }
      }
    }

    // Apply regex replacements
    for (const rule of REGEX_REPLACEMENTS) {
      const matches = content.match(rule.from);
      if (matches && matches.length > 0) {
        const before = content;
        content = content.replace(rule.from, rule.to);
        if (content !== before) {
          changed = true;
          countReplacement(`${rule.from.toString().slice(0, 40)}... → replacement`);
          if (localSamples.length < 5) {
            localSamples.push({ regex: rule.from.toString().slice(0, 60), count: matches.length });
          }
        }
      }
    }

    if (changed) {
      fs.writeFileSync(filePath, content, 'utf8');
      stats.filesChanged++;
      if (stats.samples.length < 8 && localSamples.length > 0) {
        stats.samples.push({
          file: path.relative(PROJECT_ROOT, filePath),
          samples: localSamples.slice(0, 2)
        });
      }
    }
  } catch (err) {
    // Skip files that can't be read/written
    stats.filesSkipped++;
    stats.skipReasons['read/write error'] = (stats.skipReasons['read/write error'] || 0) + 1;
  }
}

function walkDir(dir) {
  if (shouldSkip(dir)) return;

  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkDir(fullPath);
    } else if (entry.isFile()) {
      const ext = entry.name.split('.').pop()?.toLowerCase();
      if (ext && ALLOWED_EXTENSIONS.has(ext)) {
        processFile(fullPath);
      }
    }
  }
}

console.log('Starting maitroll → maitroll rebrand...\n');
walkDir(PROJECT_ROOT);

console.log('='.repeat(60));
console.log('REBRAND SUMMARY');
console.log('='.repeat(60));
console.log(`Total files changed: ${stats.filesChanged}`);
console.log(`Total files skipped: ${stats.filesSkipped}`);
console.log('\nTop 20 most common replacements:');
const sorted = Object.entries(stats.replacements)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 20);
sorted.forEach(([name, count], i) => {
  console.log(`  ${i + 1}. ${name}: ${count}x`);
});

console.log('\nSkip reasons:');
Object.entries(stats.skipReasons).forEach(([reason, count]) => {
  console.log(`  ${reason}: ${count}`);
});

console.log('\nSample changes:');
stats.samples.forEach((s, i) => {
  console.log(`\n  [${i + 1}] ${s.file || s.file}`);
  if (s.samples) {
    s.samples.forEach(sample => {
      if (sample.from) console.log(`      "${sample.from}" → "${sample.to}"`);
      else console.log(`      ${sample.regex} (${sample.count}x)`);
    });
  } else {
    console.log(`      Context: "${s.original?.slice(0, 80)}"`);
    console.log(`      → "${s.replaced?.slice(0, 80)}"`);
  }
});

console.log('\n' + '='.repeat(60));
console.log('DONE');
