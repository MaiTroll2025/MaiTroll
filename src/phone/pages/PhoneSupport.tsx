import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  LifeBuoy,
  UserRound,
  Coins,
  Shield,
  Video,
  CreditCard,
  Bug,
  MessageCircle,
  FileWarning,
  ChevronRight,
  HelpCircle,
} from 'lucide-react'
import { neonCard, neonTextGradient } from '../phoneTheme'

interface SupportOption {
  title: string
  description: string
  icon: typeof UserRound
  color: string
  route?: string
}

const SUPPORT_OPTIONS: SupportOption[] = [
  {
    title: 'Account Help',
    description: 'Login, profile, settings, verification, and account access.',
    icon: UserRound,
    color: 'text-cyan-400',
    route: '/support/account',
  },
  {
    title: 'Coins & Payments',
    description: 'Coin purchases, transactions, charges, and payment issues.',
    icon: Coins,
    color: 'text-amber-400',
    route: '/support/payments',
  },
  {
    title: 'Cash-Out Help',
    description: 'Cash-outs, verification holds, and payout questions.',
    icon: CreditCard,
    color: 'text-emerald-400',
    route: '/support/cashout',
  },
  {
    title: 'Broadcast Support',
    description: 'Problems with going live, broadcasts, seats, or viewers.',
    icon: Video,
    color: 'text-purple-400',
    route: '/support/broadcast',
  },
  {
    title: 'Safety & Moderation',
    description: 'Report safety concerns, violations, or moderation issues.',
    icon: Shield,
    color: 'text-red-400',
    route: '/support/safety',
  },
  {
    title: 'Technical Issues',
    description: 'Report bugs, crashes, loading problems, or broken features.',
    icon: Bug,
    color: 'text-blue-400',
    route: '/support/technical',
  },
]

export default function PhoneSupport() {
  const navigate = useNavigate()

  const handleSupportOption = (option: SupportOption) => {
    if (option.route) {
      navigate(option.route)
      return
    }

    navigate('/support')
  }

  return (
    <div className="relative min-h-screen w-full overflow-x-hidden bg-[#05010f] text-white">
      {/* Neon Background */}
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-[#00BFFF]/15 blur-[120px]" />
        <div className="absolute -right-32 top-1/3 h-96 w-96 rounded-full bg-[#BF00FF]/15 blur-[120px]" />
        <div className="absolute bottom-0 left-1/3 h-80 w-80 rounded-full bg-purple-600/10 blur-[120px]" />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-[#00BFFF]/20 bg-[#05010f]/90 backdrop-blur-2xl">
        <div className="flex items-center justify-between px-4 py-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 transition active:scale-95"
            aria-label="Go back"
          >
            <ArrowLeft size={19} />
          </button>

          <div className="text-center">
            <h1 className="text-sm font-black uppercase tracking-[0.18em]">
              Support
            </h1>

            <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-500">
              MaiTroll Help Center
            </p>
          </div>

          <div className="w-10" />
        </div>
      </header>

      <main className="relative z-10 space-y-4 px-4 py-6">
        {/* Hero */}
        <section
          className={`relative overflow-hidden rounded-3xl p-6 ${neonCard}`}
        >
          <div className="absolute inset-0 bg-gradient-to-br from-[#00BFFF]/10 via-transparent to-[#BF00FF]/10" />

          <div className="relative flex flex-col items-center text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 shadow-[0_0_25px_rgba(34,211,238,0.3)]">
              <LifeBuoy size={32} className="text-white" />
            </div>

            <h2 className={`mt-4 text-xl font-black ${neonTextGradient}`}>
              MaiTroll Support
            </h2>

            <p className="mt-2 text-xs leading-5 text-zinc-400">
              Need help with your account, broadcasts, coins, cash-outs,
              safety, or a technical issue? Start here.
            </p>

            <button
              type="button"
              onClick={() => navigate('/support')}
              className="mt-5 flex items-center gap-2 rounded-xl border border-cyan-400/30 bg-cyan-400/10 px-5 py-2.5 text-xs font-black text-cyan-300 transition hover:bg-cyan-400/20 active:scale-95"
            >
              <MessageCircle className="h-4 w-4" />
              Open Support Center
            </button>
          </div>
        </section>

        {/* Support Options */}
        <section>
          <div className="mb-3 flex items-center gap-2 px-1">
            <HelpCircle className="h-4 w-4 text-cyan-400" />

            <h2 className="text-xs font-black uppercase tracking-widest text-white">
              How Can We Help?
            </h2>
          </div>

          <div className="space-y-2">
            {SUPPORT_OPTIONS.map((option) => {
              const Icon = option.icon

              return (
                <button
                  key={option.title}
                  type="button"
                  onClick={() => handleSupportOption(option)}
                  className={`group flex w-full items-center gap-3 rounded-2xl p-4 text-left ${neonCard} transition hover:border-cyan-400/20 hover:bg-white/[0.05] active:scale-[0.99]`}
                >
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04]">
                    <Icon className={`h-5 w-5 ${option.color}`} />
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-black text-white">
                      {option.title}
                    </p>

                    <p className="mt-0.5 text-[10px] leading-4 text-zinc-500">
                      {option.description}
                    </p>
                  </div>

                  <ChevronRight className="h-4 w-4 shrink-0 text-zinc-600 transition group-hover:text-cyan-400" />
                </button>
              )
            })}
          </div>
        </section>

        {/* Safety */}
        <section className={`${neonCard} rounded-3xl p-5`}>
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-red-400/20 bg-red-500/10">
              <FileWarning className="h-5 w-5 text-red-400" />
            </div>

            <div>
              <h2 className="text-sm font-black text-white">
                Safety or Rule Violation?
              </h2>

              <p className="mt-1 text-xs leading-5 text-zinc-500">
                If you see content or behavior that violates MaiTroll's
                community or safety rules, report it through the available
                platform tools.
              </p>

              <button
                type="button"
                onClick={() => navigate('/safety')}
                className="mt-3 text-[10px] font-black uppercase tracking-wider text-red-300 transition hover:text-red-200"
              >
                Open Safety Center →
              </button>
            </div>
          </div>
        </section>

        {/* Cashout Notice */}
        <section className={`${neonCard} rounded-3xl p-5`}>
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-amber-400/20 bg-amber-500/10">
              <CreditCard className="h-5 w-5 text-amber-400" />
            </div>

            <div>
              <h2 className="text-sm font-black text-white">
                Cash-Out Questions
              </h2>

              <p className="mt-1 text-xs leading-5 text-zinc-500">
                Cash-outs may be placed on a verification or security hold
                when required information is missing, suspicious, or cannot be
                verified.
              </p>

              <p className="mt-2 text-[10px] font-bold text-amber-300">
                Verification holds may last up to 30 days.
              </p>
            </div>
          </div>
        </section>

        {/* Web Support */}
        <section className={`${neonCard} rounded-3xl p-5`}>
          <div className="text-center">
            <h2 className="text-sm font-black text-white">
              Need More Assistance?
            </h2>

            <p className="mt-2 text-xs leading-5 text-zinc-500">
              For the complete MaiTroll Support Center, visit the web version
              at:
            </p>

            <p className="mt-3 break-all rounded-xl border border-cyan-400/20 bg-cyan-400/5 px-3 py-2 text-xs font-bold text-cyan-300">
              www.MaiTroll.com/support
            </p>

            <button
              type="button"
              onClick={() => navigate('/support')}
              className="mt-4 w-full rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-4 py-3 text-xs font-black text-white shadow-[0_0_20px_rgba(34,211,238,0.2)] transition hover:opacity-90 active:scale-[0.98]"
            >
              Go To Support
            </button>
          </div>
        </section>

        {/* Footer */}
        <div className="pb-8 pt-2 text-center">
          <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-zinc-600">
            MaiTroll Support Center
          </p>

          <p className="mt-1 text-[9px] text-zinc-700">
            We're here to help keep MaiTroll running smoothly.
          </p>
        </div>
      </main>
    </div>
  )
}