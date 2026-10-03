import { useEffect, useState } from 'react';
import { Gavel, Loader2, Shield, X } from 'lucide-react';
import { toast } from 'sonner';
import {
  founderArrestUser,
  founderReleaseUser,
  founderSummonToCourt,
  getActiveJailForUser,
  type FounderPermissions,
} from '@/services/founderProgram';

type Action = 'arrest' | 'release' | 'summon';

interface FounderLiveModerationSheetProps {
  targetUserId: string;
  targetUsername: string;
  permissions: FounderPermissions;
  onClose: () => void;
}

export default function FounderLiveModerationSheet({
  targetUserId,
  targetUsername,
  permissions,
  onClose,
}: FounderLiveModerationSheetProps) {
  const availableActions: Action[] = [
    ...(permissions.arrest ? ['arrest' as const] : []),
    ...(permissions.release ? ['release' as const] : []),
    ...(permissions.summon ? ['summon' as const] : []),
  ];
  const [action, setAction] = useState<Action>(availableActions[0] || 'arrest');
  const [reason, setReason] = useState('');
  const [severity, setSeverity] = useState<'minor' | 'moderate' | 'serious' | 'severe'>('moderate');
  const [jailId, setJailId] = useState<string | null>(null);
  const [loadingJail, setLoadingJail] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!permissions.release) return;
    let active = true;
    setLoadingJail(true);
    getActiveJailForUser(targetUserId).then((jail) => {
      if (!active) return;
      setJailId(jail?.is_jailed ? jail.jail_id : null);
      setLoadingJail(false);
    });
    return () => { active = false; };
  }, [permissions.release, targetUserId]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!reason.trim()) {
      toast.error('A reason is required.');
      return;
    }
    if (action === 'release' && !jailId) {
      toast.error('This user does not have an active jail record.');
      return;
    }

    setSaving(true);
    const result = action === 'arrest'
      ? await founderArrestUser({ targetUserId, reason: reason.trim(), severity })
      : action === 'summon'
        ? await founderSummonToCourt({ targetUserId, reason: reason.trim() })
        : await founderReleaseUser({ jailId: jailId!, reason: reason.trim() });
    setSaving(false);

    if (!result.ok) {
      toast.error(result.message);
      return;
    }

    toast.success(result.message);
    onClose();
  };

  if (!availableActions.length) return null;

  return (
    <div className="fixed inset-0 z-[220] flex items-end justify-center bg-black/75 p-3 backdrop-blur-sm sm:items-center">
      <section role="dialog" aria-modal="true" aria-labelledby="founder-live-tools-title" className="w-full max-w-lg rounded-2xl border border-yellow-500/25 bg-[#101018] p-4 shadow-2xl">
        <header className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-yellow-300">
              <Shield size={14} /> Founder moderation
            </p>
            <h2 id="founder-live-tools-title" className="mt-1 text-lg font-black text-white">@{targetUsername}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close Founder moderation" className="rounded-lg p-2 text-white/50 hover:bg-white/10 hover:text-white">
            <X size={18} />
          </button>
        </header>

        <div className="mb-4 grid grid-cols-3 gap-2">
          {availableActions.map((item) => (
            <button key={item} type="button" onClick={() => setAction(item)} className={`rounded-lg border px-2 py-2 text-xs font-black capitalize ${action === item ? 'border-yellow-400/40 bg-yellow-500/15 text-yellow-200' : 'border-white/10 bg-white/[0.03] text-white/55'}`}>
              {item === 'summon' ? 'Court summons' : item}
            </button>
          ))}
        </div>

        <form onSubmit={submit} className="space-y-3">
          {action === 'arrest' && (
            <label className="block text-[10px] font-bold uppercase tracking-wider text-white/45">
              Severity
              <select value={severity} onChange={(event) => setSeverity(event.target.value as typeof severity)} className="mt-1 block w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm normal-case text-white">
                <option value="minor">Minor</option>
                <option value="moderate">Moderate</option>
                <option value="serious">Serious</option>
                <option value="severe">Severe</option>
              </select>
            </label>
          )}

          {action === 'release' && (
            <p className="rounded-lg border border-white/10 bg-white/[0.03] p-3 text-xs text-white/55">
              {loadingJail ? 'Checking active jail record…' : jailId ? 'An active jail record was found.' : 'No active jail record was found.'}
            </p>
          )}

          <label className="block text-[10px] font-bold uppercase tracking-wider text-white/45">
            Reason
            <textarea required minLength={3} maxLength={2000} value={reason} onChange={(event) => setReason(event.target.value)} rows={3} className="mt-1 block w-full resize-y rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm normal-case text-white outline-none focus:border-yellow-400/40" />
          </label>

          <button type="submit" disabled={saving || (action === 'release' && (!jailId || loadingJail))} className="flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-yellow-500 to-amber-600 px-4 py-2.5 text-sm font-black text-black disabled:cursor-not-allowed disabled:opacity-50">
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Gavel size={16} />}
            {saving ? 'Submitting…' : action === 'summon' ? 'Issue court summons' : action === 'arrest' ? 'Submit arrest' : 'Release from jail'}
          </button>
        </form>
      </section>
    </div>
  );
}