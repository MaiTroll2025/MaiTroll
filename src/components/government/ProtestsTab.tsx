import React, { useState } from 'react';
import { Hand, Plus, X, Flame, Users, Clock, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';

export default function ProtestsTab(props: any) {
  const protests = props.protests || [];
  const userProtestIds = props.userProtestIds || new Set();
  const laws = props.laws || [];
  const onCreateProtest = props.onCreateProtest;
  const onJoinProtest = props.onJoinProtest;
  const onLeaveProtest = props.onLeaveProtest;
  const roleLevel = props.roleLevel || 'citizen';

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [targetLawId, setTargetLawId] = useState('');
  const [location, setLocation] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [joiningId, setJoiningId] = useState<string | null>(null);

  const activeLaws = laws.filter((l: any) => l.status === 'active');
  const activeProtests = protests.filter((p: any) => ['active', 'growing', 'crisis'].includes(p.status));
  const pastProtests = protests.filter((p: any) => ['resolved', 'dispersed'].includes(p.status));

  const handleCreateProtest = async () => {
    if (!title.trim()) {
      toast.error('Please enter a protest title');
      return;
    }
    if (!description.trim()) {
      toast.error('Please describe your protest');
      return;
    }
    setSubmitting(true);
    try {
      await onCreateProtest({
        title: title.trim(),
        description: description.trim(),
        target_law_id: targetLawId || null,
        location: location.trim() || 'City Center',
      });
      toast.success('Protest started! Others can now join.');
      setShowCreateModal(false);
      setTitle('');
      setDescription('');
      setTargetLawId('');
      setLocation('');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to start protest');
    } finally {
      setSubmitting(false);
    }
  };

  const handleJoin = async (protestId: string) => {
    setJoiningId(protestId);
    try {
      await onJoinProtest(protestId);
      toast.success('You joined the protest!');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to join protest');
    } finally {
      setJoiningId(null);
    }
  };

  const handleLeave = async (protestId: string) => {
    setJoiningId(protestId);
    try {
      await onLeaveProtest(protestId);
      toast.success('You left the protest.');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to leave protest');
    } finally {
      setJoiningId(null);
    }
  };

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'crisis': return 'bg-red-500/20 text-red-400 border-red-500/30';
      case 'growing': return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
      case 'active': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      case 'resolved': return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'dispersed': return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
      default: return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'crisis': return '🔥 CRISIS';
      case 'growing': return '📈 GROWING';
      case 'active': return '📢 ACTIVE';
      case 'resolved': return '✅ RESOLVED';
      case 'dispersed': return '💨 DISPERSED';
      default: return status.toUpperCase();
    }
  };

  const getIntensityBars = (intensity: number) => {
    const bars = [];
    for (let i = 1; i <= 10; i++) {
      bars.push(
        <div
          key={i}
          className={`h-2 w-full rounded-full transition-colors ${
            i <= intensity
              ? i <= 3 ? 'bg-yellow-400'
              : i <= 6 ? 'bg-orange-400'
              : 'bg-red-500'
              : 'bg-slate-700'
          }`}
        />
      );
    }
    return bars;
  };

  const getTimeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  const getTargetLawTitle = (lawId: string | null) => {
    if (!lawId) return null;
    const law = activeLaws.find((l: any) => l.id === lawId);
    return law?.title || 'Unknown Law';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-3">
            <Hand className="text-orange-400" />
            City Protests
          </h2>
          <p className="text-slate-400 mt-1">Make your voice heard — organize and participate in city demonstrations</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-500 rounded-xl font-bold transition-colors"
        >
          <Plus size={18} /> Start Protest
        </button>
      </div>

      {/* City mood indicator */}
      {activeProtests.length > 0 && (
        <div className="bg-gradient-to-r from-orange-500/10 to-red-500/10 border border-orange-500/20 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Flame className="text-orange-400" size={24} />
              <div>
                <p className="font-bold text-orange-200">
                  {activeProtests.length === 1
                    ? '1 active protest — the city is restless'
                    : `${activeProtests.length} active protests — tensions are rising`}
                </p>
                <p className="text-sm text-slate-400">
                  Total demonstrators: {activeProtests.reduce((sum: number, p: any) => sum + (p.participant_count || 0), 0)}
                </p>
              </div>
            </div>
            <div className="flex gap-1">
              {activeProtests.map((p: any) => (
                <div
                  key={p.id}
                  className={`h-8 rounded-full flex items-center px-3 text-xs font-bold ${
                    p.status === 'crisis' ? 'bg-red-500/30 text-red-300' :
                    p.status === 'growing' ? 'bg-orange-500/30 text-orange-300' :
                    'bg-yellow-500/30 text-yellow-300'
                  }`}
                >
                  {p.participant_count}👤
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Active Protests */}
      {activeProtests.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-bold flex items-center gap-2">
            <Flame className="text-orange-400" />
            Active Demonstrations
          </h3>
          {activeProtests.map((protest: any) => {
            const isJoined = userProtestIds.has(protest.id);
            const isOrganizer = protest.organizer_id === props.userId;
            const isCrisis = protest.status === 'crisis';
            const isGrowing = protest.status === 'growing';
            const targetLawTitle = getTargetLawTitle(protest.target_law_id);

            return (
              <div
                key={protest.id}
                className={`bg-slate-900 border rounded-xl overflow-hidden transition-all ${
                  isCrisis ? 'border-red-500/50 shadow-[0_0_20px_rgba(239,68,68,0.1)]' :
                  isGrowing ? 'border-orange-500/30' : 'border-slate-800'
                }`}
              >
                {isCrisis && (
                  <div className="bg-red-500/10 border-b border-red-500/20 px-5 py-2 flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                    <span className="text-xs font-bold text-red-400 uppercase tracking-wider">Crisis Level Protest</span>
                  </div>
                )}
                <div className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h4 className="font-bold text-lg">{protest.title}</h4>
                      <p className="text-slate-400 text-sm mt-1">{protest.description}</p>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-bold border ml-3 ${getStatusStyle(protest.status)}`}>
                      {getStatusLabel(protest.status)}
                    </span>
                  </div>

                  {/* Protest info row */}
                  <div className="flex flex-wrap items-center gap-4 mb-4 text-xs text-slate-500">
                    <span className="flex items-center gap-1">
                      <Users size={12} />
                      {protest.participant_count}/{protest.max_participants} protesters
                    </span>
                    {protest.location && (
                      <span className="flex items-center gap-1">
                        📍 {protest.location}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <Clock size={12} />
                      Started {getTimeAgo(protest.started_at)}
                    </span>
                    {targetLawTitle && (
                      <span className="flex items-center gap-1 text-cyan-400">
                        📜 Target: {targetLawTitle}
                      </span>
                    )}
                  </div>

                  {/* Participant bar */}
                  <div className="mb-4">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-slate-400">Strength</span>
                      <span className="text-slate-400">{Math.round((protest.participant_count / protest.max_participants) * 100)}%</span>
                    </div>
                    <div className="w-full bg-slate-800 rounded-full h-3 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          isCrisis ? 'bg-red-500' : isGrowing ? 'bg-orange-500' : 'bg-yellow-500'
                        }`}
                        style={{ width: `${Math.min(100, (protest.participant_count / protest.max_participants) * 100)}%` }}
                      />
                    </div>
                  </div>

                  {/* Intensity meter */}
                  <div className="mb-4">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-slate-400 flex items-center gap-1">
                        <TrendingUp size={12} /> Intensity
                      </span>
                      <span className={`font-bold ${
                        protest.intensity >= 7 ? 'text-red-400' :
                        protest.intensity >= 4 ? 'text-orange-400' : 'text-yellow-400'
                      }`}>
                        {protest.intensity}/10
                      </span>
                    </div>
                    <div className="grid grid-cols-10 gap-1">
                      {getIntensityBars(protest.intensity)}
                    </div>
                  </div>

                  {/* Effects */}
                  {(protest.effect_on_law !== 0 || protest.effect_on_reputation !== 0) && (
                    <div className="flex gap-4 mb-4 text-xs">
                      {protest.effect_on_law !== 0 && (
                        <span className="text-orange-300">
                          📉 Law effectiveness: {Math.abs(Math.round(protest.effect_on_law))}% reduced
                        </span>
                      )}
                      {protest.effect_on_reputation !== 0 && (
                        <span className="text-red-300">
                          🏛️ City trust: {Math.abs(Math.round(protest.effect_on_reputation))}% lost
                        </span>
                      )}
                    </div>
                  )}

                  {/* Action buttons */}
                  <div className="flex gap-2">
                    {isJoined ? (
                      <button
                        onClick={() => handleLeave(protest.id)}
                        disabled={joiningId === protest.id || isOrganizer}
                        className="flex-1 py-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 rounded-lg font-medium transition-colors text-sm"
                      >
                        {isOrganizer ? "You're the organizer (can't leave)" : '✋ Leave Protest'}
                      </button>
                    ) : (
                      <button
                        onClick={() => handleJoin(protest.id)}
                        disabled={joiningId === protest.id || protest.participant_count >= protest.max_participants}
                        className={`flex-1 py-2 rounded-lg font-bold transition-colors text-sm flex items-center justify-center gap-2 ${
                          isCrisis
                            ? 'bg-red-600 hover:bg-red-500 disabled:opacity-50'
                            : 'bg-orange-600 hover:bg-orange-500 disabled:opacity-50'
                        }`}
                      >
                        <Hand size={16} />
                        {protest.participant_count >= protest.max_participants ? 'Protest Full' : 'Join Protest'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Empty state */}
      {protests.length === 0 && (
        <div className="text-center py-16 text-slate-500">
          <Hand className="w-20 h-20 mx-auto mb-4 opacity-20" />
          <h3 className="text-2xl font-bold text-slate-300 mb-2">No Protests Yet</h3>
          <p className="text-slate-400 mb-2">The city is peaceful... for now.</p>
          <p className="text-slate-500 text-sm max-w-md mx-auto">
            Unhappy with a new law? Think the government isn&apos;t listening? Start a protest
            and rally your fellow citizens to make your voice heard.
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="mt-6 inline-flex items-center gap-2 px-6 py-3 bg-orange-600 hover:bg-orange-500 rounded-xl font-bold transition-colors"
          >
            <Plus size={18} /> Start the First Protest
          </button>
        </div>
      )}

      {/* Past Protests */}
      {pastProtests.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">Past Protests</h3>
          {pastProtests.map((protest: any) => (
            <div key={protest.id} className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4 opacity-70">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium text-slate-300">{protest.title}</h4>
                  <p className="text-xs text-slate-500 mt-1">
                    {protest.participant_count} participants • Ended {getTimeAgo(protest.ended_at || protest.started_at)}
                  </p>
                </div>
                <span className={`px-2 py-1 rounded-full text-xs font-bold border ${getStatusStyle(protest.status)}`}>
                  {getStatusLabel(protest.status)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Protest Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-2xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto border border-slate-700">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <Hand className="text-orange-400" size={22} />
                Start a Protest
              </h3>
              <button onClick={() => setShowCreateModal(false)} className="p-1 hover:bg-slate-700 rounded-lg transition-colors">
                <X size={20} className="text-slate-400" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">What are you protesting? *</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. 'Unfair Tax Law', 'We Demand Change'"
                  maxLength={100}
                  className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-orange-500 transition-colors"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Explain your cause *</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Tell citizens why they should join your protest..."
                  rows={4}
                  maxLength={500}
                  className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-orange-500 resize-none transition-colors"
                />
                <p className="text-xs text-slate-500 mt-1">{description.length}/500 characters</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Target Law (optional)</label>
                <select
                  value={targetLawId}
                  onChange={(e) => setTargetLawId(e.target.value)}
                  className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-orange-500 transition-colors"
                >
                  <option value="">No specific law</option>
                  {activeLaws.map((law: any) => (
                    <option key={law.id} value={law.id}>{law.title}</option>
                  ))}
                </select>
                <p className="text-xs text-slate-500 mt-1">Targeting a law increases the protest&apos;s effect on that law</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Location</label>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="e.g. City Hall, Main Square, Market District"
                  className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-orange-500 transition-colors"
                />
              </div>
            </div>

            <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl p-3 mt-4">
              <p className="text-xs text-orange-300">
                💡 <strong>Tip:</strong> Protests grow as more citizens join. Once a protest hits 10+ participants it starts growing,
                and at 50+ it reaches crisis level — significantly impacting city trust and law effectiveness.
              </p>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowCreateModal(false)}
                className="flex-1 px-4 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-xl transition-colors font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateProtest}
                disabled={submitting || !title.trim() || !description.trim()}
                className="flex-1 px-4 py-3 bg-orange-600 hover:bg-orange-500 text-white rounded-xl font-bold transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <>
                    <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Starting...
                  </>
                ) : (
                  <>
                    <Hand size={16} />
                    Start Protest
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
