import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  Shield,
  Eye,
  Video,
  Ban,
  UserRoundCheck,
  Coins,
  AlertTriangle,
  MessageSquareWarning,
  Gavel,
  Baby,
  Lock,
  Radio,
  CheckCircle2,
  XCircle,
} from 'lucide-react'
import { neonCard, neonTextGradient } from '../phoneTheme'

const Section = ({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof Shield
  title: string
  children: React.ReactNode
}) => (
  <section className={`${neonCard} overflow-hidden rounded-3xl p-5`}>
    <div className="flex items-center gap-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#00BFFF]/20 bg-[#00BFFF]/10">
        <Icon className="h-5 w-5 text-[#00BFFF]" />
      </div>

      <h2 className="text-sm font-black uppercase tracking-wide text-white">
        {title}
      </h2>
    </div>

    <div className="mt-4 space-y-3 text-xs leading-6 text-zinc-400">
      {children}
    </div>
  </section>
)

const Rule = ({
  children,
  allowed = true,
}: {
  children: React.ReactNode
  allowed?: boolean
}) => (
  <div className="flex items-start gap-2">
    {allowed ? (
      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
    ) : (
      <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
    )}

    <span>{children}</span>
  </div>
)

export default function PhoneSafety() {
  const navigate = useNavigate()

  return (
    <div className="relative min-h-screen w-full overflow-x-hidden bg-[#05010f] text-white">
      {/* Neon background */}
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
              Safety
            </h1>
            <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-500">
              MaiTroll Community Rules
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
              MaiTroll Safety Center
            </h2>

            <p className="mt-3 text-xs leading-6 text-zinc-400">
              MaiTroll is built around freedom, creativity, conversation,
              broadcasting, entertainment, and community. You have substantial
              freedom to express yourself — but freedom on MaiTroll exists
              within the rules that protect the community.
            </p>

            <div className="mt-4 rounded-2xl border border-cyan-400/20 bg-cyan-400/5 p-4 text-left">
              <p className="text-xs font-black uppercase tracking-wider text-cyan-300">
                Freedom With Rules
              </p>

              <p className="mt-2 text-xs leading-5 text-zinc-400">
                A moderator not taking action on a particular piece of content
                does not mean the content is permanently approved or that
                moderation does not exist. MaiTroll reserves the right to
                review, restrict, remove, suspend, or otherwise enforce its
                rules whenever necessary.
              </p>
            </div>
          </div>
        </section>

        {/* Monitoring */}
        <Section icon={Radio} title="24/7 Broadcast Monitoring">
          <p>
            Every MaiTroll broadcast is subject to platform monitoring and
            safety review 24 hours a day, 7 days a week.
          </p>

          <p>
            This does <strong className="text-white">not</strong> mean that a
            human officer is watching every broadcast every second. It means
            broadcasts may be monitored through MaiTroll safety systems,
            reports, moderation tools, Troll Officers, administrators, and
            other enforcement mechanisms.
          </p>

          <p>
            Content may be reviewed after it is reported, flagged, detected,
            escalated, or otherwise brought to the attention of MaiTroll.
          </p>

          <div className="rounded-2xl border border-purple-400/20 bg-purple-500/5 p-3">
            <div className="flex gap-2">
              <Eye className="mt-0.5 h-4 w-4 shrink-0 text-purple-300" />
              <span>
                Do not assume that content is permitted simply because it has
                remained visible for a period of time.
              </span>
            </div>
          </div>
        </Section>

        {/* Nudity */}
        <Section icon={Ban} title="Nudity & Sexual Exposure">
          <p className="font-bold text-white">
            Complete nudity and complete exposure are not permitted on
            MaiTroll.
          </p>

          <p>
            MaiTroll allows users and broadcasters a degree of freedom in how
            they present themselves, including clothing that may be considered
            revealing, provided the prohibited exposure rules are followed.
          </p>

          <div className="space-y-2 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <Rule>
              Boxers, briefs, underwear, lingerie, and similar clothing may be
              worn.
            </Rule>

            <Rule>
              Revealing clothing is not automatically prohibited solely because
              it is revealing.
            </Rule>

            <Rule allowed={false}>
              Complete nudity or complete exposure is prohibited.
            </Rule>

            <Rule allowed={false}>
              Explicit exposure of sexual anatomy is prohibited.
            </Rule>

            <Rule allowed={false}>
              Content intentionally displaying sexual anatomy to sexually
              entice viewers is prohibited.
            </Rule>

            <Rule allowed={false}>
              Deliberate sexual rubbing, touching, or manipulation of sexual
              body parts for broadcast content is prohibited.
            </Rule>
          </div>

          <div className="rounded-2xl border border-red-400/20 bg-red-500/5 p-3">
            <p className="font-bold text-red-300">
              Breastfeeding does not create an exception.
            </p>

            <p className="mt-1">
              A breast may not be exposed on MaiTroll during a broadcast,
              including during breastfeeding. Users may breastfeed while
              maintaining the required coverage.
            </p>
          </div>
        </Section>

        {/* Sexual conduct */}
        <Section icon={AlertTriangle} title="Sexual Conduct">
          <p>
            MaiTroll permits personal expression, but broadcasts cannot become
            sexually explicit performances.
          </p>

          <Rule allowed={false}>
            Do not intentionally rub, manipulate, expose, or emphasize sexual
            body parts.
          </Rule>

          <Rule allowed={false}>
            Do not use the camera to intentionally display prohibited sexual
            areas.
          </Rule>

          <Rule allowed={false}>
            Do not use clothing, camera angles, movements, or positioning as a
            deliberate workaround for the nudity rules.
          </Rule>

          <Rule allowed={true}>
            Ordinary conversation, entertainment, dancing, gaming, comedy,
            music, and other non-explicit content remain permitted subject to
            the other community rules.
          </Rule>
        </Section>

        {/* Minors */}
        <Section icon={Baby} title="Minors & Child Safety">
          <p className="font-bold text-white">
            MaiTroll takes the presence of minors extremely seriously.
          </p>

          <p>
            For MaiTroll safety enforcement purposes, the platform's minor
            rules apply to users under 18, with enhanced protections and
            restrictions applying to younger minors.
          </p>

          <div className="rounded-2xl border border-red-400/20 bg-red-500/5 p-4">
            <p className="font-black uppercase tracking-wide text-red-300">
              No child should be left unattended on a broadcast.
            </p>

            <p className="mt-2">
              If a parent or responsible adult leaves a child visible on a
              broadcast without appropriate supervision, MaiTroll may
              immediately intervene.
            </p>
          </div>

          <p>
            When a Troll Officer identifies a serious child-safety violation,
            MaiTroll may place the responsible account into{' '}
            <strong className="text-white">MaiTroll Arrest</strong>.
          </p>

          <p>
            MaiTroll Arrest is an <strong className="text-white">
              in-platform enforcement status
            </strong>
            . It is not a real-world arrest or statement that MaiTroll has
            arrested someone under criminal law.
          </p>

          <p>
            A serious violation involving a child may result in a minimum
            in-platform enforcement period of 2 days, with additional action
            possible depending on the circumstances.
          </p>

          <Rule allowed={false}>
            Minors may not be used as sexual content, sexualized broadcast
            material, or entertainment intended to sexualize them.
          </Rule>

          <Rule allowed={false}>
            Adults must not facilitate prohibited interactions between minors
            and other users.
          </Rule>
        </Section>

        {/* Age and verification */}
        <Section icon={UserRoundCheck} title="Age & Identity Verification">
          <p>
            Users who are required to verify their identity must provide
            accurate and authentic identification information.
          </p>

          <p>
            If required identification is missing, incomplete, suspicious,
            fictitious, unverifiable, or otherwise fails MaiTroll's
            verification requirements, MaiTroll may place financial
            transactions or cash-outs on hold.
          </p>

          <div className="rounded-2xl border border-amber-400/20 bg-amber-500/5 p-4">
            <p className="font-black text-amber-300">
              Cash-out safety hold: up to 30 days
            </p>

            <p className="mt-2">
              Where the applicable verification requirements have not been
              satisfied, cash-outs may be held for 30 days regardless of the
              amount involved.
            </p>
          </div>

          <p>
            MaiTroll may require a new or valid identification submission
            before releasing funds. Platform leadership and authorized
            financial personnel may review questionable verification results.
          </p>

          <p>
            Attempting to bypass age or identity requirements can result in
            account restrictions, financial holds, suspension, or termination.
          </p>
        </Section>

        {/* Cashouts */}
        <Section icon={Coins} title="Cash-Out Protection">
          <p>
            Financial safety is part of user safety. Receiving coins or
            rewards does not automatically guarantee immediate cash-out.
          </p>

          <Rule>
            Verified users may access cash-out features according to the
            applicable MaiTroll requirements.
          </Rule>

          <Rule>
            Verification may be required before funds are released.
          </Rule>

          <Rule>
            Suspicious or incomplete identity information may trigger a
            30-day hold.
          </Rule>

          <Rule allowed={false}>
            Users may not use another person's identity or fabricated
            identification to bypass verification.
          </Rule>
        </Section>

        {/* Threats, Harm & Harassment */}
<Section icon={MessageSquareWarning} title="Threats, Harm & Harassment">
  <p className="font-bold text-white">
    MaiTroll does not automatically prohibit words simply because they can be
    associated with violence, insults, or sensitive subjects.
  </p>

  <p>
    MaiTroll recognizes that people talk about real life, fictional stories,
    television, movies, gaming, history, news, personal experiences, jokes,
    arguments, and other subjects. Context matters.
  </p>

  <div className="space-y-2 rounded-2xl border border-emerald-400/20 bg-emerald-500/5 p-4">
    <Rule allowed={true}>
      Users may use words such as "kill," "killed," "killing," "hurt," or
      similar words when they are discussing a situation, story, event,
      fictional content, gaming, news, or another non-threatening context.
    </Rule>

    <Rule allowed={true}>
      Users do not have to add words such as "in GTA" every time they discuss
      something that happened in a video game or other fictional environment.
    </Rule>

    <Rule allowed={true}>
      Strong language, profanity, insults, or words that some people consider
      offensive are not automatically violations solely because someone finds
      the word offensive.
    </Rule>

    <Rule allowed={true}>
      The word "retarded" is not automatically prohibited solely because the
      word was used. MaiTroll evaluates the surrounding context and whether
      the user is deliberately targeting, bullying, or harassing another
      person.
    </Rule>
  </div>

  <div className="space-y-2 rounded-2xl border border-red-400/20 bg-red-500/5 p-4">
    <Rule allowed={false}>
      Do not make a genuine threat to kill another MaiTroll user or another
      identifiable person.
    </Rule>

    <Rule allowed={false}>
      Do not make a genuine threat to physically harm another person.
    </Rule>

    <Rule allowed={false}>
      Do not encourage or coordinate real-world violence against another
      person.
    </Rule>

    <Rule allowed={false}>
      Do not deliberately use language to intimidate another user into
      believing that you intend to harm them.
    </Rule>

    <Rule allowed={false}>
      Do not deliberately bully, harass, repeatedly target, or abuse another
      user.
    </Rule>

    <Rule allowed={false}>
      Do not use supposedly fictional or gaming language as a disguise for a
      genuine threat against a real person.
    </Rule>
  </div>

  <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/5 p-4">
    <p className="font-black uppercase tracking-wide text-cyan-300">
      Context Matters
    </p>

    <p className="mt-2">
      Saying "I could kill this boss" while discussing a game is not the same
      as telling a specific person "I'm going to kill you." Saying "he got
      killed in the movie" is not a threat. Discussing someone being hurt in a
      news story is not automatically a threat. MaiTroll does not treat every
      occurrence of a sensitive word as a safety violation.
    </p>

    <p className="mt-2">
      However, changing the wording to reference a game, joke, movie, or other
      context does not automatically protect a user when the surrounding
      circumstances show that the statement is actually directed at a real
      person as a threat or harassment.
    </p>
  </div>

  <div className="rounded-2xl border border-amber-400/20 bg-amber-500/5 p-4">
    <p className="font-black uppercase tracking-wide text-amber-300">
      Offensive Language vs. Targeted Harassment
    </p>

    <p className="mt-2">
      MaiTroll gives users room to speak in their own style. Not every rude,
      offensive, insensitive, or controversial statement automatically
      requires enforcement.
    </p>

    <p className="mt-2">
      The situation changes when a user is reported for deliberately targeting
      another person, repeatedly bullying them, threatening them, or using
      language as part of a pattern of harassment. In those situations,
      MaiTroll may review the surrounding context and take appropriate
      enforcement action.
    </p>
  </div>

  <p>
    MaiTroll's goal is not to police every word. The goal is to distinguish
    ordinary conversation and expression from conduct that creates a genuine
    safety, harassment, bullying, or targeted-threat concern.
  </p>
</Section>

        {/* Troll Officers */}
        <Section icon={Gavel} title="Troll Officers & Enforcement">
          <p>
            Troll Officers are part of MaiTroll's internal safety and
            enforcement structure.
          </p>

          <p>
            Officers may investigate reports, review broadcasts, identify
            violations, protect users, restrict accounts, escalate incidents,
            and apply platform enforcement according to their authority.
          </p>

          <p>
            Enforcement does not have to occur immediately for a rule to still
            apply. A violation may be reviewed later.
          </p>

          <div className="rounded-2xl border border-purple-400/20 bg-purple-500/5 p-4">
            <div className="flex items-start gap-3">
              <Gavel className="mt-0.5 h-5 w-5 shrink-0 text-purple-300" />

              <div>
                <p className="font-black text-purple-200">
                  MaiTroll Arrest
                </p>

                <p className="mt-1">
                  An internal platform restriction that may temporarily limit
                  an account's ability to participate in MaiTroll.
                </p>
              </div>
            </div>
          </div>
        </Section>

        {/* CEO authority */}
        <Section icon={Lock} title="CEO & Platform Authority">
          <p>
            The MaiTroll CEO and authorized platform leadership retain final
            authority over the platform's rules, safety standards, enforcement
            systems, and operational policies.
          </p>

          <p>
            The existence of user freedom does not eliminate platform
            governance. MaiTroll may create, modify, interpret, enforce, or
            expand safety procedures when necessary to protect the platform
            and its community.
          </p>

          <p>
            A moderation decision, missed report, delayed review, or lack of
            immediate action does not constitute permission to violate the
            rules.
          </p>
        </Section>

        {/* Reporting */}
        <Section icon={Video} title="When You See a Violation">
          <p>
            If you believe a broadcast, post, message, or user is violating
            MaiTroll safety rules, use the platform's available reporting and
            moderation tools.
          </p>

          <p>
            Do not attempt to personally retaliate against another user.
            Report the issue and allow MaiTroll's enforcement system to
            investigate.
          </p>

          <div className="flex items-center gap-2 rounded-2xl border border-emerald-400/20 bg-emerald-500/5 p-3 text-emerald-300">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span className="font-bold">
              Report it. Let MaiTroll handle it.
            </span>
          </div>
        </Section>

        {/* Final statement */}
        <section className={`${neonCard} rounded-3xl p-6`}>
          <div className="text-center">
            <Shield className="mx-auto h-10 w-10 text-[#00BFFF]" />

            <h2 className={`mt-3 text-lg font-black ${neonTextGradient}`}>
              Freedom. Responsibility. MaiTroll.
            </h2>

            <p className="mt-3 text-xs leading-6 text-zinc-400">
              MaiTroll is designed to give people room to express themselves,
              create content, broadcast, communicate, entertain, and build
              community. That freedom is real — but it operates inside the
              MaiTroll rules.
            </p>

            <p className="mt-3 text-xs font-bold leading-5 text-white/80">
              Be yourself. Have fun. Create freely. Know the rules. Respect
              other people. And remember that every broadcast is subject to
              MaiTroll safety enforcement.
            </p>
          </div>
        </section>

        {/* Footer */}
        <div className="pb-8 text-center">
          <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-zinc-600">
            MaiTroll Safety Center
          </p>

          <p className="mt-1 text-[9px] text-zinc-700">
            Internal platform enforcement policies may be updated as MaiTroll
            evolves.
          </p>
        </div>
      </main>
    </div>
  )
}