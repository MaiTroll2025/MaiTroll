import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  FileText,
  Shield,
  Eye,
  Ban,
  UserCheck,
  AlertTriangle,
  Lock,
  Scale,
  Coins,
  Radio,
  Gavel,
  Crown,
  MessageSquareWarning,
} from 'lucide-react'
import { neonCard, neonTextGradient } from '../phoneTheme'

interface LegalSectionProps {
  icon: typeof Shield
  title: string
  body: string
  color: string
}

function LegalSection({
  icon: Icon,
  title,
  body,
  color,
}: LegalSectionProps) {
  return (
    <section className={`${neonCard} overflow-hidden p-4`}>
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04]">
          <Icon size={19} className={color} />
        </div>

        <div className="min-w-0">
          <h3 className="text-sm font-black text-white">{title}</h3>
          <p className="mt-2 text-[11px] leading-relaxed text-zinc-400">
            {body}
          </p>
        </div>
      </div>
    </section>
  )
}

const legalSections: LegalSectionProps[] = [
  {
    icon: Shield,
    title: 'Freedom With Responsibility',
    color: 'text-cyan-400',
    body:
      'MaiTroll is designed to give users freedom to communicate, create, broadcast, entertain, socialize, express opinions, and use the platform in the ways MaiTroll provides. Freedom does not mean there are no rules. Every user is expected to respect the MaiTroll Terms, Community Standards, Safety Rules, and CEO platform policies.',
  },

  {
    icon: Crown,
    title: 'CEO Platform Authority',
    color: 'text-yellow-400',
    body:
      'The CEO and authorized MaiTroll leadership may establish, interpret, update, and enforce platform rules in the interest of user safety, platform integrity, financial security, and the MaiTroll community. These rules may be stricter than the minimum requirements of a particular jurisdiction. Using MaiTroll means agreeing to follow the platform rules established by MaiTroll leadership.',
  },

  {
    icon: Eye,
    title: '24/7 Broadcast Monitoring',
    color: 'text-purple-400',
    body:
      'Every MaiTroll broadcast is subject to continuous platform safety coverage. 24/7 monitoring does not mean a human moderator is watching every broadcast every second. Broadcasts may be monitored, reviewed, reported, investigated, recorded for safety purposes where permitted, or acted upon at any time. A moderator not being present at the exact moment something happens does not make that conduct permitted.',
  },

  {
    icon: Radio,
    title: 'Troll Officer Enforcement',
    color: 'text-cyan-400',
    body:
      'Authorized Troll Officers and other authorized MaiTroll moderation personnel may review broadcasts, investigate reports, enforce platform rules, remove users from broadcasts, restrict features, issue warnings, place users into MaiTroll Arrest, and take other authorized enforcement actions. Enforcement may occur immediately or after a later review.',
  },

  {
    icon: Gavel,
    title: 'MaiTroll Arrest',
    color: 'text-red-400',
    body:
      'MaiTroll Arrest is an INTERNAL PLATFORM ENFORCEMENT ACTION. It does not mean arrest by police or any real-world government authority. When a user is placed under MaiTroll Arrest, MaiTroll may temporarily restrict the user from broadcasts, chat, community features, sending or receiving certain interactions, or other platform functions for the duration determined by the applicable rule or authorized officer.',
  },

  {
    icon: Ban,
    title: 'Nudity Is Not Permitted',
    color: 'text-red-400',
    body:
      'Complete nudity and complete exposure are prohibited on MaiTroll. Users and broadcasters may not appear completely naked or expose sexual or intimate body parts. This is a platform-wide rule and applies regardless of whether the content is presented as entertainment, education, art, humor, breastfeeding, personal expression, or another purpose.',
  },

  {
    icon: UserCheck,
    title: 'Underwear & Lingerie Are Allowed',
    color: 'text-pink-400',
    body:
      'Users and broadcasters may appear in underwear, boxers, briefs, lingerie, sleepwear, or similar clothing. Clothing itself is not prohibited. However, the covered areas must remain appropriately covered. Underwear or lingerie may not be intentionally manipulated, removed, pulled aside, or positioned to expose prohibited intimate areas.',
  },

  {
    icon: AlertTriangle,
    title: 'Sexual Exposure & Body-Part Conduct',
    color: 'text-orange-400',
    body:
      'Users may not intentionally expose, manipulate, rub, touch, display, or focus on sexual or intimate body areas in a manner intended to sexually entice viewers or produce prohibited sexual content. This rule applies to all genders and applies whether the conduct occurs during a live broadcast, video, voice interaction, profile content, or another MaiTroll feature.',
  },

  {
    icon: Ban,
    title: 'Breast Exposure',
    color: 'text-red-400',
    body:
      'Visible breast exposure is not permitted on MaiTroll. This rule applies regardless of the reason for the exposure. Breastfeeding does not create an exception to this platform rule. A user may discuss breastfeeding, parenting, or related subjects, but the breast must remain covered while using MaiTroll.',
  },

  {
    icon: MessageSquareWarning,
    title: 'Threats Are Prohibited',
    color: 'text-red-400',
    body:
      'Real-world threats of violence or harm are prohibited. Users may not threaten to kill, seriously injure, attack, stalk, or physically harm another person. This applies to text, voice chat, live broadcasts, direct messages, comments, community features, and other platform interactions.',
  },

  {
    icon: MessageSquareWarning,
    title: 'Gaming & Fictional Context',
    color: 'text-violet-400',
    body:
      'MaiTroll recognizes that users may discuss fictional games, movies, shows, stories, and other entertainment. Saying that someone was killed in GTA or another fictional game is not automatically treated as a real-world threat. Context matters. However, a user may not use GTA, gaming language, roleplay, fiction, or another fictional reference as a disguise for an actual threat against a real person.',
  },

  {
    icon: Shield,
    title: 'Minor Safety',
    color: 'text-blue-400',
    body:
      'MaiTroll applies strict protections to minors. For MaiTroll safety purposes, a minor is treated as a person 16 or younger under this platform policy. MaiTroll may also restrict or take action against accounts that appear to belong to anyone under 18. Platform safety rules may be stricter than the legal age or consent rules of a particular state or country.',
  },

  {
    icon: UserCheck,
    title: 'Parent & Guardian Responsibility',
    color: 'text-emerald-400',
    body:
      'A parent or guardian who places a minor on a MaiTroll broadcast is responsible for maintaining appropriate supervision. A parent or guardian must not intentionally leave a minor on-screen while the parent or guardian leaves the broadcast environment. This is a serious MaiTroll child-safety violation.',
  },

  {
    icon: Gavel,
    title: 'Minor Supervision Violation — MaiTroll Arrest',
    color: 'text-red-400',
    body:
      'If a parent or guardian leaves a minor on-screen without the responsible parent or guardian remaining present, MaiTroll may immediately place the responsible account into MaiTroll Arrest. The minimum MaiTroll Arrest period for this violation is 2 days. Additional restrictions, investigation, account suspension, or other safety measures may also be applied when warranted.',
  },

  {
    icon: Lock,
    title: 'Under-18 Account Restrictions',
    color: 'text-indigo-400',
    body:
      'If an account is determined or reasonably believed to belong to a person under 18, MaiTroll may impose additional safety restrictions. These may include restrictions on broadcasting, financial features, interactions, or other platform functions. MaiTroll may require age and identity verification before allowing certain features.',
  },

  {
    icon: Coins,
    title: 'Identity Verification & Cash-Outs',
    color: 'text-yellow-400',
    body:
      'MaiTroll may require a valid government-issued identification document or other approved verification before permitting cash-outs. Earning or receiving Troll Coins does not automatically guarantee that a cash-out will be approved. Cash-outs remain subject to identity, age, account, fraud, safety, and financial review.',
  },

  {
    icon: Coins,
    title: '30-Day Cash-Out Hold',
    color: 'text-amber-400',
    body:
      'If required identity verification has not been submitted, is incomplete, appears fictitious, appears altered, cannot be reasonably authenticated, or otherwise fails MaiTroll verification requirements, cash-outs may be placed on a 30-day hold. This hold may apply regardless of the amount of coins or money associated with the account.',
  },

  {
    icon: AlertTriangle,
    title: 'Fictitious or Invalid Identification',
    color: 'text-orange-400',
    body:
      'Submitting identification that appears fictitious, altered, fraudulent, misleading, or otherwise invalid may result in a 30-day cash-out hold, account restrictions, additional verification, MaiTroll Arrest where applicable, suspension, or termination. MaiTroll may use reasonable verification methods available to the platform.',
  },

  {
    icon: Scale,
    title: 'No Loophole Principle',
    color: 'text-purple-400',
    body:
      'Users may not intentionally reinterpret, disguise, relabel, manipulate, or relocate prohibited conduct in an attempt to bypass MaiTroll rules. Calling content educational, fictional, artistic, joking, roleplay, gaming-related, or otherwise does not automatically create an exception. MaiTroll may consider the complete context when determining whether a violation occurred.',
  },
]

export default function PhoneLegal() {
  const navigate = useNavigate()

  return (
    <div className="relative min-h-screen w-full overflow-x-hidden bg-[#05010f] text-white">
      {/* Neon background */}
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-[#00BFFF]/15 blur-[120px]" />
        <div className="absolute -right-32 top-1/3 h-96 w-96 rounded-full bg-[#BF00FF]/15 blur-[120px]" />
        <div className="absolute bottom-0 left-1/3 h-80 w-80 rounded-full bg-[#00BFFF]/10 blur-[120px]" />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-[#00BFFF]/20 bg-[#05010f]/90 backdrop-blur-2xl">
        <div className="flex items-center justify-between px-4 py-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            aria-label="Go back"
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 active:scale-95"
          >
            <ArrowLeft size={19} />
          </button>

          <div className="text-center">
            <h1 className="text-sm font-black uppercase tracking-[0.18em]">
              Legal & Safety
            </h1>

            <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-500">
              MaiTroll Platform Rules
            </p>
          </div>

          <div className="w-10" />
        </div>
      </header>

      <main className="relative z-10 px-4 py-5 pb-24">
        {/* CEO Statement */}
        <section className={`${neonCard} relative overflow-hidden p-5`}>
          <div className="absolute inset-0 bg-gradient-to-br from-[#00BFFF]/10 via-transparent to-[#BF00FF]/10" />

          <div className="relative">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#00BFFF] to-[#BF00FF] shadow-[0_0_25px_rgba(0,191,255,0.3)]">
                <Crown size={23} className="text-white" />
              </div>

              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-cyan-300">
                  CEO Platform Statement
                </p>

                <h2 className={`text-lg font-black ${neonTextGradient}`}>
                  Freedom Has Boundaries
                </h2>
              </div>
            </div>

            <p className="mt-4 text-xs leading-relaxed text-zinc-300">
              MaiTroll is built to give its users freedom. You can communicate,
              create, broadcast, entertain, socialize, express yourself, and
              participate in the many features MaiTroll provides.
            </p>

            <p className="mt-3 text-xs leading-relaxed text-zinc-300">
              That freedom exists within the rules of the platform. Users are
              expected to respect MaiTroll safety policies, community standards,
              financial rules, and enforcement decisions.
            </p>

            <div className="mt-4 rounded-2xl border border-cyan-400/20 bg-cyan-400/5 p-3">
              <p className="text-[10px] font-bold leading-relaxed text-cyan-100/80">
                Just because a moderator has not acted yet does not mean a
                violation is allowed. MaiTroll rules apply at all times.
              </p>
            </div>
          </div>
        </section>

        {/* Monitoring */}
        <section className="mt-4 rounded-2xl border border-purple-400/20 bg-purple-500/5 p-4">
          <div className="flex items-start gap-3">
            <Eye className="mt-0.5 h-5 w-5 shrink-0 text-purple-400" />

            <div>
              <h2 className="text-xs font-black uppercase tracking-wider text-purple-200">
                24/7 Broadcast Safety Coverage
              </h2>

              <p className="mt-2 text-[11px] leading-relaxed text-zinc-400">
                Every broadcast is subject to MaiTroll monitoring and moderation
                coverage 24 hours a day, 7 days a week. This does not mean a
                human moderator watches every broadcast every second. It means
                broadcasts may be monitored, reviewed, reported, investigated,
                or acted upon at any time.
              </p>
            </div>
          </div>
        </section>

        {/* Rules */}
        <div className="mt-5 space-y-3">
          <div className="px-1">
            <h2 className="text-xs font-black uppercase tracking-[0.2em] text-white">
              MaiTroll Rules
            </h2>

            <p className="mt-1 text-[10px] text-zinc-500">
              These rules apply throughout the MaiTroll platform.
            </p>
          </div>

          {legalSections.map((section) => (
            <LegalSection
              key={section.title}
              icon={section.icon}
              title={section.title}
              body={section.body}
              color={section.color}
            />
          ))}
        </div>

        {/* Enforcement Box */}
        <section className="mt-5 rounded-3xl border border-red-400/20 bg-red-500/[0.04] p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-red-500/10">
              <Gavel className="h-5 w-5 text-red-400" />
            </div>

            <div>
              <h2 className="text-sm font-black text-white">
                MaiTroll Enforcement
              </h2>

              <p className="text-[9px] uppercase tracking-widest text-red-300/70">
                Troll Officers • Moderation • CEO Authority
              </p>
            </div>
          </div>

          <p className="mt-4 text-[11px] leading-relaxed text-zinc-400">
            MaiTroll may take enforcement action whenever it determines that
            content, behavior, accounts, broadcasts, interactions, or
            transactions violate platform rules or create a safety, financial,
            legal, or community risk.
          </p>

          <div className="mt-4 grid grid-cols-2 gap-2">
            {[
              'Warnings',
              'Content Removal',
              'Broadcast Removal',
              'Feature Restrictions',
              'MaiTroll Arrest',
              'Temporary Suspension',
              'Permanent Termination',
              'Cash-Out Holds',
            ].map((item) => (
              <div
                key={item}
                className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-center"
              >
                <span className="text-[9px] font-bold text-zinc-400">
                  {item}
                </span>
              </div>
            ))}
          </div>

          <p className="mt-4 text-[10px] font-bold leading-relaxed text-white/60">
            Enforcement may happen immediately or after a later review.
            Delayed enforcement does not make prohibited conduct permissible.
          </p>
        </section>

        {/* Arrest Explanation */}
        <section className={`${neonCard} mt-4 p-5`}>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-500/10">
              <Gavel className="h-5 w-5 text-red-400" />
            </div>

            <div>
              <h2 className="text-sm font-black text-white">
                What Is MaiTroll Arrest?
              </h2>

              <p className="text-[9px] uppercase tracking-widest text-red-300/70">
                Internal Platform Discipline
              </p>
            </div>
          </div>

          <p className="mt-3 text-[11px] leading-relaxed text-zinc-400">
            MaiTroll Arrest is a platform disciplinary status. It is not a
            real-world criminal arrest and does not represent police or
            government authority.
          </p>

          <p className="mt-3 text-[11px] leading-relaxed text-zinc-400">
            A user placed under MaiTroll Arrest may lose access to broadcasts,
            chat, community features, financial features, or other platform
            functions for the assigned period.
          </p>

          <div className="mt-4 rounded-2xl border border-red-400/20 bg-red-500/5 p-3">
            <p className="text-[10px] font-black text-red-300">
              Serious violations may receive immediate MaiTroll Arrest without
              a prior warning.
            </p>
          </div>
        </section>

        {/* Minor Safety Highlight */}
        <section className="mt-4 rounded-3xl border border-blue-400/20 bg-blue-500/[0.04] p-5">
          <div className="flex items-center gap-3">
            <Shield className="h-5 w-5 text-blue-400" />

            <h2 className="text-sm font-black text-white">
              Minor Safety Is Non-Negotiable
            </h2>
          </div>

          <p className="mt-3 text-[11px] leading-relaxed text-zinc-400">
            MaiTroll takes minor safety seriously. Parents and guardians are
            responsible for supervising minors who appear on broadcasts.
          </p>

          <div className="mt-4 rounded-2xl border border-red-400/20 bg-red-500/5 p-4">
            <p className="text-[10px] font-black uppercase tracking-wider text-red-300">
              Minimum MaiTroll Arrest
            </p>

            <p className="mt-1 text-2xl font-black text-white">
              2 Days
            </p>

            <p className="mt-1 text-[10px] leading-relaxed text-zinc-500">
              Applies to the specified parent/guardian minor-supervision
              violation described in these rules.
            </p>
          </div>
        </section>

        {/* Cash-Out */}
        <section className="mt-4 rounded-3xl border border-yellow-400/20 bg-yellow-500/[0.04] p-5">
          <div className="flex items-center gap-3">
            <Coins className="h-5 w-5 text-yellow-400" />

            <div>
              <h2 className="text-sm font-black text-white">
                Cash-Out Protection
              </h2>

              <p className="text-[9px] uppercase tracking-widest text-yellow-300/70">
                Identity • Age • Fraud Prevention
              </p>
            </div>
          </div>

          <p className="mt-3 text-[11px] leading-relaxed text-zinc-400">
            MaiTroll may hold cash-outs when required identification or age
            verification has not been satisfactorily completed.
          </p>

          <div className="mt-4 flex items-center gap-3 rounded-2xl border border-yellow-400/20 bg-yellow-400/5 p-4">
            <div className="text-center">
              <p className="text-3xl font-black text-yellow-300">30</p>
              <p className="text-[8px] font-black uppercase tracking-widest text-yellow-200/60">
                Days
              </p>
            </div>

            <p className="text-[10px] leading-relaxed text-zinc-400">
              Cash-outs may be held for 30 days when required verification is
              missing, incomplete, fictitious, invalid, or cannot be reasonably
              authenticated.
            </p>
          </div>

          <p className="mt-3 text-[10px] leading-relaxed text-zinc-500">
            Receiving coins does not guarantee immediate cash-out approval.
            Financial activity remains subject to MaiTroll verification and
            account review.
          </p>
        </section>

        {/* Final Acknowledgement */}
        <section className="mt-5 rounded-3xl border border-cyan-400/20 bg-gradient-to-br from-cyan-500/5 to-purple-500/5 p-5 text-center">
          <FileText className="mx-auto h-8 w-8 text-cyan-400" />

          <h2 className={`mt-3 text-lg font-black ${neonTextGradient}`}>
            You Have Freedom. Follow The Rules.
          </h2>

          <p className="mt-3 text-[11px] leading-relaxed text-zinc-400">
            MaiTroll gives users significant freedom to use the platform,
            express themselves, broadcast, communicate, entertain, and build
            their communities. That freedom exists alongside rules designed to
            protect users, broadcasters, minors, the community, and the
            platform.
          </p>

          <p className="mt-3 text-[11px] font-bold leading-relaxed text-white/70">
            By using MaiTroll, you acknowledge that platform rules apply even
            when immediate moderation is not visible.
          </p>

          <button
            type="button"
            onClick={() => navigate(-1)}
            className="mt-5 rounded-xl bg-gradient-to-r from-[#00BFFF] to-[#BF00FF] px-6 py-3 text-xs font-black text-white shadow-[0_0_25px_rgba(0,191,255,0.2)] active:scale-95"
          >
            I Understand
          </button>
        </section>
      </main>
    </div>
  )
}