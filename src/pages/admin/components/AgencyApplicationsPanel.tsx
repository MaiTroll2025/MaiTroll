import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAdminAgencyApplications } from '../../hooks/useAdminAgency';
import type { AgencyApplication } from '../../types/agency';
import { cn } from '../../lib/utils';
import { toast } from 'sonner';
import { FileText, Check, X, Loader2, User, Clock, Eye, EyeOff } from 'lucide-react';

interface ApplicationWithProfile extends AgencyApplication {
  username?: string;
  avatar_url?: string;
}

function ApproveModal({
  application,
  onClose,
  onConfirm,
}: {
  application: ApplicationWithProfile;
  onClose: () => void;
  onConfirm: (notes: string) => void;
}) {
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await onConfirm(notes);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#070b19]/95 p-6 backdrop-blur-2xl shadow-[0_20px_80px_rgba(0,0,0,0.5)]">
        <h3 className="text-lg font-black text-white mb-1">Approve Application</h3>
        <p className="text-sm text-slate-400 mb-4">
          Approving @{application.username}&apos;s agency application
        </p>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Optional review notes..."
          className="w-full h-24 rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 resize-none"
        />
        <div className="flex gap-3 mt-4">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-bold text-slate-300 transition-colors hover:bg-white/10"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-emerald-400/30 bg-emerald-500/20 px-4 py-2.5 text-sm font-black text-emerald-200 transition-colors hover:bg-emerald-500/30 disabled:opacity-50"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            Approve
          </button>
        </div>
      </div>
    </div>
  );
}

function RejectModal({
  application,
  onClose,
  onConfirm,
}: {
  application: ApplicationWithProfile;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!reason.trim()) {
      toast.error('Rejection reason is required');
      return;
    }
    setSubmitting(true);
    try {
      await onConfirm(reason.trim());
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#070b19]/95 p-6 backdrop-blur-2xl shadow-[0_20px_80px_rgba(0,0,0,0.5)]">
        <h3 className="text-lg font-black text-white mb-1">Reject Application</h3>
        <p className="text-sm text-slate-400 mb-4">
          Rejecting @{application.username}&apos;s agency application
        </p>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Rejection reason (required)..."
          className="w-full h-24 rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-red-500/50 resize-none"
        />
        <div className="flex gap-3 mt-4">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-bold text-slate-300 transition-colors hover:bg-white/10"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || !reason.trim()}
            className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-red-400/30 bg-red-500/20 px-4 py-2.5 text-sm font-black text-red-200 transition-colors hover:bg-red-500/30 disabled:opacity-50"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
            Reject
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AgencyApplicationsPanel() {
  const { applications, loading, error, refresh, approve, reject } = useAdminAgencyApplications();
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [modalState, setModalState] = useState<{
    type: 'approve' | 'reject';
    application: ApplicationWithProfile;
  } | null>(null);
  const [expandedAppIds, setExpandedAppIds] = useState<Set<string>>(new Set());

  const toggleExpanded = (id: string) => {
    setExpandedAppIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleApproveConfirm = async (notes: string) => {
    if (!modalState) return;
    setProcessingId((modalState.application as any).id);
    try {
      await approve((modalState.application as any).id, notes);
      toast.success('Application approved successfully');
      setModalState(null);
    } catch (err) {
      toast.error('Failed to approve application');
    } finally {
      setProcessingId(null);
    }
  };

  const handleRejectConfirm = async (reason: string) => {
    if (!modalState) return;
    setProcessingId((modalState.application as any).id);
    try {
      await reject((modalState.application as any).id, reason);
      toast.success('Application rejected');
      setModalState(null);
    } catch (err) {
      toast.error('Failed to reject application');
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-purple-500/20 p-2.5">
            <FileText className="w-6 h-6 text-purple-400" />
          </div>
          <div>
            <h2 className="text-xl font-black text-white">Agency Applications</h2>
            <p className="text-sm text-slate-400">Review and process pending agency applications</p>
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

      <div className="rounded-2xl border border-amber-400/20 bg-amber-500/5 px-5 py-3">
        <div className="flex items-center gap-2 text-sm text-amber-200">
          <Clock className="w-4 h-4" />
          <span className="font-medium">{applications.length} pending application{applications.length !== 1 ? 's' : ''}</span>
        </div>
      </div>

      {loading && !applications.length ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-6 text-center text-red-300">
          <p className="font-bold">Error loading applications</p>
          <p className="mt-1 text-sm text-red-400">{error}</p>
        </div>
      ) : applications.length === 0 ? (
        <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-12 text-center backdrop-blur-xl">
          <FileText className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-slate-400">No pending applications</h3>
          <p className="mt-1 text-sm text-slate-500">New applications will appear here for review</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {applications.map((app) => {
            const isExpanded = expandedAppIds.has(app.id);
            const isProcessing = processingId === app.id;

            return (
              <div
                key={app.id}
                className={cn(
                  'group relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-xl',
                  'shadow-2xl shadow-black/20 transition-all duration-300',
                  'hover:border-purple-500/20 hover:bg-white/[0.06]',
                )}
              >
                <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 via-transparent to-cyan-500/5 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                <div className="relative p-5">
                  <div className="flex flex-col md:flex-row gap-5">
                    <div className="flex-1 space-y-4">
                      <div className="flex items-start gap-4">
                        <img
                          src={app.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${app.user_id}`}
                          alt={app.username}
                          className="w-12 h-12 rounded-full border border-white/10 bg-black/40"
                        />
                        <div>
                          <h3 className="text-lg font-black text-white">@{app.username || 'Unknown'}</h3>
                          <p className="text-sm text-slate-400">{app.display_name}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="inline-flex items-center gap-1 rounded-full border border-purple-400/30 bg-purple-500/10 px-2.5 py-0.5 text-[0.65rem] font-black uppercase tracking-wider text-purple-200">
                              {app.primary_platform}
                            </span>
                            <span className="text-xs text-slate-500">
                              {new Date(app.created_at).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div className="rounded-xl border border-white/10 bg-black/30 px-3 py-2.5">
                          <p className="text-[0.65rem] font-black uppercase tracking-wider text-slate-500">Avg Hours</p>
                          <p className="text-lg font-black text-white">{app.avg_weekly_hours}</p>
                        </div>
                        <div className="rounded-xl border border-white/10 bg-black/30 px-3 py-2.5">
                          <p className="text-[0.65rem] font-black uppercase tracking-wider text-slate-500">Avg Viewers</p>
                          <p className="text-lg font-black text-white">{app.avg_weekly_viewers}</p>
                        </div>
                        <div className="rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 col-span-2">
                          <p className="text-[0.65rem] font-black uppercase tracking-wider text-slate-500">Channel URL</p>
                          <p className="text-sm font-bold text-cyan-300 truncate">{app.channel_url || 'N/A'}</p>
                        </div>
                      </div>

                      {app.motivation && (
                        <button
                          type="button"
                          onClick={() => toggleExpanded(app.id)}
                          className="flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-white transition-colors"
                        >
                          {isExpanded ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          {isExpanded ? 'Hide' : 'Show'} Details
                        </button>
                      )}

                      {isExpanded && (
                        <div className="space-y-3 animate-fade-in">
                          {app.motivation && (
                            <div className="rounded-xl border border-white/10 bg-black/30 p-4">
                              <p className="text-[0.65rem] font-black uppercase tracking-wider text-slate-500 mb-2">Motivation</p>
                              <p className="text-sm leading-relaxed text-slate-300">{app.motivation}</p>
                            </div>
                          )}
                          {app.experience && (
                            <div className="rounded-xl border border-white/10 bg-black/30 p-4">
                              <p className="text-[0.65rem] font-black uppercase tracking-wider text-slate-500 mb-2">Experience</p>
                              <p className="text-sm leading-relaxed text-slate-300">{app.experience}</p>
                            </div>
                          )}
                          {app.content_category && app.content_category.length > 0 && (
                            <div className="rounded-xl border border-white/10 bg-black/30 p-4">
                              <p className="text-[0.65rem] font-black uppercase tracking-wider text-slate-500 mb-2">Content Categories</p>
                              <div className="flex flex-wrap gap-2">
                                {app.content_category.map((cat) => (
                                  <span key={cat} className="rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-xs font-bold text-slate-300">
                                    {cat}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                          {app.referral_code && (
                            <div className="rounded-xl border border-white/10 bg-black/30 p-4">
                              <p className="text-[0.65rem] font-black uppercase tracking-wider text-slate-500 mb-2">Referral Code</p>
                              <p className="text-sm font-bold text-amber-300">{app.referral_code}</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="flex flex-row md:flex-col gap-3 justify-center md:justify-start md:min-w-[140px]">
                      <button
                        type="button"
                        onClick={() => setModalState({ type: 'approve', application: app })}
                        disabled={isProcessing}
                        className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-emerald-400/30 bg-emerald-500/15 px-4 py-2.5 text-sm font-black text-emerald-200 transition-all hover:bg-emerald-500/25 hover:shadow-lg hover:shadow-emerald-500/15 disabled:opacity-50"
                      >
                        {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                        Approve
                      </button>
                      <button
                        type="button"
                        onClick={() => setModalState({ type: 'reject', application: app })}
                        disabled={isProcessing}
                        className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-red-400/30 bg-red-500/15 px-4 py-2.5 text-sm font-black text-red-200 transition-all hover:bg-red-500/25 hover:shadow-lg hover:shadow-red-500/15 disabled:opacity-50"
                      >
                        {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
                        Reject
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {modalState?.type === 'approve' && (
        <ApproveModal
          application={modalState.application}
          onClose={() => setModalState(null)}
          onConfirm={handleApproveConfirm}
        />
      )}
      {modalState?.type === 'reject' && (
        <RejectModal
          application={modalState.application}
          onClose={() => setModalState(null)}
          onConfirm={handleRejectConfirm}
        />
      )}
    </div>
  );
}
