import React from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  Ban,
  Camera,
  CheckCircle2,
  Eye,
  FileText,
  Gavel,
  Gift,
  HeartHandshake,
  Lock,
  MessageSquare,
  Radio,
  Scale,
  Shield,
  Shirt,
  ShoppingBag,
  Siren,
  UserRound,
  Users,
} from 'lucide-react'

export default function Safety() {
  return (
    <main className="min-h-screen overflow-x-hidden bg-[#020617] text-white">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(34,211,238,0.16),transparent_32%),radial-gradient(circle_at_85%_10%,rgba(168,85,247,0.12),transparent_30%),radial-gradient(circle_at_50%_100%,rgba(239,68,68,0.08),transparent_36%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(34,211,238,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(34,211,238,0.035)_1px,transparent_1px)] bg-[size:52px_52px]" />
      </div>

      <section className="relative z-10 mx-auto max-w-7xl px-4 py-8 md:px-8">
        <header className="mb-8 rounded-[2rem] border border-cyan-400/20 bg-slate-950/75 p-6 shadow-[0_0_70px_rgba(34,211,238,0.12)] backdrop-blur-xl md:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-4 py-2 text-xs font-black uppercase tracking-[0.22em] text-cyan-200">
                <Shield className="h-4 w-4" />
                Mai Troll Safety Division
              </div>

              <h1 className="text-4xl font-black tracking-tight md:text-6xl">
                Safety &
                <span className="block bg-gradient-to-r from-cyan-300 via-fuchsia-300 to-red-300 bg-clip-text text-transparent">
                  City Policies
                </span>
              </h1>

              <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-400 md:text-base">
                These rules apply across Mai Troll, including live broadcasts,
                battles, camera seats, chats, families, auctions, marketplace
                activity, gifting, profiles, posts, and messages. Troll Officers
                and administrators may act immediately when safety requires it.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
              <StatCard icon={Users} label="Citizens" value="Protected" />
              <StatCard icon={Gavel} label="Court" value="Appeals" />
              <StatCard icon={Siren} label="Live Safety" value="Enforced" danger />
            </div>
          </div>
        </header>

        <section className="mb-6 rounded-[2rem] border border-red-400/25 bg-red-500/10 p-6 shadow-[0_0_50px_rgba(239,68,68,0.08)] backdrop-blur-xl">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-red-400/25 bg-red-500/10 text-red-300">
                <Camera className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-red-300">
                  Immediate Live-Stream Rule
                </p>
                <h2 className="mt-1 text-2xl font-black text-white">
                  Exposed intimate body parts can end a stream immediately
                </h2>
                <p className="mt-2 max-w-4xl text-sm leading-6 text-red-100/80">
                  Troll Officers and administrators may end a broadcast at any
                  time if exposed intimate body parts are visible, whether the
                  exposure is accidental or intentional. A warning is not
                  required before the stream is ended.
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-red-400/20 bg-black/25 px-4 py-3 text-sm font-black text-red-200">
              Coverage must remain secure at all times
            </div>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <PolicyCard icon={Shirt} title="Clothing Requirements" accent="purple">
            <p className="text-sm leading-6 text-slate-300">
              Everyone visible on camera must remain properly covered throughout
              the entire stream. Clothing must stay secure while sitting,
              standing, dancing, exercising, gaming, battling, or moving around.
            </p>

            <PolicyItem
              title="Men"
              text="Genitals and buttocks must remain fully covered. Underwear may be worn on camera only when it provides full coverage and is not transparent, sheer, or see-through."
            />
            <PolicyItem
              title="Women"
              text="Breasts, nipples, genitals, and buttocks must remain fully covered. Bras, sports bras, swimwear, underwear, bodysuits, shorts, skirts, and similar clothing are allowed only when they provide secure, non-transparent coverage."
            />
            <PolicyItem
              title="Rules for Everyone"
              text="Clothing may not be see-through, sheer, transparent when wet, or positioned in a way that exposes intimate areas. Clothing must remain securely in place during movement."
            />
            <PolicyItem
              title="Camera Angles"
              text="Camera angles intended to focus on breasts, genitals, buttocks, or underwear-covered intimate areas are not allowed."
            />

            <Notice tone="red">
              Changing clothes while live, intentional exposure, sexual posing,
              or repeated wardrobe malfunctions may result in immediate stream
              termination and additional account restrictions.
            </Notice>
          </PolicyCard>

          <PolicyCard icon={Eye} title="Exposure & Stream Termination" accent="red">
            <PolicyItem
              title="Officer Authority"
              text="Troll Officers and administrators may immediately end a broadcast when intimate body parts become visible or when clothing no longer provides adequate coverage."
            />
            <PolicyItem
              title="No Warning Required"
              text="Staff do not have to issue a warning before ending a stream involving nudity, exposure, sexual activity, or unsafe camera conduct."
            />
            <PolicyItem
              title="Accidental Exposure"
              text="Accidental exposure may still require the stream to be ended so the content is no longer visible. Staff may consider context when deciding whether further restrictions are necessary."
            />
            <PolicyItem
              title="Intentional or Repeated Exposure"
              text="Intentional exposure, repeated violations, attempts to bypass moderation, or restarting a stream without correcting the issue may lead to temporary or permanent broadcasting restrictions."
            />

            <Notice tone="red">
              Exposed intimate body parts include genitals, nipples, breasts,
              buttocks, or intimate areas visible through transparent clothing.
            </Notice>
          </PolicyCard>

          <PolicyCard icon={Radio} title="Live Broadcast Conduct">
            <PolicyItem
              title="Broadcaster Responsibility"
              text="Broadcasters are responsible for everything visible or audible on their stream, including guests, camera seats, background activity, music, screens, and people entering the camera view."
            />
            <PolicyItem
              title="Guests and Camera Seats"
              text="Guests must follow the same clothing, conduct, and safety rules as the main broadcaster. The host should remove guests who violate the rules."
            />
            <PolicyItem
              title="Dangerous Conduct"
              text="Do not show dangerous stunts, reckless driving, active violence, self-harm, drug use, or conduct that could reasonably put someone in immediate danger."
            />
            <PolicyItem
              title="Sexual Conduct"
              text="Sexual acts, simulated sexual activity, explicit sexual behavior, masturbation, or content created mainly for sexual gratification are prohibited."
            />
          </PolicyCard>

          <PolicyCard icon={Users} title="Community Conduct">
            <PolicyItem
              title="Respect Other Citizens"
              text="Harassment, targeted bullying, violent threats, stalking, intimidation, hate speech, and discrimination are not allowed."
            />
            <PolicyItem
              title="No Doxxing"
              text="Do not share another person's address, phone number, government identification, private messages, workplace, school, financial details, or other sensitive information without permission."
            />
            <PolicyItem
              title="No Impersonation"
              text="Do not impersonate Troll Officers, administrators, broadcasters, businesses, or other users in order to deceive or manipulate people."
            />
            <PolicyItem
              title="No Coordinated Abuse"
              text="Do not organize mass harassment, false reports, raids, threats, or campaigns intended to drive someone off the platform."
            />
          </PolicyCard>

          <PolicyCard icon={UserRound} title="Minor Safety" accent="red">
            <PolicyItem
              title="Strict Protection"
              text="Content that exploits, sexualizes, threatens, grooms, or endangers a minor is strictly prohibited."
            />
            <PolicyItem
              title="Sexual Content Involving Minors"
              text="Any sexual content involving a person under 18 is prohibited and may be reported to the appropriate authorities."
            />
            <PolicyItem
              title="Private Contact"
              text="Adults must not pressure minors for private photos, sexual conversations, money, gifts, off-platform contact, or secret communication."
            />
            <PolicyItem
              title="Immediate Action"
              text="Mai Troll may immediately remove content, restrict accounts, preserve relevant records, and contact law enforcement or child-safety organizations when legally appropriate."
            />
          </PolicyCard>

          <PolicyCard icon={MessageSquare} title="Chat & Messaging">
            <PolicyItem
              title="No Threats or Abuse"
              text="Do not threaten, sexually harass, repeatedly insult, blackmail, intimidate, or pressure another user."
            />
            <PolicyItem
              title="No Spam"
              text="Repeated unsolicited messages, copy-and-paste flooding, link spam, fake promotions, and disruptive chat behavior may lead to chat restrictions."
            />
            <PolicyItem
              title="Sexual Messages"
              text="Unwanted sexual comments, explicit requests, sexual coercion, and sending explicit material without consent are prohibited."
            />
            <PolicyItem
              title="Staff Controls"
              text="Troll Officers may mute users, disable chat, remove users from streams, or apply temporary restrictions when necessary."
            />
          </PolicyCard>

          <PolicyCard icon={Gift} title="Coins, Gifts & Payments" accent="yellow">
            <PolicyItem
              title="Use Approved Payment Flows"
              text="Coin purchases, gifts, auction payments, subscriptions, and payouts must use official Mai Troll payment systems."
            />
            <PolicyItem
              title="No Payment Manipulation"
              text="Do not fake payments, reverse transactions dishonestly, exploit coin balances, manipulate gifts, or coordinate fraudulent payouts."
            />
            <PolicyItem
              title="No Off-Platform Pressure"
              text="Users may not pressure others to send money through unapproved payment apps, gift cards, cryptocurrency, or private payment links."
            />
            <PolicyItem
              title="Account Responsibility"
              text="Users are responsible for protecting their payment methods, account credentials, and devices from unauthorized use."
            />
          </PolicyCard>

          <PolicyCard icon={ShoppingBag} title="Marketplace & Auction Safety">
            <PolicyItem
              title="Accurate Listings"
              text="Sellers and auctioneers must accurately describe items, condition, pricing, shipping terms, and known defects."
            />
            <PolicyItem
              title="No Prohibited Goods"
              text="Illegal goods, stolen items, dangerous materials, counterfeit goods, weapons, drugs, or other prohibited products may not be sold."
            />
            <PolicyItem
              title="No Bid Manipulation"
              text="Do not use fake accounts, coordinated bidding, false bids, shill bidding, or payment manipulation to influence an auction."
            />
            <PolicyItem
              title="Dispute Review"
              text="Mai Troll may review transaction records, listings, chats, bids, and payment activity when investigating a marketplace dispute."
            />
          </PolicyCard>

          <PolicyCard icon={Lock} title="Privacy & Account Security">
            <PolicyItem
              title="Protect Your Login"
              text="Do not share passwords, one-time codes, recovery links, staff credentials, or private account access."
            />
            <PolicyItem
              title="Official Staff Contact"
              text="Mai Troll staff will not ask you to send your password, full card number, or one-time login code through chat."
            />
            <PolicyItem
              title="Blocking & Boundaries"
              text="Users may block unwanted contact. Staff may also restrict communication, live access, or account features when safety requires it."
            />
            <PolicyItem
              title="Suspicious Activity"
              text="Report unfamiliar logins, unauthorized purchases, account takeovers, payment fraud, or suspicious staff impersonation immediately."
            />
          </PolicyCard>

          <PolicyCard icon={AlertTriangle} title="Reporting Violations" accent="yellow">
            <p className="mb-4 text-sm leading-6 text-slate-300">
              Use Mai Troll's reporting tools when you see a genuine violation.
              Give staff enough information to understand what happened.
            </p>

            <StepList
              items={[
                'Use the report button on the profile, stream, post, message, auction, or marketplace listing.',
                'Choose the closest violation reason.',
                'Add clear details, timestamps, screenshots, or context when available.',
                'A Troll Officer or administrator reviews the report and determines the next action.',
              ]}
            />

            <Notice tone="yellow">
              False, retaliatory, coordinated, or abusive reports may lead to
              account restrictions.
            </Notice>
          </PolicyCard>

          <PolicyCard icon={Ban} title="Moderation Actions" accent="red">
            <PolicyItem
              title="Warning"
              text="A warning may be used for lower-level, accidental, or first-time violations when immediate removal is not necessary."
            />
            <PolicyItem
              title="Live Controls"
              text="Staff may end streams, mute microphones, remove camera guests, disable chat, block gifting, or temporarily restrict broadcasting."
            />
            <PolicyItem
              title="Troll Jail"
              text="Mai Troll may use timed jail restrictions, court summons, bond requirements, feature restrictions, or other city-based penalties."
            />
            <PolicyItem
              title="Temporary Suspension"
              text="Temporary restrictions may be applied when time away from a feature or the platform is necessary."
            />
            <PolicyItem
              title="Permanent Ban"
              text="Severe violence, sexual exploitation, fraud, repeated intentional exposure, dangerous conduct, or continued abuse may result in permanent removal."
            />
          </PolicyCard>

          <PolicyCard icon={Gavel} title="Appeals & Court">
            <p className="text-sm leading-6 text-slate-300">
              Users may appeal eligible moderation decisions through support or
              the Mai Troll court system when available. Appeals should explain
              what happened, identify the action being challenged, and include
              relevant evidence.
            </p>

            <PolicyItem
              title="Human Review"
              text="Appeals are reviewed by people where possible. Filing an appeal does not guarantee that the original decision will be changed."
            />
            <PolicyItem
              title="Honest Appeals"
              text="False evidence, harassment of staff, repeated duplicate appeals, or attempts to manipulate the process may affect the review."
            />

            <Notice tone="cyan">
              Immediate safety actions may remain active while an appeal is being
              reviewed.
            </Notice>
          </PolicyCard>

          <PolicyCard icon={HeartHandshake} title="Emergency & Wellness Safety">
            <PolicyItem
              title="Immediate Danger"
              text="If someone appears to be in immediate danger, contact local emergency services. Mai Troll reporting tools are not a replacement for emergency assistance."
            />
            <PolicyItem
              title="Self-Harm Concerns"
              text="Report credible self-harm threats or attempts immediately. Staff may restrict a stream, preserve relevant information, or contact authorities when appropriate."
            />
            <PolicyItem
              title="Violent Threats"
              text="Specific or credible threats of violence may result in immediate account action and referral to law enforcement."
            />
          </PolicyCard>

          <PolicyCard icon={Scale} title="Fair Enforcement">
            <PolicyItem
              title="Context Matters"
              text="Staff may consider intent, severity, repetition, risk, cooperation, and prior violations when deciding what action to take."
            />
            <PolicyItem
              title="No Guaranteed Warning"
              text="Some violations are serious enough that staff may act immediately without first issuing a warning."
            />
            <PolicyItem
              title="Platform Safety First"
              text="Mai Troll may remove content or restrict features when reasonably necessary to protect users, staff, transactions, or platform operations."
            />
          </PolicyCard>

          <PolicyCard icon={MessageSquare} title="Need Help?">
            <StepList
              items={[
                'Visit Support from your Mai Troll dashboard.',
                'Use the report button for content or user violations.',
                'Contact Troll Officers through official moderation tools.',
                'Use court or appeal routes when they are available.',
                'For urgent payment or account issues, use official support channels only.',
              ]}
            />
          </PolicyCard>
        </section>

        <section className="mt-6 rounded-[2rem] border border-cyan-400/15 bg-slate-950/75 p-6 shadow-[0_0_45px_rgba(34,211,238,0.08)] backdrop-blur-xl">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-cyan-400/20 bg-cyan-500/10 text-cyan-300">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-white">
                Broadcaster Safety Checklist
              </h2>
              <p className="mt-1 text-sm text-slate-400">
                Before going live, confirm each of these requirements.
              </p>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <ChecklistItem text="Clothing is secure and not see-through." />
            <ChecklistItem text="Private body parts are fully covered." />
            <ChecklistItem text="Camera angles are appropriate." />
            <ChecklistItem text="Guests understand the rules." />
            <ChecklistItem text="No dangerous activity is visible." />
            <ChecklistItem text="No private information is on screen." />
            <ChecklistItem text="Music and video use is authorized." />
            <ChecklistItem text="You can quickly remove unsafe guests." />
          </div>
        </section>

        <section className="mt-6 rounded-[2rem] border border-cyan-400/15 bg-slate-950/75 p-6 shadow-[0_0_45px_rgba(34,211,238,0.08)] backdrop-blur-xl">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-cyan-400/20 bg-cyan-500/10 text-cyan-300">
              <FileText className="h-5 w-5" />
            </div>
            <h2 className="text-2xl font-black text-white">Legal Documents</h2>
          </div>

          <div className="grid gap-3 md:grid-cols-4">
            <LegalLink to="/legal/terms" label="Terms of Service" />
            <LegalLink to="/legal/refunds" label="Refund Policy" />
            <LegalLink to="/legal/payouts" label="Payout Policy" />
            <LegalLink to="/legal/safety" label="Safety Guidelines" />
          </div>
        </section>
      </section>
    </main>
  )
}

function StatCard({
  icon: Icon,
  label,
  value,
  danger,
}: {
  icon: React.ElementType
  label: string
  value: string
  danger?: boolean
}) {
  return (
    <div
      className={`rounded-3xl border p-4 ${
        danger
          ? 'border-red-400/20 bg-red-500/5'
          : 'border-cyan-400/20 bg-cyan-500/5'
      }`}
    >
      <Icon
        className={`mb-3 h-5 w-5 ${
          danger ? 'text-red-300' : 'text-cyan-300'
        }`}
      />
      <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
        {label}
      </p>
      <p className="mt-1 text-lg font-black text-white">{value}</p>
    </div>
  )
}

function PolicyCard({
  icon: Icon,
  title,
  children,
  accent = 'cyan',
}: {
  icon: React.ElementType
  title: string
  children: React.ReactNode
  accent?: 'cyan' | 'yellow' | 'red' | 'purple'
}) {
  const color =
    accent === 'yellow'
      ? 'border-yellow-400/20 bg-yellow-500/5 text-yellow-300'
      : accent === 'red'
        ? 'border-red-400/20 bg-red-500/5 text-red-300'
        : accent === 'purple'
          ? 'border-fuchsia-400/20 bg-fuchsia-500/5 text-fuchsia-300'
          : 'border-cyan-400/20 bg-cyan-500/5 text-cyan-300'

  return (
    <section className="rounded-[2rem] border border-cyan-400/15 bg-slate-950/75 p-6 shadow-[0_0_45px_rgba(34,211,238,0.08)] backdrop-blur-xl">
      <div className="mb-5 flex items-center gap-3">
        <div
          className={`flex h-11 w-11 items-center justify-center rounded-2xl border ${color}`}
        >
          <Icon className="h-5 w-5" />
        </div>
        <h2 className="text-2xl font-black text-white">{title}</h2>
      </div>

      <div className="space-y-4">{children}</div>
    </section>
  )
}

function PolicyItem({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
      <h3 className="font-black text-white">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-400">{text}</p>
    </div>
  )
}

function StepList({ items }: { items: string[] }) {
  return (
    <ol className="space-y-2">
      {items.map((item, index) => (
        <li
          key={item}
          className="flex gap-3 rounded-2xl border border-white/10 bg-black/25 p-3"
        >
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-cyan-400 text-xs font-black text-slate-950">
            {index + 1}
          </span>
          <span className="text-sm leading-6 text-slate-300">{item}</span>
        </li>
      ))}
    </ol>
  )
}

function ChecklistItem({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-white/10 bg-black/25 p-4">
      <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300" />
      <p className="text-sm leading-6 text-slate-300">{text}</p>
    </div>
  )
}

function Notice({
  children,
  tone = 'cyan',
}: {
  children: React.ReactNode
  tone?: 'cyan' | 'yellow' | 'red'
}) {
  return (
    <div
      className={`mt-4 rounded-2xl border p-4 text-sm leading-6 ${
        tone === 'yellow'
          ? 'border-yellow-400/20 bg-yellow-500/10 text-yellow-100'
          : tone === 'red'
            ? 'border-red-400/20 bg-red-500/10 text-red-100'
            : 'border-cyan-400/20 bg-cyan-500/10 text-cyan-100'
      }`}
    >
      {children}
    </div>
  )
}

function LegalLink({ to, label }: { to: string; label: string }) {
  return (
    <Link
      to={to}
      className="rounded-2xl border border-cyan-400/15 bg-black/30 px-4 py-3 text-sm font-black text-cyan-200 transition hover:border-cyan-300/40 hover:bg-cyan-500/10 hover:text-white"
    >
      {label}
    </Link>
  )
}