/**
 * useStaffAudit Hook
 *
 * Provides access to the staff action audit log for the Staff Audit Dashboard.
 * Fetches audit entries, summaries, and permission matrix data.
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../lib/store';

// ─── Types ───────────────────────────────────────────────────

export interface StaffAuditEntry {
  id: string;
  staff_user_id: string;
  staff_role: string;
  staff_email: string;
  action_type: string;
  action_category: string;
  target_type: string | null;
  target_id: string | null;
  target_name: string | null;
  details: Record<string, unknown>;
  route_path: string | null;
  result: string;
  error_message: string | null;
  created_at: string;
}

export interface StaffAuditSummary {
  staff_role: string;
  action_type: string;
  action_count: number;
  last_action: string;
  denied_count: number;
}

export interface PermissionEntry {
  id: string;
  role_name: string;
  resource: string;
  permission: string;
  conditions: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface StaffAuditFilters {
  staffRole?: string;
  actionType?: string;
  actionCategory?: string;
  targetType?: string;
  result?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
}

type ActionLogRow = {
  id: string;
  user_id: string;
  data: unknown;
  created_at: string;
};

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function textValue(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function normalizeActionLog(row: ActionLogRow): StaffAuditEntry {
  const data = objectValue(row.data);
  return {
    id: row.id,
    staff_user_id: textValue(data.staff_user_id, row.user_id),
    staff_role: textValue(data.staff_role, 'unknown'),
    staff_email: textValue(data.staff_email),
    action_type: textValue(data.action_type, textValue(data.action, 'unknown')),
    action_category: textValue(data.action_category, 'unknown'),
    target_type: textValue(data.target_type) || null,
    target_id: textValue(data.target_id) || null,
    target_name: textValue(data.target_name) || null,
    details: objectValue(data.details),
    route_path: textValue(data.route_path) || null,
    result: textValue(data.result, 'unknown'),
    error_message: textValue(data.error_message) || null,
    created_at: row.created_at,
  };
}

// ─── Hook ────────────────────────────────────────────────────

export function useStaffAudit(filters?: StaffAuditFilters) {
  const { profile } = useAuthStore();
  const [entries, setEntries] = useState<StaffAuditEntry[]>([]);
  const [summary, setSummary] = useState<StaffAuditSummary[]>([]);
  const [permissions, setPermissions] = useState<PermissionEntry[]>([]);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(0);
  const pageSize = 50;

  const isAdmin =
    profile?.is_admin ||
    profile?.role === 'admin' ||
    profile?.role === 'superadmin' ||
    profile?.role === 'ceo';

  // Fetch audit entries
  const fetchEntries = useCallback(async () => {
    if (!profile || !isAdmin) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      let query = supabase
        .from('action_logs')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (filters?.staffRole) {
        query = query.filter('data->>staff_role', 'eq', filters.staffRole);
      }
      if (filters?.actionType) {
        query = query.filter('data->>action_type', 'eq', filters.actionType);
      }
      if (filters?.actionCategory) {
        query = query.filter('data->>action_category', 'eq', filters.actionCategory);
      }
      if (filters?.targetType) {
        query = query.filter('data->>target_type', 'eq', filters.targetType);
      }
      if (filters?.result) {
        query = query.filter('data->>result', 'eq', filters.result);
      }
      if (filters?.dateFrom) {
        query = query.gte('created_at', filters.dateFrom);
      }
      if (filters?.dateTo) {
        query = query.lte('created_at', filters.dateTo);
      }
      if (filters?.search) {
        const term = filters.search.trim().replace(/[^\w@.\- ]/g, '');
        if (term) {
          const pattern = `%${term}%`;
          query = query.or(
            `data->>target_name.ilike.${pattern},data->>staff_email.ilike.${pattern},data->>action_type.ilike.${pattern}`
          );
        }
      }

      const { data, error: fetchError, count } = await query;

      if (fetchError) throw fetchError;

      setEntries(((data || []) as ActionLogRow[]).map(normalizeActionLog));
      setTotalCount(count || 0);
    } catch (err: any) {
      console.error('[useStaffAudit] Fetch error:', err);
      setError(err.message || 'Failed to fetch audit entries');
    } finally {
      setLoading(false);
    }
  }, [profile, isAdmin, page, filters]);

  // Fetch summary
  const fetchSummary = useCallback(async (days: number = 7) => {
    if (!isAdmin) return;

    try {
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
      const { data, error: summaryError } = await supabase
        .from('action_logs')
        .select('id, user_id, data, created_at')
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(1000);

      if (summaryError) throw summaryError;
      const groups = new Map<string, StaffAuditSummary>();
      ((data || []) as ActionLogRow[]).map(normalizeActionLog).forEach(entry => {
        const key = `${entry.staff_role}\u0000${entry.action_type}`;
        const group = groups.get(key) || {
          staff_role: entry.staff_role,
          action_type: entry.action_type,
          action_count: 0,
          last_action: entry.created_at,
          denied_count: 0,
        };
        group.action_count += 1;
        if (entry.result === 'denied') group.denied_count += 1;
        groups.set(key, group);
      });
      setSummary([...groups.values()].sort((left, right) => right.action_count - left.action_count));
    } catch (err: any) {
      console.error('[useStaffAudit] Summary error:', err);
      setError(err.message || 'Failed to fetch audit summary');
    }
  }, [isAdmin]);

  // Fetch permission matrix
  const fetchPermissions = useCallback(async () => {
    if (!isAdmin) return;

    setPermissionError(null);
    try {
      const { data, error: permError } = await supabase
        .from('role_permission_matrix')
        .select('*')
        .order('role_name')
        .order('resource');

      if (permError) throw permError;
      setPermissions((data || []) as PermissionEntry[]);
    } catch (err: any) {
      console.error('[useStaffAudit] Permissions error:', err);
      setPermissionError(err.message || 'Failed to load the current permission matrix.');
    }
  }, [isAdmin]);

  // Update permission
  const updatePermission = useCallback(
    async (id: string, permission: 'allow' | 'deny') => {
      if (!isAdmin) return false;

      try {
        const { error: updateError } = await supabase
          .from('role_permission_matrix')
          .update({ permission, updated_at: new Date().toISOString() })
          .eq('id', id);

        if (updateError) throw updateError;

        // Refresh permissions
        await fetchPermissions();
        return true;
      } catch (err: any) {
        console.error('[useStaffAudit] Update permission error:', err);
        setError(err.message || 'Failed to update permission');
        return false;
      }
    },
    [isAdmin, fetchPermissions]
  );

  // Add permission
  const addPermission = useCallback(
    async (roleName: string, resource: string, permission: 'allow' | 'deny') => {
      if (!isAdmin) return false;

      try {
        const { error: insertError } = await supabase
          .from('role_permission_matrix')
          .insert({ role_name: roleName, resource, permission });

        if (insertError) throw insertError;

        await fetchPermissions();
        return true;
      } catch (err: any) {
        console.error('[useStaffAudit] Add permission error:', err);
        setError(err.message || 'Failed to add permission');
        return false;
      }
    },
    [isAdmin, fetchPermissions]
  );

  // Remove permission
  const removePermission = useCallback(
    async (id: string) => {
      if (!isAdmin) return false;

      try {
        const { error: deleteError } = await supabase
          .from('role_permission_matrix')
          .delete()
          .eq('id', id);

        if (deleteError) throw deleteError;

        await fetchPermissions();
        return true;
      } catch (err: any) {
        console.error('[useStaffAudit] Remove permission error:', err);
        setError(err.message || 'Failed to remove permission');
        return false;
      }
    },
    [isAdmin, fetchPermissions]
  );

  // Initial fetch
  useEffect(() => {
    fetchEntries();
    fetchSummary();
    fetchPermissions();
  }, [fetchEntries, fetchSummary, fetchPermissions]);

  return {
    entries,
    summary,
    permissions,
    permissionError,
    loading,
    error,
    totalCount,
    page,
    pageSize,
    setPage,
    refresh: fetchEntries,
    refreshSummary: fetchSummary,
    refreshPermissions: fetchPermissions,
    updatePermission,
    addPermission,
    removePermission,
    isAdmin,
  };
}
