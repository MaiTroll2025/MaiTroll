import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/lib/store';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { ArrowLeft, Briefcase, CheckCircle2, Clock3, Gamepad2, Loader2, XCircle, AlertTriangle } from 'lucide-react';
import GamingLoanModal from '@/components/broadcast/GamingLoanModal';

const REQUIRED_COINS = 5000;

const CONTENT_CATEGORIES = [
  'FPS',
  'MOBA',
  'Battle Royale',
  'RPG',
  'Strategy',
  'Sports',
  'Racing',
  'Fighting',
  'Survival',
  'Sandbox',
  'Other',
];

const PLATFORMS = ['twitch', 'youtube', 'kick', 'tiktok', 'other'];

export default function HytroGamingApply() {
  const navigate = useNavigate();
  const { user, profile } = useAuthStore();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [existingApp, setExistingApp] = useState<any>(null);
  const [showLoanModal, setShowLoanModal] = useState(false);
  const [hasLoan, setHasLoan] = useState(false);
  const [_insufficientBalance, setInsufficientBalance] = useState(false);

  const [displayName, setDisplayName] = useState('');
  const [primaryPlatform, setPrimaryPlatform] = useState('twitch');
  const [channelUrl, setChannelUrl] = useState('');
  const [avgWeeklyHours, setAvgWeeklyHours] = useState('');
  const [avgWeeklyViewers, setAvgWeeklyViewers] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [motivation, setMotivation] = useState('');
  const [experience, setExperience] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [applyForLoan, setApplyForLoan] = useState(false);
  const [loanAmount, setLoanAmount] = useState('');
  const MAX_LOAN_AMOUNT = 5000;

  const toggleCategory = (cat: string) => {
    setSelectedCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  };

  const checkExisting = useCallback(async () => {
    if (!user) return;
    try {
      const { data } = await supabase
        .from('agency_applications')
        .select('id, status, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      setExistingApp(data);
    } catch {
      setExistingApp(null);
    }
  }, [user]);

  const _checkBalanceAndLoan = useCallback(() => {
    const balance = profile?.troll_coins ?? 0;
    if (balance < REQUIRED_COINS) {
      setInsufficientBalance(true);
      setShowLoanModal(true);
      return false;
    }
    setInsufficientBalance(false);
    return true;
  }, [profile?.troll_coins]);

  useEffect(() => {
    if (!user) {
      navigate('/auth');
      return;
    }
    setDisplayName(profile?.display_name || profile?.username || '');
    checkExisting().finally(() => setLoading(false));
  }, [user, profile, navigate, checkExisting]);

  const handleSubmit = async () => {
    if (!user) {
      toast.error('Please sign in to apply');
      return;
    }
    if (!displayName.trim()) {
      toast.error('Display name is required');
      return;
    }
    if (!primaryPlatform) {
      toast.error('Select your primary platform');
      return;
    }

    const balance = profile?.troll_coins ?? 0;
    // If the user requested a loan (either inline or via the loan modal),
    // they don't need to meet the balance requirement up front — the loan
    // covers the startup fee. Only block when they have no loan and can't pay.
    const usingLoan = applyForLoan || hasLoan;

    if (!usingLoan && balance < REQUIRED_COINS) {
      setInsufficientBalance(true);
      setShowLoanModal(true);
      return;
    }

    if (applyForLoan) {
      const loanVal = parseFloat(loanAmount) || 0;
      if (loanVal <= 0) {
        toast.error('Enter a valid loan amount');
        return;
      }
      if (loanVal > 5000) {
        toast.error('Loan amount cannot exceed 5,000 Troll Coins');
        return;
      }
    }

    setSubmitting(true);
    try {
      const { error } = await supabase.from('agency_applications').insert({
        user_id: user.id,
        applicant_id: user.id,
        display_name: displayName.trim(),
        primary_platform: primaryPlatform,
        channel_url: channelUrl.trim() || null,
        avg_weekly_hours: parseFloat(avgWeeklyHours) || 0,
        avg_weekly_viewers: parseInt(avgWeeklyViewers) || 0,
        content_category: selectedCategories,
        motivation: motivation.trim() || null,
        experience: experience.trim() || null,
        referral_code: referralCode.trim() || null,
        apply_for_loan: usingLoan,
        loan_amount: applyForLoan ? (parseFloat(loanAmount) || 0) : 0,
        // Auto-approve instantly so applicants can start game sharing right away.
        status: 'approved',
      });

      if (error) throw error;

      toast.success('Application approved! You can start game sharing now.');
      navigate('/hytrogaming');
    } catch (err: any) {
      console.error('HytroGaming application error:', err);
      toast.error(err.message || 'Failed to submit application');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-cyan-400" />
      </div>
    );
  }

  if (existingApp?.status === 'pending') {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-4">
        <div className="max-w-md w-full rounded-3xl border border-amber-400/20 bg-amber-500/5 p-8 text-center">
          <Clock3 className="mx-auto mb-4 h-16 w-16 text-amber-400" />
          <h2 className="text-2xl font-black text-amber-300">Application Pending</h2>
          <p className="mt-3 text-slate-400">
            Your HytroGaming agency application is under review by Agency HR.
          </p>
          <p className="mt-2 text-sm text-slate-500">
            Submitted: {new Date(existingApp.created_at).toLocaleDateString()}
          </p>
          <button
            onClick={() => navigate('/hytrogaming')}
            className="mt-6 rounded-xl bg-cyan-500/20 px-6 py-3 font-bold text-cyan-50 hover:bg-cyan-500/30"
          >
            Back to HytroGaming
          </button>
        </div>
      </div>
    );
  }

  if (existingApp?.status === 'approved') {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-4">
        <div className="max-w-md w-full rounded-3xl border border-emerald-400/20 bg-emerald-500/5 p-8 text-center">
          <CheckCircle2 className="mx-auto mb-4 h-16 w-16 text-emerald-400" />
          <h2 className="text-2xl font-black text-emerald-300">Already Approved</h2>
          <p className="mt-3 text-slate-400">
            Your HytroGaming agency application has been approved.
          </p>
          <button
            onClick={() => navigate('/hytrogaming')}
            className="mt-6 rounded-xl bg-cyan-500/20 px-6 py-3 font-bold text-cyan-50 hover:bg-cyan-500/30"
          >
            Start Game Sharing
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_12%_10%,rgba(34,211,238,0.12),transparent_30%),radial-gradient(circle_at_84%_18%,rgba(168,85,247,0.10),transparent_32%)]" />

      <main className="relative mx-auto max-w-2xl px-4 py-8">
        <button
          type="button"
          onClick={() => navigate('/hytrogaming')}
          className="mb-6 inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold text-white/75 transition hover:bg-white/10"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to HytroGaming
        </button>

        <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 shadow-2xl shadow-black/30 backdrop-blur-xl sm:p-8">
          <div className="mb-6 flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-purple-500/20 to-cyan-500/20">
              <Gamepad2 className="h-6 w-6 text-cyan-300" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-white">Apply for HytroGaming Agency</h1>
              <p className="text-sm text-slate-400">Join as a creator, earn points, and climb tiers</p>
            </div>
          </div>

          {existingApp?.status === 'rejected' && (
            <div className="mb-6 rounded-2xl border border-red-400/20 bg-red-500/10 p-4">
              <div className="flex items-center gap-2 text-red-200">
                <XCircle className="h-5 w-5" />
                <p className="text-sm font-bold">Previous application was rejected</p>
              </div>
              <p className="mt-1 text-xs text-red-300/70">You may submit a new application below.</p>
            </div>
          )}

          <div className="space-y-5">
            <div>
              <label className="text-xs font-black uppercase tracking-[0.16em] text-slate-300">Display Name *</label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Your gaming alias"
                className="mt-2 w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white placeholder:text-slate-500 outline-none transition focus:border-cyan-300/60 focus:ring-2 focus:ring-cyan-400/20"
              />
            </div>

            <div>
              <label className="text-xs font-black uppercase tracking-[0.16em] text-slate-300">Primary Platform *</label>
              <select
                value={primaryPlatform}
                onChange={(e) => setPrimaryPlatform(e.target.value)}
                className="mt-2 w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/60 focus:ring-2 focus:ring-cyan-400/20"
              >
                {PLATFORMS.map((p) => (
                  <option key={p} value={p} className="bg-slate-900">
                    {p.charAt(0).toUpperCase() + p.slice(1)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-black uppercase tracking-[0.16em] text-slate-300">Channel URL</label>
              <input
                type="url"
                value={channelUrl}
                onChange={(e) => setChannelUrl(e.target.value)}
                placeholder="https://twitch.tv/yourchannel"
                className="mt-2 w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white placeholder:text-slate-500 outline-none transition focus:border-cyan-300/60 focus:ring-2 focus:ring-cyan-400/20"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-xs font-black uppercase tracking-[0.16em] text-slate-300">Avg Weekly Hours</label>
                <input
                  type="number"
                  value={avgWeeklyHours}
                  onChange={(e) => setAvgWeeklyHours(e.target.value)}
                  placeholder="e.g. 20"
                  min="0"
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white placeholder:text-slate-500 outline-none transition focus:border-cyan-300/60 focus:ring-2 focus:ring-cyan-400/20"
                />
              </div>
              <div>
                <label className="text-xs font-black uppercase tracking-[0.16em] text-slate-300">Avg Weekly Viewers</label>
                <input
                  type="number"
                  value={avgWeeklyViewers}
                  onChange={(e) => setAvgWeeklyViewers(e.target.value)}
                  placeholder="e.g. 500"
                  min="0"
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white placeholder:text-slate-500 outline-none transition focus:border-cyan-300/60 focus:ring-2 focus:ring-cyan-400/20"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-black uppercase tracking-[0.16em] text-slate-300">Content Categories</label>
              <div className="mt-2 flex flex-wrap gap-2">
                {CONTENT_CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => toggleCategory(cat)}
                    className={`rounded-xl border px-3 py-1.5 text-xs font-bold transition ${
                      selectedCategories.includes(cat)
                        ? 'border-cyan-300/40 bg-cyan-500/20 text-cyan-100'
                        : 'border-white/10 bg-white/5 text-slate-400 hover:bg-white/10'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-black uppercase tracking-[0.16em] text-slate-300">Motivation</label>
              <textarea
                value={motivation}
                onChange={(e) => setMotivation(e.target.value)}
                placeholder="Why do you want to join the HytroGaming Agency?"
                rows={3}
                className="mt-2 w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white placeholder:text-slate-500 outline-none transition focus:border-cyan-300/60 focus:ring-2 focus:ring-cyan-400/20"
              />
            </div>

            <div>
              <label className="text-xs font-black uppercase tracking-[0.16em] text-slate-300">Streaming Experience</label>
              <textarea
                value={experience}
                onChange={(e) => setExperience(e.target.value)}
                placeholder="Tell us about your streaming background and achievements"
                rows={3}
                className="mt-2 w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white placeholder:text-slate-500 outline-none transition focus:border-cyan-300/60 focus:ring-2 focus:ring-cyan-400/20"
              />
            </div>

            <div>
              <label className="text-xs font-black uppercase tracking-[0.16em] text-slate-300">Referral Code (optional)</label>
              <input
                type="text"
                value={referralCode}
                onChange={(e) => setReferralCode(e.target.value)}
                placeholder="Enter referral code if you have one"
                className="mt-2 w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white placeholder:text-slate-500 outline-none transition focus:border-cyan-300/60 focus:ring-2 focus:ring-cyan-400/20"
              />
            </div>
          </div>

          {/* Low Balance Warning */}
          {(profile?.troll_coins ?? 0) < REQUIRED_COINS && (
            <div className="rounded-2xl border border-amber-400/30 bg-amber-500/10 p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 shrink-0 text-amber-400 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-bold text-amber-200">Insufficient Balance</p>
                  <p className="mt-1 text-xs text-amber-300/80">
                    You need at least {REQUIRED_COINS.toLocaleString()} Troll Coins to apply for HytroGaming Agency.
                    Your current balance is {(profile?.troll_coins ?? 0).toLocaleString()} TC.
                    Shortfall: {(REQUIRED_COINS - (profile?.troll_coins ?? 0)).toLocaleString()} TC.
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowLoanModal(true)}
                    className="mt-3 inline-flex items-center gap-2 rounded-xl bg-amber-500/20 px-4 py-2 text-xs font-bold text-amber-100 transition hover:bg-amber-500/30"
                  >
                    Apply for Gaming Loan
                  </button>
                </div>
              </div>
            </div>
          )}
          {/* Loan Application Section */}
          <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-sm font-black text-white">Need a Loan?</h3>
                <p className="mt-1 text-xs text-slate-400">
                  Apply for a loan to cover the agency startup fee. Monthly fee is 5,000 Troll Coins.
                  Tips received while streaming go toward loan balance first.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setApplyForLoan(!applyForLoan)}
                className={`shrink-0 rounded-xl border px-4 py-2 text-xs font-bold transition ${
                  applyForLoan
                    ? 'border-cyan-300/40 bg-cyan-500/20 text-cyan-100'
                    : 'border-white/10 bg-white/5 text-slate-400 hover:bg-white/10'
                }`}
              >
                {applyForLoan ? 'Loan Applied ✓' : 'Apply for Loan'}
              </button>
            </div>

            {applyForLoan && (
              <div className="mt-4 space-y-3">
                <div>
                  <label className="text-xs font-bold text-slate-300">Loan Amount (Troll Coins, max 5,000)</label>
                  <input
                    type="number"
                    value={loanAmount}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === '') {
                        setLoanAmount('');
                        return;
                      }
                      const num = parseFloat(val);
                      if (num > MAX_LOAN_AMOUNT) {
                        setLoanAmount(String(MAX_LOAN_AMOUNT));
                        toast.warning(`Maximum loan is ${MAX_LOAN_AMOUNT.toLocaleString()} TC`);
                      } else {
                        setLoanAmount(val);
                      }
                    }}
                    placeholder="e.g. 5000"
                    min="0"
                    max={MAX_LOAN_AMOUNT}
                    className="mt-2 w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white placeholder:text-slate-500 outline-none transition focus:border-cyan-300/60 focus:ring-2 focus:ring-cyan-400/20"
                  />
                </div>
                <div className="rounded-xl border border-amber-400/20 bg-amber-400/5 p-3">
                  <p className="text-[11px] text-amber-200">
                    <strong>Loan Terms:</strong> Startup fee same as regular agencies. Monthly fee: 5,000 TC (vs 10,000 TC regular).
                    All tips go toward loan balance first. No cashouts allowed until loan is fully paid off.
                    Loan is restricted to Hytro Gaming Agency use only.
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-slate-500">
              By applying, you agree to the HytroGaming Agency terms. Applications are reviewed by Agency HR.
            </p>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting || !displayName.trim()}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-purple-500 to-blue-500 px-6 py-3 text-sm font-black text-white shadow-lg shadow-purple-500/20 transition hover:scale-[1.02] disabled:opacity-50"
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Briefcase className="h-4 w-4" />
              )}
              {submitting ? 'Submitting...' : 'Submit Application'}
            </button>
          </div>
        </div>
      </main>

      <GamingLoanModal
        isOpen={showLoanModal}
        onClose={() => setShowLoanModal(false)}
        currentBalance={profile?.troll_coins ?? 0}
        onLoanApproved={() => {
          setHasLoan(true);
          setInsufficientBalance(false);
        }}
      />
    </div>
  );
}
