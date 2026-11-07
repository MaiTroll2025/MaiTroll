import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../lib/store';

export type SecurityEvent = {
  id: string;
  event_type: string;
  title: string;
  description: string | null;
  severity: string;
  status: string;
  user_id: string | null;
  actor_id: string | null;
  target_user_id: string | null;
  stream_id: string | null;
  cashout_id: string | null;
  ip_address: string | null;
  user_agent: string | null;
  device_fingerprint: string | null;
  route: string | null;
  source: string;
  metadata: Record<string, any>;
  risk_score: number;
  reviewed_by: string | null;
  reviewed_at: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
};

export type RiskScore = {
  id: string;
  user_id: string;
  risk_score: number;
  risk_level: string;
  failed_login_count: number;
  suspicious_action_count: number;
  last_event_at: string | null;
  last_ip_address: string | null;
  notes: string | null;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
};

export type RateLimitRow = {
  id: string;
  bucket: string;
  identifier: string;
  user_id: string | null;
  ip_address: string | null;
  action: string;
  hit_count: number;
  window_start: string;
  window_end: string;
  blocked_until: string | null;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
};

export type AuditLogEntry = {
  id: string;
  action: string;
  user_id: string | null;
  target_id: string | null;
  details: any;
  created_at: string;
  ip_address: string | null;
};

export type BugReport = {
  id: string;
  created_at: string;
  updated_at: string;
  status: string;
  severity: string;
  source: string;
  page_url: string | null;
  route_path: string | null;
  user_id: string | null;
  user_email: string | null;
  error_code: string | null;
  error_message: string;
  error_details: string | null;
  stack_trace: string | null;
  browser_info: any;
  app_context: any;
  occurrence_count: number;
  last_seen_at: string;
};

export type PayoutRequest = {
  id: string;
  user_id: string;
  coin_amount: number;
  cash_amount: number;
  status: string;
  created_at: string;
  updated_at: string;
  rejection_reason: string | null;
  amount_usd: number;
  paypal_email: string | null;
};

export type IncidentReport = {
  id: string;
  title: string;
  severity: string;
  status: string;
  created_by: string | null;
  assigned_to: string | null;
  summary: string | null;
  evidence: any;
  actions_taken: any;
  created_at: string;
  updated_at: string;
};

type UseSecurityEventsReturn = {
  events: SecurityEvent[];
  riskScores: RiskScore[];
  rateLimits: RateLimitRow[];
  auditLogs: AuditLogEntry[];
  bugReports: BugReport[];
  payoutRequests: PayoutRequest[];
  incidentReports: IncidentReport[];
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
  resolveEvent: (eventId: string, status: string, note?: string | null) => Promise<void>;
  markFalsePositive: (eventId: string) => Promise<void>;
  ignoreEvent: (eventId: string) => Promise<void>;
};

export const useSecurityEvents = (): UseSecurityEventsReturn => {
  const { user } = useAuthStore();
  const [events, setEvents] = useState<SecurityEvent[]>([]);
  const [riskScores, setRiskScores] = useState<RiskScore[]>([]);
  const [rateLimits, setRateLimits] = useState<RateLimitRow[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [bugReports, setBugReports] = useState<BugReport[]>([]);
  const [payoutRequests, setPayoutRequests] = useState<PayoutRequest[]>([]);
  const [incidentReports, setIncidentReports] = useState<IncidentReport[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const fetchData = useCallback(async () => {
    if (!user) {
      if (mountedRef.current) setLoading(false);
      return;
    }

    if (mountedRef.current) {
      setLoading(true);
      setError(null);
    }

    try {
      const [eventsRes, riskRes, rateRes, auditRes, bugRes, payoutRes, incidentRes] = await Promise.allSettled([
        supabase
          .from('security_events')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(500),
        supabase
          .from('security_user_risk_scores')
          .select('*')
          .order('risk_score', { ascending: false })
          .limit(200),
        supabase
          .from('security_rate_limits')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(200),
        supabase
          .from('audit_logs')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(300),
        supabase
          .from('app_bug_reports')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(300),
        supabase
          .from('payout_requests')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(200),
        supabase
          .from('security_incident_reports')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(100),
      ]);

      if (!mountedRef.current) return;

      const safeSet = <T>(setter: React.Dispatch<React.SetStateAction<T>>, result: PromiseSettledResult<any>) => {
        if (result.status === 'fulfilled' && !result.value.error) {
          setter(result.value.data || []);
        } else if (result.status === 'fulfilled' && result.value.error) {
          console.warn('[useSecurityEvents] Query returned error:', result.value.error.message);
        } else if (result.status === 'rejected') {
          console.warn('[useSecurityEvents] Query failed:', result.reason?.message);
        }
      };

      safeSet(setEvents, eventsRes);
      safeSet(setRiskScores, riskRes);
      safeSet(setRateLimits, rateRes);
      safeSet(setAuditLogs, auditRes);
      safeSet(setBugReports, bugRes);
      safeSet(setPayoutRequests, payoutRes);
      safeSet(setIncidentReports, incidentRes);

      const criticalErrors = [eventsRes, riskRes]
        .filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && r.value.error));
      if (criticalErrors.length === 2) {
        const firstErr = criticalErrors[0];
        const errObj = firstErr.status === 'rejected'
          ? new Error(firstErr.reason?.message || 'Failed to fetch security data')
          : new Error(firstErr.value.error.message);
        setError(errObj);
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(err instanceof Error ? err : new Error('Unknown error fetching security data'));
      }
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (!user) return;

    const eventChannel = supabase
      .channel('security-events-realtime')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'security_events' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setEvents((prev) => [(payload.new as SecurityEvent), ...prev]);
          } else if (payload.eventType === 'UPDATE') {
            setEvents((prev) =>
              prev.map((e) => e.id === (payload.new as SecurityEvent).id ? (payload.new as SecurityEvent) : e)
            );
          } else if (payload.eventType === 'DELETE') {
            setEvents((prev) => prev.filter((e) => e.id !== (payload.old as SecurityEvent).id));
          }
        }
      )
      .subscribe();

    const riskChannel = supabase
      .channel('security-risk-realtime')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'security_user_risk_scores' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setRiskScores((prev) => [(payload.new as RiskScore), ...prev]);
          } else if (payload.eventType === 'UPDATE') {
            setRiskScores((prev) =>
              prev.map((r) => r.user_id === (payload.new as RiskScore).user_id ? (payload.new as RiskScore) : r)
            );
          }
        }
      )
      .subscribe();

    const bugChannel = supabase
      .channel('security-bugs-realtime')
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'app_bug_reports' },
        (payload) => {
          setBugReports((prev) => [(payload.new as BugReport), ...prev]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(eventChannel);
      supabase.removeChannel(riskChannel);
      supabase.removeChannel(bugChannel);
    };
  }, [user]);

  const refresh = useCallback(() => fetchData(), [fetchData]);

  const resolveEvent = async (eventId: string, status: string, note: string | null = null) => {
    const { error } = await supabase.rpc('resolve_security_event', {
      p_event_id: eventId,
      p_status: status,
      p_note: note,
    });
    if (error) throw error;
    await refresh();
  };

  const markFalsePositive = async (eventId: string) => {
    await resolveEvent(eventId, 'false_positive', 'Marked as false positive via Security Command Center');
  };

  const ignoreEvent = async (eventId: string) => {
    await resolveEvent(eventId, 'ignored', 'Ignored via Security Command Center');
  };

  return {
    events,
    riskScores,
    rateLimits,
    auditLogs,
    bugReports,
    payoutRequests,
    incidentReports,
    loading,
    error,
    refresh,
    resolveEvent,
    markFalsePositive,
    ignoreEvent,
  };
};
