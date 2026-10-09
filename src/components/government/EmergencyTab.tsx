import React, { useState } from 'react';
import { Siren, AlertTriangle, X, Scale, Ban, Hand, Megaphone } from 'lucide-react';
import { toast } from 'sonner';

export default function EmergencyTab(props: any) {
  const roleLevel = props.roleLevel || 'citizen';
  const canUse = ['president', 'admin'].includes(roleLevel);
  const onUseEmergencyPower = props.onUseEmergencyPower;
  const laws = props.laws || [];
  const protests = props.protests || [];
  const cityReputation = props.cityReputation;

  const [showConfirm, setShowConfirm] = useState<string | null>(null);
  const [targetId, setTargetId] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const votingLaws = laws.filter((l: any) => l.status === 'voting');
  const _activeLaws = laws.filter((l: any) => l.status === 'active');
  const activeProtests = protests.filter((p: any) => ['active', 'growing', 'crisis'].includes(p.status));

  const emergencyPowers = [
    {
      id: 'override_vote',
      label: 'Override Vote',
      icon: Scale,
      description: 'Force pass or reject any law currently in voting',
      color: 'blue',
      bgClass: 'bg-blue-500/10 hover:border-blue-500/50',
      borderClass: 'border-slate-800',
      iconClass: 'text-blue-400',
      textClass: 'text-blue-400',
      btnClass: 'bg-blue-600 hover:bg-blue-500',
      needsTarget: true,
      targetOptions: votingLaws,
      targetLabel: 'Law to Override',
    },
    {
      id: 'force_law',
      label: 'Force Law',
      icon: Ban,
      description: 'Instantly activate any law without voting',
      color: 'cyan',
      bgClass: 'bg-cyan-500/10 hover:border-cyan-500/50',
      borderClass: 'border-slate-800',
      iconClass: 'text-cyan-400',
      textClass: 'text-cyan-400',
      btnClass: 'bg-cyan-600 hover:bg-cyan-500',
      needsTarget: true,
      targetOptions: laws.filter((l: any) => l.status === 'draft'),
      targetLabel: 'Law to Force',
    },
    {
      id: 'end_protest',
      label: 'Disperse Protests',
      icon: Hand,
      description: 'Immediately end and disperse all active protests',
      color: 'orange',
      bgClass: 'bg-orange-500/10 hover:border-orange-500/50',
      borderClass: 'border-slate-800',
      iconClass: 'text-orange-400',
      textClass: 'text-orange-400',
      btnClass: 'bg-orange-600 hover:bg-orange-500',
      needsTarget: false,
      extraLabel: `${activeProtests.length} active protests will be dispersed`,
    },
    {
      id: 'emergency_declaration',
      label: 'Emergency Declaration',
      icon: Megaphone,
      description: 'Declare a city-wide emergency — suspends certain rights',
      color: 'red',
      bgClass: 'bg-red-500/10 hover:border-red-500/50',
      borderClass: 'border-slate-800',
      iconClass: 'text-red-400',
      textClass: 'text-red-400',
      btnClass: 'bg-red-600 hover:bg-red-500',
      needsTarget: false,
    },
  ];

  const handleActivate = async (actionType: string) => {
    if (!reason.trim()) {
      toast.error('You must provide a reason for emergency action');
      return;
    }
    setSubmitting(true);
    try {
      await onUseEmergencyPower(
        actionType,
        targetId || undefined,
        reason.trim()
      );
      toast.success(`Emergency power used: ${emergencyPowers.find(p => p.id === actionType)?.label}`);
      setShowConfirm(null);
      setTargetId('');
      setReason('');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to use emergency power');
    } finally {
      setSubmitting(false);
    }
  };

  if (!canUse) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-3">
            <Siren className="text-red-400" />
            Emergency Powers
          </h2>
          <p className="text-slate-400 mt-1">Presidential emergency actions</p>
        </div>
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-8 text-center">
          <Siren className="w-16 h-16 mx-auto mb-4 text-slate-600" />
          <h3 className="text-xl font-bold text-slate-300 mb-2">Access Restricted</h3>
          <p className="text-slate-400">Only the President can use emergency powers.</p>
          <p className="text-xs text-slate-600 mt-2">Think the President is abusing power? Start a protest at /government</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-3">
          <Siren className="text-red-400" />
          Emergency Powers
        </h2>
        <p className="text-slate-400 mt-1">Presidential emergency actions — use with extreme caution</p>
      </div>

      {/* Warning banner */}
      <div className="bg-red-900/20 border border-red-500/30 rounded-xl p-4">
        <div className="flex items-start gap-3 text-red-400">
          <AlertTriangle size={20} className="shrink-0 mt-0.5" />
          <div>
            <span className="font-bold block mb-1">Executive Authority Warning</span>
            <p className="text-slate-400 text-sm">
              Emergency powers bypass normal democratic processes. Use of emergency powers increases backlash
              and reduces city trust. {cityReputation?.emergency_declarations > 0 && (
                <>This power has been used <strong className="text-red-300">{cityReputation.emergency_declarations}</strong> time(s) already.</>
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Power cards */}
      <div className="grid md:grid-cols-2 gap-4">
        {emergencyPowers.map((power) => {
          const Icon = power.icon;
          return (
            <div key={power.id} className={`bg-slate-900 border rounded-xl p-6 ${power.borderClass} transition-colors ${power.bgClass}`}>
              <div className="flex items-center gap-3 mb-3">
                <div className={`w-12 h-12 rounded-xl bg-slate-800 border ${power.borderClass} flex items-center justify-center`}>
                  <Icon className={power.iconClass} size={24} />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-white">{power.label}</h3>
                  <p className="text-slate-400 text-xs">{power.description}</p>
                </div>
              </div>

              {showConfirm === power.id ? (
                <div className="mt-4 space-y-3 bg-slate-950/50 rounded-xl p-4 border border-slate-700">
                  <div className="flex items-center justify-between">
                    <span className={`font-bold ${power.textClass}`}>Confirm: {power.label}</span>
                    <button onClick={() => { setShowConfirm(null); setTargetId(''); setReason(''); }} className="p-1 hover:bg-slate-700 rounded">
                      <X size={16} className="text-slate-400" />
                    </button>
                  </div>

                  {power.needsTarget && (
                    <div>
                      <label className="block text-sm text-slate-400 mb-1">{power.targetLabel} *</label>
                      <select
                        value={targetId}
                        onChange={(e) => setTargetId(e.target.value)}
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-red-500"
                      >
                        <option value="">Select...</option>
                        {power.targetOptions?.map((opt: any) => (
                          <option key={opt.id} value={opt.id}>{opt.title}</option>
                        ))}
                      </select>
                      {power.targetOptions?.length === 0 && (
                        <p className="text-xs text-slate-500 mt-1">No available targets</p>
                      )}
                    </div>
                  )}

                  {!power.needsTarget && power.extraLabel && (
                    <p className="text-sm text-slate-400">{power.extraLabel}</p>
                  )}

                  <div>
                    <label className="block text-sm text-slate-400 mb-1">Reason *</label>
                    <textarea
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      placeholder="Why are you using emergency powers?"
                      rows={2}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-red-500 resize-none"
                    />
                  </div>

                  <button
                    onClick={() => handleActivate(power.id)}
                    disabled={submitting || (power.needsTarget && !targetId)}
                    className={`w-full py-2 rounded-lg font-bold text-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2 ${power.btnClass}`}
                  >
                    {submitting ? (
                      <>
                        <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Activating...
                      </>
                    ) : (
                      <>
                        <Siren size={14} />
                        Confirm Emergency Action
                      </>
                    )}
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => { setShowConfirm(power.id); setTargetId(''); setReason(''); }}
                  className={`mt-2 w-full py-2 rounded-lg font-bold text-sm transition-all border border-slate-700 hover:border-slate-600 ${power.bgClass}`}
                >
                  Activate Power
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Cooldown note */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4 text-center">
        <p className="text-xs text-slate-500">
          ⚡ Emergency powers have a cooldown period. Use them wisely — the citizens are watching.
        </p>
      </div>
    </div>
  );
}
