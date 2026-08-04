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

// Broadcast API routes
app.post('/api/broadcasts/start-streaming', broadcastRoutes.startBroadcast);
app.post('/api/broadcasts/stop-streaming', broadcastRoutes.stopBroadcast);
app.get('/api/broadcasts/:streamId/status', broadcastRoutes.getBroadcastStatus);

// Ghost Mode API routes
app.post('/api/ghost-mode/create', ghostModeRoutes.createGhostSession);
app.post('/api/ghost-mode/leave', ghostModeRoutes.leaveGhostSession);
app.get('/api/ghost-mode/sessions', ghostModeRoutes.getGhostSessions);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Error handler
app.use((err, req, res, next) => {
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
