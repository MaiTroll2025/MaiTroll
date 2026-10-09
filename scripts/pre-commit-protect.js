/**
 * PRE-COMMIT PROTECTION SCRIPT
 * Prevents accidental changes to critical Mux/broadcast integration files.
 *
 * This script runs before every commit and:
 * 1. Checks if any protected files are being modified
 * 2. Prompts for explicit confirmation if critical files are changed
 * 3. Provides context about what the files do
 * 4. Aborts commit if confirmation is not given
 *
 * Protected files are marked with "CRITICAL STREAMING INFRASTRUCTURE" header comment.
 * DO NOT REMOVE THIS SCRIPT - It protects the Mux/LiveKit integration from breaking.
 */

import { execSync } from 'node:child_process';
import readline from 'node:readline';

// Files that require confirmation before modification
// These are the core files that handle Mux stream creation/teardown
// PLUS the protection infrastructure itself
const PROTECTED_FILES = [
  // Frontend: Mux API callers
  'src/pages/broadcast/SetupPage.tsx',
  'src/pages/broadcast/BroadcastPage.tsx',

  // Hooks: broadcast lifecycle management
  'src/hooks/useBroadcastStreaming.ts',

  // Library: Court session initialization (also calls Mux start)
  'src/lib/courtSessions.ts',

  // Backend: Mux service and routing
  'server/index.js',
  'server/api/broadcasts.js',
  'server/routes/broadcasts.ts',
  'server/services/muxService.js',
  'server/index.ts',

  // Edge Functions (Supabase)
  'supabase/functions/live/index.ts',

  // Protection infrastructure
  '.githooks/pre-commit',
  'scripts/pre-commit-protect.js',
  'scripts/setup-githooks.js',

  // Configuration/docs that define endpoints
  'MUX_CDN_INTEGRATION_GUIDE.md',
  'BACKEND_URL_CONFIG.md',
];

// Friendly descriptions for each protected file
const FILE_DESCRIPTIONS = {
  'src/pages/broadcast/SetupPage.tsx':
    'Initializes Mux stream when broadcaster clicks "Go Live". This page calls the backend API to create the Mux live stream and LiveKit egress. Changing this breaks stream start.',

   'src/pages/broadcast/BroadcastPage.tsx':
     'Stops Mux stream and LiveKit egress when broadcast ends. Changing this can leave orphaned Mux streams incurring charges.',

   'src/hooks/useBroadcastStreaming.ts':
     'React hook for broadcast lifecycle (start/stop/status). Encapsulates calls to /api/broadcasts/start-streaming and /api/broadcasts/stop-streaming. Used by various broadcast components.',

   'src/lib/courtSessions.ts':
    'Initializes Mux streams for Troll Court sessions. Calls /api/broadcasts/start-streaming. Changing this breaks court streaming functionality.',

  'server/index.js':
    'Main Express server - defines API routes. The /api/broadcasts/start-streaming and /api/broadcasts/stop-streaming endpoints are mapped here. Changing routes breaks frontend-backend communication.',

  'server/api/broadcasts.js':
    'Core broadcast handler - creates Mux streams via API, starts LiveKit egress, updates database. This is the heart of the streaming pipeline. Changing this will break all broadcasts.',

  'server/routes/broadcasts.ts':
    'TypeScript route definitions (reference only). The running server uses server/api/broadcasts.js, not this file. However, this file documents the intended API contract and should match.',

   'server/services/muxService.js':
     'Mux API service wrapper - contains Mux client initialization and API calls. Changing this affects all Mux interactions.',

   'server/index.ts':
     'TypeScript entry point for development server (tsx). Defines the same routes as server/index.js but in TS. Changing this affects dev environment.',

   'supabase/functions/live/index.ts':
     'Supabase Edge Function for live stream creation (viewer-facing). Also creates Mux streams for certain workflows. Changing this affects stream availability.',

   // Protection infrastructure
   '.githooks/pre-commit':
     'Git pre-commit hook that enforces protection on critical files. Disabling this removes the safety check.',

   'scripts/pre-commit-protect.js':
     'Core protection logic - defines which files are protected and prompts for confirmation. Tampering bypasses the protection.',

   'scripts/setup-githooks.js':
     'Installs the pre-commit hook by setting core.hooksPath. Prevents accidental bypass.',

   'MUX_CDN_INTEGRATION_GUIDE.md':
    'Documentation of Mux integration architecture. Changing this without updating code causes documentation drift.',

  'BACKEND_URL_CONFIG.md':
    'Documents backend endpoint URLs. Changing this without updating frontend calls breaks routing.',
};

function getStagedFiles() {
  try {
    const output = execSync('git diff --cached --name-only', { encoding: 'utf-8' });
    return output.split('\n').filter(f => f.trim());
  } catch (err) {
    console.error('Error getting staged files:', err.message);
    process.exit(1);
  }
}

function getModifiedProtectedFiles(stagedFiles) {
  return stagedFiles.filter(file =>
    PROTECTED_FILES.some(protectedPath =>
      file === protectedPath || file.startsWith(protectedPath + '/')
    )
  );
}

function promptConfirmation(files) {
  console.log('\n╔═══════════════════════════════════════════════════════════════════════╗');
  console.log('║           🛡️  PROTECTED FILES MODIFICATION REQUIRES APPROVAL          ║');
  console.log('╚═══════════════════════════════════════════════════════════════════════╝\n');

  console.log('The following critical streaming infrastructure files are staged for commit:\n');

  files.forEach((file, index) => {
    const desc = FILE_DESCRIPTIONS[file] || 'Critical system file';
    console.log(`  ${index + 1}. ${file}`);
    console.log(`     └─ ${desc}\n`);
  });

  console.log('⚠️  WARNING: Modifying these files can:');
  console.log('   • Break live streaming for all broadcasters');
  console.log('   • Cause Mux service disruptions or unexpected charges');
  console.log('   • Create orphaned LiveKit egress processes');
  console.log('   • Introduce routing mismatches between frontend and backend\n');

  console.log('Do you confirm these changes are correct and tested?');
  console.log('  Type YES to confirm, or any other key to abort commit.\n');

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise(resolve => {
    rl.question('Confirm (YES/NO): ', (answer) => {
      rl.close();
      resolve(answer.trim().toUpperCase() === 'YES');
    });
  });
}

async function run() {
  const stagedFiles = getStagedFiles();

  if (stagedFiles.length === 0) {
    // Nothing to commit
    process.exit(0);
  }

  const protectedFiles = getModifiedProtectedFiles(stagedFiles);

  if (protectedFiles.length === 0) {
    // No protected files modified, allow commit
    process.exit(0);
  }

  const confirmed = await promptConfirmation(protectedFiles);

  if (!confirmed) {
    console.log('\n❌ Commit aborted. Protected file changes require explicit confirmation.');
    console.log('   Review your changes with: git diff --cached\n');
    process.exit(1);
  }

  console.log('\n✅ Confirmed. Proceeding with commit.\n');
  process.exit(0);
}

run().catch(err => {
  console.error('Pre-commit protection script error:', err);
  process.exit(1);
});
