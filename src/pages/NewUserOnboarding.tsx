import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import TutorialOverlay, { TutorialStep } from '../components/tutorial/TutorialOverlay';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../lib/store';
import { Check, Sparkles } from 'lucide-react';

type OnboardingPhase = 'profile' | 'neighborhood' | 'coins' | 'golive' | 'finish';

const PROFILE_STEPS: TutorialStep[] = [
  {
    id: 'profile-fullname',
    title: 'Complete your profile',
    description: 'Add your full name so people know who they are interacting with on Mai Troll.',
    targetSelector: '#onboarding-fullname',
  },
  {
    id: 'profile-username',
    title: 'Choose your username',
    description: 'Pick a unique username. This will be your identity on Mai Troll.',
    targetSelector: '#onboarding-username',
  },
  {
    id: 'profile-gender',
    title: 'Select your gender',
    description: 'This helps us personalize your experience.',
    targetSelector: '#onboarding-gender',
  },
  {
    id: 'profile-save',
    title: 'Save your profile',
    description: 'Click Save Profile to continue. You can update this anytime later.',
    targetSelector: '#onboarding-save-profile',
  },
];

const NEIGHBORHOOD_STEPS: TutorialStep[] = [
  {
    id: 'neighborhood-create',
    title: 'Welcome to your Neighborhood',
    description: 'Your Neighborhood is your personal area in Mai Troll. This is where you establish your property, vehicle, insurance and license.',
    targetSelector: '#onboarding-create-street',
  },
  {
    id: 'neighborhood-license',
    title: 'Get your Mai Troll License',
    description: 'A valid license is required to drive, broadcast and participate in city activities.',
    targetSelector: '#onboarding-get-license',
  },
  {
    id: 'neighborhood-insurance',
    title: 'Setup Insurance',
    description: 'Every new user receives ONE FREE MONTH of qualifying coverage. Protect your property and vehicle.',
    targetSelector: '#onboarding-get-insurance',
  },
  {
    id: 'neighborhood-vehicle',
    title: 'Get your first vehicle',
    description: 'Your first eligible vehicle is FREE. Do not let anyone charge you for your starter car.',
    targetSelector: '#onboarding-get-vehicle',
  },
  {
    id: 'neighborhood-complete',
    title: 'Neighborhood Ready',
    description: 'Your Neighborhood is set up. You now have a license, insurance, property and vehicle.',
    targetSelector: '#onboarding-neighborhood-done',
  },
];

const COIN_STORE_STEPS: TutorialStep[] = [
  {
    id: 'coins-intro',
    title: 'Troll Coins',
    description: 'Troll Coins are used for gifts, games and other features throughout Mai Troll. Buying coins is completely optional.',
    targetSelector: '#onboarding-coin-package',
  },
];

const GO_LIVE_STEPS: TutorialStep[] = [
  {
    id: 'golive-intro',
    title: 'Go Live',
    description: 'Go Live lets you host your own broadcast, invite guests, interact with viewers, receive gifts and participate in battles.',
    targetSelector: '#onboarding-go-live-btn',
  },
];

export default function NewUserOnboarding() {
  const navigate = useNavigate();
  const { user, profile, setProfile, refreshProfile } = useAuthStore();
  const [phase, setPhase] = useState<OnboardingPhase>('profile');
  const [stepIndex, setStepIndex] = useState(0);
  const [isTouch, setIsTouch] = useState(false);
  const [onboardingId, setOnboardingId] = useState<string | null>(null);

  const currentSteps = useMemo(() => {
    switch (phase) {
      case 'profile':
        return PROFILE_STEPS;
      case 'neighborhood':
        return NEIGHBORHOOD_STEPS;
      case 'coins':
        return COIN_STORE_STEPS;
      case 'golive':
        return GO_LIVE_STEPS;
      default:
        return [];
    }
  }, [phase]);

  useEffect(() => {
    setIsTouch(
      window.matchMedia('(pointer: coarse)').matches ||
        ('maxTouchPoints' in navigator && (navigator as any).maxTouchPoints > 0)
    );
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;

    async function init() {
      const { data, error } = await supabase
        .from('user_onboarding')
        .select('id, current_phase, current_step, completed')
        .eq('user_id', user.id)
        .maybeSingle();

      if (cancelled) return;

      if (!data || error) {
        const { data: inserted, error: insertError } = await supabase
          .from('user_onboarding')
          .insert({
            user_id: user.id,
            current_phase: 'profile',
            current_step: 0,
            completed: false,
          })
          .select('id')
          .single();

        if (!cancelled && inserted && !insertError) {
          setOnboardingId(inserted.id);
        }
      } else {
        setOnboardingId(data.id);
        if (data.completed) {
          navigate('/');
          return;
        }
        setPhase((data.current_phase as OnboardingPhase) || 'profile');
        setStepIndex(data.current_step || 0);
      }
    }

    init();

    return () => {
      cancelled = true;
    };
  }, [user?.id, navigate]);

  const saveProgress = async (nextPhase: OnboardingPhase, nextStep: number) => {
    if (!user?.id || !onboardingId) return;
    await supabase
      .from('user_onboarding')
      .update({
        current_phase: nextPhase,
        current_step: nextStep,
        updated_at: new Date().toISOString(),
      })
      .eq('id', onboardingId);
  };

  const handleNext = async () => {
    if (!currentSteps.length) return;
    const nextStep = stepIndex + 1;
    if (nextStep >= currentSteps.length) {
      await advancePhase();
    } else {
      setStepIndex(nextStep);
      await saveProgress(phase, nextStep);
    }
  };

  const handlePrev = async () => {
    if (stepIndex > 0) {
      const prev = stepIndex - 1;
      setStepIndex(prev);
      await saveProgress(phase, prev);
    }
  };

  const advancePhase = async () => {
    let nextPhase: OnboardingPhase = 'finish';
    switch (phase) {
      case 'profile':
        nextPhase = 'neighborhood';
        break;
      case 'neighborhood':
        nextPhase = 'coins';
        break;
      case 'coins':
        nextPhase = 'golive';
        break;
      case 'golive':
        nextPhase = 'finish';
        break;
    }

    if (nextPhase === 'finish') {
      await completeOnboarding();
    } else {
      setPhase(nextPhase);
      setStepIndex(0);
      await saveProgress(nextPhase, 0);
    }
  };

  const completeOnboarding = async () => {
    if (!user?.id || !onboardingId) return;
    await supabase
      .from('user_onboarding')
      .update({
        completed: true,
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', onboardingId);

    if (profile) {
      await supabase
        .from('user_profiles')
        .update({ has_seen_tutorial: true, updated_at: new Date().toISOString() })
        .eq('id', user.id);
      setProfile({ ...profile, has_seen_tutorial: true } as any);
    }

    toast.success('You are ready!');
    navigate('/');
  };

  const handleSkip = async () => {
    await advancePhase();
  };

  if (phase === 'finish') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-950 via-[#0d1222] to-[#1c1334] px-4">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="max-w-md rounded-3xl border border-slate-700 bg-slate-900/90 p-8 text-center shadow-2xl"
        >
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/20">
            <Check className="h-8 w-8 text-emerald-400" />
          </div>
          <h1 className="mb-2 text-3xl font-bold text-white">You are Ready!</h1>
          <p className="mb-6 text-slate-300">
            You have completed the Mai Troll onboarding. Welcome to the city.
          </p>
          <div className="mb-6 space-y-2 text-left">
            {['Profile', 'Neighborhood', 'Troll Coins', 'Go Live'].map((item) => (
              <div key={item} className="flex items-center gap-2 text-sm text-slate-300">
                <Check className="h-4 w-4 text-emerald-400" />
                {item}
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={completeOnboarding}
            className="w-full rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 py-3 font-bold text-white hover:from-cyan-600 hover:to-blue-700"
          >
            Enter Mai Troll
          </button>
        </motion.div>
      </div>
    );
  }

  if (!currentSteps.length) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[9999]">
      <TutorialOverlay
        steps={currentSteps}
        currentStepIndex={stepIndex}
        onNext={handleNext}
        onPrev={handlePrev}
        onSkip={handleSkip}
        onComplete={completeOnboarding}
        isTouchDevice={isTouch}
      />
    </div>
  );
}
