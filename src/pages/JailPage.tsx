import React, { useEffect, useState } from 'react';
import { useAuthStore } from '@/lib/store';
import { supabase } from '@/lib/supabase';
import { moderation } from '@/services/maitrollModeration';
import { toast } from 'sonner';
import { Shield, Lock, Clock, DollarSign, Home, AlertTriangle, Users } from 'lucide-react';

export default function JailPage() {
  const { user, profile } = useAuthStore();
  const [jailState, setJailState] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [postingBond, setPostingBond] = useState(false);
  const [walletBalance, setWalletBalance] = useState(0);

  useEffect(() => {
    if (user) {
      loadJailState();
      loadWalletBalance();
    }
  }, [user]);

  const loadJailState = async () => {
    if (!user) return;
    try {
      const state = await moderation.getJailState(user.id);
      setJailState(state);
    } catch (err) {
      console.error('Failed to load jail state:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadWalletBalance = async () => {
    if (!user) return;
    try {
      const { data } = await supabase
        .from('user_profiles')
        .select('troll_coins')
        .eq('id', user.id)
        .single();
      setWalletBalance(data?.troll_coins || 0);
    } catch (err) {
      console.error('Failed to load wallet:', err);
    }
  };

  const handlePostBond = async () => {
    if (!jailState?.jailId) return;
    setPostingBond(true);
    try {
      const result = await moderation.postBond(jailState.jailId);
      if (result.success) {
        toast.success(result.message || 'Bond Posted — You Have Been Released');
        await loadJailState();
        await loadWalletBalance();
        setTimeout(() => {
          window.location.href = result.data?.redirect_to || '/';
        }, 1500);
      } else {
        toast.error(result.message || 'Failed to post bond');
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to post bond');
    } finally {
      setPostingBond(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin w-8 h-8 border-4 border-green-500 rounded-full border-t-transparent"></div>
      </div>
    );
  }

  if (!jailState?.isJailed) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-8 text-center">
          <Shield className="w-16 h-16 mx-auto mb-4 text-green-400" />
          <h2 className="text-2xl font-bold text-white mb-2">You Are Free</h2>
          <p className="text-slate-400 mb-6">You are not currently in jail.</p>
          <button
            onClick={() => window.location.href = '/'}
            className="px-6 py-3 bg-green-600 hover:bg-green-500 rounded-lg font-semibold flex items-center justify-center gap-2 mx-auto"
          >
            <Home className="w-5 h-5" />
            Go Home
          </button>
        </div>
      </div>
    );
  }

  const canAffordBond = walletBalance >= (jailState.bondAmount || 0);

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="bg-slate-900/50 border border-red-900/50 rounded-xl p-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-red-500/20 rounded-full mb-4">
            <Lock className="w-8 h-8 text-red-400" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">MAI TROLL JAIL</h1>
          <p className="text-slate-400">You have been temporarily restricted from Mai Troll</p>
        </div>

        {/* Reason */}
        <div className="bg-red-900/20 border border-red-800/50 rounded-lg p-4 mb-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-400 mt-0.5" />
            <div>
              <h3 className="font-semibold text-red-300">Reason</h3>
              <p className="text-slate-300">{jailState.reason || 'Repeated Chat Rule Violations'}</p>
            </div>
          </div>
        </div>

        {/* Sentence Info */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-slate-800/50 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="w-4 h-4 text-slate-400" />
              <span className="text-sm text-slate-400">Discipline Level</span>
            </div>
            <p className="text-2xl font-bold text-white">Level {jailState.disciplineLevel}</p>
          </div>
          <div className="bg-slate-800/50 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="w-4 h-4 text-slate-400" />
              <span className="text-sm text-slate-400">Bond Amount</span>
            </div>
            <p className="text-2xl font-bold text-white">{jailState.bondAmount?.toLocaleString()} TC</p>
          </div>
        </div>

        {/* Time Remaining */}
        {jailState.scheduledReleaseAt && (
          <div className="bg-slate-800/50 rounded-lg p-4 mb-6">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="w-4 h-4 text-slate-400" />
              <span className="text-sm text-slate-400">Time Remaining</span>
            </div>
            <p className="text-xl font-mono text-white">
              {new Date(jailState.scheduledReleaseAt).toLocaleString()}
            </p>
          </div>
        )}

        {/* Wallet Status */}
        <div className="bg-slate-800/50 rounded-lg p-4 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-slate-400" />
              <span className="text-sm text-slate-400">Your Wallet</span>
            </div>
            <span className="text-lg font-bold text-white">{walletBalance.toLocaleString()} TC</span>
          </div>
          {!canAffordBond && jailState.bondAmount > 0 && (
            <p className="text-red-400 text-sm mt-2">
              You don&apos;t have enough Troll Coins to post bond. Required: {jailState.bondAmount?.toLocaleString()} TC
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          {jailState.bondAllowed && jailState.bondAmount > 0 && (
            <button
              onClick={handlePostBond}
              disabled={postingBond || !canAffordBond}
              className="flex-1 py-3 bg-green-600 hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-semibold flex items-center justify-center gap-2"
            >
              <DollarSign className="w-5 h-5" />
              {postingBond ? 'Processing...' : `Post Bond (${jailState.bondAmount?.toLocaleString()} TC)`}
            </button>
          )}
          <button
            onClick={() => window.location.href = '/'}
            className="px-6 py-3 bg-slate-700 hover:bg-slate-600 rounded-lg font-medium"
          >
            <Home className="w-5 h-5" />
          </button>
        </div>

        {/* Rules */}
        <div className="mt-8 pt-6 border-t border-slate-800">
          <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
            <Shield className="w-4 h-4" />
            Rules While Jailed
          </h3>
          <ul className="text-sm text-slate-400 space-y-1">
            <li>• You cannot send messages in any chat</li>
            <li>• You cannot participate in broadcasts</li>
            <li>• You cannot use MaiPiks or comments</li>
            <li>• You can view content and post bond</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
