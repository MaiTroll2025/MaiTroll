import React, { useCallback, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  BriefcaseBusiness,
  Building2,
  CheckCircle2,
  ChevronRight,
  GraduationCap,
  Landmark,
  MessageSquare,
  Radio,
  Scale,
  ShieldCheck,
  ShoppingBag,
  Trophy,
  Users,
  Wallet,
  X,
  Zap,
} from 'lucide-react'

interface LearnAboutMaiTrollModalProps {
  isOpen: boolean
  onClose: () => void
}

const ecosystemFeatures = [
  {
    icon: GraduationCap,
    title: 'Education',
    description:
      'MAiTROLL connects students and instructors with a digital environment built around learning, participation, opportunity, and future-building.',
  },
  {
    icon: BriefcaseBusiness,
    title: 'MAi Business',
    description:
      'A dedicated business environment where eligible educational users can develop entrepreneurial ideas, opportunities, and real-world business activity.',
  },
  {
    icon: Radio,
    title: 'Broadcasting',
    description:
      'Go live, participate in broadcasts, connect with other users, and use broadcasting as one part of the larger MAiTROLL city.',
  },
  {
    icon: ShoppingBag,
    title: 'Commerce',
    description:
      'Marketplace experiences, businesses, products, services, virtual items, and economic systems give the city an active commercial layer.',
  },
  {
    icon: Trophy,
    title: 'Competition',
    description:
      'School Battles, events, competitions, progression, and recognition give members reasons to participate and build together.',
  },
  {
    icon: Users,
    title: 'Community',
    description:
      'Connect with other members through conversations, shared experiences, city spaces, broadcasts, events, and community services.',
  },
]

const businessFeatures = [
  {
    title: 'Built for entrepreneurs',
    description:
      'MAi Business gives eligible educational users a dedicated place to develop entrepreneurial ideas and opportunities.',
  },
  {
    title: 'Education meets business',
    description:
      'The goal is to connect education with practical entrepreneurship instead of separating learning from what comes next.',
  },
  {
    title: 'Verification matters',
    description:
      'MAi Business access is controlled by verified educational eligibility. A regular MAiTROLL account does not automatically receive access.',
  },
  {
    title: 'Build something real',
    description:
      'The platform is designed around creating, participating, learning, competing, and developing opportunities—not simply consuming content.',
  },
]

const schoolFeatures = [
  {
    icon: Trophy,
    title: 'School Battles',
    description:
      'Eligible users can represent their verified educational institution in school-based competition.',
  },
  {
    icon: Landmark,
    title: 'School Pool',
    description:
      'School activity can contribute to a dedicated School Pool system that tracks school-level results and financial activity.',
  },
  {
    icon: GraduationCap,
    title: 'School recognition',
    description:
      'Weekly results and school performance can create recognition around participation, competition, and achievement.',
  },
  {
    icon: Building2,
    title: 'Built around institutions',
    description:
      'School representation is tied to verified institution data rather than arbitrary school names entered by users.',
  },
]

const citySystems = [
  'City Hall and civic-style systems',
  'Troll Court and moderation systems',
  'Marketplace and commerce',
  'Transportation and vehicle services',
  'Community and social spaces',
  'Broadcasting and live experiences',
  'Podcasts, games, and events',
  'Wallet and virtual economy systems',
  'Support, safety, and account services',
  'Progression, recognition, and competitions',
]

const steps = [
  {
    number: '01',
    title: 'Create your account',
    description:
      'Choose the account path that fits you and complete the required verification or onboarding process.',
  },
  {
    number: '02',
    title: 'Enter the city',
    description:
      'Explore the systems, services, communities, opportunities, and experiences available to your account.',
  },
  {
    number: '03',
    title: 'Find your direction',
    description:
      'Learn, build, broadcast, compete, participate, create, sell, connect, or develop something of your own.',
  },
  {
    number: '04',
    title: 'Build your future',
    description:
      'Use MAiTROLL as an environment for opportunity—not simply another place to scroll.',
  },
]

const principles = [
  'Build instead of simply consume.',
  'Create opportunities instead of waiting for them.',
  'Respect the people and institutions around you.',
  'Use the city responsibly.',
  'Protect the integrity of competitions and financial systems.',
  'Follow MAiTROLL policies and applicable laws.',
]

export default function LearnAboutMaiTrollModal({
  isOpen,
  onClose,
}: LearnAboutMaiTrollModalProps) {
  const navigate = useNavigate()

  const handleClose = useCallback(() => {
    onClose()
  }, [onClose])

  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        handleClose()
      }
    }

    document.addEventListener('keydown', handleKeyDown)

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [isOpen, handleClose])

  const handleNavigate = (path: string) => {
    handleClose()
    navigate(path)
  }

  if (!isOpen) {
    return null
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] overflow-y-auto bg-black/80 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-labelledby="learn-about-maitroll-title"
      onClick={handleClose}
    >
      <div className="flex min-h-full items-start justify-center p-3 sm:p-6">
        <article
          className="relative my-4 w-full max-w-5xl overflow-hidden rounded-3xl border border-white/10 bg-[#07070d] text-white shadow-2xl sm:my-8"
          onClick={(event) => event.stopPropagation()}
        >
          {/* Close */}
          <button
            type="button"
            onClick={handleClose}
            className="absolute right-4 top-4 z-20 flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-black/40 text-white/70 backdrop-blur transition hover:bg-white/10 hover:text-white"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>

          {/* Hero */}
          <section className="relative overflow-hidden border-b border-white/10 px-6 pb-14 pt-16 sm:px-10 sm:pb-20 sm:pt-20">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(168,85,247,0.20),transparent_35%),radial-gradient(circle_at_bottom_left,rgba(59,130,246,0.12),transparent_35%)]" />

            <div className="relative mx-auto max-w-4xl">
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-purple-400/20 bg-purple-500/10 px-4 py-2 text-sm font-medium text-purple-300">
                <Zap className="h-4 w-4" />
                Welcome to MAiTROLL
              </div>

              <h1
                id="learn-about-maitroll-title"
                className="max-w-4xl text-4xl font-bold tracking-tight sm:text-6xl"
              >
                A Virtual City Built to Help You Build Your Future.
              </h1>

              <p className="mt-6 max-w-3xl text-base leading-7 text-white/65 sm:text-lg sm:leading-8">
                MAiTROLL is a virtual city connecting education,
                entrepreneurship, business, broadcasting, commerce,
                competition, and community in one digital environment.
              </p>

              <p className="mt-4 max-w-3xl text-base leading-7 text-white/50">
                It is designed for students, instructors, entrepreneurs,
                creators, broadcasters, and eligible members of the MAiTROLL
                community who want to do more than simply consume content.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={() => handleNavigate('/auth?mode=signup')}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-6 py-3.5 font-semibold text-black transition hover:bg-white/90"
                >
                  Create Your Account
                  <ArrowRight className="h-4 w-4" />
                </button>

                <button
                  type="button"
                  onClick={() => handleNavigate('/explore')}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 px-6 py-3.5 font-semibold text-white transition hover:bg-white/10"
                >
                  Explore MAiTROLL
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </section>

          {/* What MAiTROLL Is */}
          <section className="border-b border-white/10 px-6 py-12 sm:px-10 sm:py-16">
            <div className="mx-auto max-w-4xl">
              <div className="max-w-2xl">
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-purple-400">
                  The ecosystem
                </p>

                <h2 className="mt-3 text-3xl font-bold sm:text-4xl">
                  More than a social platform.
                </h2>

                <p className="mt-4 leading-7 text-white/55">
                  MAiTROLL brings multiple digital experiences together under
                  one city structure. Broadcasting is part of the city—but it
                  is not the entire reason the city exists.
                </p>
              </div>

              <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {ecosystemFeatures.map((feature) => {
                  const Icon = feature.icon

                  return (
                    <div
                      key={feature.title}
                      className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 transition hover:border-purple-400/20 hover:bg-white/[0.05]"
                    >
                      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-purple-500/10 text-purple-300">
                        <Icon className="h-5 w-5" />
                      </div>

                      <h3 className="mt-5 text-lg font-semibold">
                        {feature.title}
                      </h3>

                      <p className="mt-2 text-sm leading-6 text-white/50">
                        {feature.description}
                      </p>
                    </div>
                  )
                })}
              </div>
            </div>
          </section>

          {/* MAi Business */}
          <section className="border-b border-white/10 bg-white/[0.015] px-6 py-12 sm:px-10 sm:py-16">
            <div className="mx-auto grid max-w-4xl gap-10 lg:grid-cols-[1fr_1.1fr] lg:items-center">
              <div>
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-300">
                  <BriefcaseBusiness className="h-7 w-7" />
                </div>

                <p className="mt-6 text-sm font-semibold uppercase tracking-[0.2em] text-emerald-400">
                  MAi Business
                </p>

                <h2 className="mt-3 text-3xl font-bold sm:text-4xl">
                  Where education meets entrepreneurship.
                </h2>

                <p className="mt-5 leading-7 text-white/55">
                  MAi Business is a dedicated part of the MAiTROLL ecosystem
                  for eligible educational users. The purpose is simple:
                  connect education with entrepreneurship and give people a
                  place to work toward what comes next.
                </p>

                <div className="mt-6 rounded-2xl border border-emerald-400/15 bg-emerald-500/5 p-5">
                  <div className="flex gap-3">
                    <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300" />
                    <div>
                      <p className="font-semibold text-emerald-200">
                        Eligibility is enforced.
                      </p>
                      <p className="mt-1 text-sm leading-6 text-white/50">
                        A regular or non-student MAiTROLL account does not
                        automatically receive access to MAi Business.
                        Educational eligibility and verification are required.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid gap-3">
                {businessFeatures.map((feature) => (
                  <div
                    key={feature.title}
                    className="flex gap-4 rounded-2xl border border-white/10 bg-black/20 p-5"
                  >
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300" />

                    <div>
                      <h3 className="font-semibold">{feature.title}</h3>
                      <p className="mt-1 text-sm leading-6 text-white/50">
                        {feature.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Education */}
          <section className="border-b border-white/10 px-6 py-12 sm:px-10 sm:py-16">
            <div className="mx-auto max-w-4xl">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-500/10 text-blue-300">
                  <GraduationCap className="h-6 w-6" />
                </div>

                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-400">
                    Education
                  </p>
                  <h2 className="mt-1 text-2xl font-bold sm:text-3xl">
                    Your education can be part of your city identity.
                  </h2>
                </div>
              </div>

              <div className="mt-8 grid gap-5 md:grid-cols-3">
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                  <h3 className="font-semibold">Students</h3>
                  <p className="mt-2 text-sm leading-6 text-white/50">
                    Verified students can participate in educational,
                    entrepreneurial, competitive, and community experiences.
                  </p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                  <h3 className="font-semibold">Instructors</h3>
                  <p className="mt-2 text-sm leading-6 text-white/50">
                    Instructors can participate as verified educational
                    members while remaining subject to their appropriate
                    account permissions.
                  </p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                  <h3 className="font-semibold">Verification</h3>
                  <p className="mt-2 text-sm leading-6 text-white/50">
                    Educational access is tied to verified institution
                    information rather than simply claiming a school name.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* School Battles */}
          <section className="border-b border-white/10 bg-white/[0.015] px-6 py-12 sm:px-10 sm:py-16">
            <div className="mx-auto max-w-4xl">
              <div className="max-w-2xl">
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-amber-400">
                  School competition
                </p>

                <h2 className="mt-3 text-3xl font-bold sm:text-4xl">
                  Bring your school into the city.
                </h2>

                <p className="mt-4 leading-7 text-white/55">
                  MAiTROLL turns school participation into an active part of
                  the ecosystem through verified school representation,
                  School Battles, weekly activity, recognition, and the
                  School Pool.
                </p>
              </div>

              <div className="mt-10 grid gap-4 sm:grid-cols-2">
                {schoolFeatures.map((feature) => {
                  const Icon = feature.icon

                  return (
                    <div
                      key={feature.title}
                      className="rounded-2xl border border-white/10 bg-black/20 p-5"
                    >
                      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-500/10 text-amber-300">
                        <Icon className="h-5 w-5" />
                      </div>

                      <h3 className="mt-5 text-lg font-semibold">
                        {feature.title}
                      </h3>

                      <p className="mt-2 text-sm leading-6 text-white/50">
                        {feature.description}
                      </p>
                    </div>
                  )
                })}
              </div>

              <div className="mt-6 rounded-2xl border border-amber-400/15 bg-amber-500/5 p-5">
                <p className="text-sm leading-6 text-white/55">
                   The School Pool is separate from an individual user&apos;s
                  personal Troll Coin balance. School-level activity and
                  school-level financial tracking are handled through the
                  dedicated School Pool system.
                </p>
              </div>
            </div>
          </section>

          {/* MAi Pay */}
          <section className="border-b border-white/10 px-6 py-12 sm:px-10 sm:py-16">
            <div className="mx-auto grid max-w-4xl gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
              <div>
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-purple-500/10 text-purple-300">
                  <Wallet className="h-7 w-7" />
                </div>

                <p className="mt-6 text-sm font-semibold uppercase tracking-[0.2em] text-purple-400">
                  MAi Pay
                </p>

                <h2 className="mt-3 text-3xl font-bold sm:text-4xl">
                  A virtual economy with separate financial systems.
                </h2>

                <p className="mt-5 leading-7 text-white/55">
                  Troll Coins are part of the MAiTROLL virtual economy.
                  Different balance types can have different purposes, and
                  eligible earned balances may qualify for MAi Pay cashout
                  under the current payout policy.
                </p>

                <p className="mt-4 leading-7 text-white/55">
                  For current MAi Pay cashout calculations, the established
                  conversion is <strong className="text-white">200 Troll Coins = $1 USD</strong>.
                  Cashout eligibility, verification, fees, and other policy
                  requirements still apply.
                </p>

                <div className="mt-6 inline-flex items-center gap-2 rounded-xl border border-purple-400/15 bg-purple-500/5 px-4 py-3 text-sm text-purple-200">
                  <ShieldCheck className="h-4 w-4" />
                  Coin Store pricing is separate from MAi Pay cashout calculations.
                </div>
              </div>

              <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
                <h3 className="font-semibold">The city economy can include</h3>

                <div className="mt-5 space-y-3">
                  {[
                    'Troll Coins',
                    'Virtual gifts and items',
                    'Marketplace transactions',
                    'Eligible MAi Pay cashouts',
                    'School Pool financial tracking',
                    'Wallet and payment experiences',
                  ].map((item) => (
                    <div
                      key={item}
                      className="flex items-center gap-3 rounded-xl border border-white/5 bg-black/20 px-4 py-3"
                    >
                      <CheckCircle2 className="h-4 w-4 text-purple-300" />
                      <span className="text-sm text-white/65">{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* City Systems */}
          <section className="border-b border-white/10 bg-white/[0.015] px-6 py-12 sm:px-10 sm:py-16">
            <div className="mx-auto max-w-4xl">
              <div className="text-center">
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-400">
                  The city
                </p>

                <h2 className="mt-3 text-3xl font-bold sm:text-4xl">
                  There is more to MAiTROLL than one feature.
                </h2>

                <p className="mx-auto mt-4 max-w-2xl leading-7 text-white/50">
                  The city is made from interconnected systems designed to
                  make the platform feel like an actual digital environment,
                  rather than a collection of unrelated pages.
                </p>
              </div>

              <div className="mt-10 grid gap-3 sm:grid-cols-2">
                {citySystems.map((system) => (
                  <div
                    key={system}
                    className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/20 px-4 py-3.5"
                  >
                    <ChevronRight className="h-4 w-4 shrink-0 text-cyan-300" />
                    <span className="text-sm text-white/65">{system}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Broadcasting */}
          <section className="border-b border-white/10 px-6 py-12 sm:px-10 sm:py-16">
            <div className="mx-auto max-w-4xl">
              <div className="rounded-3xl border border-red-400/10 bg-gradient-to-br from-red-500/5 via-white/[0.02] to-purple-500/5 p-6 sm:p-8">
                <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-red-500/10 text-red-300">
                    <Radio className="h-7 w-7" />
                  </div>

                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.2em] text-red-400">
                      Broadcasting
                    </p>

                    <h2 className="mt-3 text-3xl font-bold">
                      Go live—but don&apos;t stop there.
                    </h2>

                    <p className="mt-4 max-w-3xl leading-7 text-white/55">
                      Broadcasting is one of the experiences inside MAiTROLL.
                      Members can participate in live experiences, interact
                      with broadcasters, compete, communicate, and use the
                      broader city around them.
                    </p>

                    <p className="mt-4 max-w-3xl leading-7 text-white/55">
                      MAiTROLL is not built around the idea of spending all
                      day watching somebody else build their platform. The
                      larger mission is participation, opportunity, creation,
                      education, and building your own future.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* How It Works */}
          <section className="border-b border-white/10 px-6 py-12 sm:px-10 sm:py-16">
            <div className="mx-auto max-w-4xl">
              <div className="max-w-2xl">
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-purple-400">
                  Getting started
                </p>

                <h2 className="mt-3 text-3xl font-bold sm:text-4xl">
                  How MAiTROLL works.
                </h2>
              </div>

              <div className="mt-10 grid gap-4 md:grid-cols-2">
                {steps.map((step) => (
                  <div
                    key={step.number}
                    className="rounded-2xl border border-white/10 bg-white/[0.03] p-6"
                  >
                    <span className="text-sm font-bold tracking-widest text-purple-400">
                      {step.number}
                    </span>

                    <h3 className="mt-4 text-xl font-semibold">
                      {step.title}
                    </h3>

                    <p className="mt-2 text-sm leading-6 text-white/50">
                      {step.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Who It's For */}
          <section className="border-b border-white/10 bg-white/[0.015] px-6 py-12 sm:px-10 sm:py-16">
            <div className="mx-auto max-w-4xl">
              <div className="text-center">
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-400">
                  Who is MAiTROLL for?
                </p>

                <h2 className="mt-3 text-3xl font-bold sm:text-4xl">
                  Different people. One city.
                </h2>
              </div>

              <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  {
                    icon: GraduationCap,
                    title: 'Students',
                    text: 'Learn, participate, compete, connect, and explore entrepreneurial opportunities.',
                  },
                  {
                    icon: Building2,
                    title: 'Instructors',
                    text: 'Participate in a verified educational environment built around community and opportunity.',
                  },
                  {
                    icon: BriefcaseBusiness,
                    title: 'Entrepreneurs',
                    text: 'Develop ideas, businesses, opportunities, and a future you actually want to build.',
                  },
                  {
                    icon: Radio,
                    title: 'Creators',
                    text: 'Broadcast, create experiences, connect with people, and become part of the larger city.',
                  },
                ].map((audience) => {
                  const Icon = audience.icon

                  return (
                    <div
                      key={audience.title}
                      className="rounded-2xl border border-white/10 bg-black/20 p-5 text-center"
                    >
                      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-blue-500/10 text-blue-300">
                        <Icon className="h-6 w-6" />
                      </div>

                      <h3 className="mt-4 font-semibold">{audience.title}</h3>

                      <p className="mt-2 text-sm leading-6 text-white/50">
                        {audience.text}
                      </p>
                    </div>
                  )
                })}
              </div>
            </div>
          </section>

          {/* Philosophy */}
          <section className="border-b border-white/10 px-6 py-12 sm:px-10 sm:py-16">
            <div className="mx-auto max-w-4xl">
              <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-purple-500/10 via-white/[0.02] to-blue-500/5 p-8 text-center sm:p-12">
                <MessageSquare className="mx-auto h-8 w-8 text-purple-300" />

                <blockquote className="mx-auto mt-6 max-w-3xl text-2xl font-semibold leading-9 sm:text-3xl">
                   “Don&apos;t just watch someone else build their future. Build
                  yours.”
                </blockquote>

                <p className="mx-auto mt-5 max-w-2xl leading-7 text-white/50">
                  That is the direction behind MAiTROLL: create an environment
                  where people can learn, participate, create, compete,
                  connect, and work toward something bigger.
                </p>
              </div>
            </div>
          </section>

          {/* Community Standards */}
          <section className="border-b border-white/10 bg-white/[0.015] px-6 py-12 sm:px-10 sm:py-16">
            <div className="mx-auto grid max-w-4xl gap-10 lg:grid-cols-[0.8fr_1.2fr]">
              <div>
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-green-500/10 text-green-300">
                  <ShieldCheck className="h-6 w-6" />
                </div>

                <p className="mt-5 text-sm font-semibold uppercase tracking-[0.2em] text-green-400">
                  The standard
                </p>

                <h2 className="mt-3 text-3xl font-bold">
                  Build something worth being part of.
                </h2>

                <p className="mt-4 leading-7 text-white/50">
                  MAiTROLL depends on responsible participation. City systems,
                  competitions, financial features, and community experiences
                  require users to follow the rules.
                </p>
              </div>

              <div className="space-y-3">
                {principles.map((principle) => (
                  <div
                    key={principle}
                    className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/20 px-4 py-3"
                  >
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-green-300" />
                    <span className="text-sm text-white/65">
                      {principle}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Final CTA */}
          <section className="relative overflow-hidden px-6 py-14 sm:px-10 sm:py-20">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(168,85,247,0.16),transparent_55%)]" />

            <div className="relative mx-auto max-w-3xl text-center">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-purple-400">
                Enter the city
              </p>

              <h2 className="mt-4 text-3xl font-bold sm:text-5xl">
                Education. Business. Broadcasting. Commerce. Competition.
                Community.
              </h2>

              <p className="mx-auto mt-5 max-w-2xl leading-7 text-white/50">
                MAiTROLL brings it together in one virtual city built around
                participation and opportunity.
              </p>

              <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={() => handleNavigate('/auth?mode=signup')}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-7 py-3.5 font-semibold text-black transition hover:bg-white/90"
                >
                  Join MAiTROLL
                  <ArrowRight className="h-4 w-4" />
                </button>

                <button
                  type="button"
                  onClick={() => handleNavigate('/explore')}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 px-7 py-3.5 font-semibold transition hover:bg-white/10"
                >
                  Explore the City
                </button>
              </div>
            </div>
          </section>

          {/* Legal Footer */}
          <footer className="border-t border-white/10 bg-black/20 px-6 py-6 sm:px-10">
            <div className="mx-auto flex max-w-4xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2 text-sm text-white/35">
                <Scale className="h-4 w-4" />
                <span>MAiTROLL community standards and policies apply.</span>
              </div>

              <div className="flex flex-wrap gap-4 text-sm">
                <button
                  type="button"
                  onClick={() => handleNavigate('/legal/safety')}
                  className="text-white/45 transition hover:text-white"
                >
                  Safety
                </button>

                <button
                  type="button"
                  onClick={() => handleNavigate('/legal/terms')}
                  className="text-white/45 transition hover:text-white"
                >
                  Terms
                </button>

                <button
                  type="button"
                  onClick={() => handleNavigate('/privacy')}
                  className="text-white/45 transition hover:text-white"
                >
                  Privacy
                </button>
              </div>
            </div>
          </footer>
        </article>
      </div>
    </div>,
    document.body
  )
}