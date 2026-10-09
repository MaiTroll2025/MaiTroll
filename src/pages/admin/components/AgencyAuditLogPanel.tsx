import { useAdminAgencyAuditLog } from '@/hooks/useAdminAgency';
import { cn } from '@/lib/utils';
import { ScrollText, Loader2, Clock, User, FileText, AlertTriangle, CheckCircle2, XCircle, Settings, Shield } from 'lucide-react';

const actionConfig: Record<string, { icon: typeof ScrollText; color: string; bg: string }> = {
  approve: { icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-emerald-500/15' },
  reject: { icon: XCircle, color: 'text-red-400', bg: 'bg-red-500/15' },
  create: { icon: FileText, color: 'text-cyan-400', bg: 'bg-cyan-500/15' },
  update: { icon: Settings, color: 'text-amber-400', bg: 'bg-amber-500/15' },
  delete: { icon: XCircle, color: 'text-red-400', bg: 'bg-red-500/15' },
  deactivate: { icon: AlertTriangle, color: 'text-orange-400', bg: 'bg-orange-500/15' },
  adjust: { icon: Settings, color: 'text-purple-400', bg: 'bg-purple-500/15' },
  revoke: { icon: XCircle, color: 'text-red-400', bg: 'bg-red-500/15' },
  claim: { icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-emerald-500/15' },
  distribute: { icon: Shield, color: 'text-blue-400', bg: 'bg-blue-500/15' },
};

function getActionStyle(action: string) {
  const lower = action.toLowerCase();
  for (const [key, config] of Object.entries(actionConfig)) {
    if (lower.includes(key)) return config;
  }
  return { icon: ScrollText, color: 'text-slate-400', bg: 'bg-slate-500/15' };
}

export default function AgencyAuditLogPanel() {
  const { logs, loading, error, refresh } = useAdminAgencyAuditLog(100);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-slate-500/20 p-2.5">
            <ScrollText className="w-6 h-6 text-slate-300" />
          </div>
          <div>
            <h2 className="text-xl font-black text-white">Audit Log</h2>
            <p className="text-sm text-slate-400">Track all agency system actions and changes</p>
          </div>
        </div>
        <button
          type="button"
          onClick={refresh}
          disabled={loading}
          className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold text-slate-300 transition-colors hover:bg-white/10 disabled:opacity-50"
        >
          <Loader2 className={cn('w-4 h-4', loading && 'animate-spin')} />
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur-xl">
          <p className="text-[0.65rem] font-black uppercase tracking-wider text-slate-500">Total Entries</p>
          <p className="text-2xl font-black text-white mt-1">{logs.length}</p>
        </div>
        <div className="rounded-2xl border border-emerald-500/10 bg-emerald-500/5 p-4 backdrop-blur-xl">
          <p className="text-[0.65rem] font-black uppercase tracking-wider text-emerald-500/70">Approvals</p>
          <p className="text-2xl font-black text-emerald-400 mt-1">
            {logs.filter((l) => l.action.toLowerCase().includes('approve') || l.action.toLowerCase().includes('claim')).length}
          </p>
        </div>
        <div className="rounded-2xl border border-red-500/10 bg-red-500/5 p-4 backdrop-blur-xl">
          <p className="text-[0.65rem] font-black uppercase tracking-wider text-red-500/70">Rejections</p>
          <p className="text-2xl font-black text-red-400 mt-1">
            {logs.filter((l) => l.action.toLowerCase().includes('reject') || l.action.toLowerCase().includes('revoke') || l.action.toLowerCase().includes('deactivat')).length}
          </p>
        </div>
      </div>

      {loading && !logs.length ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-6 text-center text-red-300">
          <p className="font-bold">Error loading audit log</p>
          <p className="mt-1 text-sm text-red-400">{error}</p>
        </div>
      ) : logs.length === 0 ? (
        <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-12 text-center backdrop-blur-xl">
          <ScrollText className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-slate-400">No audit log entries</h3>
          <p className="mt-1 text-sm text-slate-500">System actions will be recorded here</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] backdrop-blur-xl overflow-hidden">
          <div className="max-h-[600px] overflow-y-auto">
            {logs.map((log) => {
              const style = getActionStyle(log.action);
              const ActionIcon = style.icon;

              return (
                <div key={log.id} className="flex items-start gap-4 px-5 py-4 border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                  <div className={cn(
                    'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
                    style.bg,
                  )}>
                    <ActionIcon className={cn('w-5 h-5', style.color)} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={cn('text-sm font-black', style.color)}>{log.action}</span>
                      <span className="text-xs text-slate-500">on</span>
                      <span className="text-xs font-bold text-slate-300">{log.entity_type}</span>
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                      {log.actor_id && (
                        <span className="flex items-center gap-1 text-xs text-slate-500">
                          <User className="w-3 h-3" />
                          {log.actor_id.slice(0, 8)}...
                        </span>
                      )}
                      {log.target_user_id && (
                        <span className="flex items-center gap-1 text-xs text-slate-500">
                          <span className="text-slate-600">→</span>
                          {log.target_user_id.slice(0, 8)}...
                        </span>
                      )}
                    </div>
                    {log.new_data && typeof log.new_data === 'object' && Object.keys(log.new_data).length > 0 && (
                      <div className="mt-2 rounded-lg border border-white/5 bg-black/20 px-3 py-2">
                        <p className="text-[0.65rem] font-black uppercase tracking-wider text-slate-600 mb-1">Details</p>
                        <pre className="text-xs text-slate-400 overflow-x-auto whitespace-pre-wrap">
                          {JSON.stringify(log.new_data, null, 0).slice(0, 200)}
                        </pre>
                      </div>
                    )}
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="flex items-center gap-1 text-xs text-slate-500">
                      <Clock className="w-3 h-3" />
                      {new Date(log.created_at).toLocaleDateString()}
                    </div>
                    <p className="text-[0.65rem] text-slate-600 mt-0.5">
                      {new Date(log.created_at).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
