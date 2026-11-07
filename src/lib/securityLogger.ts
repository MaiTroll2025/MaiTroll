import { supabase } from './supabase';

/**
 * Safely get client context for security logging
 * Collects only privacy-conscious client info
 */
export const safeGetClientContext = () => {
  if (typeof window === 'undefined') return {};

  // Get route/pathname - we'll use window.location
  const pathname = window.location.pathname;
  
  // Get userAgent
  const userAgent = navigator.userAgent;
  
  // Get online status
  const online = navigator.onLine;
  
  // Timestamp
  const timestamp = new Date().toISOString();
  
  // Optional anonymous device ID from localStorage
  let deviceId = localStorage.getItem('tc_device_audit_id');
  if (!deviceId) {
    deviceId = crypto.randomUUID();
    localStorage.setItem('tc_device_audit_id', deviceId);
  }

  return {
    route: pathname,
    userAgent,
    online,
    timestamp,
    deviceId: deviceId, // This is anonymous and for abuse detection only
  };
};

/**
 * Log a security event
 * @param payload - The security event data
 */
export const logSecurityEvent = async (payload: {
  event_type: string;
  title: string;
  description?: string;
  severity?: 'low' | 'medium' | 'high' | 'critical';
  risk_score?: number;
  metadata?: Record<string, any>;
  user_id?: string;
  actor_id?: string;
  target_user_id?: string;
  stream_id?: string;
  cashout_id?: string;
  route?: string;
  source?: 'frontend' | 'backend';
}) => {
  try {
    // Get client context
    const clientContext = safeGetClientContext();
    
    // Prepare the event data
    const eventData = {
      event_type: payload.event_type,
      title: payload.title,
      description: payload.description || null,
      severity: payload.severity || 'low',
      risk_score: payload.risk_score || 0,
      metadata: {
        ...payload.metadata,
        ...clientContext,
        // Add any additional context from payload
        user_id: payload.user_id,
        actor_id: payload.actor_id,
        target_user_id: payload.target_user_id,
        stream_id: payload.stream_id,
        cashout_id: payload.cashout_id,
        route: payload.route,
        source: payload.source || 'frontend',
      },
      user_id: payload.user_id || null,
      actor_id: payload.actor_id || null,
      target_user_id: payload.target_user_id || null,
      stream_id: payload.stream_id || null,
      cashout_id: payload.cashout_id || null,
      ip_address: payload.metadata?.ip_address || null,
      user_agent: payload.metadata?.userAgent || null,
      device_fingerprint: payload.metadata?.deviceId || null,
      route: payload.route || clientContext.route,
      source: payload.source || 'frontend',
    };

    // Call the Supabase RPC to log the security event
    const { data, error } = await supabase.rpc('log_security_event', {
      p_event_type: eventData.event_type,
      p_severity: eventData.severity,
      p_user_id: eventData.user_id,
      p_actor_id: eventData.actor_id,
      p_target_user_id: eventData.target_user_id,
      p_stream_id: eventData.stream_id,
      p_cashout_id: eventData.cashout_id,
      p_route: eventData.route,
      p_source: eventData.source,
      p_title: eventData.title,
      p_description: eventData.description,
      p_metadata: eventData.metadata,
      p_risk_score: eventData.risk_score,
    });

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Failed to log security event:', error);
    throw error;
  }
};

/**
 * Log a suspicious action
 * @param type - The type of suspicious action
 * @param metadata - Additional metadata
 */
export const logSuspiciousAction = async (type: string, metadata: Record<string, any> = {}) => {
  await logSecurityEvent({
    event_type: `suspicious_action_${type}`,
    title: `Suspicious Action: ${type}`,
    description: `Detected suspicious action of type ${type}`,
    severity: 'medium',
    risk_score: 25,
    metadata,
  });
};

/**
 * Log an admin action
 * @param action - The admin action performed
 * @param metadata - Additional metadata
 */
export const logAdminAction = async (action: string, metadata: Record<string, any> = {}) => {
  await logSecurityEvent({
    event_type: `admin_action_${action}`,
    title: `Admin Action: ${action}`,
    description: `Admin performed action: ${action}`,
    severity: 'low',
    risk_score: 0,
    metadata: {
      ...metadata,
      admin_action: true,
    },
  });
};