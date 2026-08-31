import React, { useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import {
  X,
  Radio,
  MessageCircle,
  Gift,
  Swords,
  Telescope,
  Map as MapIcon,
  Coins,
  Shield,
  Zap,
  Pin,
  Users,
  Trophy,
  Sparkles,
  Smartphone,
  Video,
  Gamepad2,
  Mail,
  Crown,
  Eye,
  UserPlus,
  Flame,
} from 'lucide-react';

interface LearnAboutMaiTrollModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/* ============================================================
   MAITROLL FEATURES
   Keep this list aligned with features that actually exist
   or are intentionally part of the current platform.
   ============================================================ */

const features = [
  {
    icon: Radio,
    title: 'Go Live',
    description:
      'Turn your camera on, grab a seat, and go live. Talk, hang out, build your audience, or just see who pulls up.',
    color: 'from-red-500/15 to-orange-500/10',
    iconColor: 'text-red-400',
  },
  {
    icon: MessageCircle,
    title: 'Chat & Pull Up',
    description:
      'Talk in live chats, meet people, react, follow creators, and actually be part of what is happening instead of just watching.',
    color: 'from-cyan-500/15 to-blue-500/10',
    iconColor: 'text-cyan-400',
  },
  {
    icon: Gift,
    title: 'Send Gifts',
    description:
      'Got a creator you rock with? Send gifts using Troll Coins and show some love while they are live.',
    color: 'from-pink-500/15 to-rose-500/10',
    iconColor: 'text-pink-400',
  },
  {
    icon: Swords,
    title: '1v1 MaiBattles',
    description:
      'Creators can go head-to-head in live 1v1 battles. Viewers watch, hype things up, send gifts, and pick their side.',
    color: 'from-purple-500/15 to-violet-500/10',
    iconColor: 'text-purple-400',
  },
  {
    icon: Telescope,
    title: 'Find Your People',
    description:
      'Swipe through live streams, discover creators, find new personalities, and see what is popping around the city.',
    color: 'from-amber-500/15 to-yellow-500/10',
    iconColor: 'text-amber-400',
  },
  {
    icon: MapIcon,
    title: 'The MaiTroll City',
    description:
      'This is bigger than one feed. Explore the city, jump between experiences, find communities, creators, games, events, and more.',
    color: 'from-emerald-500/15 to-teal-500/10',
    iconColor: 'text-emerald-400',
  },
];

const liveFeatures = [
  {
    icon: Users,
    title: 'Guest Seats',
    description:
      'Bring people into your live and turn a solo stream into a whole conversation.',
  },
  {
    icon: UserPlus,
    title: 'Co-Hosts',
    description:
      'Go live with other people and make the room feel like a real hangout.',
  },
  {
    icon: Pin,
    title: 'Pinned Messages',
    description:
      'Keep important messages front and center so the whole room can see them.',
  },
  {
    icon: Sparkles,
    title: 'RGB Box Effects',
    description:
      'Turn on RGB effects for supported broadcast boxes and make your setup pop.',
  },
  {
    icon: Shield,
    title: 'Minor Safety',
    description:
      'Safety confirmations and badges help make age-related protections visible where they matter.',
  },
  {
    icon: Eye,
    title: 'Stream Swipe',
    description:
      'Swipe through streams and find something worth watching without digging through menus.',
  },
];

const creatorFeatures = [
  'Go live from your phone or web',
  'Bring guests into your stream',
  'Co-host with other creators',
  'Receive virtual gifts',
  'Build your audience',
  'Join 1v1 MaiBattles',
  'Use pinned chat messages',
  'Customize supported stream visuals',
  'Build XP and progress through tiers',
  'Take part in the creator economy',
];

const cityFeatures = [
  'Live streams',
  'Treelz',
  'Mai Network',
  'MaiBattles',
  'Games',
  'Events',
  'Creator communities',
  'UTroMail',
  'Virtual economy',
  'Social experiences',
  'T-League',
  'More city experiences',
];

const progressionFeatures = [
  {
    icon: Trophy,
    title: 'XP & Tiers',
    description:
      'Use the platform, participate, create, and progress through MaiTroll’s tier system.',
  },
  {
    icon: Crown,
    title: 'T-League',
    description:
      'Competitive progression gives the city another layer beyond simply watching and posting.',
  },
  {
    icon: Flame,
    title: 'Keep Moving Up',
    description:
      'Your activity and participation can help you progress through the MaiTroll experience.',
  },
];

const socialFeatures = [
  {
    icon: Video,
    title: 'Treelz',
    description:
      'Short-form content for when you want something quick, funny, chaotic, interesting, or completely random.',
  },
  {
    icon: Gamepad2,
    title: 'Games & Experiences',
    description:
      'MaiTroll is not just about livestreams. There are different experiences around the city to jump into.',
  },
  {
    icon: Mail,
    title: 'UTroMail',
    description:
      'Your place for messaging and communication beyond the live room.',
  },
  {
    icon: Smartphone,
    title: 'Built for Phone + Web',
    description:
      'Use MaiTroll on your phone or web and keep moving around the city.',
  },
];

const steps = [
  {
    step: '01',
    title: 'Make Your Account',
    description: 'Create your profile and pull up to the city.',
  },
  {
    step: '02',
    title: 'Find Your Spot',
    description:
      'Watch streams, swipe around, meet people, explore Treelz, or find something else going on.',
  },
  {
    step: '03',
    title: 'Actually Join In',
    description:
      'Chat, follow, gift, battle, create, go live, bring friends, and make your mark.',
  },
];

const rules = [
  'Respect people.',
  'No harassment or threats.',
  'No spam or platform abuse.',
  'Do not impersonate people.',
  'Do not post prohibited content.',
  'Do not abuse moderation tools.',
  'Do not exploit or manipulate the platform.',
  'Follow applicable laws and MaiTroll policies.',
];

export default function LearnAboutMaiTrollModal({
  isOpen,
  onClose,
}: LearnAboutMaiTrollModalProps) {
  const navigate = useNavigate();

  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
      }
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
      className="fixed inset-0 z-[9999] flex items-start justify-center overflow-y-auto bg-black/85 p-0 backdrop-blur-md sm:p-4"
      onClick={handleClose}
    >
      <article
        className="
          relative my-0 w-full max-w-4xl overflow-hidden
          border border-white/[0.08]
          bg-[#07070d] text-white shadow-2xl
          sm:my-6 sm:rounded-[28px]
        "
        onClick={(e) => e.stopPropagation()}
      >
        {/* =====================================================
            CLOSE
            ===================================================== */}

        <button
          onClick={handleClose}
          className="
            absolute right-4 top-4 z-50
            flex h-10 w-10 items-center justify-center
            rounded-full border border-white/10
            bg-black/40 text-white/70
            backdrop-blur-xl
            transition-all duration-200
            hover:bg-white/10 hover:text-white
          "
          aria-label="Close Learn About MaiTroll"
        >
          <X className="h-5 w-5" />
        </button>

        {/* =====================================================
            HERO
            ===================================================== */}

        <header className="relative overflow-hidden border-b border-white/[0.06]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(168,85,247,0.22),transparent_35%),radial-gradient(circle_at_85%_20%,rgba(6,182,212,0.16),transparent_30%),radial-gradient(circle_at_50%_100%,rgba(236,72,153,0.12),transparent_35%)]" />

          <div className="absolute -left-32 top-20 h-64 w-64 rounded-full bg-purple-600/10 blur-3xl" />
          <div className="absolute -right-32 bottom-0 h-64 w-64 rounded-full bg-cyan-500/10 blur-3xl" />

          <div className="relative px-6 pb-16 pt-20 sm:px-10 sm:pb-20 sm:pt-24">
            <div className="mx-auto max-w-3xl text-center">
              <div
                className="
                  mb-6 inline-flex items-center gap-2
                  rounded-full border border-purple-400/20
                  bg-purple-500/[0.08]
                  px-4 py-2
                  text-xs font-bold uppercase tracking-[0.16em]
                  text-purple-300
                "
              >
                <Sparkles className="h-3.5 w-3.5" />
                Welcome to the city
              </div>

              <h1 className="text-5xl font-black tracking-[-0.04em] sm:text-6xl lg:text-7xl">
                This isn't just
                <br />
                another social app.
              </h1>

              <div className="mt-4 text-4xl font-black tracking-[-0.04em] sm:text-5xl">
                This is{' '}
                <span className="bg-gradient-to-r from-purple-400 via-pink-400 to-cyan-400 bg-clip-text text-transparent">
                  MaiTroll.
                </span>
              </div>

              <p className="mx-auto mt-6 max-w-2xl text-base leading-7 text-white/55 sm:text-lg">
                Go live. Pull up on somebody else's stream. Find your people.
                Send gifts. Battle. Swipe through streams. Explore the city.
                Do whatever makes sense for you.
              </p>

              <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
                <button
                  onClick={() => navigate('/auth?mode=signup')}
                  className="
                    w-full rounded-2xl
                    bg-white px-7 py-3.5
                    text-sm font-black text-black
                    shadow-[0_10px_40px_rgba(255,255,255,0.12)]
                    transition-all duration-200
                    hover:scale-[1.02] hover:bg-white/90
                    sm:w-auto
                  "
                >
                  Join MaiTroll
                </button>

                <button
                  onClick={() => {
                    handleClose();
                    navigate('/explore');
                  }}
                  className="
                    w-full rounded-2xl
                    border border-white/10
                    bg-white/[0.05]
                    px-7 py-3.5
                    text-sm font-bold text-white
                    backdrop-blur-xl
                    transition-all duration-200
                    hover:bg-white/[0.09]
                    sm:w-auto
                  "
                >
                  Explore the City
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* =====================================================
            QUICK IDENTITY
            ===================================================== */}

        <section className="border-b border-white/[0.06] px-6 py-10 sm:px-10">
          <div className="mx-auto grid max-w-4xl gap-3 sm:grid-cols-3">
            {[
              ['GO LIVE', 'Broadcast your way.'],
              ['PULL UP', 'Find people worth watching.'],
              ['GET INVOLVED', "Don't just sit there."],
            ].map(([title, text]) => (
              <div
                key={title}
                className="
                  rounded-2xl border border-white/[0.07]
                  bg-white/[0.025] p-5
                  transition-all duration-200
                  hover:border-white/[0.12]
                  hover:bg-white/[0.04]
                "
              >
                <div className="text-xs font-black tracking-[0.18em] text-purple-300">
                  {title}
                </div>

                <div className="mt-2 text-sm font-medium text-white/60">
                  {text}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* =====================================================
            WHAT IS MAITROLL
            ===================================================== */}

        <section className="px-6 py-14 sm:px-10">
          <div className="mx-auto max-w-3xl">
            <div className="mb-3 text-xs font-black uppercase tracking-[0.2em] text-cyan-400">
              So... what is this?
            </div>

            <h2 className="text-3xl font-black tracking-tight sm:text-4xl">
              A whole digital city built around people.
            </h2>

            <div className="mt-6 space-y-4 text-base leading-7 text-white/55 sm:text-lg">
              <p>
                MaiTroll brings live streaming, social interaction, creators,
                battles, gifts, games, content, messaging, progression, and
                community into one place.
              </p>

              <p>
                You can literally just chill and watch. Or you can go all in,
                build your profile, go live, meet people, battle, support
                creators, and become part of the community.
              </p>

              <p className="font-bold text-white">
                Basically: pull up, find something interesting, and make the
                city yours.
              </p>
            </div>
          </div>
        </section>

        {/* =====================================================
            MAIN FEATURES
            ===================================================== */}

        <section className="border-y border-white/[0.06] bg-white/[0.015] px-6 py-14 sm:px-10">
          <div className="mx-auto max-w-5xl">
            <div className="mb-9">
              <div className="text-xs font-black uppercase tracking-[0.2em] text-purple-400">
                The main stuff
              </div>

              <h2 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">
                What you can actually do here.
              </h2>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {features.map((feature) => {
                const Icon = feature.icon;

                return (
                  <div
                    key={feature.title}
                    className={`
                      group rounded-2xl border border-white/[0.07]
                      bg-gradient-to-br ${feature.color}
                      p-5 backdrop-blur-xl
                      transition-all duration-200
                      hover:-translate-y-0.5
                      hover:border-white/[0.14]
                    `}
                  >
                    <div
                      className="
                        mb-5 flex h-11 w-11 items-center justify-center
                        rounded-xl border border-white/[0.07]
                        bg-black/20
                      "
                    >
                      <Icon
                        className={`h-5 w-5 ${feature.iconColor}`}
                      />
                    </div>

                    <h3 className="text-lg font-black text-white">
                      {feature.title}
                    </h3>

                    <p className="mt-2 text-sm leading-6 text-white/50">
                      {feature.description}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* =====================================================
            LIVE STREAMING
            ===================================================== */}

        <section className="px-6 py-14 sm:px-10">
          <div className="mx-auto max-w-5xl">
            <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
              <div>
                <div className="text-xs font-black uppercase tracking-[0.2em] text-red-400">
                  When you're live
                </div>

                <h2 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">
                  Your stream.
                  <br />
                  Your room.
                </h2>

                <p className="mt-5 text-base leading-7 text-white/50">
                  Go solo or bring people in. Your live room can be a
                  conversation, a performance, a battle, a hangout, or
                  whatever you're making it.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {liveFeatures.map((item) => {
                  const Icon = item.icon;

                  return (
                    <div
                      key={item.title}
                      className="
                        rounded-2xl border border-white/[0.07]
                        bg-white/[0.025] p-5
                      "
                    >
                      <Icon className="h-5 w-5 text-purple-400" />

                      <h3 className="mt-4 text-sm font-black text-white">
                        {item.title}
                      </h3>

                      <p className="mt-1.5 text-xs leading-5 text-white/45">
                        {item.description}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        {/* =====================================================
            CREATOR SECTION
            ===================================================== */}

        <section className="border-y border-white/[0.06] bg-white/[0.015] px-6 py-14 sm:px-10">
          <div className="mx-auto max-w-4xl">
            <div className="max-w-2xl">
              <div className="text-xs font-black uppercase tracking-[0.2em] text-pink-400">
                For creators
              </div>

              <h2 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">
                If you create, there is room for you.
              </h2>

              <p className="mt-5 text-base leading-7 text-white/50">
                MaiTroll gives creators more than a place to press “Go Live.”
                Build your presence, connect with viewers, bring people into
                your streams, battle other creators, and participate in the
                platform economy.
              </p>
            </div>

            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              {creatorFeatures.map((item) => (
                <div
                  key={item}
                  className="
                    flex items-center gap-3
                    rounded-xl border border-white/[0.07]
                    bg-white/[0.02] px-4 py-3
                  "
                >
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-purple-500/10">
                    <Zap className="h-3.5 w-3.5 text-purple-400" />
                  </div>

                  <span className="text-sm font-semibold text-white/70">
                    {item}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* =====================================================
            CONTENT + SOCIAL
            ===================================================== */}

        <section className="px-6 py-14 sm:px-10">
          <div className="mx-auto max-w-5xl">
            <div className="mb-9">
              <div className="text-xs font-black uppercase tracking-[0.2em] text-cyan-400">
                More than live
              </div>

              <h2 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">
                There's more than one way to be here.
              </h2>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {socialFeatures.map((item) => {
                const Icon = item.icon;

                return (
                  <div
                    key={item.title}
                    className="
                      rounded-2xl border border-white/[0.07]
                      bg-white/[0.025] p-5
                    "
                  >
                    <Icon className="h-5 w-5 text-cyan-400" />

                    <h3 className="mt-5 text-base font-black">
                      {item.title}
                    </h3>

                    <p className="mt-2 text-xs leading-5 text-white/45">
                      {item.description}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* =====================================================
            CITY
            ===================================================== */}

        <section className="border-y border-white/[0.06] bg-white/[0.015] px-6 py-14 sm:px-10">
          <div className="mx-auto max-w-4xl text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-emerald-400/10 bg-emerald-400/[0.06]">
              <MapIcon className="h-5 w-5 text-emerald-400" />
            </div>

            <h2 className="mt-5 text-3xl font-black tracking-tight sm:text-4xl">
              Welcome to the city.
            </h2>

            <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-white/50 sm:text-lg">
              MaiTroll is built like a digital city. Different places,
              different people, different things happening all the time.
              There is no single “right” way to use it.
            </p>

            <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {cityFeatures.map((area) => (
                <div
                  key={area}
                  className="
                    rounded-xl border border-white/[0.07]
                    bg-black/20 px-4 py-3
                    text-sm font-semibold text-white/60
                  "
                >
                  {area}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* =====================================================
            XP + TIER
            ===================================================== */}

        <section className="px-6 py-14 sm:px-10">
          <div className="mx-auto max-w-5xl">
            <div className="grid gap-8 lg:grid-cols-[0.85fr_1.15fr] lg:items-center">
              <div>
                <div className="text-xs font-black uppercase tracking-[0.2em] text-amber-400">
                  Progression
                </div>

                <h2 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">
                  Level up while you use the city.
                </h2>

                <p className="mt-5 text-base leading-7 text-white/50">
                  MaiTroll has progression built into the experience. As you
                  participate, create, interact, and keep moving, there are
                  tiers and competitive systems to work through.
                </p>
              </div>

              <div className="space-y-3">
                {progressionFeatures.map((item) => {
                  const Icon = item.icon;

                  return (
                    <div
                      key={item.title}
                      className="
                        flex gap-4 rounded-2xl
                        border border-white/[0.07]
                        bg-white/[0.025] p-5
                      "
                    >
                      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-amber-400/[0.08]">
                        <Icon className="h-5 w-5 text-amber-400" />
                      </div>

                      <div>
                        <h3 className="font-black text-white">
                          {item.title}
                        </h3>

                        <p className="mt-1 text-sm leading-5 text-white/45">
                          {item.description}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        {/* =====================================================
            TROLL COINS
            ===================================================== */}

        <section className="border-y border-white/[0.06] bg-white/[0.015] px-6 py-14 sm:px-10">
          <div className="mx-auto max-w-3xl">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-400/[0.08]">
                <Coins className="h-5 w-5 text-amber-400" />
              </div>

              <div>
                <div className="text-xs font-black uppercase tracking-[0.18em] text-amber-400">
                  The economy
                </div>

                <h2 className="mt-1 text-3xl font-black tracking-tight">
                  Troll Coins
                </h2>
              </div>
            </div>

            <div className="mt-6 space-y-4 text-base leading-7 text-white/50 sm:text-lg">
              <p>
                Troll Coins are MaiTroll's virtual currency used across
                supported features on the platform.
              </p>

              <p>
                Depending on the feature, they can be used for things like
                sending gifts, supporting creators, and participating in
                supported MaiTroll experiences.
              </p>

              <p className="font-semibold text-white/75">
                Coin packages and pricing are available through the current
                MaiTroll store.
              </p>
            </div>
          </div>
        </section>

        {/* =====================================================
            PAYOUTS
            ===================================================== */}

        <section className="px-6 py-14 sm:px-10">
          <div className="mx-auto max-w-3xl">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-400/[0.08]">
                <Coins className="h-5 w-5 text-emerald-400" />
              </div>

              <div>
                <div className="text-xs font-black uppercase tracking-[0.18em] text-emerald-400">
                  Creator economy
                </div>

                <h2 className="mt-1 text-3xl font-black tracking-tight">
                  Creator Cashouts
                </h2>
              </div>
            </div>

            <p className="mt-6 text-base leading-7 text-white/50 sm:text-lg">
              Eligible creators may be able to cash out qualifying balances
              through supported payout methods. Cashouts are subject to current
              MaiTroll requirements, limits, fees, and applicable policies.
            </p>

            <div className="mt-6 rounded-2xl border border-emerald-400/10 bg-emerald-400/[0.04] p-5">
              <div className="text-sm font-black text-emerald-300">
                Current payout rules apply
              </div>

              <p className="mt-1.5 text-sm leading-6 text-white/45">
                Check the current cashout experience for the requirements and
                options available to your account.
              </p>
            </div>
          </div>
        </section>

        {/* =====================================================
            COMMUNITY
            ===================================================== */}

        <section className="border-y border-white/[0.06] bg-white/[0.015] px-6 py-14 sm:px-10">
          <div className="mx-auto max-w-3xl text-center">
            <div className="text-xs font-black uppercase tracking-[0.2em] text-pink-400">
              The vibe
            </div>

            <h2 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">
              Come for the content.
              <br />
              Stay for the people.
            </h2>

            <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-white/50 sm:text-lg">
              Some people are here to create. Some are here to watch. Some
              pull up to chat. Some are here for battles. Some just want to
              see what the city is doing today.
            </p>

            <p className="mt-5 font-bold text-white">
              You don't have to fit one box.
            </p>
          </div>
        </section>

        {/* =====================================================
            HOW IT WORKS
            ===================================================== */}

        <section className="px-6 py-14 sm:px-10">
          <div className="mx-auto max-w-4xl">
            <div className="mb-10 text-center">
              <div className="text-xs font-black uppercase tracking-[0.2em] text-purple-400">
                It's really that simple
              </div>

              <h2 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">
                How to get started
              </h2>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              {steps.map((item) => (
                <div
                  key={item.step}
                  className="
                    relative rounded-2xl
                    border border-white/[0.07]
                    bg-white/[0.025]
                    p-6 text-center
                  "
                >
                  <div
                    className="
                      mx-auto flex h-11 w-11
                      items-center justify-center
                      rounded-full
                      bg-gradient-to-br from-purple-500 to-pink-500
                      text-xs font-black
                    "
                  >
                    {item.step}
                  </div>

                  <h3 className="mt-5 text-base font-black">
                    {item.title}
                  </h3>

                  <p className="mt-2 text-sm leading-5 text-white/45">
                    {item.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* =====================================================
            RULES
            ===================================================== */}

        <section className="border-t border-white/[0.06] bg-white/[0.015] px-6 py-14 sm:px-10">
          <div className="mx-auto max-w-4xl">
            <div className="max-w-2xl">
              <div className="flex items-center gap-3">
                <Shield className="h-5 w-5 text-purple-400" />

                <div className="text-xs font-black uppercase tracking-[0.2em] text-purple-400">
                  Keep the city playable
                </div>
              </div>

              <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">
                A few things are not cool.
              </h2>

              <p className="mt-4 text-base leading-7 text-white/50">
                Have fun, talk your talk, be yourself — just don't ruin the
                experience for everybody else.
              </p>
            </div>

            <div className="mt-8 grid gap-2.5 sm:grid-cols-2">
              {rules.map((rule) => (
                <div
                  key={rule}
                  className="
                    flex items-center gap-3
                    rounded-xl border border-white/[0.07]
                    bg-black/20 px-4 py-3
                  "
                >
                  <div className="h-1.5 w-1.5 rounded-full bg-purple-400" />

                  <span className="text-sm text-white/55">
                    {rule}
                  </span>
                </div>
              ))}
            </div>

            <div className="mt-7 flex flex-wrap gap-3">
              <button
                onClick={() => {
                  handleClose();
                  navigate('/legal/safety');
                }}
                className="
                  rounded-xl border border-white/10
                  bg-white/[0.04] px-4 py-2.5
                  text-sm font-bold text-white/70
                  transition-colors hover:bg-white/[0.08]
                "
              >
                Community Rules
              </button>

              <button
                onClick={() => {
                  handleClose();
                  navigate('/legal/terms');
                }}
                className="
                  rounded-xl border border-white/10
                  bg-white/[0.04] px-4 py-2.5
                  text-sm font-bold text-white/70
                  transition-colors hover:bg-white/[0.08]
                "
              >
                Terms
              </button>

              <button
                onClick={() => {
                  handleClose();
                  navigate('/privacy');
                }}
                className="
                  rounded-xl border border-white/10
                  bg-white/[0.04] px-4 py-2.5
                  text-sm font-bold text-white/70
                  transition-colors hover:bg-white/[0.08]
                "
              >
                Privacy
              </button>
            </div>
          </div>
        </section>

        {/* =====================================================
            FINAL CTA
            ===================================================== */}

        <footer className="relative overflow-hidden border-t border-white/[0.06]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_100%,rgba(168,85,247,0.18),transparent_55%)]" />

          <div className="relative px-6 py-16 text-center sm:px-10 sm:py-20">
            <div className="mx-auto max-w-2xl">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-purple-400/10 bg-purple-400/[0.07]">
                <Sparkles className="h-5 w-5 text-purple-400" />
              </div>

              <h2 className="mt-6 text-4xl font-black tracking-[-0.03em] sm:text-5xl">
                So...
                <br />
                you pulling up or what?
              </h2>

              <p className="mx-auto mt-5 max-w-xl text-base leading-7 text-white/45 sm:text-lg">
                Create your account, explore the city, find a stream, meet
                some people, and see what MaiTroll is about.
              </p>

              <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
                <button
                  onClick={() => navigate('/auth?mode=signup')}
                  className="
                    w-full rounded-2xl
                    bg-white px-8 py-3.5
                    text-sm font-black text-black
                    transition-all duration-200
                    hover:scale-[1.02]
                    hover:bg-white/90
                    sm:w-auto
                  "
                >
                  Join MaiTroll
                </button>

                <button
                  onClick={() => {
                    handleClose();
                    navigate('/explore');
                  }}
                  className="
                    w-full rounded-2xl
                    border border-white/10
                    bg-white/[0.05]
                    px-8 py-3.5
                    text-sm font-bold text-white
                    transition-all duration-200
                    hover:bg-white/[0.09]
                    sm:w-auto
                  "
                >
                  Explore First
                </button>
              </div>
            </div>
          </div>
        </footer>
      </article>
    </div>,
    document.body
  );
}

