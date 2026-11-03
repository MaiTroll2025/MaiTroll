import React from 'react'
import {
  Shield,
  Lock,
  CreditCard,
  Gavel,
  FileText,
} from 'lucide-react'

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
  <section className="mb-8 rounded-[2rem] border border-cyan-400/20 bg-slate-950/75 p-6 md:p-8 shadow-[0_0_50px_rgba(34,211,238,0.08)] backdrop-blur-xl">
    <div className="flex items-center gap-3 mb-4">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-cyan-400/20 bg-cyan-400/10 text-cyan-300">
        <Icon className="h-5 w-5" />
      </div>
      <h2 className="text-xl font-black tracking-tight text-white">
        {title}
      </h2>
      {badge && (
        <span className="ml-auto px-2 py-0.5 rounded border border-cyan-400/30 text-[10px] font-black uppercase tracking-wider text-cyan-300">
          {badge}
        </span>
      )}
    </div>
    <div className="prose prose-invert max-w-none text-slate-300">{children}</div>
  </section>
)

const GuaranteeBox = ({
  title,
  body,
}: {
  title: string
  body: string
}) => (
  <div className="mt-6 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-6">
    <h3 className="mb-2 text-sm font-black uppercase tracking-[0.15em] text-emerald-300">
      {title}
    </h3>
    <p className="text-sm leading-6 text-emerald-100/90">{body}</p>
  </div>
)

const FactRow = ({
  label,
  value,
}: {
  label: string
  value: string
}) => (
  <div className="mb-3 flex items-start gap-3">
    <span className="shrink-0 w-20 text-xs font-black uppercase tracking-wider text-slate-500">
      {label}
    </span>
    <p className="text-sm leading-6 text-slate-300">{value}</p>
  </div>
)

export default function TrustSafety() {
  return (
    <main className="min-h-screen overflow-x-hidden bg-[#020617] text-white">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(34,211,238,0.16),transparent_32%),radial-gradient(circle_at_85%_10%,rgba(168,85,247,0.12),transparent_30%),radial-gradient(circle_at_50%_100%,rgba(239,68,68,0.08),transparent_36%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(34,211,238,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(34,211,238,0.035)_1px,transparent_1px)] bg-[size:52px_52px]" />
      </div>

      <section className="relative z-10 mx-auto max-w-7xl px-4 py-12 md:px-8">
        <header className="mb-10 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-4 py-2 text-xs font-black uppercase tracking-[0.22em] text-cyan-200 mb-6">
            <Shield className="h-4 w-4" />
            MaiTroll Trust & Transparency
          </div>

          <h1 className="mb-4 text-4xl font-black tracking-tight md:text-6xl">
            Trust &
            <span className="block bg-gradient-to-r from-cyan-300 via-fuchsia-300 to-red-300 bg-clip-text text-transparent">
              Safety
            </span>
          </h1>

          <p className="max-w-2xl mx-auto text-sm leading-7 text-slate-400 md:text-base">
            Every claim on this page is grounded in our live Supabase schema and
            application code. This is how we protect your password, your
            payments, your data, and our community.
          </p>
        </header>

        {/* 1. Password Security */}
        <Section
          icon={Lock}
          title="Your password is safe"
          badge="Supabase Auth + pgcrypto bcrypt"
        >
          <p className="mb-4">
            MaiTroll does <strong className="text-white">not</strong> store your
            password in plain text. Authentication is handled by
            <strong className="text-cyan-300">Supabase Auth</strong>. Passwords
            are hashed with <strong className="text-cyan-300">bcrypt</strong>
            using PostgreSQL <code className="text-cyan-300">pgcrypto</code>
            (<code className="text-cyan-300">gen_salt(&apos;bf&apos;)</code>) before being
            written to the database.
          </p>

          <FactRow
            label="Hash algorithm"
            value="bcrypt (Blowfish), per-password salt via pgcrypto gen_salt('bf')"
          />
          <FactRow
            label="Plain-text storage"
            value="Never. No MaiTroll table stores a plain-text password."
          />
          <FactRow
            label="Staff access"
            value="Staff cannot read or decrypt your password."
          />
          <FactRow
            label="Legacy password manager"
            value="Removed. The custom password-manager edge function, reset-pin functions, and reset_pin_hash column were dropped."
          />
          <FactRow
            label="Password resets"
            value="Handled by Supabase's built-in resetPasswordForEmail / updateUser flow."
          />

          <GuaranteeBox
            title="Publishable guarantee"
            body="Your password is hashed with bcrypt via Supabase Auth and pgcrypto. MaiTroll staff cannot read your plain-text password. The legacy custom password-manager function has been removed."
          />
        </Section>

        {/* 2. Payment Safety */}
        <Section
          icon={CreditCard}
          title="We do not store your full card number"
          badge="Stripe & Square tokenization"
        >
          <p className="mb-4">
            MaiTroll does <strong className="text-white">not</strong> store full
            credit or debit card numbers. Card processing is handled by payment
            processors (Square and Stripe). MaiTroll only stores non-sensitive
            reference fields.
          </p>

          <div className="mb-6 rounded-xl border border-slate-800/50 bg-slate-900/40 p-4">
            <p className="mb-2 text-xs font-black uppercase tracking-[0.15em] text-slate-400">
              user_payment_methods table (supabase/schema.sql)
            </p>
            <pre className="text-xs overflow-x-auto bg-slate-950 p-3 rounded text-cyan-100">
`create table if not exists public.user_payment_methods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  provider text not null,          -- &apos;card&apos;, &apos;cashapp&apos;, etc.
  token_id text not null,          -- vault token from processor
  display_name text,               -- e.g. &quot;Visa ••••1234&quot;
  brand text,                      -- Visa, Mastercard
  last4 text,                      -- Last 4 digits only
  exp_month int,
  exp_year int,
  square_customer_id text,
  square_card_id text,
  is_default boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);`</pre>
          </div>

          <div className="overflow-x-auto mb-6">
            <table className="w-full text-left text-sm border-collapse border border-slate-700/40">
              <thead>
                <tr className="border-b border-slate-700/40">
                  <th className="p-3 text-xs font-black uppercase tracking-wider text-slate-400">Field</th>
                  <th className="p-3 text-xs font-black uppercase tracking-wider text-slate-400">Stored?</th>
                  <th className="p-3 text-xs font-black uppercase tracking-wider text-slate-400">Sensitive?</th>
                  <th className="p-3 text-xs font-black uppercase tracking-wider text-slate-400">Notes</th>
                </tr>
              </thead>
              <tbody className="text-slate-300 divide-y divide-slate-700/40">
                <tr>
                  <td className="p-3 font-mono text-xs">Full card number (PAN)</td>
                  <td className="p-3 font-black text-red-400">No</td>
                  <td className="p-3 text-red-400">Yes (never)</td>
                  <td className="p-3">Never hits our database</td>
                </tr>
                <tr>
                  <td className="p-3 font-mono text-xs">CVV / CVC</td>
                  <td className="p-3 font-black text-red-400">No</td>
                  <td className="p-3 text-red-400">Yes (never)</td>
                  <td className="p-3">Never hits our database</td>
                </tr>
                <tr>
                  <td className="p-3 font-mono text-xs">last4</td>
                  <td className="p-3 font-black text-emerald-400">Yes</td>
                  <td className="p-3 text-emerald-400">No</td>
                  <td className="p-3">Last 4 digits only</td>
                </tr>
                <tr>
                  <td className="p-3 font-mono text-xs">brand / display_name</td>
                  <td className="p-3 font-black text-emerald-400">Yes</td>
                  <td className="p-3 text-emerald-400">No</td>
                  <td className="p-3">Masked (&quot;Visa ••••1234&quot;)</td>
                </tr>
                <tr>
                  <td className="p-3 font-mono text-xs">exp_month / exp_year</td>
                  <td className="p-3 font-black text-emerald-400">Yes</td>
                  <td className="p-3 text-emerald-400">Low</td>
                  <td className="p-3">Expiry month/year only</td>
                </tr>
                <tr>
                  <td className="p-3 font-mono text-xs">token_id / stripe_customer_id / square_*</td>
                  <td className="p-3 font-black text-emerald-400">Yes</td>
                  <td className="p-3 text-emerald-400">Low</td>
                  <td className="p-3">Processor vault reference tokens</td>
                </tr>
              </tbody>
            </table>
          </div>

          <FactRow
            label="Row Level Security"
            value="Enabled on user_payment_methods, payment_methods, payment_transactions, stripe_customers, and related payment tables. Users can only access their own rows."
          />

          <GuaranteeBox
            title="Publishable guarantee"
            body="MaiTroll does not store full credit card numbers. Card details are tokenized by Square and Stripe. We store only non-sensitive reference fields such as last-4 digits, card brand, expiry month/year, and processor vault tokens. Your full PAN and CVV never touch our database."
          />
        </Section>

        {/* 3. AI vs Human Moderation */}
        <Section
          icon={Gavel}
          title="AI is for roleplay, not moderation"
          badge="Human moderation with audit trail"
        >
          <p className="mb-4">
            MaiTroll uses AI for <strong className="text-white">entertainment
            and roleplay only</strong> — never to ban, mute, or judge users.
            All enforcement is performed by human Troll Officers and
            administrators.
          </p>

          <div className="mb-6 grid gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-cyan-400/20 bg-cyan-400/5 p-4">
              <h4 className="mb-2 text-sm font-black text-cyan-300">AI usage (OpenAI / Gemini)</h4>
              <ul className="text-sm text-slate-300 space-y-2 list-disc pl-5">
                <li>
                  <strong className="text-white">Troll Court</strong> — AI plays
                  Prosecutor / Defense in an in-game courtroom
                  (src/lib/courtAi.ts, gpt-4o-mini).
                </li>
                <li>
                  <strong className="text-white">Troll Court edge function</strong>
                  — Gemini gemini-2.0-flash for summaries; PII is redacted
                  before sending.
                </li>
                <li>
                  <strong className="text-white">Stream AI host</strong> — short
                  announcer reactions to live events (gpt-4o-mini).
                </li>
                <li>
                  <strong className="text-white">Translation</strong> — message
                  translation via OpenAI API.
                </li>
              </ul>
            </div>
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
              <h4 className="mb-2 text-sm font-black text-emerald-300">Human moderation</h4>
              <ul className="text-sm text-slate-300 space-y-2 list-disc pl-5">
                <li>
                  <strong className="text-white">User reports</strong> — filed
                  via the user_reports table; reviewed by officers.
                </li>
                <li>
                  <strong className="text-white">Staff action audit log</strong>
                  — every moderation action is recorded in
                  staff_action_audit_log with timestamp, staff role, action
                  type, target, and result.
                </li>
                <li>
                  <strong className="text-white">RLS on moderation tables</strong>
                  — moderation_actions, moderation_reports, moderation_events,
                  moderation_notes all have Row Level Security enabled.
                </li>
                <li>
                  <strong className="text-white">AI has no enforcement write
                  access</strong> — AI cannot modify is_banned, banned_until, or
                  any enforcement state.
                </li>
              </ul>
            </div>
          </div>

          <GuaranteeBox
            title="Publishable guarantee"
            body="MaiTroll AI (OpenAI and Gemini) is used strictly for courtroom roleplay and entertainment features such as Troll Court. AI never automatically bans, mutes, or judges users. All moderation actions are performed by human Troll Officers and administrators, and every action is recorded in an auditable staff action log."
          />
        </Section>

        {/* 4. Public FAQ */}
        <Section
          icon={FileText}
          title="Public FAQ — Trust & Safety"
          badge="Transparency"
        >
          <h3 className="mb-3 text-sm font-black uppercase tracking-[0.15em] text-cyan-300">
            Is my data isolated from other users?
          </h3>
          <p className="mb-4 text-sm leading-6 text-slate-300">
            Yes. Row Level Security is enabled globally across user data tables
            (enable_rls_globally.sql, fix_rls_errors.sql). Users can only access
            their own profile, payment methods, and private data. Other users
            cannot read your private fields.
          </p>

          <h3 className="mb-3 text-sm font-black uppercase tracking-[0.15em] text-cyan-300">
            Is MaiTroll harvesting my data?
          </h3>
          <p className="mb-4 text-sm leading-6 text-slate-300">
            No. We store what is necessary for platform function (username,
            email, coin balances, payout details for creators). Full SSNs were
            removed — only tax_id_last4 remains. Full card numbers are never
            stored.
          </p>

          <h3 className="mb-3 text-sm font-black uppercase tracking-[0.15em] text-cyan-300">
            Is this a ponzi scheme or an unsustainable economic loop?
          </h3>
          <p className="mb-4 text-sm leading-6 text-slate-300">
            No. There is no investment product. Coins are earned through platform
            activity or purchased; they are platform currency, not an
            investment. Founder rewards grant badges and fee waivers — not
            returns. Payouts go from the platform to creators for content and
            activity, not from new users to earlier users.
          </p>

          <h3 className="mb-3 text-sm font-black uppercase tracking-[0.15em] text-cyan-300">
            Is MaiTroll safe for a new user?
          </h3>
          <p className="mb-4 text-sm leading-6 text-slate-300">
            Yes, by design. Passwords are bcrypt-hashed, full card numbers are
            not stored, RLS isolates your data, there is a working report system
            with human moderation and an audit trail, and banned accounts are
            tracked (is_banned, banned_until, ban_reason).
          </p>

          <div className="mt-8 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-6">
            <p className="mb-2 text-sm font-black uppercase tracking-[0.15em] text-emerald-300">
              Bottom line
            </p>
            <p className="text-sm leading-6 text-emerald-100/90">
              MaiTroll is a live broadcasting and social platform with
              bcrypt-hashed passwords, tokenized (never full) card data, RLS
              data isolation, human moderation with an audit trail, AI limited
              to entertainment roleplay, and no investment or ponzi mechanics.
            </p>
          </div>
        </Section>

        <footer className="mt-12 border-t border-slate-800/40 pt-8 text-center text-xs text-slate-500">
          <p className="mb-2">
            Based on the live Supabase schema and application code in this
            repository. Not legal advice.
          </p>
        </footer>
      </section>
    </main>
  )
}
