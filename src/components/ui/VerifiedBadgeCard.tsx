import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/lib/store';
import { toast } from 'sonner';
import { BadgeCheck, Coins, Shield, Sparkles, CheckCircle, Clock } from 'lucide-react';

const VERIFICATION_COST_COINS = 500;

export default function VerifiedBadgeCard() {
  const { user, profile, refreshProfile } = useAuthStore();
  const navigate = useNavigate();
  const [processing, setProcessing] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);

  useEffect(() => {
    if (profile?.verification_expires_at) {
      const exp = new Date(profile.verification_expires_at);
      if (exp > new Date()) {
        setIsVerified(true);
        setExpiresAt(exp.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }));
      }
    }
  }, [profile]);

  const handlePurchaseWithCoins = async () => {
    if (!user) {
      navigate('/auth');
      return;
    }
    setProcessing(true);
    try {
      // Check eligibility
      const { data: eligData, error: eligError } = await supabase.rpc('check_verification_eligibility', {
        p_user_id: user.id,
      });
      if (eligError) throw eligError;
      if (eligData && !eligData.eligible) {
        toast.error(eligData.reason || 'You are not eligible for verification at this time.');
        setProcessing(false);
        return;
      }

      // Deduct coins
      const { error: deductError } = await supabase.rpc('spend_coins', {
        p_sender_id: user.id,
        p_receiver_id: user.id,
        p_coin_amount: VERIFICATION_COST_COINS,
        p_source: 'verified_badge',
        p_item: 'Verified Badge Purchase',
      });
      if (deductError) throw deductError;

      // Set verified
      const expiresAt = new Date();
      expiresAt.setFullYear(expiresAt.getFullYear() + 1);
      const { error: updateError } = await supabase
        .from('user_profiles')
        .update({
          is_verified: true,
          verification_expires_at: expiresAt.toISOString(),
          verified_since: new Date().toISOString(),
        })
        .eq('id', user.id);
      if (updateError) throw updateError;

      await refreshProfile();
      toast.success('🎉 You are now verified! Your badge is active for 1 year.');
    } catch (err: any) {
      console.error('Verified badge purchase failed:', err);
      toast.error(err?.message || 'Failed to purchase verified badge.');
    } finally {
      setProcessing(false);
    }
  };

  if (isVerified) {
    return (
      <div className="rounded-2xl border border-emerald-500/30 bg-gradient-to-r from-emerald-950/60 via-emerald-900/40 to-emerald-950/60 p-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
            <CheckCircle className="w-5 h-5 text-emerald-400" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-emerald-200">Verified Badge Active</span>
              <BadgeCheck className="w-4 h-4 text-emerald-400" />
            </div>
            <p className="text-[11px] text-emerald-400/70 mt-0.5 flex items-center gap-1">
              <Clock size={10} />
              Expires {expiresAt}
            </p>
          </div>
        </div>
      </div>
    );
  }

  const canAfford = (profile?.troll_coins ?? 0) >= VERIFICATION_COST_COINS;

  return (
    <div className="rounded-2xl border border-purple-500/30 bg-gradient-to-r from-purple-950/60 via-fuchsia-950/40 to-purple-950/60 p-4">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center shrink-0">
          <BadgeCheck className="w-5 h-5 text-purple-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-purple-100">Get Verified Badge</span>
            <Sparkles className="w-3.5 h-3.5 text-purple-400" />
          </div>
          <p className="text-[11px] text-purple-300/70 mt-0.5 leading-relaxed">
            Stand out with a verified badge on your profile. Valid for 1 year.
          </p>
          <div className="flex items-center gap-2 mt-3">
            <button
              type="button"
              onClick={handlePurchaseWithCoins}
              disabled={processing || !canAfford}
              className="inline-flex items-center gap-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:opacity-40 disabled:cursor-not-allowed px-3 py-1.5 text-[11px] font-bold text-white transition-all"
            >
              <Coins size={12} />
              {processing ? 'Processing...' : `${VERIFICATION_COST_COINS.toLocaleString()} Coins`}
            </button>
            {!canAfford && (
              <span className="text-[10px] text-red-400 font-semibold">
                Need {(VERIFICATION_COST_COINS - (profile?.troll_coins ?? 0)).toLocaleString()} more coins
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
