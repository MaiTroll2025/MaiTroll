import React from 'react'
import { Link } from 'react-router-dom'
import SEOLayout, { Breadcrumb } from './SEOLayout'
import { AlertTriangle, Copyright, CreditCard, FileText, Gavel, Mail, Scale, ShieldCheck, UserCheck } from 'lucide-react';

export default function TermsPage() {
  return (
    <SEOLayout
      title="Terms of Service | MAiTROLL"
      description="Read the MAiTROLL Terms of Service covering educational verification, MAi Business, broadcasting, MAi Pay, Troll Coins, School Battles, School Pool, accounts, content, safety, and platform rules."
      keywords={[
        'MAiTROLL terms of service',
        'MAiTROLL terms',
        'MAiTROLL rules',
        'MAiTROLL student platform',
        'MAi Business',
        'School Battle',
        'School Pool',
        'MAi Pay',
        'Troll Coins',
        'broadcasting',
        'student entrepreneurship',
        'platform rules',
        'account rules',
      ]}
    >
      <Breadcrumb items={[{ label: 'Terms of Service' }]} />

      <main className="max-w-5xl mx-auto px-4 py-12">
        {/* Hero */}
        <section className="mb-12">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/20">
              <Scale className="w-7 h-7 text-purple-400" />
            </div>

            <div>
              <p className="text-sm text-purple-400 font-semibold uppercase tracking-wider">
                Legal
              </p>
              <h1 className="text-4xl md:text-5xl font-bold text-white">
                Terms of Service
              </h1>
            </div>
          </div>

          <p className="text-slate-300 text-lg leading-relaxed max-w-4xl">
            These Terms of Service govern your access to and use of MAiTROLL,
            including its website, applications, virtual city systems,
            broadcasting features, educational verification, business
            features, marketplace, payments, School Battles, School Pool,
            communications, and related services.
          </p>

          <p className="text-sm text-slate-500 mt-4">
            Last updated: September 13, 2026
          </p>
        </section>

        {/* Important Notice */}
        <section className="mb-10 rounded-2xl border border-purple-500/20 bg-purple-500/5 p-6">
          <div className="flex gap-4">
            <FileText className="w-6 h-6 text-purple-400 shrink-0 mt-1" />

            <div>
              <h2 className="text-xl font-bold text-white mb-3">
                Please Read These Terms
              </h2>

              <p className="text-slate-300 leading-relaxed">
                By creating an account, accessing MAiTROLL, or using any MAiTROLL
                service, you agree to these Terms of Service and any additional
                rules that specifically apply to the feature you use.
              </p>

              <p className="text-slate-300 leading-relaxed mt-3">
                If you do not agree with these Terms, do not create an account
                or use MAiTROLL.
              </p>
            </div>
          </div>
        </section>

        {/* What These Terms Cover */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-white mb-4">
            1. What These Terms Cover
          </h2>

          <p className="text-slate-300 leading-relaxed mb-4">
            MAiTROLL is a virtual city designed to bring together education,
            entrepreneurship, broadcasting, commerce, community, entertainment,
            and civic-style systems in one digital environment.
          </p>

          <p className="text-slate-300 leading-relaxed mb-4">
            These Terms apply to your use of MAiTROLL services, including where
            available:
          </p>

          <div className="grid sm:grid-cols-2 gap-3">
            {[
              'MAiTROLL website and web applications',
              'Mobile applications and supported devices',
              'Student and instructor accounts',
              'Educational verification',
              'MAi Business',
              'Broadcasting and HytroGaming',
              'Troll Pods and podcast features',
              'Troll Coins and virtual items',
              'MAi Pay and cashout services',
              'School Battles',
              'School Pool',
              'Marketplace and commerce systems',
              'Troll Court and civic systems',
              'City Hall and government systems',
              'Community and messaging features',
              'Transportation and vehicle systems',
              'Properties and virtual city systems',
              'Events, competitions, and other MAiTROLL features',
            ].map((item) => (
              <div
                key={item}
                className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 text-slate-300"
              >
                {item}
              </div>
            ))}
          </div>
        </section>

        {/* Eligibility */}
        <section className="mb-12">
          <div className="flex items-center gap-3 mb-4">
            <UserCheck className="w-6 h-6 text-purple-400" />
            <h2 className="text-2xl font-bold text-white">
              2. Account Eligibility
            </h2>
          </div>

          <p className="text-slate-300 leading-relaxed mb-4">
            You must provide accurate information when creating and maintaining
            your MAiTROLL account. You are responsible for maintaining the
            security of your account and for activity conducted through it.
          </p>

          <ul className="space-y-3 text-slate-300 list-disc pl-6">
            <li>You may not impersonate another person.</li>
            <li>
              You may not create an account using another person&apos;s identity,
              credentials, or personal information.
            </li>
            <li>
              You may not sell, rent, lease, transfer, or otherwise provide
              control of your account to another person.
            </li>
            <li>
              You may not use duplicate accounts to evade restrictions,
              enforcement actions, financial controls, or platform limits.
            </li>
            <li>
              You are responsible for protecting your login credentials and
              notifying MAiTROLL of suspected unauthorized access.
            </li>
          </ul>
        </section>

        {/* Education */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-white mb-4">
            3. Educational Accounts and Verification
          </h2>

          <p className="text-slate-300 leading-relaxed mb-4">
            MAiTROLL supports educational users, including eligible students
            and instructors. Educational access is subject to verification.
          </p>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 mb-5">
            <h3 className="text-lg font-semibold text-white mb-3">
              Educational verification may require:
            </h3>

            <ol className="space-y-3 text-slate-300 list-decimal pl-6">
              <li>
                Selecting an institution that exists in MAiTROLL&apos;s verified
                institution system.
              </li>
              <li>
                Providing an institutional email address associated with the
                selected institution.
              </li>
              <li>
                Completing required MAiTROLL and Supabase email confirmation.
              </li>
              <li>
                Passing MAiTROLL&apos;s institution and domain verification process.
              </li>
            </ol>
          </div>

          <p className="text-slate-300 leading-relaxed">
            A user may not enter an arbitrary school name and treat that school
            as verified. MAiTROLL may reject, suspend, expire, or request
            additional verification when educational information cannot be
            validated.
          </p>
        </section>

        {/* MAi Business */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-white mb-4">
            4. MAi Business Eligibility
          </h2>

          <div className="rounded-2xl border border-purple-500/20 bg-purple-500/5 p-6">
            <h3 className="text-xl font-bold text-white mb-3">
              MAi Business is restricted access.
            </h3>

            <p className="text-slate-300 leading-relaxed mb-4">
              A regular or non-student MAiTROLL user may not access MAi Business
              merely by creating a MAiTROLL account.
            </p>

            <p className="text-slate-300 leading-relaxed mb-4">
              Access to MAi Business requires the user&apos;s MAiTROLL account to
              qualify as an eligible verified educational account under
              MAiTROLL&apos;s current eligibility requirements.
            </p>

            <p className="text-slate-300 leading-relaxed">
              If a regular user later enrolls in a qualifying college,
              university, trade school, or other eligible educational
              institution, the user must complete the applicable MAiTROLL
              verification/support process before MAi Business access is
              granted.
            </p>
          </div>
        </section>

        {/* Regular Users */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-white mb-4">
            5. Regular Users and Administration Fee
          </h2>

          <p className="text-slate-300 leading-relaxed mb-4">
            MAiTROLL may allow regular users who do not qualify for educational
            verification to create accounts subject to the rules applicable to
            regular users.
          </p>

          <p className="text-slate-300 leading-relaxed mb-4">
            Where applicable, a regular-user account requires a{' '}
            <strong className="text-white">$1.00 administration fee</strong>
            paid directly through PayPal.
          </p>

          <ul className="space-y-3 text-slate-300 list-disc pl-6">
            <li>
              The administration fee is a real-money payment and is separate
              from Troll Coins.
            </li>
            <li>
              The fee is processed through PayPal or another payment flow
              specifically identified by MAiTROLL.
            </li>
            <li>
              A failed or declined required administration payment may prevent
              account completion.
            </li>
            <li>
              Where technically and legally applicable, MAiTROLL may remove
              incomplete account records associated with an unsuccessful
              required payment.
            </li>
            <li>
              Administration-fee revenue may be earmarked for MAiTROLL&apos;s School
              Pool Funding Reserve.
            </li>
          </ul>
        </section>

        {/* Conduct */}
        <section className="mb-12">
          <div className="flex items-center gap-3 mb-4">
            <ShieldCheck className="w-6 h-6 text-purple-400" />
            <h2 className="text-2xl font-bold text-white">
              6. Acceptable Use and Conduct
            </h2>
          </div>

          <p className="text-slate-300 leading-relaxed mb-5">
            MAiTROLL is intended to be used for constructive participation,
            education, entrepreneurship, creativity, communication, commerce,
            broadcasting, and community activity.
          </p>

          <p className="text-slate-300 leading-relaxed mb-4">
            You may not use MAiTROLL to:
          </p>

          <ul className="space-y-3 text-slate-300 list-disc pl-6">
            <li>Commit, promote, or facilitate illegal activity.</li>
            <li>Threaten, harass, stalk, or intentionally intimidate others.</li>
            <li>Exploit, endanger, or sexually exploit minors.</li>
            <li>Conduct scams, fraud, financial manipulation, or deception.</li>
            <li>
              Manipulate Gifts, Troll Coins, battles, viewers, rankings, School
              Battles, School Pool activity, or other platform systems.
            </li>
            <li>
              Self-gift, artificially inflate activity, or otherwise manipulate
              economic or engagement metrics.
            </li>
            <li>
              Attempt unauthorized access to accounts, systems, databases, or
              administrative functions.
            </li>
            <li>Deploy malware or malicious code.</li>
            <li>Use unauthorized bots or automation to abuse the service.</li>
            <li>Scrape or systematically extract MAiTROLL data without authorization.</li>
            <li>Impersonate MAiTROLL, MAi Corp, employees, officers, or users.</li>
            <li>Infringe intellectual-property rights.</li>
            <li>
              Abuse reporting, appeals, chargebacks, moderation, or Troll Court
              processes.
            </li>
          </ul>
        </section>

        {/* Content */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-white mb-4">
            7. User Content
          </h2>

          <p className="text-slate-300 leading-relaxed mb-4">
            You retain ownership of content that you lawfully own and upload,
            publish, stream, transmit, or otherwise provide through MAiTROLL.
          </p>

          <p className="text-slate-300 leading-relaxed mb-4">
            By submitting content to MAiTROLL, you grant MAiTROLL a worldwide,
            non-exclusive, royalty-free license to host, store, reproduce,
            process, transmit, display, perform, format, adapt, and technically
            modify that content as reasonably necessary to operate, secure,
            maintain, and provide the MAiTROLL service.
          </p>

          <p className="text-slate-300 leading-relaxed">
            This may include technical processing required for livestreams,
            video playback, thumbnails, captions, previews, recordings,
            moderation, backups, device compatibility, and other platform
            functionality.
          </p>

          <p className="text-slate-300 leading-relaxed mt-4">
            MAiTROLL does not obtain ownership of your content merely because
            you use the platform.
          </p>
        </section>

        {/* IP */}
        <section className="mb-12">
          <div className="flex items-center gap-3 mb-4">
            <Copyright className="w-6 h-6 text-purple-400" />
            <h2 className="text-2xl font-bold text-white">
              8. MAiTROLL Intellectual Property
            </h2>
          </div>

          <p className="text-slate-300 leading-relaxed mb-4">
            MAiTROLL&apos;s software, branding, logos, designs, interfaces, systems,
            graphics, databases, original text, city concepts, features, and
            other platform materials are owned by or licensed to MAiTROLL and
            are protected by applicable intellectual-property laws.
          </p>

          <p className="text-slate-300 leading-relaxed">
            Except as expressly permitted by MAiTROLL, you may not copy,
            reproduce, distribute, reverse engineer, modify, sell, sublicense,
            or commercially exploit MAiTROLL&apos;s proprietary materials.
          </p>
        </section>

        {/* Coins */}
        <section className="mb-12">
          <div className="flex items-center gap-3 mb-4">
            <CreditCard className="w-6 h-6 text-purple-400" />
            <h2 className="text-2xl font-bold text-white">
              9. Troll Coins, Gifts, and Virtual Items
            </h2>
          </div>

          <p className="text-slate-300 leading-relaxed mb-4">
            Troll Coins and other virtual items are digital platform units
            governed by MAiTROLL&apos;s current systems and rules. Unless expressly
            stated otherwise, they are not legal tender, bank deposits,
            securities, cryptocurrency, or a personal bank balance.
          </p>

          <ul className="space-y-3 text-slate-300 list-disc pl-6">
            <li>
              Troll Coins may be purchased, awarded, earned, gifted, or
              otherwise granted according to MAiTROLL rules.
            </li>
            <li>
              Virtual items do not automatically guarantee earnings, prizes,
              wins, cashouts, or any particular financial result.
            </li>
            <li>
              Gifts and virtual transactions may be final where the applicable
              transaction flow states that they are non-refundable.
            </li>
            <li>
              Promotional, administrative, testing, or bonus credits may have
              different restrictions.
            </li>
            <li>
              MAiTROLL may modify virtual-item pricing, availability, rewards,
              limits, or economic structures when reasonably necessary to
              operate the service.
            </li>
          </ul>
        </section>

        {/* MAi Pay */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-white mb-4">
            10. MAi Pay, Cashouts, and Financial Transactions
          </h2>

          <p className="text-slate-300 leading-relaxed mb-4">
            MAi Pay is MAiTROLL&apos;s applicable financial and cashout system.
            Eligibility, verification, minimum requirements, timing, payment
            methods, account standing, and other requirements may apply before
            a cashout can be processed.
          </p>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 mb-5">
            <h3 className="text-lg font-semibold text-white mb-3">
              Current MAi Pay conversion
            </h3>

            <p className="text-2xl font-bold text-purple-400">
              150 Troll Coins = $1 USD
            </p>

            <p className="text-slate-400 mt-2 text-sm">
              This conversion applies to the current MAi Pay cashout system and
              should not be confused with Coin Store purchase pricing or
              promotional coin packages.
            </p>
          </div>

          <ul className="space-y-3 text-slate-300 list-disc pl-6">
            <li>
              Only eligible balances may qualify for cashout.
            </li>
            <li>
              Administrative, promotional, test, or restricted balances may
              not be withdrawable.
            </li>
            <li>
              Identity, tax, payment, fraud, or account verification may be
              required.
            </li>
            <li>
              Cashouts may be delayed when additional review is required.
            </li>
            <li>
              Fraudulent, manipulated, reversed, or unauthorized transactions
              may be reversed or withheld.
            </li>
            <li>
              Users are responsible for applicable taxes and charges imposed by
              their financial institution, payment provider, government, or
              jurisdiction.
            </li>
          </ul>

          <p className="text-slate-300 leading-relaxed mt-5">
            MAiTROLL may maintain financial records and transaction histories
            necessary to operate, reconcile, secure, and legally document
            payments and cashouts.
          </p>
        </section>

        {/* School Battles */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-white mb-4">
            11. School Battles
          </h2>

          <p className="text-slate-300 leading-relaxed mb-4">
            School Battles allow eligible users to represent a verified
            educational institution within applicable MAiTROLL battle systems.
          </p>

          <ul className="space-y-3 text-slate-300 list-disc pl-6">
            <li>
              A represented school must come from MAiTROLL&apos;s verified
              institution system.
            </li>
            <li>
              Users may not simply type an arbitrary school and establish it as
              their verified representation.
            </li>
            <li>
              School identity is tied to the user&apos;s authenticated and verified
              educational information.
            </li>
            <li>
              MAiTROLL may reject or remove invalid school representation.
            </li>
            <li>
              Existing battle functionality, including timers, matchmaking,
              broadcasters, viewers, gifts, XP, chat, effects, and winner
              determination, remains governed by the applicable battle rules.
            </li>
          </ul>
        </section>

        {/* School Pool */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-white mb-4">
            12. School Pool
          </h2>

          <p className="text-slate-300 leading-relaxed mb-4">
            The School Pool is a MAiTROLL financial program designed to
            accumulate eligible school contributions and support participating
            educational institutions.
          </p>

          <p className="text-slate-300 leading-relaxed mb-4">
            School Pool amounts are maintained separately from individual user
            Troll Coin balances and are not a user&apos;s personal wallet balance.
          </p>

          <div className="rounded-2xl border border-purple-500/20 bg-purple-500/5 p-6 mb-5">
            <h3 className="text-lg font-semibold text-white mb-3">
              School contribution calculation
            </h3>

            <p className="text-slate-300 leading-relaxed">
              Where the School Pool program applies a 5% contribution to
              eligible School Battle activity, the contribution is calculated
              in USD using the applicable MAi Pay cashout conversion. The
              School Pool does not use Coin Store pricing to determine this
              amount.
            </p>
          </div>

          <p className="text-slate-300 leading-relaxed mb-4">
            MAiTROLL may also earmark applicable MAi Pay cashout fees and
            qualifying regular-user administration fees for the School Pool
            Funding Reserve.
          </p>

          <p className="text-slate-300 leading-relaxed">
            School Pool obligations, available funding, settlements, and actual
            institutional payments may be maintained as separate accounting
            records. A displayed School Pool amount does not necessarily mean
            that a school has already received a payment.
          </p>
        </section>

        {/* Auctions / Marketplace */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-white mb-4">
            13. Marketplace, Sales, Auctions, and User Transactions
          </h2>

          <p className="text-slate-300 leading-relaxed mb-4">
            Certain MAiTROLL features may allow users to list, sell, purchase,
            auction, trade, or otherwise interact with goods, services, or
            virtual-city assets.
          </p>

          <p className="text-slate-300 leading-relaxed mb-4">
            Users are responsible for ensuring that their listings and
            transactions comply with applicable laws and MAiTROLL rules.
          </p>

          <p className="text-slate-300 leading-relaxed">
            MAiTROLL may restrict, remove, cancel, investigate, or suspend
            transactions that appear fraudulent, abusive, unlawful, unsafe, or
            inconsistent with platform rules.
          </p>
        </section>

        {/* Third Parties / Privacy */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-white mb-4">
            14. Payment and Technical Infrastructure
          </h2>

          <p className="text-slate-300 leading-relaxed mb-4">
            MAiTROLL relies on technical infrastructure and specialized
            services necessary to operate the platform, including hosting,
            databases, authentication, communications, video, realtime
            infrastructure, storage, and payment processing.
          </p>

          <p className="text-slate-300 leading-relaxed mb-4">
            PayPal may receive information necessary to process applicable
            payments. Such processing does not mean MAiTROLL sells your
            personal information.
          </p>

          <p className="text-slate-300 leading-relaxed">
            MAiTROLL does not sell, rent, trade, or commercially monetize user
            personal information to third-party advertisers, data brokers, or
            other companies for their independent commercial purposes. Technical
            infrastructure may process information only as necessary to provide
            MAiTROLL&apos;s services.
          </p>

          <p className="text-slate-300 leading-relaxed mt-4">
            For additional information, review the{' '}
            <Link
              to="/privacy"
              className="text-purple-400 hover:text-purple-300"
            >
              MAiTROLL Privacy Policy
            </Link>
            .
          </p>
        </section>

        {/* Reporting */}
        <section className="mb-12">
          <div className="flex items-center gap-3 mb-4">
            <ShieldCheck className="w-6 h-6 text-purple-400" />
            <h2 className="text-2xl font-bold text-white">
              15. Reporting, Moderation, and Enforcement
            </h2>
          </div>

          <p className="text-slate-300 leading-relaxed mb-4">
            MAiTROLL may investigate suspected violations of these Terms,
            applicable laws, platform rules, financial abuse, security
            incidents, fraud, manipulation, or other harmful conduct.
          </p>

          <p className="text-slate-300 leading-relaxed mb-4">
            Depending on the circumstances, MAiTROLL may:
          </p>

          <ul className="space-y-3 text-slate-300 list-disc pl-6">
            <li>Remove or restrict content.</li>
            <li>Restrict specific features.</li>
            <li>Freeze or review financial activity.</li>
            <li>Remove battle or marketplace participation.</li>
            <li>Suspend an account.</li>
            <li>Terminate an account.</li>
            <li>Preserve information necessary for security or legal reasons.</li>
            <li>Refer matters to appropriate authorities where required.</li>
          </ul>

          <p className="text-slate-300 leading-relaxed mt-5">
            MAiTROLL may also maintain internal moderation, officer, reporting,
            appeal, and Troll Court systems as part of the platform&apos;s governance
            structure.
          </p>
        </section>

        {/* Copyright */}
        <section className="mb-12">
          <div className="flex items-center gap-3 mb-4">
            <Copyright className="w-6 h-6 text-purple-400" />
            <h2 className="text-2xl font-bold text-white">
              16. Copyright Complaints
            </h2>
          </div>

          <p className="text-slate-300 leading-relaxed mb-4">
            If you believe content available through MAiTROLL infringes your
            copyright, you may submit a copyright complaint containing
            sufficient information for MAiTROLL to evaluate the claim.
          </p>

          <p className="text-slate-300 leading-relaxed mb-4">
            Do not submit false or knowingly misleading copyright claims.
          </p>

          <p className="text-slate-300 leading-relaxed">
            Until MAiTROLL formally identifies a designated copyright agent,
            users should contact MAiTROLL through its current support/contact
            channels regarding copyright concerns.
          </p>
        </section>

        {/* Account termination */}
        <section className="mb-12">
          <div className="flex items-center gap-3 mb-4">
            <AlertTriangle className="w-6 h-6 text-purple-400" />
            <h2 className="text-2xl font-bold text-white">
              17. Account Suspension and Termination
            </h2>
          </div>

          <p className="text-slate-300 leading-relaxed mb-4">
            You may stop using MAiTROLL at any time. MAiTROLL may suspend or
            terminate access when reasonably necessary to protect users,
            platform security, financial systems, legal compliance, or the
            integrity of MAiTROLL.
          </p>

          <p className="text-slate-300 leading-relaxed">
            Termination does not automatically eliminate obligations that by
            their nature should survive termination, including applicable
            payment obligations, intellectual-property provisions, dispute
            provisions, limitations of liability, and legally required record
            retention.
          </p>
        </section>

        {/* Account deletion */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-white mb-4">
            18. Account Deletion
          </h2>

          <p className="text-slate-300 leading-relaxed mb-4">
            Where account deletion is available, users may request deletion of
            their MAiTROLL account through the applicable account or support
            process.
          </p>

          <p className="text-slate-300 leading-relaxed">
            Certain information may remain for a limited period when necessary
            for legal compliance, fraud prevention, financial reconciliation,
            security, dispute resolution, backups, or other legitimate
            operational purposes.
          </p>
        </section>

        {/* Disclaimer */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-white mb-4">
            19. Disclaimers
          </h2>

          <p className="text-slate-300 leading-relaxed mb-4">
            MAiTROLL is provided on an “as available” and “as is” basis to the
            extent permitted by applicable law.
          </p>

          <p className="text-slate-300 leading-relaxed mb-4">
            MAiTROLL does not guarantee uninterrupted availability, error-free
            operation, continuous broadcasting, uninterrupted payment
            processing, or that every feature will remain available
            indefinitely.
          </p>

          <p className="text-slate-300 leading-relaxed">
            Participation in battles, broadcasting, marketplace activity,
            School Battles, entrepreneurship features, or other MAiTROLL
            programs does not guarantee income, employment, business success,
            educational outcomes, prizes, or financial returns.
          </p>
        </section>

        {/* Liability */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-white mb-4">
            20. Limitation of Liability
          </h2>

          <p className="text-slate-300 leading-relaxed mb-4">
            To the maximum extent permitted by applicable law, MAiTROLL and its
            owners, officers, employees, contractors, and service providers
            will not be liable for indirect, incidental, consequential,
            special, exemplary, or punitive damages arising from your use of
            the service.
          </p>

          <p className="text-slate-300 leading-relaxed">
            Nothing in these Terms is intended to exclude liability that cannot
            legally be excluded under applicable law.
          </p>
        </section>

        {/* Indemnification */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-white mb-4">
            21. Indemnification
          </h2>

          <p className="text-slate-300 leading-relaxed">
            To the extent permitted by applicable law, you agree to defend,
            indemnify, and hold harmless MAiTROLL and its applicable owners,
            officers, employees, contractors, and agents from claims,
            liabilities, damages, losses, and expenses arising from your
            unlawful conduct, violation of these Terms, infringement of another
            person&apos;s rights, or misuse of the service.
          </p>
        </section>

        {/* Governing law */}
        <section className="mb-12">
          <div className="flex items-center gap-3 mb-4">
            <Gavel className="w-6 h-6 text-purple-400" />
            <h2 className="text-2xl font-bold text-white">
              22. Governing Law and Disputes
            </h2>
          </div>

          <p className="text-slate-300 leading-relaxed mb-4">
            These Terms are subject to the laws of the jurisdiction applicable
            to MAiTROLL, without regard to conflict-of-law principles, except
            where applicable law requires otherwise.
          </p>

          <p className="text-slate-300 leading-relaxed">
            Any specific governing state, county, venue, arbitration provision,
            or class-action waiver should be inserted only after being reviewed
            and approved for MAiTROLL by qualified legal counsel.
          </p>
        </section>

        {/* Changes */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-white mb-4">
            23. Changes to These Terms
          </h2>

          <p className="text-slate-300 leading-relaxed">
            MAiTROLL may update these Terms when necessary to reflect changes
            to the service, business model, technology, laws, security
            requirements, payment systems, or platform rules. The updated
            version will identify its effective or last-updated date.
          </p>
        </section>

        {/* General */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-white mb-4">
            24. General Legal Terms
          </h2>

          <p className="text-slate-300 leading-relaxed mb-4">
            If any provision of these Terms is determined to be unenforceable,
            the remaining provisions will remain effective to the extent
            permitted by law.
          </p>

          <p className="text-slate-300 leading-relaxed">
            Failure by MAiTROLL to enforce a provision does not constitute a
            waiver of the right to enforce that provision later.
          </p>
        </section>

        {/* Contact */}
        <section className="rounded-2xl border border-purple-500/20 bg-purple-500/5 p-6 md:p-8">
          <div className="flex items-start gap-4">
            <Mail className="w-7 h-7 text-purple-400 shrink-0 mt-1" />

            <div>
              <h2 className="text-2xl font-bold text-white mb-3">
                Contact MAiTROLL
              </h2>

              <p className="text-slate-300 leading-relaxed mb-4">
                If you have questions about these Terms, educational
                verification, MAi Business eligibility, MAi Pay, School
                Battles, School Pool, account rules, or other MAiTROLL legal
                matters, contact us at{' '}
                <a
                  href="mailto:ceo@maitroll.com"
                  className="text-purple-400 hover:text-purple-300"
                  aria-label="Email MAiTROLL at ceo@maitroll.com"
                >
                  ceo@maitroll.com
                </a>{' '}
                or visit our{' '}
                <Link
                  to="/contact"
                  className="text-purple-400 hover:text-purple-300"
                >
                  Contact page
                </Link>
                .
              </p>

              <p className="text-sm text-slate-500">
                MAiTROLL reserves the right to update these Terms as the city,
                business systems, payment infrastructure, educational programs,
                and services evolve.
              </p>
            </div>
          </div>
        </section>
      </main>
    </SEOLayout>
  )
}