import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../lib/store';
import { Loader } from '../../components/ui/loader';
import { useAgencyApplication } from '../../hooks/useAgency';
import { useAgencyMember } from '../../hooks/useAgency';
import { toast } from 'sonner';
import { ArrowLeft, Send, Clock3, XCircle } from 'lucide-react';

const PLATFORMS = ['twitch', 'youtube', 'tiktok', 'kick', 'other'];
const CATEGORIES = ['Gaming', 'IRL', 'Music', 'Art', 'Sports', 'Tech', 'Education', 'Comedy', 'ASMR', 'Cooking'];

export default function AgencyApplyPage() {
  const navigate = useNavigate();
  const { profile } = useAuthStore();
  const { application, submit, loading: appLoading } = useAgencyApplication();
  const { member } = useAgencyMember();
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    display_name: profile?.username || '',
    primary_platform: 'twitch',
    channel_url: '',
    avg_weekly_hours: '',
    avg_weekly_viewers: '',
    content_category: [] as string[],
    motivation: '',
    experience: '',
    referral_code: '',
  });

  if (appLoading) return <Loader />;

  if (member) {
    navigate('/agency-dashboard');
    return null;
  }

  if (application?.status === 'pending') {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-4">
        <div className="glass-panel rounded-3xl border border-yellow-400/20 bg-yellow-500/5 backdrop-blur-2xl p-8 max-w-md w-full text-center">
          <Clock3 className="mx-auto mb-4 h-16 w-16 text-yellow-400" />
          <h2 className="text-2xl font-black mb-3 text-yellow-300">Application Pending</h2>
          <p className="text-slate-400 mb-2">Your agency application is under review.</p>
          <p className="text-sm text-slate-500">
            Submitted: {new Date(application.created_at).toLocaleDateString()}
          </p>
          <button
            onClick={() => navigate('/agency-dashboard')}
            className="mt-6 rounded-xl border border-white/10 bg-white/5 px-6 py-2 text-sm font-medium text-white transition hover:bg-white/10"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (application?.status === 'rejected') {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-4">
        <div className="glass-panel rounded-3xl border border-red-400/20 bg-red-500/5 backdrop-blur-2xl p-8 max-w-md w-full text-center">
          <XCircle className="mx-auto mb-4 h-16 w-16 text-red-400" />
          <h2 className="text-2xl font-black mb-3 text-red-300">Application Not Approved</h2>
          <p className="text-slate-400 mb-2">
            {application.rejection_reason || 'Your application was not approved at this time.'}
          </p>
          <button
            onClick={() => navigate('/agency-apply')}
            className="mt-6 rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 px-6 py-3 font-bold text-white transition-all hover:shadow-[0_0_30px_rgba(147,51,234,0.4)]"
          >
            Apply Again
          </button>
        </div>
      </div>
    );
  }

  const toggleCategory = (cat: string) => {
    setForm(prev => ({
      ...prev,
      content_category: prev.content_category.includes(cat)
        ? prev.content_category.filter(c => c !== cat)
        : [...prev.content_category, cat],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.display_name.trim()) {
      toast.error('Display name is required');
      return;
    }
    if (!form.primary_platform) {
      toast.error('Primary platform is required');
      return;
    }

    setSubmitting(true);
    try {
      await submit({
        display_name: form.display_name.trim(),
        primary_platform: form.primary_platform,
        channel_url: form.channel_url.trim() || undefined,
        avg_weekly_hours: parseFloat(form.avg_weekly_hours) || 0,
        avg_weekly_viewers: parseInt(form.avg_weekly_viewers) || 0,
        content_category: form.content_category,
        motivation: form.motivation.trim() || undefined,
        experience: form.experience.trim() || undefined,
        referral_code: form.referral_code.trim() || undefined,
      });
      toast.success('Application submitted successfully!');
    } catch (err: any) {
      toast.error(err.message || 'Failed to submit application');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-2xl px-4 py-8">
        <button
          onClick={() => navigate(-1)}
          className="mb-6 flex items-center gap-2 text-sm text-slate-400 transition hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>

        <div className="mb-8 text-center">
          <h1 className="text-3xl font-black bg-gradient-to-r from-purple-400 via-blue-400 to-cyan-400 bg-clip-text text-transparent">
            Apply to HytroGaming Agency
          </h1>
          <p className="mt-2 text-slate-400">
            Join our creator agency and earn points for your content
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur-2xl p-6 space-y-5">
            <h2 className="text-lg font-bold text-white">Basic Information</h2>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-300">Display Name *</label>
              <input
                type="text"
                value={form.display_name}
                onChange={e => setForm(prev => ({ ...prev, display_name: e.target.value }))}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder-slate-500 outline-none transition focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/30"
                placeholder="Your creator name"
                required
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-300">Primary Platform *</label>
                <select
                  value={form.primary_platform}
                  onChange={e => setForm(prev => ({ ...prev, primary_platform: e.target.value }))}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/30"
                >
                  {PLATFORMS.map(p => (
                    <option key={p} value={p} className="bg-slate-900">{p.charAt(0).toUpperCase() + p.slice(1)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-300">Channel URL</label>
                <input
                  type="url"
                  value={form.channel_url}
                  onChange={e => setForm(prev => ({ ...prev, channel_url: e.target.value }))}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder-slate-500 outline-none transition focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/30"
                  placeholder="https://twitch.tv/yourname"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-300">Avg Weekly Hours</label>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={form.avg_weekly_hours}
                  onChange={e => setForm(prev => ({ ...prev, avg_weekly_hours: e.target.value }))}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder-slate-500 outline-none transition focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/30"
                  placeholder="e.g. 20"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-300">Avg Weekly Viewers</label>
                <input
                  type="number"
                  min="0"
                  value={form.avg_weekly_viewers}
                  onChange={e => setForm(prev => ({ ...prev, avg_weekly_viewers: e.target.value }))}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder-slate-500 outline-none transition focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/30"
                  placeholder="e.g. 500"
                />
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur-2xl p-6 space-y-5">
            <h2 className="text-lg font-bold text-white">Content</h2>
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-300">Content Categories</label>
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map(cat => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => toggleCategory(cat)}
                    className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                      form.content_category.includes(cat)
                        ? 'border-purple-500/50 bg-purple-500/20 text-purple-300'
                        : 'border-white/10 bg-white/5 text-slate-400 hover:border-white/20 hover:text-white'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur-2xl p-6 space-y-5">
            <h2 className="text-lg font-bold text-white">About You</h2>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-300">Why do you want to join?</label>
              <textarea
                value={form.motivation}
                onChange={e => setForm(prev => ({ ...prev, motivation: e.target.value }))}
                rows={3}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder-slate-500 outline-none transition focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/30 resize-none"
                placeholder="Tell us why you'd be a great fit..."
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-300">Streaming/Creation Experience</label>
              <textarea
                value={form.experience}
                onChange={e => setForm(prev => ({ ...prev, experience: e.target.value }))}
                rows={3}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder-slate-500 outline-none transition focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/30 resize-none"
                placeholder="Describe your experience..."
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-300">Referral Code (optional)</label>
              <input
                type="text"
                value={form.referral_code}
                onChange={e => setForm(prev => ({ ...prev, referral_code: e.target.value }))}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder-slate-500 outline-none transition focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/30"
                placeholder="Enter referral code"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 px-6 py-4 font-bold text-white transition-all hover:shadow-[0_0_30px_rgba(147,51,234,0.4)] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {submitting ? (
              <>
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                Submitting...
              </>
            ) : (
              <>
                <Send className="h-5 w-5" />
                Submit Application
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
