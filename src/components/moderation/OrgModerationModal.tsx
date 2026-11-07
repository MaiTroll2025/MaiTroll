import React, { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import {
  Shield,
  AlertTriangle,
  MicOff,
  MessageSquareOff,
  Ban,
  Flag,
  History,
  X,
  Loader2,
} from 'lucide-react';

export type OrgType = 'family';

type OrgModAction =
  | 'warn'
  | 'mute'
  | 'remove_from_chat'
  | 'remove_from_org'
  | 'restrict'
  | 'report';

interface OrgModerationModalProps {
  open: boolean;
  onClose: () => void;
  orgType: OrgType;
  orgId: string;
  targetUserId: string;
  targetName?: string;
  /** Called after a successful action so parents can refetch. */
  onActionComplete?: () => void;
}

interface ActionDef {
  action: OrgModAction;
  label: string;
  description: string;
  icon: React.ElementType;
  color: string;
  supportsDuration?: boolean;
  familyOnly?: boolean;
  destructive?: boolean;
}

const ACTIONS: ActionDef[] = [
  { action: 'warn', label: 'Warn', description: 'Send a formal warning', icon: AlertTriangle, color: 'text-amber-400' },
  { action: 'mute', label: 'Mute', description: 'Prevent chatting for a duration', icon: MicOff, color: 'text-orange-400', supportsDuration: true },
  { action: 'remove_from_chat', label: 'Remove from Chat', description: 'Remove from the family chat', icon: MessageSquareOff, color: 'text-rose-400', supportsDuration: true, familyOnly: true },
  { action: 'restrict', label: 'Restrict Participation', description: 'Temporarily restrict within this organization', icon: Shield, color: 'text-yellow-400', supportsDuration: true },
  { action: 'remove_from_org', label: 'Remove from Organization', description: 'Remove this member entirely', icon: Ban, color: 'text-red-500', destructive: true },
  { action: 'report', label: 'Report to Staff', description: 'Escalate this member to platform staff', icon: Flag, color: 'text-purple-400' },
];

const DURATION_PRESETS = [
  { label: '15 min', minutes: 15 },
  { label: '1 hour', minutes: 60 },
  { label: '24 hours', minutes: 1440 },
  { label: '7 days', minutes: 10080 },
  { label: 'Permanent', minutes: 0 },
];

interface HistoryRow {
  id: string;
  action: string;
  reason: string | null;
  status: string;
  duration_minutes: number | null;
  created_at: string;
  expires_at: string | null;
  revoked_at: string | null;
  actor_username?: string | null;
  target_username?: string | null;
}

const OrgModerationModal: React.FC<OrgModerationModalProps> = ({
  open,
  onClose,
  orgType,
  orgId,
  targetUserId,
  targetName,
  onActionComplete,
}) => {
  const [selected, setSelected] = useState<ActionDef | null>(null);
  const [reason, setReason] = useState('');
  const [durationMinutes, setDurationMinutes] = useState<number>(60);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const availableActions = ACTIONS.filter((a) => !(a.familyOnly && orgType !== 'family'));

  useEffect(() => {
    if (!open) {
      setSelected(null);
      setReason('');
      setDurationMinutes(60);
      setError(null);
      setShowHistory(false);
    }
  }, [open]);

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    setError(null);
    try {
      const { data, error: rpcError } = await supabase.rpc('org_get_moderation_history', {
        p_org_type: orgType,
        p_org_id: orgId,
        p_limit: 100,
      });
      if (rpcError) throw rpcError;
      const result = data as { success: boolean; error?: string; history?: HistoryRow[] };
      if (!result?.success) throw new Error(result?.error || 'Failed to load history');
      setHistory(result.history || []);
    } catch (err: any) {
      setError(err?.message || 'Failed to load history');
    } finally {
      setHistoryLoading(false);
    }
  }, [orgType, orgId]);

  const submitAction = async () => {
    if (!selected) return;
    setSubmitting(true);
    setError(null);
    try {
      const { data, error: rpcError } = await supabase.rpc('org_moderate_member', {
        p_org_type: orgType,
        p_org_id: orgId,
        p_target_user_id: targetUserId,
        p_action: selected.action,
        p_reason: reason.trim() || null,
        p_duration_minutes: selected.supportsDuration && durationMinutes > 0 ? durationMinutes : null,
      });
      if (rpcError) throw rpcError;
      const result = data as { success: boolean; error?: string };
      if (!result?.success) throw new Error(result?.error || 'Action failed');
      onActionComplete?.();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Action failed');
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-2xl border border-white/10 bg-slate-900 shadow-2xl max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-white/10 p-4">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-cyan-400" />
            <h3 className="font-semibold text-white">
              Moderate {targetName ? `@${targetName}` : 'member'}
            </h3>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-gray-400 hover:bg-white/10 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div className="mx-4 mt-4 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
            {error}
          </div>
        )}

        {showHistory ? (
          <div className="p-4">
            <button
              onClick={() => setShowHistory(false)}
              className="mb-3 text-sm text-cyan-400 hover:underline"
            >
              ← Back to actions
            </button>
            {historyLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-cyan-400" />
              </div>
            ) : history.length === 0 ? (
              <p className="py-6 text-center text-sm text-gray-400">No moderation history yet.</p>
            ) : (
              <div className="space-y-2">
                {history.map((h) => (
                  <div key={h.id} className="rounded-lg border border-white/10 bg-slate-800/60 p-3 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="font-medium capitalize text-white">{h.action.replace(/_/g, ' ')}</span>
                      <span
                        className={`rounded px-2 py-0.5 text-xs ${
                          h.status === 'active'
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : h.status === 'revoked'
                              ? 'bg-slate-500/20 text-slate-300'
                              : 'bg-amber-500/20 text-amber-300'
                        }`}
                      >
                        {h.status}
                      </span>
                    </div>
                    <p className="mt-1 text-gray-400">
                      Target @{h.target_username || '—'} · by @{h.actor_username || '—'}
                    </p>
                    {h.reason && <p className="mt-1 text-gray-300">{h.reason}</p>}
                    <p className="mt-1 text-xs text-gray-500">
                      {new Date(h.created_at).toLocaleString()}
                      {h.expires_at ? ` · expires ${new Date(h.expires_at).toLocaleString()}` : ''}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : selected ? (
          <div className="p-4">
            <button
              onClick={() => {
                setSelected(null);
                setError(null);
              }}
              className="mb-3 text-sm text-cyan-400 hover:underline"
            >
              ← Back
            </button>
            <div className="mb-3 flex items-center gap-2">
              <selected.icon className={`h-5 w-5 ${selected.color}`} />
              <span className="font-medium text-white">{selected.label}</span>
            </div>

            {selected.supportsDuration && (
              <div className="mb-4">
                <label className="mb-1 block text-xs text-gray-400">Duration</label>
                <div className="flex flex-wrap gap-2">
                  {DURATION_PRESETS.map((preset) => (
                    <button
                      key={preset.label}
                      onClick={() => setDurationMinutes(preset.minutes)}
                      className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${
                        durationMinutes === preset.minutes
                          ? 'border-cyan-500 bg-cyan-500/20 text-cyan-200'
                          : 'border-white/10 text-gray-300 hover:bg-white/5'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <label className="mb-1 block text-xs text-gray-400">Reason</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Explain the reason for this action…"
              className="mb-4 w-full rounded-lg border border-white/10 bg-slate-800 p-2 text-sm text-white placeholder-gray-500 focus:border-cyan-500 focus:outline-none"
              rows={3}
            />

            <button
              onClick={submitAction}
              disabled={submitting}
              className={`flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 font-medium transition-colors disabled:opacity-50 ${
                selected.destructive
                  ? 'bg-red-600 text-white hover:bg-red-700'
                  : 'bg-cyan-600 text-white hover:bg-cyan-700'
              }`}
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <selected.icon className="h-4 w-4" />}
              Confirm {selected.label}
            </button>
          </div>
        ) : (
          <div className="p-4">
            <div className="space-y-2">
              {availableActions.map((a) => (
                <button
                  key={a.action}
                  onClick={() => setSelected(a)}
                  className="flex w-full items-center gap-3 rounded-lg border border-white/10 bg-slate-800/40 p-3 text-left transition-colors hover:bg-slate-800"
                >
                  <a.icon className={`h-5 w-5 shrink-0 ${a.color}`} />
                  <div className="min-w-0">
                    <p className="font-medium text-white">{a.label}</p>
                    <p className="truncate text-xs text-gray-400">{a.description}</p>
                  </div>
                </button>
              ))}
            </div>
            <button
              onClick={() => {
                setShowHistory(true);
                void loadHistory();
              }}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-white/10 bg-slate-800/40 p-2.5 text-sm text-gray-300 hover:bg-slate-800"
            >
              <History className="h-4 w-4" />
              View moderation history
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default OrgModerationModal;
