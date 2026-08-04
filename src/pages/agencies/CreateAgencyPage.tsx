import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { Button } from '../../components/ui/button';

export default function CreateAgencyPage() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [defaultSplitPercent, setDefaultSplitPercent] = useState(10);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [loadingBalance, setLoadingBalance] = useState<boolean>(true);

  useEffect(() => {
    if (user?.id) {
      loadUserBalance();
    } else {
      setBalance(null);
      setLoadingBalance(false);
    }
  }, [user]);

  const loadUserBalance = async () => {
    if (!user?.id) return;
    
    setLoadingBalance(true);
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('troll_coins')
        .eq('id', user.id)
        .maybeSingle();

      if (error) {
        console.error('Error loading balance:', error);
        setBalance(0);
      } else {
        setBalance(data?.troll_coins ?? 0);
      }
    } catch (err) {
      console.error('Error loading balance:', err);
      setBalance(0);
    } finally {
      setLoadingBalance(false);
    }
  };

  const handleCreateAgency = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!user) {
      setError('You must be logged in to create a Talent Office.');
      return;
    }

    if (loadingBalance) {
      setError('Loading your balance...');
      return;
    }

    const userBalance = balance ?? 0;
    const requiredFee = 35000; // 25,000 startup + 10,000 monthly

    if (!name.trim()) {
      setError('Talent Office name is required.');
      return;
    }

    if (defaultSplitPercent < 0 || defaultSplitPercent > 15) {
      setError('Agency split must be between 0% and 15%.');
      return;
    }

    if (userBalance < requiredFee) {
      setError(`Insufficient Troll Coins. You have ${userBalance.toLocaleString()} TC but need ${requiredFee.toLocaleString()} TC (25,000 startup + 10,000 monthly fee).`);
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      const { data, error: rpcError } = await supabase.rpc('apply_for_agency_with_fee', {
        p_name: name.trim(),
        p_bio: bio.trim() || null,
        p_default_split_percent: defaultSplitPercent,
      });

      if (rpcError) {
        throw rpcError;
      }

      const result = data as
        | {
            success?: boolean;
            message?: string;
            agency_id?: string;
            application_id?: string;
            application_fee_coins?: number;
          }
        | null;

      if (!result?.success) {
        throw new Error(result?.message || 'Failed to create Talent Office application.');
      }

      navigate('/agency-dashboard');
    } catch (err: any) {
      console.error('Error creating agency:', err);
      setError(err?.message || 'Failed to create Talent Office.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-black px-4 py-8 text-white">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6">
          <p className="text-xs font-black uppercase tracking-[0.3em] text-cyan-300">
            Mai Troll Talent Offices
          </p>
          <h1 className="mt-2 text-3xl font-black text-white">
            Create Talent Office
          </h1>
            <p className="mt-2 text-sm text-slate-400">
              Create your Talent Office application. A one-time startup fee of 25,000 Troll Coins plus the first monthly fee of 10,000 Troll Coins is charged when submitting the application, and Agency HR reviews approval.
            </p>

            {loadingBalance && (
              <div className="mt-4 flex items-center gap-2 text-sm text-slate-400">
                <div className="h-3 w-3 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent"></div>
                <span>Checking your balance...</span>
              </div>
            )}

            {balance !== null && !loadingBalance && (
              <div className="mt-4 p-3 bg-slate-800/50 rounded-xl">
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-medium">Your Balance:</span>
                  <span className="ml-auto text-cyan-400">{balance?.toLocaleString()}</span>
                  <span className="text-xs text-slate-500">TC</span>
                </div>
                {balance < 35000 && (
                  <div className="mt-2 text-xs text-red-400">
                    You need 35,000 TC (25,000 startup + 10,000 monthly) to create a Talent Office
                  </div>
                )}
              </div>
            )}
        </div>

        <form
          onSubmit={handleCreateAgency}
          className="rounded-2xl border border-cyan-400/20 bg-slate-900/70 p-6 shadow-[0_0_35px_rgba(34,211,238,0.12)] backdrop-blur-xl"
        >
          {error && (
            <div className="mb-4 rounded-xl border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-200">
              {error}
            </div>
          )}

          <div className="space-y-5">
            <div>
              <label className="mb-2 block text-sm font-bold text-cyan-200">
                Talent Office Name
              </label>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Example: Blue Flame Talent Office"
                className="w-full rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-3 text-white outline-none transition focus:border-cyan-400"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-bold text-cyan-200">
                Agency Bio
              </label>
              <textarea
                value={bio}
                onChange={(event) => setBio(event.target.value)}
                placeholder="Tell creators what your Talent Office is about..."
                rows={5}
                className="w-full resize-none rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-3 text-white outline-none transition focus:border-cyan-400"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-bold text-cyan-200">
                Default Gift Split Percent
              </label>
              <input
                type="number"
                min={0}
                max={15}
                value={defaultSplitPercent}
                onChange={(event) =>
                  setDefaultSplitPercent(Number(event.target.value))
                }
                className="w-full rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-3 text-white outline-none transition focus:border-cyan-400"
              />
              <p className="mt-2 text-xs text-slate-400">
                Recommended: 10%. Maximum allowed: 15%. This applies only after a creator accepts a contract.
              </p>
            </div>

            <div className="rounded-xl border border-purple-400/20 bg-purple-500/10 p-4 text-sm text-slate-300">
              <p className="font-bold text-purple-200">Paid application + approval flow</p>
              <p className="mt-1">
                Your application fee is charged immediately to your Troll Coins balance, and the Agency HR Manager reviews the application before the Talent Office is approved.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Button
                type="submit"
                disabled={submitting}
                className="flex-1 bg-cyan-500/20 border border-cyan-400/40 text-cyan-100 hover:bg-cyan-500/30"
              >
                {submitting ? 'Creating...' : 'Create Talent Office'}
              </Button>

              <Button
                type="button"
                variant="outline"
                onClick={() => navigate('/agencies')}
                className="flex-1 border border-slate-600 bg-transparent text-slate-200 hover:bg-slate-800"
              >
                Cancel
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}