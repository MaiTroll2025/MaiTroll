import { useState, type FormEvent } from 'react';
import { Gamepad2, Loader2, Lock, Mail, UserRound } from 'lucide-react';
import { supabase } from '../lib/supabase';

const USERNAME_PATTERN = /^[A-Za-z0-9_]{3,16}$/;

type Mode = 'signIn' | 'signUp';

function friendlyAuthError(message: string): string {
  if (message.includes('Invalid login credentials')) return 'Email or password is incorrect.';
  if (message.includes('already registered')) return 'An account with that email already exists. Try signing in.';
  if (message.includes('Password should be')) return 'Choose a longer password (at least 6 characters).';
  return 'We could not complete that request. Please try again.';
}

export default function AuthScreen() {
  const [mode, setMode] = useState<Mode>('signIn');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const isSignUp = mode === 'signUp';

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setNotice(null);

    const trimmedEmail = email.trim();
    if (isSignUp && !USERNAME_PATTERN.test(username.trim())) {
      setError('Usernames use 3-16 letters, numbers or underscores.');
      return;
    }

    setBusy(true);
    if (isSignUp) {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: trimmedEmail,
        password,
        options: { data: { username: username.trim() } },
      });
      if (signUpError) {
        setError(friendlyAuthError(signUpError.message));
      } else if (!data.session) {
        setNotice('Account created. Sign in with your new details to start playing.');
        setMode('signIn');
      }
    } else {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password,
      });
      if (signInError) {
        setError(friendlyAuthError(signInError.message));
      }
    }
    setBusy(false);
  };

  return (
    <div className="arena-backdrop flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-md animate-pop-in">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-5 flex h-16 w-16 animate-float items-center justify-center rounded-2xl bg-neon-blue/15 text-neon-blue shadow-neon-blue">
            <Gamepad2 className="h-8 w-8" />
          </div>
          <h1 className="neon-title text-3xl sm:text-4xl">MAI DON&apos;T KNOW!</h1>
          <p className="mt-3 text-slate-300">Live trivia party games in the MaiTroll Arcade.</p>
        </div>

        <div className="neon-panel p-6 sm:p-8">
          <div className="mb-6 grid grid-cols-2 gap-2 rounded-xl bg-arena-950/70 p-1">
            {(['signIn', 'signUp'] as const).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => {
                  setMode(option);
                  setError(null);
                }}
                className={`rounded-lg px-4 py-2.5 text-sm font-semibold transition ${
                  mode === option ? 'bg-neon-blue text-arena-950 shadow-neon-blue' : 'text-slate-400 hover:text-slate-100'
                }`}
              >
                {option === 'signIn' ? 'Sign in' : 'Create account'}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {isSignUp && (
              <label className="block">
                <span className="mb-1.5 flex items-center gap-2 text-sm text-slate-300">
                  <UserRound className="h-4 w-4 text-neon-green" /> Username
                </span>
                <input
                  className="field"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  placeholder="TrollMaster9"
                  autoComplete="username"
                  required
                />
              </label>
            )}
            <label className="block">
              <span className="mb-1.5 flex items-center gap-2 text-sm text-slate-300">
                <Mail className="h-4 w-4 text-neon-blue" /> Email
              </span>
              <input
                className="field"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                required
              />
            </label>
            <label className="block">
              <span className="mb-1.5 flex items-center gap-2 text-sm text-slate-300">
                <Lock className="h-4 w-4 text-neon-purple" /> Password
              </span>
              <input
                className="field"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete={isSignUp ? 'new-password' : 'current-password'}
                minLength={6}
                required
              />
            </label>

            {error && (
              <p role="alert" className="animate-shake rounded-xl border border-neon-red/40 bg-neon-red/10 px-4 py-3 text-sm text-red-200">
                {error}
              </p>
            )}
            {notice && (
              <p className="rounded-xl border border-neon-green/40 bg-neon-green/10 px-4 py-3 text-sm text-emerald-100">
                {notice}
              </p>
            )}

            <button type="submit" disabled={busy} className="neon-button w-full">
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              {isSignUp ? 'Create my account' : 'Enter the arena'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

