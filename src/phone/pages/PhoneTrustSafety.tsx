import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  Shield,
  Lock,
  CreditCard,
  Gavel,
  FileText,
} from 'lucide-react'
import { neonCard, neonTextGradient } from '../phoneTheme'

const Section = ({
  icon: Icon,
  title,
  badge,
  children,
}: {
  icon: typeof Shield
  title: string
  badge?: string
  children: React.ReactNode
}) => (
  <section className={`${neonCard} overflow-hidden rounded-3xl p-5 mb-4`}>
    <div className="flex items-center gap-3 mb-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#00BFFF]/20 bg-[#00BFFF]/10">
        <Icon className="h-5 w-5 text-[#00BFFF]" />
      </div>
      <h2 className="text-sm font-black uppercase tracking-wide text-white">
        {title}
      </h2>
      {badge && (
        <span className="ml-auto px-2 py-0.5 rounded border border-[#00BFFF]/30 text-[9px] font-black uppercase tracking-wider text-[#00BFFF]">
          {badge}
        </span>
      )}
    </div>
    <div className="mt-3 space-y-2 text-xs leading-6 text-zinc-400">
      {children}
    </div>
  </section>
)

const Guarantee = ({
  title,
  body,
}: {
  title: string
  body: string
}) => (
  <div className="mt-3 rounded-2xl border border-emerald-400/20 bg-emerald-500/5 p-3">
    <p className="text-[9px] font-black uppercase tracking-wider text-emerald-300">
      {title}
    </p>
    <p className="mt-1 text-xs leading-5 text-zinc-300">{body}</p>
  </div>
)

const Fact = ({
  label,
  value,
}: {
  label: string
  value: string
}) => (
  <div className="flex items-start gap-2 mb-1.5">
    <span className="shrink-0 w-16 text-[9px] font-black uppercase tracking-wider text-zinc-500">
      {label}
    </span>
    <span className="text-xs leading-5 text-zinc-300">{value}</span>
  </div>
)

export default function PhoneTrustSafety() {
  const navigate = useNavigate()

  return (
    <div className="relative min-h-screen w-full overflow-x-hidden bg-[#05010f] text-white">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-[#00BFFF]/15 blur-[120px]" />
        <div className="absolute -right-32 top-1/3 h-96 w-96 rounded-full bg-[#BF00FF]/15 blur-[120px]" />
        <div className="absolute bottom-0 left-1/3 h-80 w-80 rounded-full bg-purple-600/10 blur-[120px]" />
      </div>

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
              Trust & Safety
            </h1>
            <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-500">
              MaiTroll Transparency
            </p>
          </div>

          <div className="w-10" />
        </div>
      </header>

      <main className="relative z-10 space-y-4 px-4 py-6">
        {/* Hero */}
        <section className={`relative overflow-hidden rounded-3xl p-6 ${neonCard}`}>
          <div className="absolute inset-0 bg-gradient-to-br from-[#00BFFF]/10 via-transparent to-[#BF00FF]/10" />

          <div className="relative text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-[0_0_25px_rgba(16,185,129,0.3)]">
              <Shield size={32} className="text-white" />
            </div>

            <h2 className={`mt-4 text-xl font-black ${neonTextGradient}`}>
              MaiTroll Trust Center
            </h2>

            <p className="mt-3 text-xs leading-6 text-zinc-400">
              Every claim here is grounded in our live Supabase schema and app
              code. This is how we protect your password, your payments, your
              data, and our community.
            </p>
          </div>
        </section>

        {/* 1. Password */}
        <Section
          icon={Lock}
          title="Your password is safe"
          badge="bcrypt via Supabase Auth"
        >
          <p>MaiTroll does not store your password in plain text.</p>
          <Fact label="Hashing" value="bcrypt, per-password salt via pgcrypto gen_salt('bf')" />
          <Fact label="Plain-text storage" value="Never" />
          <Fact label="Staff access" value="Cannot read your password" />
          <Fact label="Legacy password manager" value="Removed" />
          <Fact label="Password resets" value="Supabase secure email flow" />

          <Guarantee
            title="Publishable guarantee"
            body="Your password is hashed with bcrypt via Supabase Auth and pgcrypto. MaiTroll staff cannot read your plain-text password."
          />
        </Section>

        {/* 2. Payments */}
        <Section
          icon={CreditCard}
          title="We do not store your full card number"
          badge="Stripe & Square tokenization"
        >
          <p>MaiTroll does not store full credit card numbers.</p>
          <Fact label="Stored" value="last4, brand, expiry month/year, vault tokens" />
          <Fact label="Not stored" value="Full PAN, CVV/CVC" />
          <Fact label="Processing" value="Square & Stripe only" />
          <Fact label="Row Level Security" value="Enabled — your rows only" />

          <Guarantee
            title="Publishable guarantee"
            body="Card details are tokenized by Square and Stripe. Your full PAN and CVV never touch our database."
          />
        </Section>

        {/* 3. AI vs Human */}
        <Section
          icon={Gavel}
          title="AI is for roleplay, not moderation"
          badge="Human moderation + audit log"
        >
          <p>MaiTroll AI is used for entertainment roleplay only.</p>
          <Fact label="Troll Court" value="OpenAI gpt-4o-mini / Gemini roleplay" />
          <Fact label="Enforcement" value="Human Troll Officers only" />
          <Fact label="Audit log" value="Every staff action logged" />
          <Fact label="AI ban power" value="None — AI cannot ban or mute" />

          <Guarantee
            title="Publishable guarantee"
            body="MaiTroll AI is used strictly for courtroom roleplay and entertainment. AI never automatically bans, mutes, or judges users."
          />
        </Section>

        {/* 4. Public FAQ */}
        <Section icon={FileText} title="Public FAQ — Trust & Safety">
          <p className="font-bold text-white">Is my data isolated?</p>
          <p className="mt-1">
            Yes. Row Level Security is enabled globally — users can only access
            their own data.
          </p>

          <p className="mt-3 font-bold text-white">Is this a ponzi scheme?</p>
          <p className="mt-1">
            No. No investment product exists. Coins are platform currency, not
            an investment. Payouts go from the platform to creators.
          </p>

          <p className="mt-3 font-bold text-white">Is MaiTroll safe for new users?</p>
          <p className="mt-1">
            Yes. Bcrypt passwords, no full card storage, RLS isolation, human
            moderation with audit trail, ban tracking.
          </p>

          <Guarantee
            title="Bottom line"
            body="bcrypt-hashed passwords, tokenized (never full) card data, RLS data isolation, human moderation with an audit trail, AI limited to entertainment roleplay, no investment or ponzi mechanics."
          />
        </Section>

        <div className="pb-8 text-center">
          <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-zinc-600">
            MaiTroll Trust Center
          </p>
          <p className="mt-1 text-[9px] text-zinc-700">
            Based on live Supabase schema and app code. Not legal advice.
          </p>
        </div>
      </main>
    </div>
  )
}
