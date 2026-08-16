import React, { useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { X, Radio, MessageCircle, Gift, Swords, Telescope, Map as MapIcon, Coins, Shield, Zap, Info } from 'lucide-react';

interface LearnAboutMaiTrollModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const features = [
  {
    icon: Radio,
    title: 'Go Live',
    description: 'Broadcast yourself, share what you\'re doing, talk with your community, and build your own audience.',
    color: 'from-red-500/20 to-orange-500/20',
    iconColor: 'text-red-400',
  },
  {
    icon: MessageCircle,
    title: 'Meet & Chat',
    description: 'Hang out with other members, talk in chat, react, and become part of the community.',
    color: 'from-blue-500/20 to-cyan-500/20',
    iconColor: 'text-blue-400',
  },
  {
    icon: Gift,
    title: 'Support Creators',
    description: 'Send gifts, support broadcasters, and participate in the MaiTroll creator economy.',
    color: 'from-pink-500/20 to-rose-500/20',
    iconColor: 'text-pink-400',
  },
  {
    icon: Swords,
    title: 'MaiBattles',
    description: 'Creators can face off in live battles while the community watches, reacts, and supports their favorites.',
    color: 'from-purple-500/20 to-violet-500/20',
    iconColor: 'text-purple-400',
  },
  {
    icon: Telescope,
    title: 'Discover Talent',
    description: 'Find new creators, personalities, performers, and people doing something worth watching.',
    color: 'from-amber-500/20 to-yellow-500/20',
    iconColor: 'text-amber-400',
  },
  {
    icon: MapIcon,
    title: 'Explore the City',
    description: 'MaiTroll isn\'t just one feed. Explore the different parts of the city and discover what\'s happening.',
    color: 'from-emerald-500/20 to-teal-500/20',
    iconColor: 'text-emerald-400',
  },
];

const steps = [
  { step: '1', title: 'Create Your Account', description: 'Join MaiTroll and create your profile.' },
  { step: '2', title: 'Explore', description: 'Find broadcasts, creators, communities, and things happening around the city.' },
  { step: '3', title: 'Get Involved', description: 'Go live, chat, support creators, participate, and make MaiTroll your own.' },
];

const rules = [
  'Respect other users.',
  'Don\'t harass or threaten people.',
  'Don\'t spam.',
  'Don\'t impersonate others.',
  'Don\'t post prohibited content.',
  'Don\'t abuse moderation tools.',
  'Don\'t attempt to exploit or manipulate the platform.',
  'Follow applicable laws.',
];

export default function LearnAboutMaiTrollModal({ isOpen, onClose }: LearnAboutMaiTrollModalProps) {
  const navigate = useNavigate();

  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };
    document.addEventListener('keydown', handleKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = '';
    };
  }, [isOpen, handleClose]);

  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-start justify-center overflow-y-auto bg-black/80 backdrop-blur-sm p-0 sm:p-4"
      onClick={handleClose}
    >
      <div
        className="relative my-4 sm:my-8 w-full max-w-3xl overflow-hidden rounded-none sm:rounded-3xl bg-slate-950 shadow-2xl sm:my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={handleClose}
          className="absolute top-3 right-3 z-30 rounded-full bg-slate-800/90 p-2 text-white hover:bg-slate-700 transition-colors"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Hero */}
        <section className="relative overflow-hidden bg-gradient-to-br from-purple-900/40 via-slate-900 to-pink-900/40 px-6 py-16 sm:px-10 sm:py-24">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(147,51,234,0.2),transparent_50%)]" />
          <div className="relative mx-auto max-w-3xl text-center">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-purple-500/30 bg-purple-600/20 px-4 py-2 text-sm font-medium text-purple-300">
              <Info className="h-4 w-4" />
              Live. Connect. Create. Have a little fun.
            </div>
            <h1 className="mb-5 text-4xl font-extrabold leading-tight text-white sm:text-5xl lg:text-6xl">
              Welcome to{' '}
              <span className="bg-gradient-to-r from-purple-400 via-pink-400 to-cyan-400 bg-clip-text text-transparent">
                MaiTroll
              </span>
            </h1>
            <p className="mx-auto max-w-2xl text-lg leading-relaxed text-slate-300 sm:text-xl">
              MaiTroll is a live social community where people can broadcast, hang out, chat, support creators, discover talent, and take part in a city built around the community.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                onClick={() => navigate('/auth?mode=signup')}
                className="w-full sm:w-auto px-8 py-3 rounded-xl bg-gradient-to-r from-purple-600 via-pink-600 to-cyan-500 text-white font-bold shadow-lg hover:shadow-[0_12px_40px_rgba(236,72,153,0.4)] hover:brightness-110 transition-all duration-300"
              >
                Join MaiTroll
              </button>
              <button
                onClick={() => {
                  handleClose();
                  navigate('/explore');
                }}
                className="w-full sm:w-auto px-8 py-3 rounded-xl border border-white/10 bg-white/5 text-white font-semibold hover:bg-white/10 transition-all duration-300"
              >
                Explore MaiTroll
              </button>
            </div>
          </div>
        </section>

        {/* What is MaiTroll */}
        <section className="border-t border-slate-800 bg-slate-950 px-6 py-14 sm:px-10">
          <div className="mx-auto max-w-3xl">
            <h2 className="mb-4 text-2xl font-bold text-white sm:text-3xl">What is MaiTroll?</h2>
            <div className="space-y-4 text-base leading-relaxed text-slate-300 sm:text-lg">
              <p>
                MaiTroll is more than another place to watch a livestream. It&apos;s a community-driven digital city where people can go live, meet new people, talk, play, create, support creators, and take part in the things happening around them.
              </p>
              <p className="text-purple-300 font-medium">
                Think of it as a place where your livestream is not just a livestream — it&apos;s part of the city.
              </p>
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="border-t border-slate-800 bg-slate-900/30 px-6 py-14 sm:px-10">
          <div className="mx-auto max-w-5xl">
            <h2 className="mb-3 text-center text-2xl font-bold text-white sm:text-3xl">What Can You Do on MaiTroll?</h2>
            <p className="mb-10 text-center text-slate-400">Everything from broadcasting to exploring, all in one place.</p>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {features.map((feature) => {
                const Icon = feature.icon;
                return (
                  <div
                    key={feature.title}
                    className={`rounded-2xl border border-white/[0.08] bg-gradient-to-br ${feature.color} p-5 backdrop-blur-xl transition-all duration-300 hover:border-white/[0.15] hover:bg-slate-800/40`}
                  >
                    <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-white/5">
                      <Icon className={`h-5 w-5 ${feature.iconColor}`} />
                    </div>
                    <h3 className="mb-1.5 text-lg font-semibold text-white">{feature.title}</h3>
                    <p className="text-sm leading-relaxed text-slate-300">{feature.description}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Welcome to the City */}
        <section className="border-t border-slate-800 bg-slate-950 px-6 py-14 sm:px-10">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="mb-4 text-2xl font-bold text-white sm:text-3xl">Welcome to the City</h2>
            <p className="mx-auto max-w-2xl text-base leading-relaxed text-slate-300 sm:text-lg">
              MaiTroll is built like a digital city. Different places have different things happening, different people have different roles, and there&apos;s always something going on.
            </p>
            <div className="mt-8 grid grid-cols-2 sm:grid-cols-3 gap-3 text-left">
              {[
                'Live broadcasts',
                'Community areas',
                'Creator experiences',
                'Games & events',
                'Social features',
                'Creator economy features',
              ].map((area) => (
                <div key={area} className="rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-3 text-sm text-slate-300">
                  {area}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Creators */}
        <section className="border-t border-slate-800 bg-slate-900/30 px-6 py-14 sm:px-10">
          <div className="mx-auto max-w-3xl">
            <h2 className="mb-4 text-2xl font-bold text-white sm:text-3xl">Built for Creators</h2>
            <p className="mb-6 text-base leading-relaxed text-slate-300 sm:text-lg">
              Whether you&apos;re just getting started or already have a community, MaiTroll gives you a place to broadcast, interact with your audience, and build your presence.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                'Live broadcasting',
                'Gifts & creator support',
                'Creator profiles',
                'MaiBattles',
                'Audience interaction',
                'Creator discovery',
              ].map((tool) => (
                <div key={tool} className="flex items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-3">
                  <Zap className="h-4 w-4 text-cyan-400" />
                  <span className="text-sm font-medium text-slate-200">{tool}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Built for People */}
        <section className="border-t border-slate-800 bg-slate-950 px-6 py-14 sm:px-10">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="mb-4 text-2xl font-bold text-white sm:text-3xl">Built for People</h2>
            <p className="mx-auto max-w-2xl text-base leading-relaxed text-slate-300 sm:text-lg">
              MaiTroll was built around people — not just numbers. The goal is simple: give people a place to connect, create, have fun, and build something together.
            </p>
          </div>
        </section>

        {/* Troll Coins */}
        <section className="border-t border-slate-800 bg-slate-900/30 px-6 py-14 sm:px-10">
          <div className="mx-auto max-w-3xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/15">
                <Coins className="h-5 w-5 text-amber-400" />
              </div>
              <h2 className="text-2xl font-bold text-white sm:text-3xl">Troll Coins</h2>
            </div>
            <p className="text-base leading-relaxed text-slate-300 sm:text-lg">
              Troll Coins are MaiTroll&apos;s virtual currency. You can use them throughout the platform for supported community and creator experiences — like sending gifts, supporting broadcasters, and participating in creator economy features.
            </p>
          </div>
        </section>

        {/* Accessibility */}
        <section className="border-t border-slate-800 bg-slate-950 px-6 py-14 sm:px-10">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="mb-4 text-2xl font-bold text-white sm:text-3xl">MaiTroll Is For Everyone</h2>
            <p className="mx-auto max-w-2xl text-base leading-relaxed text-slate-300 sm:text-lg">
              Accessibility matters. MaiTroll is building accessibility into the experience so more people can participate, connect, and create.
            </p>
          </div>
        </section>

        {/* Rules */}
        <section className="border-t border-slate-800 bg-slate-900/30 px-6 py-14 sm:px-10">
          <div className="mx-auto max-w-3xl">
            <h2 className="mb-4 text-2xl font-bold text-white sm:text-3xl">Keep MaiTroll Fun</h2>
            <p className="mb-6 text-base leading-relaxed text-slate-300 sm:text-lg">
              Every city needs rules. Ours are here to keep MaiTroll welcoming, entertaining, and safe for everyone.
            </p>
            <div className="grid gap-2.5 sm:grid-cols-2">
              {rules.map((rule) => (
                <div key={rule} className="flex items-start gap-3 rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-3">
                  <Shield className="mt-0.5 h-4 w-4 flex-shrink-0 text-purple-400" />
                  <span className="text-sm text-slate-300">{rule}</span>
                </div>
              ))}
            </div>
            <div className="mt-6 flex flex-wrap gap-3">
              <button
                onClick={() => { handleClose(); navigate('/legal/safety'); }}
                className="px-4 py-2 rounded-lg border border-white/10 bg-white/5 text-sm font-medium text-slate-200 hover:bg-white/10 transition-colors"
              >
                Community Rules
              </button>
              <button
                onClick={() => { handleClose(); navigate('/legal/terms'); }}
                className="px-4 py-2 rounded-lg border border-white/10 bg-white/5 text-sm font-medium text-slate-200 hover:bg-white/10 transition-colors"
              >
                Terms of Service
              </button>
              <button
                onClick={() => { handleClose(); navigate('/privacy'); }}
                className="px-4 py-2 rounded-lg border border-white/10 bg-white/5 text-sm font-medium text-slate-200 hover:bg-white/10 transition-colors"
              >
                Privacy
              </button>
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section className="border-t border-slate-800 bg-slate-950 px-6 py-14 sm:px-10">
          <div className="mx-auto max-w-3xl">
            <h2 className="mb-8 text-center text-2xl font-bold text-white sm:text-3xl">How It Works</h2>
            <div className="grid gap-6 sm:grid-cols-3">
              {steps.map((item) => (
                <div key={item.step} className="relative text-center">
                  <div className="mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-r from-purple-600 to-pink-600 text-sm font-bold text-white">
                    {item.step}
                  </div>
                  <h3 className="mb-1.5 text-lg font-semibold text-white">{item.title}</h3>
                  <p className="text-sm text-slate-400">{item.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Is MaiTroll For You? */}
        <section className="border-t border-slate-800 bg-slate-900/30 px-6 py-14 sm:px-10">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="mb-4 text-2xl font-bold text-white sm:text-3xl">Is MaiTroll For You?</h2>
            <p className="mx-auto max-w-2xl text-base leading-relaxed text-slate-300 sm:text-lg">
              Probably. If you like meeting people, watching live content, creating, talking, competing, discovering new personalities, or simply finding somewhere new to hang out — there&apos;s a place for you here.
            </p>
          </div>
        </section>

        {/* Final CTA */}
        <section className="border-t border-slate-800 bg-gradient-to-r from-purple-900/30 via-slate-900 to-pink-900/30 px-6 py-14 sm:px-10">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="mb-3 text-2xl font-bold text-white sm:text-3xl">Ready to see what MaiTroll is about?</h2>
            <p className="mx-auto mb-8 max-w-xl text-base text-slate-300 sm:text-lg">
              Come check out the city. There&apos;s always something happening.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                onClick={() => navigate('/auth?mode=signup')}
                className="w-full sm:w-auto px-8 py-3 rounded-xl bg-gradient-to-r from-purple-600 via-pink-600 to-cyan-500 text-white font-bold shadow-lg hover:shadow-[0_12px_40px_rgba(236,72,153,0.4)] hover:brightness-110 transition-all duration-300"
              >
                Join MaiTroll
              </button>
              <button
                onClick={() => {
                  handleClose();
                  navigate('/explore');
                }}
                className="w-full sm:w-auto px-8 py-3 rounded-xl border border-white/10 bg-white/5 text-white font-semibold hover:bg-white/10 transition-all duration-300"
              >
                Explore MaiTroll
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>,
    document.body
  );
}
