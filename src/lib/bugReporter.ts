import { supabase } from '../lib/supabase';
import { useAuthStore } from '../lib/store';

// ============================================================================
// Types
// ============================================================================

export type BugSource =
  | 'frontend'
  | 'supabase'
  | 'edge_function'
  | 'realtime'
  | 'rls'
  | 'schema_cache'
  | 'broadcast'
  | 'gifts'
  | 'trollcourt'
  | 'insurance'
  | 'neighborhood'
  | 'livekit'
  | 'payout'
  | 'admin'
  | 'unknown';

export type BugSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface BugContext {
  table?: string;
  action?: 'select' | 'insert' | 'update' | 'delete' | 'rpc';
  page?: string;
  streamId?: string;
  functionName?: string;
  [key: string]: any;
}

export interface BugReport {
  id?: string;
  source: BugSource;
  severity: BugSeverity;
  pageUrl?: string;
  routePath?: string;
  userId?: string;
  userEmail?: string;
  userRole?: string;
  username?: string | null;
  streamId?: string;
  functionName?: string;
  tableName?: string;
  errorCode?: string;
  errorMessage: string;
  errorDetails?: string;
  errorHint?: string;
  stackTrace?: string;
  fileDebug?: string;
  requestPayload?: Record<string, any>;
  responsePayload?: Record<string, any>;
  browserInfo?: Record<string, any>;
  appContext?: Record<string, any>;
}

// ============================================================================
// File / Line debugging utilities
// ============================================================================

export interface StackFrame {
  functionName: string | null;
  fileName: string;
  lineNumber: number | null;
  columnNumber: number | null;
  raw: string;
}

const VENDOR_RE = /(node_modules|vendor-react|vendor-|polyfills|\.map)/;
const REACT_INTERNAL_RE = /\/\/(react|scheduler|use-subscription)/;

function isAppFrame(frame: StackFrame): boolean {
  return !VENDOR_RE.test(frame.fileName) && !REACT_INTERNAL_RE.test(frame.fileName);
}

export function parseErrorStack(stack?: string | null): StackFrame[] {
  if (!stack) return [];

  const lines = stack.split('\n');
  const frames: StackFrame[] = [];

  for (const line of lines) {
    // Skip the leading "ErrorName: message" line — it is not a frame.
    if (/^\s*(Error|TypeError|RangeError|ReferenceError|SyntaxError|EvalError|URIError)/.test(line)) {
      continue;
    }

    // V8 / Chromium formats:
    //   "    at fnName (url:line:col)"
    //   "    at url:line:col"
    const m = line.match(/^\s*at\s+(?:(.+?)\s+\((.+):(\d+):(\d+)\)|(.+):(\d+):(\d+))\s*$/);
    if (!m) continue;

    let functionName: string | null = null;
    let fileName: string;
    let lineNumber: number | null;
    let columnNumber: number | null;

    if (m[1]) {
      functionName = m[1] || null;
      fileName = m[2];
      lineNumber = parseInt(m[3], 10);
      columnNumber = parseInt(m[4], 10);
    } else {
      fileName = m[5];
      lineNumber = parseInt(m[6], 10);
      columnNumber = parseInt(m[7], 10);
    }

    if (!fileName) continue;

    frames.push({ functionName, fileName, lineNumber, columnNumber, raw: line.trim() });
  }

  return frames;
}

export function extractFileDebugInfo(error: any): string {
  const stack = typeof error?.stack === 'string' ? error.stack : '';
  const frames = parseErrorStack(stack);
  if (frames.length === 0) return '';

  const lines: string[] = [];
  lines.push(`Page: ${getCurrentPageUrl()}`);
  lines.push(`Route: ${getCurrentRoute()}`);
  lines.push('');
  lines.push('Source frames (top = origin of crash):');

  // Top 3 frames get full detail; the rest are shown compactly so the
  // developer can see the exact file:line:column that caused the crash
  // without wading through minified React internals.
  const primaryFrames = frames.slice(0, 3);
  const appOnlyFrames = frames.filter(isAppFrame).slice(0, 3);

  primaryFrames.forEach((frame, idx) => {
    const prefix = idx === 0 ? 'FRAME 1 (crash origin)' : `Frame ${idx + 1}`;
    lines.push(
      `${prefix}: ${frame.functionName || '<anonymous>'} @ ${frame.fileName}:${frame.lineNumber}:${frame.columnNumber}`,
    );
  });

  if (appOnlyFrames.length > 0 && appOnlyFrames.some((f) => !primaryFrames.includes(f))) {
    lines.push('');
    lines.push('Application frames:');
    appOnlyFrames.forEach((frame) => {
      lines.push(
        `  ${frame.functionName || '<anonymous>'} @ ${frame.fileName}:${frame.lineNumber}:${frame.columnNumber}`,
      );
    });
  }

  lines.push('');
  lines.push('Full stack:');
  frames.forEach((frame, idx) => {
    lines.push(`  ${idx + 1}. ${frame.raw}`);
  });

  return lines.join('\n');
}

// ============================================================================
// Utilities
// ============================================================================

function getCurrentRoute(): string {
  try {
    return window.location.pathname + window.location.search;
  } catch {
    return '/unknown';
  }
}

function getCurrentPageUrl(): string {
  try {
    return window.location.href;
  } catch {
    return '/unknown';
  }
}

function getBrowserInfo(): Record<string, any> {
  try {
    return {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      language: navigator.language,
      cookieEnabled: navigator.cookieEnabled,
      onLine: navigator.onLine,
      screen: {
        width: window.screen?.width,
        height: window.screen?.height,
      },
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight,
      },
    };
  } catch {
    return {};
  }
}

function getAppContext(): Record<string, any> {
  try {
    const state = useAuthStore.getState();
    return {
      authenticated: !!state.user,
      userId: state.user?.id,
      profile: state.profile ? {
        username: state.profile.username,
        role: state.profile.role,
        trollRole: state.profile.troll_role,
      } : null,
      isMobile: /Mobi|Android/i.test(navigator.userAgent),
      timestamp: new Date().toISOString(),
    };
  } catch {
    return {};
  }
}

function maskSensitiveData(obj: any): any {
  if (!obj || typeof obj !== 'object') return obj;

  const sensitiveKeys = [
    'token', 'access_token', 'refresh_token', 'api_key', 'apikey', 'secret',
    'password', 'pwd', 'pass', 'authorization', 'auth', 'key', 'private',
    'credential', 'cookie', 'session', 'jwt', 'bearer', 'livekit',
    'stripe', 'paypal', 'square', 'supabase', 'service_role'
  ];

  const mask = (value: any): any => {
    if (typeof value !== 'object' || value === null) return value;
    if (Array.isArray(value)) return value.map(mask);

    const result: any = {};
    for (const [k, v] of Object.entries(value)) {
      const lowerK = k.toLowerCase();
      if (sensitiveKeys.some(sk => lowerK.includes(sk))) {
        result[k] = '***REDACTED***';
      } else if (typeof v === 'object' && v !== null) {
        result[k] = mask(v);
      } else {
        result[k] = v;
      }
    }
    return result;
  };

  return mask(obj);
}

let isReportingBug = false;

export function normalizeError(error: any): {
  message: string;
  code?: string;
  details?: string;
  hint?: string;
  stack?: string;
} {
  if (!error) {
    return { message: 'Unknown error (null/undefined)' };
  }

  // Network/AbortError
  if (error.name === 'AbortError') {
    return {
      message: 'Network request was aborted (user cancelled or timeout)',
      code: 'ABORT_ERROR',
      stack: error.stack,
    };
  }

  // TypeError (usually network-related)
  if (error.name === 'TypeError') {
    const message = error.message || '';
    let code = 'TYPE_ERROR';
    let details = 'Network or request construction error';
    
    if (message.includes('fetch') || message.includes('Failed to fetch')) {
      code = 'NETWORK_ERROR';
      details = 'Failed to connect to server. Check internet connection and CORS settings.';
    }
    
    return {
      message: `${error.name}: ${message}`,
      code,
      details,
      stack: error.stack,
    };
  }

  // Supabase error
  if (error.message) {
    return {
      message: error.message,
      code: error.code || error.status?.toString(),
      details: error.details,
      hint: error.hint,
      stack: error.stack,
    };
  }

  // Fetch/Response error
  if (error.statusText) {
    return {
      message: `${error.status} ${error.statusText}`,
      code: error.status?.toString(),
      details: error.body,
    };
  }

  // Generic error object
  return {
    message: String(error.message || error),
    code: error.code || error.name,
    details: error.details,
    hint: error.hint,
    stack: error.stack,
  };
}

// ============================================================================
// Report Functions
// ============================================================================

/**
 * Report a generic frontend error
 */
export async function reportBug(
  error: any,
  context: BugContext = {}
): Promise<void> {
  if (isReportingBug) return;
  try {
    isReportingBug = true;
    const normalized = normalizeError(error);
    const user = useAuthStore.getState().user;
    const profile = useAuthStore.getState().profile;

    const report: BugReport = {
      source: context.source || 'frontend',
      severity: context.severity || (normalized.message.includes('critical') ? 'critical' : 'high'),
      pageUrl: getCurrentPageUrl(),
      routePath: getCurrentRoute(),
      userId: user?.id,
      userEmail: user?.email || profile?.email,
      userRole: profile?.role || profile?.troll_role,
      username: profile?.username || profile?.display_name || user?.email?.split('@')[0] || null,
      streamId: context.streamId,
      functionName: context.functionName,
      tableName: context.table,
      errorCode: normalized.code,
      errorMessage: normalized.message,
      errorDetails: normalized.details,
      errorHint: normalized.hint,
       stackTrace: normalized.stack,
       fileDebug: extractFileDebugInfo(error),
       browserInfo: getBrowserInfo(),
       appContext: getAppContext(),
     };

    // Fire-and-forget to not block user flow
    void sendBugReport(report);
  } catch {
    // Silently fail — bug reporting is non-critical
  } finally {
    isReportingBug = false;
  }
}

function toDbPayload(report: BugReport): Record<string, any> {
  return {
    source: report.source,
    severity: report.severity,
    page_url: report.pageUrl,
    route_path: report.routePath,
    user_id: report.userId,
    user_email: report.userEmail,
    user_role: report.userRole,
    username: report.username,
    stream_id: report.streamId,
    function_name: report.functionName,
    table_name: report.tableName,
    error_code: report.errorCode,
    error_message: report.errorMessage,
    error_details: report.errorDetails,
    error_hint: report.errorHint,
     stack_trace: report.stackTrace,
     file_debug: report.fileDebug,
     request_payload: report.requestPayload,
     response_payload: report.responsePayload,
     browser_info: report.browserInfo,
     app_context: report.appContext,
   };
}

async function sendBugReport(report: BugReport): Promise<void> {
  try {
    // Use direct fetch instead of supabase.rpc() to avoid infinite loop:
    // supabase.rpc() failures get caught by the global fetch wrapper which
    // calls reportBug() -> sendBugReport() again. Direct fetch lets the
    // global wrapper's isBugReporterRequest() check skip it.
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://gejtbllazzighxwxudyu.supabase.co';
    const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
    await fetch(`${supabaseUrl}/rest/v1/rpc/log_app_bug_report`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
      },
      body: JSON.stringify({ payload: maskSensitiveData(toDbPayload(report)) }),
    });
  } catch {
    // Silently fail — bug reporting is non-critical and must not cause recursion
  }
}

/**
 * Report Supabase-specific errors with auto-detected source
 */
export async function reportSupabaseError(
  error: any,
  context: BugContext = {}
): Promise<void> {
  const normalized = normalizeError(error);
  let source: BugSource = 'supabase';
  let severity: BugSeverity = 'medium';
  const errorCode = normalized.code;

  const message = normalized.message.toLowerCase();

  // Auto-detect error source
  if (message.includes('schema cache') || message.includes('cache')) {
    source = 'schema_cache';
    severity = 'high';
  } else if (message.includes('row-level security') || message.includes('rls') || message.includes('permission denied')) {
    source = 'rls';
    severity = 'medium';
  } else if (message.includes('function') && message.includes('does not exist')) {
    source = 'edge_function';
    severity = 'high';
  } else if (message.includes('realtime') || message.includes('channel')) {
    source = 'realtime';
    severity = 'medium';
  } else if (message.includes('broadcast')) {
    source = 'broadcast';
    severity = context.severity || 'medium';
  } else if (message.includes('gift')) {
    source = 'gifts';
    severity = context.severity || 'low';
  } else if (message.includes('court') || message.includes('trollcourt')) {
    source = 'trollcourt';
    severity = context.severity || 'medium';
  } else if (message.includes('insurance')) {
    source = 'insurance';
    severity = context.severity || 'medium';
  } else if (message.includes('neighborhood') || message.includes('house') || message.includes('vehicle')) {
    source = 'neighborhood';
    severity = context.severity || 'medium';
  }

  try {
    const user = useAuthStore.getState().user;
    const profile = useAuthStore.getState().profile;

    const report: BugReport = {
      source,
      severity,
      pageUrl: getCurrentPageUrl(),
      routePath: getCurrentRoute(),
      userId: user?.id,
      userEmail: user?.email || profile?.email,
      userRole: profile?.role || profile?.troll_role,
      streamId: context.streamId,
      functionName: context.functionName,
      tableName: context.table,
      errorCode: errorCode,
      errorMessage: normalized.message,
      errorDetails: normalized.details,
      errorHint: normalized.hint,
       stackTrace: normalized.stack,
       fileDebug: extractFileDebugInfo(error),
       requestPayload: maskSensitiveData(context.requestPayload),
       responsePayload: maskSensitiveData(context.responsePayload),
       browserInfo: getBrowserInfo(),
       appContext: getAppContext(),
     };

    void sendBugReport(report);
  } catch (e) {
    console.error('reportSupabaseError internal error:', e);
  }
}

/**
 * Report fetch/network errors
 */
export async function reportFetchError(
  response: Response,
  rawText: string,
  context: BugContext = {}
): Promise<void> {
  const message = `HTTP ${response.status} ${response.statusText}`;
  let details = rawText.substring(0, 500);
  let parsedResponse: Record<string, any> | null = null;
  let source: BugSource = context.source || 'frontend';
  let severity: BugSeverity = context.severity || (response.status >= 500 ? 'high' : 'medium');

  try {
    parsedResponse = JSON.parse(rawText);
    details = JSON.stringify(parsedResponse, null, 2).substring(0, 1000);
  } catch {
    // Keep as text
  }

  const lowerDetails = details.toLowerCase();
  const responseUrl = response.url || '';
  if (lowerDetails.includes('schema cache') || parsedResponse?.code === 'PGRST204') {
    source = 'schema_cache';
    severity = 'high';
  } else if (parsedResponse?.code?.startsWith?.('PGRST') || responseUrl.includes('/rest/v1/')) {
    source = 'supabase';
  } else if (lowerDetails.includes('row-level security') || lowerDetails.includes('rls')) {
    source = 'rls';
  }

  try {
    const user = useAuthStore.getState().user;
    const profile = useAuthStore.getState().profile;

    const report: BugReport = {
      source,
      severity,
      pageUrl: getCurrentPageUrl(),
      routePath: getCurrentRoute(),
      userId: user?.id,
      userEmail: user?.email || profile?.email,
      userRole: profile?.role || profile?.troll_role,
      functionName: context.functionName,
      tableName: context.table,
      errorCode: parsedResponse?.code || response.status.toString(),
      errorMessage: parsedResponse?.message || message,
      errorDetails: details,
      errorHint: parsedResponse?.hint,
      fileDebug: `Page: ${getCurrentPageUrl()}\nRoute: ${getCurrentRoute()}\nHTTP ${response.status} ${response.statusText}\nURL: ${responseUrl || ''}`,
      requestPayload: maskSensitiveData(context.requestPayload),
      responsePayload: maskSensitiveData(parsedResponse || { rawText: rawText.substring(0, 500), url: responseUrl }),
      browserInfo: getBrowserInfo(),
      appContext: getAppContext(),
    };

    void sendBugReport(report);
  } catch (e) {
    console.error('reportFetchError internal error:', e);
  }
}

/**
 * Report realtime/subscription errors
 */
export async function reportRealtimeError(
  error: any,
  context: BugContext = {}
): Promise<void> {
  try {
    const normalized = normalizeError(error);
    const user = useAuthStore.getState().user;
    const profile = useAuthStore.getState().profile;

    const report: BugReport = {
      source: 'realtime',
      severity: context.severity || 'high',
      pageUrl: getCurrentPageUrl(),
      routePath: getCurrentRoute(),
      userId: user?.id,
      userEmail: user?.email || profile?.email,
      userRole: profile?.role || profile?.troll_role,
      streamId: context.streamId,
      functionName: context.functionName,
       errorCode: normalized.code,
       errorMessage: normalized.message,
       errorDetails: normalized.details,
       stackTrace: normalized.stack,
       fileDebug: extractFileDebugInfo(error),
       browserInfo: getBrowserInfo(),
       appContext: getAppContext(),
     };

    void sendBugReport(report);
  } catch (e) {
    console.error('reportRealtimeError internal error:', e);
  }
}

/**
 * Safe JSON fetch wrapper that logs invalid responses
 */
export async function safeJsonFetch<T>(
  url: string,
  options: RequestInit = {},
  context: BugContext = {}
): Promise<{ data: T | null; error: string | null; rawResponse?: string }> {
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    const rawText = await response.text();

    if (!response.ok) {
      // Log the server's actual response, not just the status
      await reportFetchError(response, rawText, {
        ...context,
        source: context.source || 'frontend',
        functionName: context.functionName || 'safeJsonFetch',
      });
      return { data: null, error: rawText.substring(0, 500), rawResponse: rawText };
    }

    let data: T;
    try {
      data = JSON.parse(rawText) as T;
    } catch (_parseError) {
      const parseErrMsg = `Invalid JSON response: ${rawText.substring(0, 200)}`;
      await reportBug(new Error(parseErrMsg), {
        ...context,
        severity: 'high',
        functionName: context.functionName || 'safeJsonFetch',
      });
      return { data: null, error: parseErrMsg, rawResponse: rawText };
    }

    return { data, error: null };
  } catch (networkError: any) {
    await reportBug(networkError, {
      ...context,
      severity: 'high',
      functionName: context.functionName || 'safeJsonFetch',
    });
    return { data: null, error: networkError.message };
  }
}

// ============================================================================
// Edge Function helper (to be imported in Edge Functions)
// ============================================================================

/**
 * Helper for Edge Functions to log errors to Bug Center
 * Call this from within any Edge Function when catching errors
 */
export async function logEdgeFunctionError(
  functionName: string,
  error: any,
  context: Record<string, any> = {}
): Promise<void> {
  try {
    const normalized = normalizeError(error);
    const { data: _data, error: logError } = await supabase.rpc('log_app_bug_report', {
      payload: {
        source: 'edge_function',
        severity: 'high',
        function_name: functionName,
        error_message: normalized.message,
        error_code: normalized.code,
        error_details: normalized.details,
        error_hint: normalized.hint,
        stack_trace: normalized.stack,
        app_context: {
          ...context,
          edge_function: functionName,
        },
      },
    });

    if (logError) {
      console.error('Failed to log edge function error:', logError);
    }
  } catch (e) {
    console.error('logEdgeFunctionError internal error:', e);
  }
}
