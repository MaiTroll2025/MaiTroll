import { useNavigate } from 'react-router-dom';
import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../lib/store';
import { useXPStore } from '../stores/useXPStore';
import { toast } from 'sonner';
import {
  Zap,
  Crown,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Upload,
  DollarSign,
  Wallet,
  User,
  Building,
  Loader2,
} from 'lucide-react';
import PayPalPaymentModal from '../components/broadcast/PayPalPaymentModal';
import { MAI_PAY_PLUS_PRICE_USD, MAI_PAY_PLUS_ITEM_KEY } from '../config/coinConfig';

type ApplicationStatus = 'not_applied' | 'pending' | 'under_review' | 'approved' | 'rejected';

const PAYOUT_METHODS = [
  { value: 'cash_app', label: 'Cash App', icon: Building, placeholder: '$Cashtag' },
  { value: 'paypal', label: 'PayPal', icon: Wallet, placeholder: 'PayPal email' },
  { value: 'venmo', label: 'Venmo', icon: User, placeholder: 'Venmo handle' },
];

const FAST_PAY_TIERS: Record<string, { label: string; processingTime: string }> = {
  standard: { label: 'Standard', processingTime: 'Anytime' },
  fast_pay: { label: 'Fast Pay', processingTime: 'Within 24 hours' },
  instant: { label: 'Instant Pay', processingTime: 'Instant' },
};

const ELIGIBLE_COIN_SOURCES = [
  'marketplace_earnings',
  'auction_earnings',
  'auction_winnings',
  'gift_received',
  'treasury_weekly_payout',
  'treasury_payout',
  'freelancer_earnings',
  'broadcast_earnings',
  'stream_earnings',
  'quest_rewards',
  'job_earnings',
  'referral_bonus',
  'marketplace_payout',
];

const ID_BUCKET = 'verification_docs';
const MAX_ID_FILE_SIZE = 5 * 1024 * 1024;

export default function FastPayApplication() {
  const { profile } = useAuthStore();
  const xpStore = useXPStore();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [appStatus, setAppStatus] = useState<ApplicationStatus>('not_applied');
  const [existingApp, setExistingApp] = useState<any>(null);

  const [payoutMethod, setPayoutMethod] = useState('cash_app');
  const [payoutUsername, setPayoutUsername] = useState('');
  const [payoutEmail, setPayoutEmail] = useState('');
  const [cashtag, setCashtag] = useState('');
  const [venmoHandle, setVenmoHandle] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [acceptedFees, setAcceptedFees] = useState(false);
  const [acceptedIdentity, setAcceptedIdentity] = useState(false);
  const [idFile, setIdFile] = useState<File | null>(null);
  const [idUploading, setIdUploading] = useState(false);
  const [idUrl, setIdUrl] = useState<string | null>(null);

  // Plan selection: Standard (free) or MAI Pay Plus (paid one-time upgrade)
  const [selectedPlan, setSelectedPlan] = useState<'standard' | 'plus'>('standard');
  const [paypalModalOpen, setPaypalModalOpen] = useState(false);
  const isPlusActive = Boolean((profile as any)?.mai_pay_plus);

  const userLevel = Number(xpStore.level || 1);
  const tier = userLevel >= 1000 ? 'instant' : userLevel >= 500 ? 'fast_pay' : 'standard';
  const tierInfo = FAST_PAY_TIERS[tier];

  const accountAgeDays = useMemo(() => {
    if (!profile?.created_at) return 0;
    return Math.floor((Date.now() - new Date(profile.created_at).getTime()) / (1000 * 60 * 60 * 24));
  }, [profile]);

  const hasVerifiedIdentity = !!profile?.verified_since;
  const hasViolations = !!((profile as any)?.banned_at || (profile as any)?.suspended_until);
  const hasFraudHistory = !!(profile as any)?.fast_pay_no_fraud_history === false;

  const requirements = useMemo(() => [
    { key: 'identity', label: 'Verified Identity', met: hasVerifiedIdentity, detail: 'Government-issued ID verified' },
    { key: 'violations', label: 'No Active Violations', met: !hasViolations, detail: 'No active bans or suspensions' },
    { key: 'age', label: 'Account Older Than 30 Days', met: accountAgeDays >= 30, detail: `${accountAgeDays} days old` },
    { key: 'fraud', label: 'Clean Payment History', met: !hasFraudHistory, detail: 'No fraud or chargeback history' },
  ], [hasVerifiedIdentity, hasViolations, accountAgeDays, hasFraudHistory, tierInfo]);

  const unmetRequirements = requirements.filter(r => !r.met);

  useEffect(() => {
    async function checkExisting() {
      if (!profile?.id) return;
      try {
        const { data, error } = await supabase
          .from('fast_pay_applications')
          .select('*')
          .eq('user_id', profile.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (data && !error) {
          setExistingApp(data);
          setAppStatus(data.status as ApplicationStatus);
          setIdUrl(data.id_verification_url || null);
        }
        if (profile.cashout_approved && appStatus !== 'approved') {
          setAppStatus('approved');
        }
      } catch {
        // No existing application
        setAppStatus('not_applied');
      } finally {
        setLoading(false);
      }
    }
    checkExisting();
  }, [profile]);

  const currentPayoutMethod = PAYOUT_METHODS.find(m => m.value === payoutMethod);
  const IconComponent = currentPayoutMethod?.icon || Wallet;

  const handleIdUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !profile) return;

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Only JPG, PNG, WebP, or PDF files are allowed for ID upload');
      return;
    }

    if (file.size > MAX_ID_FILE_SIZE) {
      toast.error('ID file must be less than 5MB');
      return;
    }

    try {
      setIdUploading(true);
      const fileName = `${ID_BUCKET}/${profile.id}/${Date.now()}-${file.name}`;
      const { error: uploadError } = await supabase.storage.from(ID_BUCKET).upload(fileName, file, {
        cacheControl: '3600',
        upsert: false,
      });

      if (uploadError) throw uploadError;

      const { data: urlData, error: signError } = await supabase.storage
        .from(ID_BUCKET)
        .createSignedUrl(fileName, 600);
      if (signError) throw signError;

      setIdFile(file);
      setIdUrl(urlData.signedUrl);
      toast.success('ID uploaded successfully');
    } catch (err: any) {
      console.error('ID upload error:', err);
      toast.error('Failed to upload ID: ' + (err.message || 'Unknown error'));
    } finally {
      setIdUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!acceptedTerms || !acceptedFees || !acceptedIdentity) {
      toast.error('Please accept all terms and requirements');
      return;
    }

    if (!idUrl) {
      toast.error('Please upload your government-issued ID');
      return;
    }

    const finalUsername = payoutUsername.trim();
    const finalEmail = payoutEmail.trim() || null;
    const finalCashtag = cashtag.trim() || null;
    const finalVenmo = venmoHandle.trim() || null;
    const payoutIdentifier = payoutMethod === 'cash_app'
      ? finalCashtag
      : payoutMethod === 'paypal'
        ? finalEmail
        : finalVenmo;

    if (payoutMethod === 'cash_app' && !finalCashtag && !finalUsername) {
      toast.error('Please enter your Cash App $Cashtag');
      return;
    }
    if (payoutMethod === 'paypal' && !finalEmail && !finalUsername) {
      toast.error('Please enter your PayPal email');
      return;
    }
    if (payoutMethod === 'venmo' && !finalVenmo && !finalUsername) {
      toast.error('Please enter your Venmo handle');
      return;
    }

    if (existingApp && ['pending', 'under_review', 'approved'].includes(existingApp.status)) {
      toast.error('You already have a pending or approved application');
      return;
    }

    setSubmitting(true);
    try {
      const applicationPayload = {
        user_id: profile.id,
        payout_method: payoutMethod,
        payout_username: payoutIdentifier || finalUsername,
        payout_email: finalEmail,
        cashtag: finalCashtag,
        venmo_handle: finalVenmo,
        accepted_terms: acceptedTerms,
        accepted_fees: acceptedFees,
        accepted_identity_verification: acceptedIdentity,
        user_level: userLevel,
        account_age_days: accountAgeDays,
        has_verified_identity: hasVerifiedIdentity,
        has_violations: hasViolations,
        has_fraud_history: hasFraudHistory,
        id_verification_url: idUrl,
        id_verification_uploaded_at: new Date().toISOString(),
        status: 'pending',
      };

      const { data, error } = await supabase
        .from('fast_pay_applications')
        .upsert(applicationPayload, { onConflict: 'user_id' })
        .select()
        .single();

      if (error) throw error;

      setExistingApp(data);
      setAppStatus('pending');
      toast.success('Cashout profile saved.');

      // MAI Pay Plus: if selected and not already active, collect the one-time
      // upgrade payment. The server sets mai_pay_plus on successful capture.
      if (selectedPlan === 'plus' && !isPlusActive) {
        setSubmitting(false);
        setPaypalModalOpen(true);
        return;
      }
    } catch (err: any) {
      console.error('Error submitting Fast Pay application:', err);
      toast.error(err?.message || 'Failed to submit application');
    } finally {
      setSubmitting(false);
    }
  };

  const tierStyles: Record<string, { gradient: string; border: string; badge: string; iconColor: string }> = {
    standard: {
      gradient: 'from-slate-600 to-slate-700',
      border: 'border-slate-500/30',
      badge: 'bg-slate-700 text-slate-300 border-slate-500/30',
      iconColor: 'text-slate-400',
    },
    fast_pay: {
      gradient: 'from-cyan-500 to-blue-600',
      border: 'border-cyan-400/30',
      badge: 'bg-cyan-900/60 text-cyan-300 border-cyan-500/30',
      iconColor: 'text-cyan-300',
    },
    instant: {
      gradient: 'from-amber-400 via-yellow-500 to-orange-500',
      border: 'border-amber-400/30',
      badge: 'bg-amber-900/60 text-amber-300 border-amber-500/30',
      iconColor: 'text-amber-300',
    },
  };
  const style = tierStyles[tier];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-10 w-10 rounded-full border-4 border-cyan-400/30 border-t-cyan-400 animate-spin" />
      </div>
    );
  }

  const showApplicationForm = appStatus === 'not_applied' || appStatus === 'rejected';
  const showStatus = appStatus === 'pending' || appStatus === 'under_review' || appStatus === 'approved';

  return (
    <div className="min-h-screen bg-slate-950 p-6">
      <div className="mx-auto max-w-3xl space-y-6">
        {/* Header */}
          <div className="text-center">
            <div className={`inline-flex items-center gap-3 rounded-2xl border ${style.border} bg-slate-950/70 px-6 py-4`}>
              <div className={`flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${style.gradient}`}>
                {tier === 'instant' ? <Crown className={`h-6 w-6 text-white`} /> : <Zap className={`h-6 w-6 text-white`} />}
              </div>
              <div className="text-left">
                <h1 className="text-2xl font-black text-white">Cashout Profile</h1>
                <p className={`text-sm ${style.iconColor}`}>
                  Cash out anytime — no levels, no approval required.
                </p>
              </div>
            </div>
          </div>

        {/* Benefits */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-center">
            <Clock className="mx-auto mb-2 h-6 w-6 text-cyan-400" />
            <p className="text-lg font-black text-white">{tierInfo.processingTime}</p>
            <p className="text-xs text-slate-500">Processing Speed</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-center">
            <DollarSign className="mx-auto mb-2 h-6 w-6 text-cyan-400" />
            <p className="text-lg font-black text-white">0% fee</p>
            <p className="text-xs text-slate-500">Cashout Fee</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-center">
            <Zap className="mx-auto mb-2 h-6 w-6 text-cyan-400" />
            <p className="text-lg font-black text-white">
              {tier === 'instant' ? '20 Per Week' : '10 Per Week'}
            </p>
            <p className="text-xs text-slate-500">Rolling 7-day cashout limit</p>
          </div>
        </div>

        {/* Cashout-eligible coin sources */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <h3 className="mb-3 text-sm font-bold text-slate-400 uppercase tracking-wider">All Earned Coins Are Cashable</h3>
          <div className="grid grid-cols-2 gap-2 text-xs">
            {ELIGIBLE_COIN_SOURCES.map(source => (
              <div key={source} className="flex items-center gap-2 rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2">
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
                <span className="text-slate-300">{source.replace(/_/g, ' ')}</span>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-slate-500">
            All coins earned from these sources are automatically deposited into your Cashout Escrow and are eligible for cashout.
            No manual deposit needed.
          </p>
        </div>

        {/* Existing application status */}
        {showStatus && (existingApp || appStatus === 'approved') && (
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <h3 className="mb-3 text-sm font-bold text-slate-400 uppercase tracking-wider">Your Application</h3>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <span className={`text-xs px-2.5 py-1 rounded-full font-bold ${
                  appStatus === 'approved' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' :
                  appStatus === 'pending' || appStatus === 'under_review' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30' :
                  'bg-red-500/10 text-red-400 border border-red-500/30'
                }`}>
                  {appStatus === 'under_review' ? 'Under Review' : appStatus.charAt(0).toUpperCase() + appStatus.slice(1)}
                </span>
                <span className="text-xs text-slate-500">Submitted {existingApp?.created_at ? new Date(existingApp.created_at).toLocaleDateString() : 'now'}</span>
              </div>
               {appStatus === 'approved' && (
                <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3">
                  <div className="flex items-center gap-2 text-sm text-emerald-300">
                    <CheckCircle2 className="h-4 w-4" />
                    <span className="font-bold">Fast Pay profile on file!</span>
                  </div>
                  <p className="mt-1 text-xs text-slate-400">
                    You can request cashouts anytime once you reach a cashout tier. No level or approval required.
                  </p>
                </div>
              )}
              {appStatus === 'pending' || appStatus === 'under_review' ? (
                <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
                  <div className="flex items-center gap-2 text-sm text-amber-300">
                    <Clock className="h-4 w-4" />
                    <span className="font-bold">Application under review</span>
                  </div>
                  <p className="mt-1 text-xs text-slate-400">
                    We&apos;ll review your application within 24-48 hours. You&apos;ll receive a notification when it&apos;s processed.
                  </p>
                </div>
              ) : null}
              {existingApp && existingApp.admin_notes && (
                <p className="text-xs text-slate-500"><strong>Admin notes:</strong> {existingApp.admin_notes}</p>
              )}
            </div>
          </div>
        )}

        {/* Application form */}
        {showApplicationForm && (
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Plan selection */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <h3 className="mb-4 text-sm font-bold text-slate-400 uppercase tracking-wider">Choose Your Cashout Plan</h3>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setSelectedPlan('standard')}
                  className={`rounded-xl border p-4 text-left transition-all ${
                    selectedPlan === 'standard'
                      ? 'border-cyan-400/50 bg-cyan-500/10'
                      : 'border-white/10 bg-white/[0.02] hover:border-white/20'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-black text-white">Standard</span>
                    <span className="text-xs font-bold text-slate-300">Free</span>
                  </div>
                  <p className="mt-1 text-xs text-slate-400">
                    10 rolling cashouts / 24h. Standard coin requirements per tier.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedPlan('plus')}
                  disabled={isPlusActive}
                  className={`rounded-xl border p-4 text-left transition-all ${
                    selectedPlan === 'plus'
                      ? 'border-amber-400/50 bg-amber-500/10'
                      : 'border-white/10 bg-white/[0.02] hover:border-white/20'
                  } ${isPlusActive ? 'opacity-60 cursor-not-allowed' : ''}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-sm font-black text-amber-300">
                      <Crown className="h-4 w-4" /> MAI Pay Plus
                    </span>
                    <span className="text-xs font-bold text-amber-200">${MAI_PAY_PLUS_PRICE_USD}</span>
                  </div>
                  <p className="mt-1 text-xs text-slate-400">
                    {isPlusActive
                      ? 'Active — 20 cashouts / 24h, 2× coin requirements.'
                      : '20 rolling cashouts / 24h. Double coin requirements per tier.'}
                  </p>
                </button>
              </div>
            </div>

            {unmetRequirements.length > 0 && (
              <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-5">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 shrink-0 text-amber-400 mt-0.5" />
                  <div className="w-full">
                     <p className="text-sm font-bold text-amber-300">Review Your Cashout Profile</p>
                     <p className="text-xs text-slate-400 mt-1">
                       Keep your payout details and ID on file. This is optional and does not block cashouts — you can cash out anytime once you reach a cashout tier.
                     </p>
                     <div className="mt-3 space-y-2">
                       {unmetRequirements.map(req => (
                         <div key={req.key} className="flex items-center gap-2 text-xs">
                           <XCircle className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                           <span className="text-amber-200">{req.label}: {req.detail}</span>
                         </div>
                       ))}
                     </div>
                  </div>
                </div>
              </div>
            )}

            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <h3 className="mb-4 text-sm font-bold text-slate-400 uppercase tracking-wider">Payout Method</h3>
              <div className="grid grid-cols-3 gap-3 mb-4">
                {PAYOUT_METHODS.map(method => {
                  const MethodIcon = method.icon;
                  return (
                    <button
                      key={method.value}
                      type="button"
                      onClick={() => setPayoutMethod(method.value)}
                      className={`flex flex-col items-center gap-2 rounded-xl border px-4 py-3 transition-all ${
                        payoutMethod === method.value
                          ? 'border-cyan-400/50 bg-cyan-500/10'
                          : 'border-white/10 bg-white/[0.02] hover:border-white/20'
                      }`}
                    >
                      <MethodIcon className={`h-5 w-5 ${payoutMethod === method.value ? 'text-cyan-400' : 'text-slate-500'}`} />
                      <span className={`text-xs font-bold ${payoutMethod === method.value ? 'text-cyan-300' : 'text-slate-400'}`}>
                        {method.label}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-bold text-slate-400">
                  {currentPayoutMethod?.label} {currentPayoutMethod?.placeholder}
                </label>
                <div className="relative">
                  <IconComponent className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                  <input
                    type="text"
                    value={
                      payoutMethod === 'cash_app' ? cashtag :
                      payoutMethod === 'paypal' ? payoutEmail :
                      payoutMethod === 'venmo' ? venmoHandle : payoutUsername
                    }
                    onChange={(e) => {
                      if (payoutMethod === 'cash_app') setCashtag(e.target.value);
                      else if (payoutMethod === 'paypal') setPayoutEmail(e.target.value);
                      else if (payoutMethod === 'venmo') setVenmoHandle(e.target.value);
                      else setPayoutUsername(e.target.value);
                    }}
                    placeholder={currentPayoutMethod?.placeholder}
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 pl-10 text-sm text-white placeholder:text-slate-600 focus:border-cyan-400/40 focus:outline-none"
                    required
                  />
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <h3 className="mb-4 text-sm font-bold text-slate-400 uppercase tracking-wider">ID On File </h3>
              <p className="text-xs text-slate-400 mb-4">
                You may keep a government-issued ID on file for faster support. This is not required to cash out.
              </p>

              {!idUrl ? (
                <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-white/20 rounded-xl cursor-pointer bg-white/[0.02] hover:bg-white/[0.05] transition-colors">
                  <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    {idUploading ? (
                      <>
                        <Loader2 className="h-8 w-8 text-cyan-400 animate-spin mb-2" />
                        <p className="text-sm text-cyan-300">Uploading...</p>
                      </>
                    ) : (
                      <>
                        <Upload className="h-8 w-8 text-slate-400 mb-2" />
                        <p className="text-sm text-slate-300">
                          <span className="font-semibold">Click to upload</span> ID photo or PDF
                        </p>
                        <p className="text-xs text-slate-500">JPG, PNG, WebP, PDF (max 5MB)</p>
                      </>
                    )}
                  </div>
                  <input
                    type="file"
                    className="hidden"
                    accept="image/jpeg,image/png,image/webp,application/pdf"
                    onChange={handleIdUpload}
                    disabled={idUploading}
                  />
                </label>
              ) : (
                <div className="flex items-center gap-3 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                  <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                  <div className="flex-1 min-w-0 text-sm">
                    <p className="text-emerald-300 font-medium">ID uploaded</p>
                    <p className="text-emerald-500/80 text-xs truncate">{idFile?.name || 'Government-issued ID'}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setIdFile(null);
                      setIdUrl(null);
                    }}
                    className="text-sm text-red-400 hover:text-red-300"
                  >
                    Remove
                  </button>
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 space-y-4">
              <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Terms & Conditions</h3>
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={acceptedTerms}
                  onChange={(e) => setAcceptedTerms(e.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-slate-600 bg-slate-800 text-cyan-600 focus:ring-cyan-500"
                />
                <div className="text-xs text-slate-400">
                  <span className="font-bold text-slate-300">Terms of Service</span>
                  <p className="mt-0.5">I agree to the Mai Troll Fast Pay Program terms and conditions.</p>
                </div>
              </label>
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={acceptedFees}
                  onChange={(e) => setAcceptedFees(e.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-slate-600 bg-slate-800 text-cyan-600 focus:ring-cyan-500"
                />
                <div className="text-xs text-slate-400">
                  <span className="font-bold text-slate-300">Fee Agreement</span>
                  <p className="mt-0.5">I understand and accept the 0%Fast Pay processing fee on all payouts.</p>
                </div>
              </label>
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={acceptedIdentity}
                  onChange={(e) => setAcceptedIdentity(e.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-slate-600 bg-slate-800 text-cyan-600 focus:ring-cyan-500"
                />
                <div className="text-xs text-slate-400">
                  <span className="font-bold text-slate-300">Identity Verification</span>
                  <p className="mt-0.5">I authorize Mai Troll to verify my identity for compliance purposes.</p>
                </div>
              </label>
            </div>

            <button
              type="submit"
              disabled={submitting || !acceptedTerms || !acceptedFees || !acceptedIdentity || !idUrl}
              className="w-full flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-400 to-blue-500 py-4 text-sm font-black text-slate-950 transition-all hover:from-cyan-300 hover:to-blue-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <Zap className="h-4 w-4" />
                  {selectedPlan === 'plus' && !isPlusActive
                    ? `Save Profile & Upgrade MAI Pay Plus ($${MAI_PAY_PLUS_PRICE_USD})`
                    : 'Save Cashout Profile'}
                </>
              )}
            </button>

            <p className="text-xs text-slate-500 text-center">
              No application approval needed — reach a cashout tier and request a payout anytime (up to your rolling 7-day limit).
            </p>
          </form>
        )}

        {/* MAI Pay Plus upgrade checkout */}
        <PayPalPaymentModal
          isOpen={paypalModalOpen}
          onClose={() => setPaypalModalOpen(false)}
          userId={profile?.id}
          profile={profile}
          pkg={{
            id: MAI_PAY_PLUS_ITEM_KEY,
            name: 'MAI Pay Plus Upgrade',
            price_usd: MAI_PAY_PLUS_PRICE_USD,
            coins: 0,
            purchaseType: 'mai_pay_plus',
          }}
          requireCoins={false}
          onPaymentSuccess={async () => {
            toast.success('MAI Pay Plus activated! Enjoy 20 rolling cashouts and double coin tiers.');
            setPaypalModalOpen(false);
            setSelectedPlan('plus');
            try {
              await (useAuthStore.getState() as any).refreshProfile?.();
            } catch { /* noop */ }
          }}
        />
      </div>
    </div>
  );
}
