import React from 'react'
import { Link } from 'react-router-dom'
import SEOLayout, { Breadcrumb } from './SEOLayout'
import {
  AlertTriangle,
  Copyright,
  CreditCard,
  FileText,
  Gavel,
  Mail,
  Scale,
  ShieldCheck,
  UserCheck,
  Users,
} from 'lucide-react'

export default function TermsPage() {
  return (
    <SEOLayout
      title="Terms of Service | Mai Troll"
      description="Read the Mai Troll Terms of Service, including account, content, payment, creator earnings, enforcement, and platform rules."
      keywords={[
        'MaiTroll terms of service',
        'MaiMaiTroll terms',
        'user agreement',
        'terms and conditions',
        'creator platform terms',
        'MaiTroll rules',
        'platform rules',
      ]}
    >
      <Breadcrumb items={[{ label: 'Terms of Service' }]} />

      <section className="relative py-20 lg:py-24 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-900/20 via-slate-900 to-pink-900/20" />

        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-purple-600/20 border border-purple-500/30 text-purple-300 text-sm font-medium mb-6">
              <FileText className="w-4 h-4" />
              Legal
            </div>

            <h1 className="text-4xl md:text-5xl font-bold text-white mb-6 leading-tight">
              Terms of{' '}
              <span className="bg-gradient-to-r from-purple-400 via-pink-400 to-purple-400 bg-clip-text text-transparent">
                Service
              </span>
            </h1>

            <p className="text-slate-400">Last updated: July 12, 2026</p>
          </div>
        </div>
      </section>

      <section className="py-12">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="space-y-8">

            <div className="p-6 bg-purple-950/30 border border-purple-500/30 rounded-2xl">
              <p className="text-slate-200 leading-relaxed">
                Welcome to Mai Troll. These Terms of Service are the agreement between you and
                <strong> [INSERT LEGAL COMPANY NAME]</strong>, the company that operates Mai Troll
                and its related services.
              </p>

              <p className="text-slate-300 leading-relaxed mt-4">
                We wrote these Terms in plain English because you should not need a law degree to
                understand the platform you are using. The legal part still matters, though. By
                creating an account, clicking to accept these Terms, or continuing to use Troll
                City, you agree to follow them.
              </p>

              <p className="text-slate-300 leading-relaxed mt-4">
                If you do not agree, do not create an account, purchase Troll Coins, send Gifts,
                broadcast, request a cashout, or otherwise use the Platform.
              </p>
            </div>

            <div className="p-6 bg-slate-900/50 border border-slate-800 rounded-2xl">
              <div className="flex items-center gap-3 mb-4">
                <Users className="w-6 h-6 text-purple-400" />
                <h2 className="text-2xl font-bold text-white m-0">
                  What These Terms Cover
                </h2>
              </div>

              <p className="text-slate-300 leading-relaxed">
                These Terms apply to Mai Troll websites, applications, progressive web apps,
                livestreams, chats, battles, collaborations, auctions, Troll Court features,
                HytroGaming integrations, virtual items, creator tools, staff tools, and any other
                Mai Troll service that links to these Terms.
              </p>

              <p className="text-slate-300 leading-relaxed mt-4">
                Some features have additional rules. Those rules are part of this agreement when
                you use the related feature.
              </p>

              <div className="flex flex-wrap gap-3 mt-5">
                <Link
                  to="/community-guidelines"
                  className="text-purple-400 hover:text-purple-300 underline underline-offset-4"
                >
                  Community Guidelines
                </Link>

                <Link
                  to="/privacy"
                  className="text-purple-400 hover:text-purple-300 underline underline-offset-4"
                >
                  Privacy Policy
                </Link>

                <Link
                  to="/refund-policy"
                  className="text-purple-400 hover:text-purple-300 underline underline-offset-4"
                >
                  Refund Policy
                </Link>

                <Link
                  to="/cashout-rules"
                  className="text-purple-400 hover:text-purple-300 underline underline-offset-4"
                >
                  Cashout Rules
                </Link>

                <Link
                  to="/broadcaster-rules"
                  className="text-purple-400 hover:text-purple-300 underline underline-offset-4"
                >
                  Broadcaster Rules
                </Link>
              </div>
            </div>

            <div className="p-6 bg-slate-900/50 border border-slate-800 rounded-2xl">
              <div className="flex items-center gap-3 mb-4">
                <UserCheck className="w-6 h-6 text-purple-400" />
                <h2 className="text-2xl font-bold text-white m-0">
                  Eligibility and Account Registration
                </h2>
              </div>

              <ul className="list-disc pl-6 space-y-3 text-slate-300">
                <li>
                  You must be at least 13 years old to create a general Mai Troll account.
                </li>

                <li>
                  Certain features may require you to be at least 18 years old, including
                  broadcasting, purchasing or sending paid virtual items, receiving creator
                  earnings, requesting cashouts, entering binding commercial transactions, or
                  using age-restricted areas of the Platform.
                </li>

                <li>
                  We may require age or identity verification before allowing access to restricted
                  features.
                </li>

                <li>
                  You must provide accurate, current, and complete registration information.
                </li>

                <li>
                  Do not create an account using someone else's identity, documents, payment
                  method, or personal information.
                </li>

                <li>
                  You are responsible for protecting your password, authentication codes, devices,
                  and account access.
                </li>

                <li>
                  You are responsible for activity performed through your account unless you
                  promptly report unauthorized access and reasonably cooperate with our
                  investigation.
                </li>

                <li>
                  You may not sell, rent, transfer, or give your account to another person without
                  written approval from Mai Troll.
                </li>

                <li>
                  Mai Troll may limit duplicate or deceptive accounts. Multiple accounts are not
                  automatically prohibited when a legitimate Platform feature allows them, but
                  account farming, ban evasion, self-gifting schemes, reward manipulation, and
                  deceptive duplicate accounts are prohibited.
                </li>
              </ul>
            </div>

            <div className="p-6 bg-slate-900/50 border border-slate-800 rounded-2xl">
              <div className="flex items-center gap-3 mb-4">
                <AlertTriangle className="w-6 h-6 text-purple-400" />
                <h2 className="text-2xl font-bold text-white m-0">
                  Use the Platform Without Wrecking It
                </h2>
              </div>

              <p className="text-slate-300 leading-relaxed mb-4">
                Mai Troll is built for personality, jokes, debate, competition, creator culture,
                and people who are not afraid to speak freely. That does not mean anything goes.
              </p>

              <p className="text-slate-300 mb-3">You may not:</p>

              <ul className="list-disc pl-6 space-y-3 text-slate-300">
                <li>
                  Use the Platform to commit, promote, coordinate, or conceal illegal activity.
                </li>

                <li>
                  Make credible threats, encourage real-world violence, stalk users, expose private
                  information, or engage in targeted harassment prohibited by our Community
                  Guidelines.
                </li>

                <li>
                  Exploit, sexually endanger, groom, or otherwise harm a minor.
                </li>

                <li>
                  Upload or distribute illegal sexual content, non-consensual intimate content,
                  child sexual abuse material, or content that violates another person's privacy.
                </li>

                <li>
                  Scam users, fake transactions, reverse legitimate payments fraudulently, operate
                  pyramid schemes, or misrepresent goods, services, giveaways, or creator earnings.
                </li>

                <li>
                  Manipulate Gifts, coins, battles, viewer counts, achievements, levels, Troll
                  Tokens, cashouts, auctions, referrals, or other Platform systems.
                </li>

                <li>
                  Gift yourself through alternate accounts, coordinate circular gifting, or use
                  payment fraud to manufacture creator earnings or reward progress.
                </li>

                <li>
                  Access another person's account, staff tools, database records, streams, private
                  rooms, or systems without authorization.
                </li>

                <li>
                  Probe, scan, overload, attack, interfere with, or attempt to bypass Platform
                  security, rate limits, access controls, moderation tools, or technical
                  restrictions.
                </li>

                <li>
                  Introduce malware, destructive code, credential-stealing tools, automated abuse,
                  or other harmful technology.
                </li>

                <li>
                  Scrape, copy, harvest, or automatically collect Platform data except through an
                  authorized Mai Troll feature or written permission.
                </li>

                <li>
                  Use bots or scripts to fake activity, automate account actions, generate
                  fraudulent engagement, or gain an unfair advantage.
                </li>

                <li>
                  Impersonate another person, creator, company, staff member, moderator, officer,
                  or government entity.
                </li>

                <li>
                  Infringe copyrights, trademarks, publicity rights, privacy rights, or other legal
                  rights.
                </li>

                <li>
                  Abuse reports, chargebacks, appeals, moderation tools, Troll Court, or staff
                  processes to knowingly target an innocent user.
                </li>
              </ul>

              <p className="text-slate-400 leading-relaxed mt-5">
                Detailed conduct standards belong in the Community Guidelines. These Terms are not
                meant to turn every rude comment or heated argument into a legal essay.
              </p>
            </div>

            <div className="p-6 bg-slate-900/50 border border-slate-800 rounded-2xl">
              <div className="flex items-center gap-3 mb-4">
                <Copyright className="w-6 h-6 text-purple-400" />
                <h2 className="text-2xl font-bold text-white m-0">
                  Your Content and Your Rights
                </h2>
              </div>

              <p className="text-slate-300 leading-relaxed">
                You keep ownership of the original content you create and upload to Mai Troll.
                Posting it does not transfer your copyright to us.
              </p>

              <p className="text-slate-300 leading-relaxed mt-4">
                You are responsible for making sure you have the rights, licenses, releases, and
                permissions needed to upload, broadcast, display, perform, sell, or otherwise use
                your content.
              </p>

              <p className="text-slate-300 leading-relaxed mt-4">
                By uploading, posting, broadcasting, or otherwise submitting content, you grant
                Mai Troll a worldwide, non-exclusive, royalty-free, sublicensable, and
                transferable license to host, store, reproduce, process, adapt for technical
                delivery, transmit, display, perform, distribute, and promote that content for the
                purpose of operating, improving, securing, and marketing the Platform.
              </p>

              <p className="text-slate-300 leading-relaxed mt-4">
                This license includes creating thumbnails, previews, clips, recordings, captions,
                resized versions, blurred previews, promotional excerpts, and other technical
                versions needed to deliver Platform features.
              </p>

              <p className="text-slate-300 leading-relaxed mt-4">
                The license ends when your content is deleted from our active systems, except where
                continued storage or use is reasonably necessary for backups, legal compliance,
                fraud prevention, investigations, payment records, dispute resolution, or content
                already shared by others through an authorized Platform feature.
              </p>

              <p className="text-slate-300 leading-relaxed mt-4">
                You give Mai Troll permission to display your username, profile image, stream
                title, category, and related public account information alongside your content.
              </p>
            </div>

            <div className="p-6 bg-slate-900/50 border border-slate-800 rounded-2xl">
              <div className="flex items-center gap-3 mb-4">
                <ShieldCheck className="w-6 h-6 text-purple-400" />
                <h2 className="text-2xl font-bold text-white m-0">
                  Mai Troll Content and Technology
                </h2>
              </div>

              <p className="text-slate-300 leading-relaxed">
                Mai Troll's software, code, databases, interfaces, graphics, designs, trademarks,
                logos, original characters, branding, platform text, systems, and other proprietary
                materials belong to Mai Troll or its licensors.
              </p>

              <p className="text-slate-300 leading-relaxed mt-4">
                We give you a limited, personal, revocable, non-exclusive, non-transferable license
                to use the Platform as intended under these Terms.
              </p>

              <p className="text-slate-300 leading-relaxed mt-4">
                You may not copy, resell, reverse engineer, decompile, commercially exploit,
                reproduce, or create unauthorized derivative services from Mai Troll's
                proprietary technology except where applicable law does not allow that restriction.
              </p>
            </div>

            <div className="p-6 bg-slate-900/50 border border-slate-800 rounded-2xl">
              <div className="flex items-center gap-3 mb-4">
                <CreditCard className="w-6 h-6 text-purple-400" />
                <h2 className="text-2xl font-bold text-white m-0">
                  Troll Coins, Gifts, Troll Tokens, and Payments
                </h2>
              </div>

              <p className="text-slate-300 leading-relaxed">
                Mai Troll may offer virtual items and Platform balances, including Troll Coins,
                Gifts, Troll Tokens, rewards, achievements, promotional credits, or other digital
                benefits.
              </p>

              <ul className="list-disc pl-6 space-y-3 text-slate-300 mt-4">
                <li>
                  Troll Coins and other virtual items are licensed Platform features. They are not
                  legal tender, bank deposits, cryptocurrency, stored-value accounts, or property
                  usable outside Mai Troll.
                </li>

                <li>
                  Purchasing Troll Coins does not guarantee that you will receive creator earnings,
                  win a battle, obtain a refund, qualify for a cashout, or achieve any particular
                  result.
                </li>

                <li>
                  Gifts are voluntary digital interactions. Once properly completed, a Gift may be
                  final except where our Refund Policy, payment processor rules, or applicable law
                  requires otherwise.
                </li>

                <li>
                  Troll Tokens are promotional broadcaster rewards. They cannot be purchased,
                  gifted, transferred, sold, or redeemed directly for cash.
                </li>

                <li>
                  Troll Tokens may reduce the Troll Coin requirement for an eligible cashout under
                  the current Troll Token and Cashout Rules. They do not guarantee cashout approval.
                </li>

                <li>
                  Promotional balances, bonus coins, test credits, admin grants, and other limited
                  credits may be non-refundable, non-transferable, non-cashable, or subject to
                  expiration.
                </li>

                <li>
                  Prices, packages, reward requirements, exchange structures, cashout tiers, and
                  promotional offers may change. Changes will not be applied deceptively to a
                  completed purchase.
                </li>

                <li>
                  Before you authorize a purchase, we will display the applicable price and
                  material transaction information.
                </li>

                <li>
                  You authorize us and our payment processors to charge the payment method you
                  select.
                </li>

                <li>
                  You are responsible for taxes, carrier charges, bank charges, currency conversion
                  costs, and other third-party costs that apply to your activity unless Mai Troll
                  expressly agrees otherwise.
                </li>

                <li>
                  Fraudulent payments, unauthorized payment methods, abusive chargebacks, or
                  manipulated transactions may result in reversal of virtual items, account
                  restrictions, withheld cashouts, or account termination.
                </li>
              </ul>
            </div>

            <div className="p-6 bg-slate-900/50 border border-slate-800 rounded-2xl">
              <div className="flex items-center gap-3 mb-4">
                <Scale className="w-6 h-6 text-purple-400" />
                <h2 className="text-2xl font-bold text-white m-0">
                  Creator Earnings and Cashouts
                </h2>
              </div>

              <p className="text-slate-300 leading-relaxed">
                Creator balances and projected earnings are not final until Mai Troll verifies the
                underlying activity and approves the related cashout.
              </p>

              <ul className="list-disc pl-6 space-y-3 text-slate-300 mt-4">
                <li>
                  Cashouts are available only to eligible users who satisfy applicable age,
                  identity, tax, account-standing, minimum-balance, level, scheduling, and
                  verification requirements.
                </li>

                <li>
                  Mai Troll may require identity verification, tax information, payment details,
                  proof of account ownership, or additional fraud-prevention checks.
                </li>

                <li>
                  Cashout timing may depend on user level, Fast Pay eligibility, payment processor
                  availability, manual review, weekends, holidays, security checks, and technical
                  conditions.
                </li>

                <li>
                  Mai Troll's current cashout interface shows the total Troll Coin requirement for
                  each cashout tier.
                </li>

                <li>
                  No separate cashout fee is deducted from the displayed cashout amount when the
                  applicable tier states that the user receives the full displayed amount.
                </li>

                <li>
                  Troll Tokens may reduce the required Troll Coins for a cashout but do not increase
                  the displayed cash payout.
                </li>

                <li>
                  We may delay, deny, reverse, or adjust a cashout connected to fraud, payment
                  reversals, self-gifting, circular gifting, stolen payment methods, bot activity,
                  duplicated transactions, manipulated Gifts, account compromise, sanctions
                  restrictions, or violations of these Terms.
                </li>

                <li>
                  We may correct obvious technical, accounting, or ledger errors. We will not
                  knowingly use error correction as an excuse to take legitimate verified earnings.
                </li>

                <li>
                  You are responsible for determining and paying taxes related to your creator
                  income. Mai Troll may issue tax documents or report payments when legally
                  required.
                </li>
              </ul>

              <p className="text-slate-400 leading-relaxed mt-5">
                The current cashout tiers, Fast Pay schedule, Troll Token reductions, review
                requirements, and payment procedures are explained on the{' '}
                <Link
                  to="/cashout-rules"
                  className="text-purple-400 hover:text-purple-300"
                >
                  Cashout Rules page
                </Link>
                .
              </p>
            </div>

            <div className="p-6 bg-slate-900/50 border border-slate-800 rounded-2xl">
              <div className="flex items-center gap-3 mb-4">
                <Gavel className="w-6 h-6 text-purple-400" />
                <h2 className="text-2xl font-bold text-white m-0">
                  Auctions, Sales, and User Transactions
                </h2>
              </div>

              <p className="text-slate-300 leading-relaxed">
                Mai Troll may provide tools that allow users to list items, host auctions, place
                bids, arrange shipping, communicate, or complete transactions with one another.
              </p>

              <ul className="list-disc pl-6 space-y-3 text-slate-300 mt-4">
                <li>
                  Unless Mai Troll expressly states otherwise, the seller—not Mai Troll—is
                  responsible for the item, description, condition, legality, authenticity,
                  packaging, shipping, tracking information, returns, and transaction promises.
                </li>

                <li>
                  Buyers are responsible for reviewing listings, bidding carefully, providing
                  accurate shipping information, and meeting applicable payment or confirmation
                  deadlines.
                </li>

                <li>
                  Users may not sell illegal, stolen, counterfeit, recalled, dangerous, restricted,
                  or prohibited items.
                </li>

                <li>
                  Mai Troll may cancel or restrict suspicious listings, bids, auctions, or orders
                  and may preserve records needed to investigate disputes.
                </li>

                <li>
                  Additional auction deadlines, cancellation rules, shipping requirements, and
                  seller obligations may apply through the Auction Rules.
                </li>
              </ul>
            </div>

            <div className="p-6 bg-slate-900/50 border border-slate-800 rounded-2xl">
              <div className="flex items-center gap-3 mb-4">
                <AlertTriangle className="w-6 h-6 text-purple-400" />
                <h2 className="text-2xl font-bold text-white m-0">
                  Enforcement, Restrictions, and Account Termination
                </h2>
              </div>

              <p className="text-slate-300 leading-relaxed">
                Mai Troll may investigate suspected violations and take action reasonably related
                to platform safety, fraud prevention, legal compliance, or enforcement of these
                Terms.
              </p>

              <p className="text-slate-300 leading-relaxed mt-4">
                Depending on the situation, action may include a warning, content removal, feature
                restriction, livestream removal, transaction hold, cashout review, temporary
                suspension, permanent account termination, device restriction, or another
                Platform-level consequence described in our rules.
              </p>

              <p className="text-slate-300 leading-relaxed mt-4">
                Mai Troll is not required to start with the lightest consequence when the conduct
                is severe, dangerous, fraudulent, illegal, or creates an immediate risk.
              </p>

              <p className="text-slate-300 leading-relaxed mt-4">
                Where an appeal process is available, you may challenge an enforcement decision
                through the applicable appeal, moderation review, or Troll Court process. An appeal
                does not automatically pause a safety restriction, payment hold, or account
                limitation.
              </p>

              <p className="text-slate-300 leading-relaxed mt-4">
                You may stop using Mai Troll at any time. Account deletion does not erase payment
                obligations, completed transactions, legal records, fraud records, unresolved
                disputes, or provisions of these Terms that are intended to survive termination.
              </p>
            </div>

            <div className="p-6 bg-slate-900/50 border border-slate-800 rounded-2xl">
              <h2 className="text-2xl font-bold text-white mb-4">
                Copyright Complaints
              </h2>

              <p className="text-slate-300 leading-relaxed">
                If you believe content on Mai Troll infringes your copyright, send a complete
                notice to our designated copyright contact:
              </p>

              <div className="mt-4 p-4 bg-slate-950/60 border border-slate-800 rounded-xl text-slate-300 space-y-1">
                <p>
                  <strong>DMCA Agent:</strong> [INSERT DESIGNATED AGENT NAME]
                </p>
                <p>
                  <strong>Company:</strong> [INSERT LEGAL COMPANY NAME]
                </p>
                <p>
                  <strong>Address:</strong> [INSERT MAILING ADDRESS]
                </p>
                <p>
                  <strong>Email:</strong>{' '}
                  <a
                    href="mailto:copyright@maiMaiTroll.com"
                    className="text-purple-400 hover:text-purple-300"
                  >
                    copyright@maiMaiTroll.com
                  </a>
                </p>
              </div>

              <p className="text-slate-400 leading-relaxed mt-4">
                Mai Troll may remove allegedly infringing material and may terminate repeat
                infringers where appropriate.
              </p>
            </div>

            <div className="p-6 bg-slate-900/50 border border-slate-800 rounded-2xl">
              <h2 className="text-2xl font-bold text-white mb-4">
                Third-Party Services
              </h2>

              <p className="text-slate-300 leading-relaxed">
                Mai Troll may rely on third-party services for payments, authentication, video,
                realtime communication, cloud hosting, storage, analytics, identity verification,
                email, notifications, or other infrastructure.
              </p>

              <p className="text-slate-300 leading-relaxed mt-4">
                Those providers may have their own terms and privacy practices. Mai Troll is not
                responsible for an independent third party's products, outages, actions, or
                policies, but we remain responsible for obligations the law places directly on us.
              </p>
            </div>

            <div className="p-6 bg-slate-900/50 border border-slate-800 rounded-2xl">
              <h2 className="text-2xl font-bold text-white mb-4">
                Feedback
              </h2>

              <p className="text-slate-300 leading-relaxed">
                We welcome suggestions, bug reports, feature ideas, and criticism. If you send us
                feedback without a separate written agreement, you allow Mai Troll to use it
                without restriction or payment to you.
              </p>

              <p className="text-slate-300 leading-relaxed mt-4">
                This does not transfer ownership of your separate copyrighted content, confidential
                business materials, or inventions covered by a written agreement.
              </p>
            </div>

            <div className="p-6 bg-slate-900/50 border border-slate-800 rounded-2xl">
              <h2 className="text-2xl font-bold text-white mb-4">
                Disclaimer of Warranties
              </h2>

              <p className="text-slate-300 leading-relaxed">
                To the fullest extent permitted by law, Mai Troll is provided on an “as is” and
                “as available” basis.
              </p>

              <p className="text-slate-300 leading-relaxed mt-4">
                We do not promise that every feature will always be available, uninterrupted,
                secure, error-free, compatible with every device, or free from data loss. We do not
                guarantee viewer counts, Gifts, earnings, cashout eligibility, audience growth,
                auction success, battle outcomes, creator partnerships, employment, or any other
                specific result.
              </p>

              <p className="text-slate-300 leading-relaxed mt-4">
                Some jurisdictions do not allow certain warranty exclusions, so some of these
                exclusions may not apply to you.
              </p>
            </div>

            <div className="p-6 bg-slate-900/50 border border-slate-800 rounded-2xl">
              <h2 className="text-2xl font-bold text-white mb-4">
                Limitation of Liability
              </h2>

              <p className="text-slate-300 leading-relaxed">
                To the fullest extent permitted by law, Mai Troll and its owners, affiliates,
                officers, employees, contractors, and service providers will not be liable for
                indirect, incidental, special, exemplary, punitive, or consequential damages,
                including lost profits, lost data, lost opportunities, reputational harm, or
                business interruption arising from your use of the Platform.
              </p>

              <p className="text-slate-300 leading-relaxed mt-4">
                To the fullest extent permitted by law, Mai Troll's total liability for claims
                arising out of or related to the Platform will not exceed the greater of:
              </p>

              <ul className="list-disc pl-6 space-y-2 text-slate-300 mt-3">
                <li>
                  the amount you paid directly to Mai Troll during the 12 months before the event
                  giving rise to the claim; or
                </li>
                <li>$100 USD.</li>
              </ul>

              <p className="text-slate-300 leading-relaxed mt-4">
                These limitations do not apply where applicable law does not permit them, including
                certain claims involving fraud, intentional misconduct, or personal injury.
              </p>
            </div>

            <div className="p-6 bg-slate-900/50 border border-slate-800 rounded-2xl">
              <h2 className="text-2xl font-bold text-white mb-4">
                Indemnification
              </h2>

              <p className="text-slate-300 leading-relaxed">
                To the extent permitted by law, you agree to defend, indemnify, and hold harmless
                Mai Troll, its affiliates, owners, officers, employees, and contractors from
                third-party claims, losses, liabilities, and reasonable legal costs arising from:
              </p>

              <ul className="list-disc pl-6 space-y-2 text-slate-300 mt-3">
                <li>your content;</li>
                <li>your products, auctions, listings, or transactions;</li>
                <li>your violation of these Terms;</li>
                <li>your violation of another person's rights; or</li>
                <li>your unlawful or fraudulent use of the Platform.</li>
              </ul>

              <p className="text-slate-400 leading-relaxed mt-4">
                This section does not require you to indemnify Mai Troll for Mai Troll's own
                unlawful conduct where such indemnification is prohibited.
              </p>
            </div>

            <div className="p-6 bg-slate-900/50 border border-slate-800 rounded-2xl">
              <div className="flex items-center gap-3 mb-4">
                <Scale className="w-6 h-6 text-purple-400" />
                <h2 className="text-2xl font-bold text-white m-0">
                  Governing Law and Disputes
                </h2>
              </div>

              <p className="text-slate-300 leading-relaxed">
                These Terms are governed by the laws of the State of{' '}
                <strong>[INSERT STATE]</strong>, without regard to conflict-of-law principles,
                except where federal law or the law of your location requires otherwise.
              </p>

              <p className="text-slate-300 leading-relaxed mt-4">
                Before filing a formal claim, you agree to contact us at{' '}
                <a
                  href="mailto:legal@maiMaiTroll.com"
                  className="text-purple-400 hover:text-purple-300"
                >
                  legal@maiMaiTroll.com
                </a>{' '}
                and give us at least 30 days to try to resolve the dispute informally.
              </p>

              <p className="text-slate-300 leading-relaxed mt-4">
                Any lawsuit that is not eligible for small claims court must be brought in the state
                or federal courts located in <strong>[INSERT COUNTY AND STATE]</strong>, and each
                party consents to that jurisdiction and venue.
              </p>

              <p className="text-amber-300/90 leading-relaxed mt-4">
                Do not add mandatory arbitration or a class-action waiver unless a qualified
                attorney prepares and reviews that section for your company and intended operating
                states.
              </p>
            </div>

            <div className="p-6 bg-slate-900/50 border border-slate-800 rounded-2xl">
              <h2 className="text-2xl font-bold text-white mb-4">
                Changes to the Platform or These Terms
              </h2>

              <p className="text-slate-300 leading-relaxed">
                Mai Troll will continue changing as features are added, removed, tested, repaired,
                or redesigned.
              </p>

              <p className="text-slate-300 leading-relaxed mt-4">
                We may update these Terms when the Platform, our business, or legal requirements
                change. If a change materially affects your rights, payments, creator earnings, or
                obligations, we may provide additional notice through the Platform, email, or
                another reasonable method.
              </p>

              <p className="text-slate-300 leading-relaxed mt-4">
                The updated date at the top tells you when the Terms were last revised. Continuing
                to use the Platform after the effective date means you accept the revised Terms.
                Where the law requires separate consent, we will request it.
              </p>
            </div>

            <div className="p-6 bg-slate-900/50 border border-slate-800 rounded-2xl">
              <h2 className="text-2xl font-bold text-white mb-4">
                General Legal Terms
              </h2>

              <ul className="list-disc pl-6 space-y-3 text-slate-300">
                <li>
                  These Terms and the policies incorporated into them make up the agreement between
                  you and Mai Troll regarding the Platform.
                </li>

                <li>
                  If part of these Terms is found unenforceable, the rest remains effective to the
                  fullest extent permitted by law.
                </li>

                <li>
                  Mai Troll's failure to enforce a provision once does not waive the right to
                  enforce it later.
                </li>

                <li>
                  You may not assign your rights or obligations under these Terms without our
                  written permission.
                </li>

                <li>
                  Mai Troll may assign these Terms as part of a merger, acquisition,
                  reorganization, financing, asset transfer, or transfer to an affiliate.
                </li>

                <li>
                  Headings are included to make the Terms easier to read and do not change their
                  legal meaning.
                </li>

                <li>
                  Sections concerning ownership, payments, creator earnings, liability,
                  indemnification, disputes, fraud records, and other provisions that logically
                  should survive will remain effective after account termination.
                </li>
              </ul>
            </div>

            <div className="p-6 bg-slate-900/50 border border-slate-800 rounded-2xl">
              <div className="flex items-center gap-3 mb-4">
                <Mail className="w-6 h-6 text-purple-400" />
                <h2 className="text-2xl font-bold text-white m-0">
                  Contact Us
                </h2>
              </div>

              <p className="text-slate-300 leading-relaxed">
                Questions about these Terms can be sent to:
              </p>

              <div className="mt-4 text-slate-300 space-y-2">
                <p>
                  <strong>Legal company:</strong> [INSERT LEGAL COMPANY NAME]
                </p>

                <p>
                  <strong>Mailing address:</strong> [INSERT BUSINESS MAILING ADDRESS]
                </p>

                <p>
                  <strong>Email:</strong>{' '}
                  <a
                    href="mailto:legal@maiMaiTroll.com"
                    className="text-purple-400 hover:text-purple-300"
                  >
                    legal@maiMaiTroll.com
                  </a>
                </p>

                <p>
                  <strong>Online:</strong>{' '}
                  <Link
                    to="/contact"
                    className="text-purple-400 hover:text-purple-300"
                  >
                    Contact page
                  </Link>
                </p>
              </div>
            </div>

          </div>
        </div>
      </section>
    </SEOLayout>
  )
}