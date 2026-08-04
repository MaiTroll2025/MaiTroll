import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users,
  Heart,
  Eye,
  RefreshCw,
  Settings,
  Sparkles,
  Grid3X3,
  X,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import { TMOnboarding } from '../components/trollmatch/TMOnboarding';
import { TMMatchCard } from '../components/trollmatch/TMMatchCard';
import { TMViewerCard } from '../components/trollmatch/TMViewerCard';
import { TMUserCard } from '../components/trollmatch/TMUserCard';
import {
  useTMMatches,
  useTMViewedMe,
  useTMNeedsOnboarding,
  useTMProfile,
  useTMUpdateProfile,
  useTMAllUsers,
} from '../hooks/useTrollMatch';
import {
  TM_INTERESTS,
  TM_GENDERS,
  TM_PREFERENCES,
  TMInterest,
  TMGender,
  TMPreference,
  TMTab,
} from '../types/trollMatch';

const pageShell = 'min-h-screen bg-slate-950 text-white relative overflow-y-auto overflow-x-hidden md:overflow-hidden';
const glassPanel =
  'rounded-[2rem] border border-cyan-400/15 bg-slate-950/75 backdrop-blur-2xl shadow-[0_0_38px_rgba(45,212,191,0.10),inset_0_1px_0_rgba(255,255,255,0.04)]';
const primaryButton =
  'rounded-2xl bg-gradient-to-r from-purple-700 via-cyan-500 to-pink-600 px-5 py-3 font-black text-white shadow-[0_0_22px_rgba(45,212,191,0.30)] transition-all hover:scale-[1.02] hover:from-purple-600 hover:via-cyan-400 hover:to-pink-500 disabled:cursor-not-allowed disabled:opacity-50';
const secondaryButton =
  'rounded-2xl border border-cyan-300/20 bg-white/[0.04] px-5 py-3 font-black text-cyan-100 transition-all hover:border-cyan-300/45 hover:bg-cyan-400/10 hover:shadow-[0_0_18px_rgba(45,212,191,0.18)]';

export function MatchPage() {
  const navigate = useNavigate();
  const { needsOnboarding, loading: onboardingLoading } = useTMNeedsOnboarding();
  const { interests, datingEnabled, gender, preference, messagePrice } = useTMProfile();

  const [activeTab, setActiveTab] = useState<TMTab>('all-users');
  const [showSettings, setShowSettings] = useState(false);

  const {
    matches: friendsMatches,
    loading: friendsLoading,
    error: friendsError,
    refetch: refetchFriends,
  } = useTMMatches(false, 20);

  const {
    matches: datingMatches,
    loading: datingLoading,
    error: datingError,
    refetch: refetchDating,
  } = useTMMatches(true, 20);

  const {
    viewers,
    loading: viewersLoading,
    error: viewersError,
    refetch: refetchViewers,
  } = useTMViewedMe(50);

  const {
    users: allUsers,
    loading: allUsersLoading,
    error: allUsersError,
    refetch: refetchAllUsers,
    newUserIds,
  } = useTMAllUsers(100);

  const handleOnboardingComplete = () => {
    refetchFriends();
    refetchDating();
    navigate('/match', { replace: true });
  };

  const handleMessage = useCallback(
    (userId: string, price: number) => {
      navigate(`/utromail?recipientId=${userId}&source=troll_match&price=${price}`);
    },
    [navigate]
  );

  const handleRefresh = () => {
    if (activeTab === 'friends') {
      refetchFriends();
      toast.success('Finding new matches...');
    } else if (activeTab === 'dating') {
      refetchDating();
      toast.success('Finding new matches...');
    } else if (activeTab === 'viewed-me') {
      refetchViewers();
      toast.success('Refreshing viewers...');
    } else {
      refetchAllUsers();
      toast.success('Refreshing all users...');
    }
  };

  if (onboardingLoading) {
    return (
      <div className={`${pageShell} flex items-center justify-center`}>
        <CityBackground />
        <div className="relative h-10 w-10 animate-spin rounded-full border-4 border-cyan-400 border-t-transparent" />
      </div>
    );
  }

  if (needsOnboarding) {
    return <TMOnboarding onComplete={handleOnboardingComplete} />;
  }

  const currentMatches = activeTab === 'dating' ? datingMatches : friendsMatches;

  const isLoading =
    activeTab === 'viewed-me'
      ? viewersLoading
      : activeTab === 'dating'
        ? datingLoading
        : activeTab === 'all-users'
          ? allUsersLoading
          : friendsLoading;

  const error =
    activeTab === 'viewed-me'
      ? viewersError
      : activeTab === 'dating'
        ? datingError
        : activeTab === 'all-users'
          ? allUsersError
          : friendsError;

  return (
    <div className={pageShell}>
      <CityBackground />

      <div className="sticky top-0 z-40 border-b border-cyan-400/15 bg-slate-950/80 backdrop-blur-2xl shadow-[0_0_30px_rgba(45,212,191,0.08)]">
        <div className="mx-auto max-w-6xl px-4 py-5">
          <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-13 w-13 items-center justify-center rounded-2xl border border-cyan-300/25 bg-gradient-to-br from-purple-700 via-cyan-500 to-pink-600 shadow-[0_0_28px_rgba(45,212,191,0.25)]">
                <Sparkles className="h-7 w-7 text-white" />
              </div>

              <div>
                <h1 className="bg-gradient-to-r from-white via-cyan-100 to-pink-200 bg-clip-text text-3xl font-black text-transparent md:text-4xl">
                  Troll Match
                </h1>
                <p className="mt-1 text-sm text-slate-400">
                  Connect with citizens, creators, broadcasters, and matches across Mai Troll.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <motion.button
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.96 }}
                onClick={handleRefresh}
                className={secondaryButton}
              >
                <span className="flex items-center gap-2">
                  <RefreshCw className="h-4 w-4" />
                  Find New Matches
                </span>
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.96 }}
                onClick={() => setShowSettings(true)}
                className="rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-slate-300 transition-all hover:border-cyan-300/35 hover:bg-cyan-400/10 hover:text-white"
                aria-label="Open Troll Match settings"
              >
                <Settings className="h-5 w-5" />
              </motion.button>
            </div>
          </div>

          <div className="mt-5 flex gap-2 overflow-x-auto pb-1">
            <TabButton
              active={activeTab === 'all-users'}
              onClick={() => setActiveTab('all-users')}
              icon={<Grid3X3 className="h-4 w-4" />}
              label="All Users"
              count={allUsers.length}
            />
            <TabButton
              active={activeTab === 'friends'}
              onClick={() => setActiveTab('friends')}
              icon={<Users className="h-4 w-4" />}
              label="Friends"
            />
            <TabButton
              active={activeTab === 'dating'}
              onClick={() => setActiveTab('dating')}
              icon={<Heart className="h-4 w-4" />}
              label="Dating"
            />
            <TabButton
              active={activeTab === 'viewed-me'}
              onClick={() => setActiveTab('viewed-me')}
              icon={<Eye className="h-4 w-4" />}
              label="Viewed Me"
              count={viewers.length}
            />
          </div>
        </div>
      </div>

      <main className="relative z-10 mx-auto max-w-6xl px-4 py-8">
        <AnimatePresence mode="wait">
          {isLoading ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className={`${glassPanel} flex flex-col items-center justify-center py-20 text-center`}
            >
              <div className="mb-5 h-12 w-12 animate-spin rounded-full border-4 border-cyan-400 border-t-transparent" />
              <h2 className="text-xl font-black text-cyan-100">Syncing Troll Match</h2>
              <p className="mt-2 text-sm text-slate-400">Loading your city connections...</p>
            </motion.div>
          ) : error ? (
            <motion.div
              key="error"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className={`${glassPanel} py-20 text-center`}
            >
              <p className="mb-5 text-red-300">{error}</p>
              <button onClick={handleRefresh} className={primaryButton}>
                Try Again
              </button>
            </motion.div>
          ) : activeTab === 'viewed-me' ? (
            <motion.div key="viewed-me" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              {viewers.length === 0 ? (
                <EmptyState
                  icon={<Eye className="h-12 w-12" />}
                  title="No Views Yet"
                  description="When someone views your profile, they will appear here."
                />
              ) : (
                <div className="grid gap-3">
                  {viewers.map((viewer) => (
                    <TMViewerCard key={viewer.viewer_id} viewer={viewer} onMessage={handleMessage} />
                  ))}
                </div>
              )}
            </motion.div>
          ) : activeTab === 'all-users' ? (
            <motion.div key="all-users" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              {allUsers.length === 0 ? (
                <EmptyState
                  icon={<Grid3X3 className="h-12 w-12" />}
                  title="No Users Found"
                  description="No users have joined Troll Match yet."
                />
              ) : (
                <div className="grid grid-cols-4 gap-2 sm:grid-cols-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4">
                  {allUsers.map((matchUser) => (
                    <TMUserCard
                      key={matchUser.user_id}
                      user={matchUser}
                      isNew={newUserIds.has(matchUser.user_id)}
                    />
                  ))}
                </div>
              )}
            </motion.div>
          ) : (
            <motion.div key={activeTab} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              {currentMatches.length === 0 ? (
                <EmptyState
                  icon={activeTab === 'dating' ? <Heart className="h-12 w-12" /> : <Users className="h-12 w-12" />}
                  title={activeTab === 'dating' ? 'No Dating Matches' : 'No Matches Found'}
                  description="Try adjusting your interests or check back later."
                  action={
                    <button onClick={handleRefresh} className={`${primaryButton} mt-5`}>
                      Find New Matches
                    </button>
                  }
                />
              ) : (
                <div className="grid grid-cols-4 gap-2 sm:grid-cols-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4">
                  {currentMatches.map((match) => (
                    <TMMatchCard
                      key={match.user_id}
                      match={match}
                      type={activeTab as 'friends' | 'dating'}
                      onMessage={handleMessage}
                    />
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <AnimatePresence>
        {showSettings && (
          <TMSettingsModal
            interests={interests}
            datingEnabled={datingEnabled}
            gender={gender}
            preference={preference}
            messagePrice={messagePrice}
            onClose={() => setShowSettings(false)}
            onSave={() => {
              setShowSettings(false);
              refetchFriends();
              refetchDating();
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function CityBackground() {
  return (
    <>
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_120%_at_20%_20%,rgba(147,51,234,0.22),transparent_42%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(140%_140%_at_80%_0%,rgba(45,212,191,0.16),transparent_46%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(140%_140%_at_95%_88%,rgba(236,72,153,0.13),transparent_44%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(120deg,rgba(109,40,217,0.10)_0%,rgba(14,165,233,0.07)_44%,rgba(236,72,153,0.09)_100%)]" />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.035]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.08) 1px, transparent 1px)',
          backgroundSize: '32px 32px',
        }}
      />
    </>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  count?: number;
}) {
  return (
    <motion.button
      onClick={onClick}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className={`relative flex shrink-0 items-center gap-2 rounded-2xl px-4 py-2.5 font-bold transition-all ${
        active
          ? 'bg-gradient-to-r from-purple-700 via-cyan-500 to-pink-600 text-white shadow-[0_0_22px_rgba(45,212,191,0.30)]'
          : 'border border-white/10 bg-white/[0.04] text-slate-300 hover:border-cyan-300/35 hover:bg-cyan-400/10 hover:text-white'
      }`}
    >
      {icon}
      <span>{label}</span>
      {count !== undefined && count > 0 && (
        <span className={`rounded-full px-2 py-0.5 text-xs ${active ? 'bg-white/20 text-white' : 'bg-cyan-400/10 text-cyan-200'}`}>
          {count}
        </span>
      )}
    </motion.button>
  );
}

function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className={`${glassPanel} py-20 text-center`}>
      <div className="mx-auto mb-5 flex h-24 w-24 items-center justify-center rounded-full border border-cyan-300/20 bg-cyan-400/10 text-cyan-200 shadow-[0_0_28px_rgba(45,212,191,0.16)]">
        {icon}
      </div>
      <h3 className="mb-2 text-2xl font-black text-white">{title}</h3>
      <p className="mx-auto max-w-md text-slate-400">{description}</p>
      {action}
    </div>
  );
}

function TMSettingsModal({
  interests: currentInterests,
  datingEnabled: currentDatingEnabled,
  gender: currentGender,
  preference: currentPreference,
  messagePrice: currentMessagePrice,
  onClose,
  onSave,
}: {
  interests: string[];
  datingEnabled: boolean;
  gender: string | null;
  preference: string[];
  messagePrice: number;
  onClose: () => void;
  onSave: () => void;
}) {
  const { updateProfile } = useTMUpdateProfile();
  const [loading, setLoading] = useState(false);

  const [interests, setInterests] = useState<TMInterest[]>(currentInterests as TMInterest[]);
  const [datingEnabled, setDatingEnabled] = useState(currentDatingEnabled);
  const [gender, setGender] = useState<TMGender | null>(currentGender as TMGender | null);
  const [preference, setPreference] = useState<TMPreference[]>(currentPreference as TMPreference[]);
  const [messagePrice, setMessagePrice] = useState(currentMessagePrice);

  const toggleInterest = (interest: TMInterest) => {
    setInterests((prev) =>
      prev.includes(interest) ? prev.filter((i) => i !== interest) : [...prev, interest]
    );
  };

  const togglePreference = (pref: TMPreference) => {
    setPreference((prev) =>
      pref === 'Everyone'
        ? ['Everyone']
        : prev.includes(pref)
          ? prev.filter((p) => p !== pref)
          : [...prev.filter((p) => p !== 'Everyone'), pref]
    );
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      await updateProfile({
        interests,
        datingEnabled,
        gender,
        preference,
        messagePrice,
      });
      toast.success('Preferences updated!');
      onSave();
    } catch {
      toast.error('Failed to save preferences');
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-md"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.94, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.94, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-[2rem] border border-cyan-400/15 bg-slate-950/95 shadow-[0_0_48px_rgba(45,212,191,0.16)] backdrop-blur-2xl"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-cyan-400/10 bg-slate-950/90 p-6 backdrop-blur-xl">
          <div>
            <h2 className="bg-gradient-to-r from-white via-cyan-100 to-pink-200 bg-clip-text text-2xl font-black text-transparent">
              Troll Match Settings
            </h2>
            <p className="mt-1 text-sm text-slate-400">Tune your city connection preferences.</p>
          </div>

          <button
            onClick={onClose}
            className="rounded-2xl border border-white/10 bg-white/[0.04] p-2 text-slate-300 transition hover:border-cyan-300/35 hover:bg-cyan-400/10 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-7 p-6">
          <PreferenceSection title="Your Interests">
            <div className="flex flex-wrap gap-2">
              {TM_INTERESTS.map((interest) => (
                <Chip
                  key={interest}
                  active={interests.includes(interest)}
                  onClick={() => toggleInterest(interest)}
                >
                  {interest}
                </Chip>
              ))}
            </div>
          </PreferenceSection>

          <div className="rounded-3xl border border-cyan-300/15 bg-cyan-400/5 p-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h3 className="font-black text-white">Enable Dating</h3>
                <p className="text-sm text-slate-400">Appear in dating matches.</p>
              </div>

              <button
                onClick={() => setDatingEnabled(!datingEnabled)}
                className={`relative h-8 w-14 rounded-full transition-colors ${
                  datingEnabled ? 'bg-cyan-400 shadow-[0_0_18px_rgba(45,212,191,0.35)]' : 'bg-slate-700'
                }`}
              >
                <motion.div
                  className="absolute top-1 h-6 w-6 rounded-full bg-white"
                  animate={{ left: datingEnabled ? '1.5rem' : '0.25rem' }}
                />
              </button>
            </div>
          </div>

          {datingEnabled && (
            <div className="space-y-6">
              <PreferenceSection title="Your Gender">
                <div className="flex flex-wrap gap-2">
                  {TM_GENDERS.map((g) => (
                    <Chip key={g} active={gender === g} onClick={() => setGender(g)}>
                      {g}
                    </Chip>
                  ))}
                </div>
              </PreferenceSection>

              <PreferenceSection title="Interested In">
                <div className="flex flex-wrap gap-2">
                  {TM_PREFERENCES.map((pref) => (
                    <Chip
                      key={pref}
                      active={preference.includes(pref)}
                      onClick={() => togglePreference(pref)}
                    >
                      {pref}
                    </Chip>
                  ))}
                </div>
              </PreferenceSection>
            </div>
          )}

          <PreferenceSection title="Message Price">
            <p className="mb-4 text-sm text-slate-400">
              Set how many coins users must pay to message you.
            </p>

            <div className="flex items-center gap-4 rounded-3xl border border-cyan-300/10 bg-slate-950/70 p-4">
              <input
                type="range"
                min="0"
                max="100"
                value={messagePrice}
                onChange={(e) => setMessagePrice(Number(e.target.value))}
                className="flex-1 accent-cyan-400"
              />

              <div className="w-24 rounded-2xl border border-cyan-300/15 bg-cyan-400/10 p-3 text-center">
                <span className="text-xl font-black text-cyan-100">{messagePrice}</span>
                <span className="text-slate-400"> 💰</span>
              </div>
            </div>

            <p className="mt-2 text-xs text-slate-500">Set to 0 for free messaging.</p>
          </PreferenceSection>
        </div>

        <div className="sticky bottom-0 flex gap-3 border-t border-cyan-400/10 bg-slate-950/90 p-6 backdrop-blur-xl">
          <button onClick={onClose} className={secondaryButton}>
            Cancel
          </button>

          <button onClick={handleSave} disabled={loading} className={primaryButton}>
            {loading ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function PreferenceSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h3 className="mb-3 font-black text-cyan-100">{title}</h3>
      {children}
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-3 py-1.5 text-sm font-bold transition-all ${
        active
          ? 'border border-cyan-300/35 bg-cyan-400/15 text-cyan-100 shadow-[0_0_14px_rgba(45,212,191,0.14)]'
          : 'border border-white/10 bg-white/[0.04] text-slate-300 hover:border-cyan-300/35 hover:bg-cyan-400/10 hover:text-white'
      }`}
    >
      {children}
    </button>
  );
}

export default MatchPage;