import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Mail, Lock, CheckCircle, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';

type Step = 'request' | 'check-email' | 'reset' | 'success';

export default function PasswordReset() {
  const [searchParams] = useSearchParams();
  const _navigate = useNavigate();
  const [step, setStep] = useState<Step>('request');
  const [email, setEmail] = useState(searchParams.get('email') || '');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [_sessionReady, setSessionReady] = useState(false);
  const [authResolved, setAuthResolved] = useState(false);

  // Listen for auth state changes — Supabase recovery links put the token in the URL hash.
  // onAuthStateChange fires once the hash is exchanged for a real session.
  useEffect(() => {
    let resolved = false;

    // First check if we already have a session (e.g. page was already loaded)
    const checkInitialSession = async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        setSessionReady(true);
        setStep('reset');
      }
      resolved = true;
      setAuthResolved(true);
    };

    checkInitialSession();

    // Listen for the SIGNED_IN event that fires when the recovery token is processed
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session) {
        setSessionReady(true);
        setStep('reset');
      }
      if (event === 'SIGNED_OUT') {
        setSessionReady(false);
      }
      if (!resolved) {
        resolved = true;
        setAuthResolved(true);
      }
    });

    // Fallback: if nothing fires within 3s, assume no recovery session
    const _timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        setAuthResolved(true);
      }
    }, 3000);

    return () => {
      if (subscription) {
        subscription.unsubscribe();
      }
    };
  }, []);

  // Step 1: Send reset email via Supabase Auth
  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      toast.error('Please enter your email address');
      return;
    }
    setLoading(true);
    try {
      const redirectUrl = `${window.location.origin}/reset-password`;
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: redirectUrl,
      });
      if (error) throw error;
      setStep('check-email');
    } catch (err: any) {
      console.error('Password reset request error:', err);
      toast.error(err?.message || 'Failed to send reset email. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Step 3: Set new password via Supabase Auth
  const handleSetNewPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    setLoading(true);
    try {
      // Update the password — the user already has a valid recovery session
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      toast.success('Password updated successfully!');
      setStep('success');
    } catch (err: any) {
      console.error('Password update error:', err);
      toast.error(err?.message || 'Failed to update password. The link may have expired.');
    } finally {
      setLoading(false);
    }
  };

  // Show a loading spinner while we wait for Supabase to process the recovery token
  if (!authResolved) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white flex items-center justify-center p-4 sm:p-6">
        <div className="text-center space-y-4">
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-purple-500/30 border-t-cyan-300" />
          <p className="text-sm font-bold text-slate-300">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-md bg-black/40 border border-white/10 rounded-2xl p-6 sm:p-8 space-y-6">

        {/* Back to sign in */}
        <Link
          to="/auth?mode=login"
          className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-cyan-300 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Sign In
        </Link>

        {/* ── Step 1: Request Reset ── */}
        {step === 'request' && (
          <>
            <div className="text-center space-y-2">
              <div className="mx-auto w-14 h-14 rounded-full bg-cyan-500/10 border border-cyan-400/20 flex items-center justify-center">
                <Mail className="w-6 h-6 text-cyan-400" />
              </div>
              <h1 className="text-2xl font-bold">Forgot Password?</h1>
              <p className="text-sm text-slate-400">
                No worries — enter your email and we&apos;ll send you a reset link.
              </p>
            </div>

            <form onSubmit={handleRequestReset} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm text-slate-300 flex items-center gap-2">
                  <Mail className="w-4 h-4" /> Email Address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full px-4 py-3 bg-zinc-900 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:border-cyan-400/50 focus:ring-1 focus:ring-cyan-400/20"
                  required
                  autoComplete="email"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-gradient-to-r from-purple-600 via-pink-600 to-cyan-500 text-white font-semibold rounded-xl hover:shadow-[0_15px_40px_rgba(147,51,234,0.3)] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white/30 border-t-white" />
                    Sending...
                  </span>
                ) : (
                  'Send Reset Link'
                )}
              </button>
            </form>
          </>
        )}

        {/* ── Step 2: Check Email ── */}
        {step === 'check-email' && (
          <div className="text-center space-y-4">
            <div className="mx-auto w-14 h-14 rounded-full bg-emerald-500/10 border border-emerald-400/20 flex items-center justify-center">
              <Mail className="w-6 h-6 text-emerald-400" />
            </div>
            <h1 className="text-2xl font-bold">Check Your Email</h1>
            <p className="text-sm text-slate-400">
              We sent a password reset link to{' '}
              <span className="text-cyan-300 font-medium">{email}</span>.
              Click the link in the email to set a new password.
            </p>
            <div className="bg-slate-800/50 border border-white/10 rounded-xl p-4 text-left space-y-2">
              <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Didn&apos;t get it?</p>
              <ul className="text-xs text-slate-400 space-y-1 list-disc list-inside">
                <li>Check your spam / junk folder</li>
                <li>Make sure <span className="text-slate-300">{email}</span> is correct</li>
                <li>Wait a minute and try again</li>
              </ul>
            </div>
            <button
              type="button"
              onClick={() => setStep('request')}
              className="text-sm text-cyan-400 hover:text-cyan-300 transition-colors"
            >
              ← Try a different email
            </button>
          </div>
        )}

        {/* ── Step 3: Set New Password ── */}
        {step === 'reset' && (
          <>
            <div className="text-center space-y-2">
              <div className="mx-auto w-14 h-14 rounded-full bg-cyan-500/10 border border-cyan-400/20 flex items-center justify-center">
                <Lock className="w-6 h-6 text-cyan-400" />
              </div>
              <h1 className="text-2xl font-bold">Set New Password</h1>
              <p className="text-sm text-slate-400">
                Enter a strong password for your account.
              </p>
            </div>

            <form onSubmit={handleSetNewPassword} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm text-slate-300 flex items-center gap-2">
                  <Lock className="w-4 h-4" /> New Password
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Minimum 8 characters"
                  className="w-full px-4 py-3 bg-zinc-900 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:border-cyan-400/50 focus:ring-1 focus:ring-cyan-400/20"
                  required
                  minLength={8}
                  autoComplete="new-password"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm text-slate-300 flex items-center gap-2">
                  <Lock className="w-4 h-4" /> Confirm Password
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter your new password"
                  className="w-full px-4 py-3 bg-zinc-900 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:border-cyan-400/50 focus:ring-1 focus:ring-cyan-400/20"
                  required
                  minLength={8}
                  autoComplete="new-password"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-gradient-to-r from-purple-600 via-pink-600 to-cyan-500 text-white font-semibold rounded-xl hover:shadow-[0_15px_40px_rgba(147,51,234,0.3)] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white/30 border-t-white" />
                    Updating...
                  </span>
                ) : (
                  'Update Password'
                )}
              </button>
            </form>
          </>
        )}

        {/* ── Step 4: Success ── */}
        {step === 'success' && (
          <div className="text-center space-y-4">
            <div className="mx-auto w-14 h-14 rounded-full bg-emerald-500/10 border border-emerald-400/20 flex items-center justify-center">
              <CheckCircle className="w-7 h-7 text-emerald-400" />
            </div>
            <h1 className="text-2xl font-bold">Password Updated!</h1>
            <p className="text-sm text-slate-400">
              Your password has been changed successfully. You can now sign in with your new password.
            </p>
            <Link
              to="/auth?mode=login"
              className="inline-flex items-center justify-center w-full py-3 bg-gradient-to-r from-purple-600 via-pink-600 to-cyan-500 text-white font-semibold rounded-xl hover:shadow-[0_15px_40px_rgba(147,51,234,0.3)] transition-all duration-300"
            >
              Go to Sign In
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
