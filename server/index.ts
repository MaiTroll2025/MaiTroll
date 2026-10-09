/**
 * Main Express Server Entry Point
 * Starts the API server for broadcast streaming
 * 
 * Usage:
 *   npm run server
 *   or
 *   node server/index.js
 */

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';
import broadcastRoutes from './routes/broadcasts.ts';
import ghostModeRoutes from './api/ghost-mode.js';

/* ============================================================================
 * 🛡️  CRITICAL STREAMING INFRASTRUCTURE - PROTECTED
 *
 * Main Express Server Entry Point (TypeScript version).
 * Defines API routes for LiveKit streaming.
 *
 * Key endpoints:
 *   POST /api/broadcasts/start-streaming → starts egress
 *   POST /api/broadcasts/stop-streaming  → stops egress
 *   GET  /api/broadcasts/:streamId/status → status check
 *
 * DO NOT modify route paths without coordinating with frontend.
 *
 * PROTECTION: This file is monitored by pre-commit hook.
 * Any changes require explicit confirmation during commit.
 * ============================================================================ */

const app = express();
const port = process.env.PORT || 3002;

// Supabase client for JWT verification
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Middleware
app.use(cors({
  origin: [
    'http://localhost:5178',
    'http://localhost:3002',
    'http://127.0.0.1:5178',
    process.env.FRONTEND_URL || 'http://localhost:5178',
  ],
  credentials: true,
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Logging middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── JWT Authentication Middleware ──────────────────────────────────────────
// Verifies the Supabase JWT from the Authorization header and attaches the
// authenticated user to the request. Used to protect broadcast and ghost-mode
// endpoints from unauthenticated access.
async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header' });
  }

  const token = authHeader.slice(7); // strip "Bearer "

  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  } catch (err) {
    console.error('[requireAuth] Token verification failed:', err.message);
    return res.status(401).json({ error: 'Token verification failed' });
  }
}

// ── CEO / Admin Authorization Check ────────────────────────────────────────
// After requireAuth, checks whether the authenticated user is a CEO or admin.
async function requireCEO(req, res, next) {
  try {
    const { data: profile, error } = await supabase
      .from('user_profiles')
      .select('role, is_admin, is_ceo')
      .eq('id', req.user.id)
      .maybeSingle();

    if (error) throw error;

    const isCEO = !!(profile?.is_ceo || profile?.role === 'ceo' || profile?.is_admin);
    if (!isCEO) {
      return res.status(403).json({ error: 'Only CEOs can perform this action' });
    }
    req.user.isCEO = true;
    next();
  } catch (err) {
    console.error('[requireCEO] CEO check failed:', err.message);
    return res.status(500).json({ error: 'Failed to verify CEO status' });
  }
}

// ── Broadcast Owner Authorization ──────────────────────────────────────────
// Verifies the authenticated user is the broadcaster (or an admin/CEO).
async function requireBroadcaster(req, res, next) {
  const broadcasterId = req.body?.broadcasterId;
  if (!broadcasterId) {
    return res.status(400).json({ error: 'broadcasterId is required' });
  }

  if (broadcasterId !== req.user.id) {
    // Allow admins/CEOs to act on behalf of other broadcasters
    const { data: profile, error } = await supabase
      .from('user_profiles')
      .select('role, is_admin, is_ceo')
      .eq('id', req.user.id)
      .maybeSingle();

    if (error) throw error;

    const isAdmin = !!(profile?.is_ceo || profile?.role === 'ceo' || profile?.is_admin);
    if (!isAdmin) {
      return res.status(403).json({ error: 'You can only manage your own broadcasts' });
    }
  }
  next();
}

// Broadcast API routes — protected with JWT auth
app.post('/api/broadcasts/start-streaming', requireAuth, requireBroadcaster, broadcastRoutes.startBroadcast);
app.post('/api/broadcasts/stop-streaming', requireAuth, requireBroadcaster, broadcastRoutes.stopBroadcast);
app.get('/api/broadcasts/:streamId/status', requireAuth, broadcastRoutes.getBroadcastStatus);

// Ghost Mode API routes — protected with JWT auth + CEO check
app.post('/api/ghost-mode/create', requireAuth, requireCEO, ghostModeRoutes.createGhostSession);
app.post('/api/ghost-mode/leave', requireAuth, ghostModeRoutes.leaveGhostSession);
app.get('/api/ghost-mode/sessions', requireAuth, ghostModeRoutes.getGhostSessions);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Error handler
app.use((err, req, res, _next) => {
  console.error('[Server Error]', err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
});

// Start server
app.listen(port, () => {
console.log(`
 ╔═══════════════════════════════════════╗
 ║   Mai Troll Broadcast API Server     ║
 ╚═══════════════════════════════════════╝

✓ Server running on http://localhost:${port}
✓ CORS enabled for frontend development

Environment:
- NODE_ENV: ${process.env.NODE_ENV || 'development'}
- SUPABASE_URL: ${process.env.SUPABASE_URL ? 'configured' : 'MISSING'}

Health check: GET /health
Broadcast APIs:
  POST /api/broadcasts/start-streaming
  POST /api/broadcasts/stop-streaming
  GET  /api/broadcasts/:streamId/status
Ghost Mode APIs:
  POST /api/ghost-mode/create
  POST /api/ghost-mode/leave
  GET  /api/ghost-mode/sessions
  `);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully...');
  process.exit(0);
});

export default app;
