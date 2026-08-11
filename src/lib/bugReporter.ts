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
  | 'trollopoly'
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
  requestPayload?: Record<string, any>;
  responsePayload?: Record<string, any>;
  browserInfo?: Record<string, any>;
  appContext?: Record<string, any>;
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
  } else if (message.includes('trollopoly')) {
    source = 'trollopoly';
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
    } catch (parseError) {
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
    const { data, error: logError } = await supabase.rpc('log_app_bug_report', {
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
