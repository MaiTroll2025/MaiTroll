import React from 'react'
import { Link } from 'react-router-dom'
import SEOLayout, { Breadcrumb } from './SEOLayout'
import {
  Shield,
  Eye,
  Lock,
  Database,
  Cookie,
  Share2,
  Mail,
  GraduationCap,
  Building2,
  CreditCard,
  Landmark,
  Radio,
} from 'lucide-react'

export default function PrivacyPage() {
  return (
    <SEOLayout
      title="Privacy Policy | MAiTROLL"
      description="Read the MAiTROLL Privacy Policy. Learn how MAiTROLL collects, uses, protects, and handles your information across its educational, business, broadcasting, payment, and virtual city services."
      keywords={[
        'MAiTROLL privacy policy',
        'MAiTROLL privacy',
        'MAiTROLL data protection',
        'MAiTROLL personal information',
        'MAiTROLL student privacy',
        'MAiTROLL educational verification',
        'MAi Business privacy',
        'MAi Pay privacy',
        'MAiTROLL data collection',
        'MAiTROLL user data',
        'privacy policy',
        'data protection',
      ]}
    >
      <Breadcrumb items={[{ label: 'Privacy Policy' }]} />

      <section className="relative py-20 lg:py-24 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-900/20 via-slate-900 to-pink-900/20" />

        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-purple-600/20 border border-purple-500/30 text-purple-300 text-sm font-medium mb-6">
              <Shield className="w-4 h-4" />
              Legal & Privacy
            </div>

            <h1 className="text-4xl md:text-5xl font-bold text-white mb-6 leading-tight">
              Privacy{' '}
              <span className="bg-gradient-to-r from-purple-400 via-pink-400 to-purple-400 bg-clip-text text-transparent">
                Policy
              </span>
            </h1>

            <p className="text-slate-400">
              Last updated: September 13, 2026
            </p>
          </div>
        </div>
      </section>

      <section className="py-12">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="prose prose-invert max-w-none">

            {/* Privacy Commitment */}
            <div className="p-6 bg-slate-900/50 border border-purple-500/30 rounded-2xl mb-8">
              <div className="flex items-center gap-3 mb-4">
                <Shield className="w-6 h-6 text-purple-400" />
                <h2 className="text-2xl font-bold text-white m-0">
                  Our Privacy Commitment
                </h2>
              </div>

              <div className="text-slate-300 space-y-4">
                <p className="leading-relaxed">
                  MAiTROLL does <strong className="text-white">not sell your personal information</strong>.
                  We do not sell, rent, trade, or provide your personal
                  information to third parties for advertising, marketing,
                  profiling, or data-broker purposes.
                </p>

                <p className="leading-relaxed">
                  MAiTROLL is designed to keep your information within the
                  MAiTROLL ecosystem and the infrastructure required to operate
                  the platform. We do not intend to build a business based on
                  selling or sharing user information, and we will not sell
                  personal information to third parties.
                </p>

                <p className="leading-relaxed">
                  The primary external service specifically involved in
                  payment processing is PayPal. Backend infrastructure providers
                  may also process information as technically necessary to
                  operate MAiTROLL. These services do not change MAiTROLL's
                  policy against selling your personal information.
                </p>

                <p className="leading-relaxed">
                  If MAiTROLL is legally required to provide information to a
                  government authority, court, law enforcement agency, or other
                  authorized entity, we will comply with applicable legal
                  requirements.
                </p>
              </div>
            </div>

            <div className="space-y-8">

              {/* Information We Collect */}
              <div className="p-6 bg-slate-900/50 border border-slate-800 rounded-2xl">
                <div className="flex items-center gap-3 mb-4">
                  <Eye className="w-6 h-6 text-purple-400" />
                  <h2 className="text-2xl font-bold text-white m-0">
                    Information We Collect
                  </h2>
                </div>

                <div className="text-slate-300 space-y-4">
                  <p>
                    Depending on how you use MAiTROLL, we may collect
                    information necessary to provide, secure, and operate the
                    platform.
                  </p>

                  <ul className="list-disc pl-6 space-y-3">
                    <li>
                      <strong className="text-white">
                        Account Information:
                      </strong>{' '}
                      Name, email address, username, authentication information,
                      account type, and account status.
                    </li>

                    <li>
                      <strong className="text-white">
                        Profile Information:
                      </strong>{' '}
                      Profile image, biography, preferences, and other
                      information you voluntarily add to your profile.
                    </li>

                    <li>
                      <strong className="text-white">
                        Educational Information:
                      </strong>{' '}
                      For students and instructors, information such as your
                      selected educational institution, institutional email
                      domain, and verification status may be processed to
                      establish eligibility for education-related features.
                    </li>

                    <li>
                      <strong className="text-white">
                        Business Information:
                      </strong>{' '}
                      Information associated with MAi Business participation,
                      business profiles, applications, entrepreneurial
                      activities, and related services.
                    </li>

                    <li>
                      <strong className="text-white">
                        User Content:
                      </strong>{' '}
                      Streams, broadcasts, messages, posts, comments, profiles,
                      battle participation, marketplace activity, and other
                      content you voluntarily create or submit.
                    </li>

                    <li>
                      <strong className="text-white">
                        Transaction Information:
                      </strong>{' '}
                      Information related to purchases, Troll Coins, MAi Pay,
                      cashouts, administration fees, School Pool accounting,
                      and other financial activity.
                    </li>

                    <li>
                      <strong className="text-white">
                        Usage Information:
                      </strong>{' '}
                      Pages visited, features used, interactions, participation
                      in city systems, and related platform activity.
                    </li>

                    <li>
                      <strong className="text-white">
                        Device and Technical Information:
                      </strong>{' '}
                      Browser type, operating system, device information, IP
                      address, technical identifiers, diagnostics, and security
                      information.
                    </li>

                    <li>
                      <strong className="text-white">
                        Support Information:
                      </strong>{' '}
                      Information you provide when contacting MAiTROLL support,
                      submitting reports, appeals, verification requests, or
                      other communications.
                    </li>
                  </ul>
                </div>
              </div>

              {/* Educational Verification */}
              <div className="p-6 bg-slate-900/50 border border-slate-800 rounded-2xl">
                <div className="flex items-center gap-3 mb-4">
                  <GraduationCap className="w-6 h-6 text-purple-400" />
                  <h2 className="text-2xl font-bold text-white m-0">
                    Educational Verification
                  </h2>
                </div>

                <div className="text-slate-300 space-y-4">
                  <p>
                    MAiTROLL provides education-focused features for eligible
                    students and instructors. Educational verification may
                    require information necessary to confirm an account's
                    relationship with a recognized educational institution.
                  </p>

                  <p>
                    This may include the selected institution, institutional
                    email domain, verification status, and confirmation of the
                    email address associated with the account.
                  </p>

                  <p>
                    MAiTROLL does not treat a user-entered school name by itself
                    as proof of enrollment or instructor status. Verification
                    information is used to protect education-related features
                    and prevent unauthorized access.
                  </p>
                </div>
              </div>

              {/* MAi Business */}
              <div className="p-6 bg-slate-900/50 border border-slate-800 rounded-2xl">
                <div className="flex items-center gap-3 mb-4">
                  <Building2 className="w-6 h-6 text-purple-400" />
                  <h2 className="text-2xl font-bold text-white m-0">
                    MAi Business
                  </h2>
                </div>

                <div className="text-slate-300 space-y-4">
                  <p>
                    MAi Business is an education-connected business environment
                    within the MAiTROLL ecosystem.
                  </p>

                  <p>
                    Access to MAi Business is restricted to users who satisfy
                    MAiTROLL's eligibility and educational verification
                    requirements.
                  </p>

                  <p>
                    Educational verification information may be used to
                    determine whether an account is authorized to access
                    restricted MAi Business features.
                  </p>
                </div>
              </div>

              {/* How We Use Information */}
              <div className="p-6 bg-slate-900/50 border border-slate-800 rounded-2xl">
                <div className="flex items-center gap-3 mb-4">
                  <Database className="w-6 h-6 text-purple-400" />
                  <h2 className="text-2xl font-bold text-white m-0">
                    How We Use Your Information
                  </h2>
                </div>

                <div className="text-slate-300 space-y-3">
                  <p>
                    We use information only as reasonably necessary to operate,
                    secure, maintain, and improve MAiTROLL.
                  </p>

                  <ul className="list-disc pl-6 space-y-2">
                    <li>Create and authenticate accounts.</li>
                    <li>Provide MAiTROLL's virtual city services.</li>
                    <li>Verify educational eligibility.</li>
                    <li>Provide MAi Business features.</li>
                    <li>Operate broadcasting and communication services.</li>
                    <li>Process payments and transactions.</li>
                    <li>Maintain financial and transaction records.</li>
                    <li>Operate School Battles and School Pool systems.</li>
                    <li>Provide customer support.</li>
                    <li>Detect fraud, abuse, and unauthorized access.</li>
                    <li>Protect platform security.</li>
                    <li>Troubleshoot technical problems.</li>
                    <li>Improve platform functionality.</li>
                    <li>Comply with legal obligations.</li>
                  </ul>
                </div>
              </div>

              {/* Broadcasting */}
              <div className="p-6 bg-slate-900/50 border border-slate-800 rounded-2xl">
                <div className="flex items-center gap-3 mb-4">
                  <Radio className="w-6 h-6 text-purple-400" />
                  <h2 className="text-2xl font-bold text-white m-0">
                    Broadcasting & User Content
                  </h2>
                </div>

                <div className="text-slate-300 space-y-4">
                  <p>
                    MAiTROLL allows eligible users to participate in
                    broadcasts, podcasts, battles, conversations, and other
                    interactive experiences.
                  </p>

                  <p>
                    Content you voluntarily publish may be visible to other
                    MAiTROLL users depending on the feature and applicable
                    privacy or visibility settings.
                  </p>

                  <p>
                    Technical information associated with broadcasts may be
                    processed by the infrastructure required to establish
                    connections, deliver media, provide playback, maintain
                    security, and operate these services.
                  </p>
                </div>
              </div>

              {/* Payments */}
              <div className="p-6 bg-slate-900/50 border border-slate-800 rounded-2xl">
                <div className="flex items-center gap-3 mb-4">
                  <CreditCard className="w-6 h-6 text-purple-400" />
                  <h2 className="text-2xl font-bold text-white m-0">
                    Payments & Financial Information
                  </h2>
                </div>

                <div className="text-slate-300 space-y-4">
                  <p>
                    MAiTROLL may provide purchases, payment processing, Troll
                    Coins, MAi Pay functionality, cashouts, administration
                    fees, and other financial services.
                  </p>

                  <p>
                    <strong className="text-white">PayPal:</strong> When you
                    use PayPal to make or receive an applicable payment,
                    payment information is processed by PayPal according to
                    PayPal's own policies and systems. MAiTROLL does not sell
                    your payment information.
                  </p>

                  <p>
                    MAiTROLL may retain transaction information such as
                    transaction identifiers, amounts, dates, status, and
                    account references when necessary for accounting,
                    reconciliation, security, customer support, fraud
                    prevention, and legal compliance.
                  </p>
                </div>
              </div>

              {/* School Pool */}
              <div className="p-6 bg-slate-900/50 border border-slate-800 rounded-2xl">
                <div className="flex items-center gap-3 mb-4">
                  <Landmark className="w-6 h-6 text-purple-400" />
                  <h2 className="text-2xl font-bold text-white m-0">
                    School Pool Information
                  </h2>
                </div>

                <div className="text-slate-300 space-y-4">
                  <p>
                    MAiTROLL may maintain financial records associated with the
                    School Pool, including eligible school participation,
                    School Battle activity, contributions, funding reserves,
                    weekly settlements, and graduation-related payouts.
                  </p>

                  <p>
                    School Pool records are separate from personal Troll Coin
                    balances. School Pool amounts are not personal wallet
                    balances and are not intended to be withdrawn, transferred,
                    or spent by individual users.
                  </p>

                  <p>
                    Public School Pool information may include school names,
                    weekly wins, contribution amounts, and other information
                    necessary to display the School Pool program.
                  </p>
                </div>
              </div>

              {/* No Sale / No Third-Party Sharing */}
              <div className="p-6 bg-slate-900/50 border border-purple-500/30 rounded-2xl">
                <div className="flex items-center gap-3 mb-4">
                  <Share2 className="w-6 h-6 text-purple-400" />
                  <h2 className="text-2xl font-bold text-white m-0">
                    We Do Not Sell or Share Your Information
                  </h2>
                </div>

                <div className="text-slate-300 space-y-4">
                  <p>
                    <strong className="text-white">
                      MAiTROLL does not sell personal information.
                    </strong>{' '}
                    We do not sell, rent, lease, trade, auction, license, or
                    otherwise monetize personal information belonging to our
                    users.
                  </p>

                  <p>
                    <strong className="text-white">
                      MAiTROLL does not share personal information with
                      third-party advertisers, data brokers, marketing
                      companies, social networks, or other third parties for
                      their own commercial purposes.
                    </strong>
                  </p>

                  <p>
                    Information may be processed by the backend infrastructure
                    necessary to operate MAiTROLL. These infrastructure
                    services process information only as necessary to provide
                    the technical services MAiTROLL requires.
                  </p>

                  <p>
                    PayPal may receive information necessary to process
                    applicable payments. This is payment processing, not a sale
                    of your personal information by MAiTROLL.
                  </p>

                  <p>
                    <strong className="text-white">
                      If the law requires MAiTROLL to disclose information, we
                      will provide the information required by the applicable
                      legal process.
                    </strong>
                  </p>
                </div>
              </div>

              {/* Data Security */}
              <div className="p-6 bg-slate-900/50 border border-slate-800 rounded-2xl">
                <div className="flex items-center gap-3 mb-4">
                  <Lock className="w-6 h-6 text-purple-400" />
                  <h2 className="text-2xl font-bold text-white m-0">
                    Data Security
                  </h2>
                </div>

                <p className="text-slate-300 leading-relaxed">
                  MAiTROLL uses reasonable technical and organizational
                  safeguards designed to protect information against
                  unauthorized access, disclosure, alteration, or destruction.
                  Security measures may include authentication controls, access
                  restrictions, database security policies, encryption where
                  appropriate, monitoring, and administrative safeguards.
                </p>

                <p className="text-slate-300 leading-relaxed mt-4">
                  No internet transmission, electronic storage system, or
                  security measure can be guaranteed to be completely secure.
                </p>
              </div>

              {/* Cookies */}
              <div className="p-6 bg-slate-900/50 border border-slate-800 rounded-2xl">
                <div className="flex items-center gap-3 mb-4">
                  <Cookie className="w-6 h-6 text-purple-400" />
                  <h2 className="text-2xl font-bold text-white m-0">
                    Cookies & Similar Technologies
                  </h2>
                </div>

                <div className="text-slate-300 space-y-4">
                  <p>
                    MAiTROLL may use cookies, local storage, session
                    technologies, and similar mechanisms necessary to maintain
                    sessions, remember preferences, support authentication,
                    provide functionality, and protect platform security.
                  </p>

                  <p>
                    MAiTROLL does not use personal information for sale to
                    advertising networks or data brokers.
                  </p>

                  <p>
                    Browser settings may provide controls over certain cookies
                    and storage technologies. Disabling technologies required
                    by the platform may affect certain features.
                  </p>
                </div>
              </div>

              {/* Children's Privacy */}
              <div className="p-6 bg-slate-900/50 border border-slate-800 rounded-2xl">
                <h2 className="text-2xl font-bold text-white mb-4">
                  Children's Privacy
                </h2>

                <p className="text-slate-300 leading-relaxed">
                  MAiTROLL is not intended for children under 18, and we do not
                  knowingly collect personal information from children under
                  18. If you believe a child under 18 has provided personal
                  information to MAiTROLL, please contact us so we can review
                  the situation and take appropriate action.
                </p>
              </div>

              {/* Data Retention */}
              <div className="p-6 bg-slate-900/50 border border-slate-800 rounded-2xl">
                <h2 className="text-2xl font-bold text-white mb-4">
                  Data Retention
                </h2>

                <p className="text-slate-300 leading-relaxed">
                  MAiTROLL retains information for as long as reasonably
                  necessary to operate the platform, maintain security, provide
                  services, maintain financial and transaction records, resolve
                  disputes, prevent fraud and abuse, enforce policies, and
                  comply with applicable legal obligations.
                </p>

                <p className="text-slate-300 leading-relaxed mt-4">
                  Different types of information may have different retention
                  periods depending on why the information is maintained.
                </p>
              </div>

              {/* Account Deletion */}
              <div className="p-6 bg-slate-900/50 border border-slate-800 rounded-2xl">
                <h2 className="text-2xl font-bold text-white mb-4">
                  Account Deletion
                </h2>

                <p className="text-slate-300 leading-relaxed">
                  MAiTROLL may provide account deletion functionality. When an
                  account is deleted, account-associated information may be
                  removed or deactivated according to MAiTROLL's systems and
                  applicable requirements.
                </p>

                <p className="text-slate-300 leading-relaxed mt-4">
                  Certain records may need to remain available after account
                  deletion for legal, financial, security, fraud-prevention,
                  dispute-resolution, or other legitimate purposes.
                </p>
              </div>

              {/* Privacy Requests */}
              <div className="p-6 bg-slate-900/50 border border-slate-800 rounded-2xl">
                <h2 className="text-2xl font-bold text-white mb-4">
                  Privacy Requests
                </h2>

                <div className="text-slate-300 space-y-4">
                  <p>
                    Depending on applicable law, you may have rights regarding
                    your personal information, including rights to request
                    access, correction, deletion, restriction, portability, or
                    other privacy-related actions.
                  </p>

                  <p>
                    Privacy requests can be submitted to MAiTROLL support. We
                    may need to verify the identity or authority of the person
                    making a request before providing account-specific
                    information or making certain changes.
                  </p>
                </div>
              </div>

              {/* Changes */}
              <div className="p-6 bg-slate-900/50 border border-slate-800 rounded-2xl">
                <h2 className="text-2xl font-bold text-white mb-4">
                  Changes to This Privacy Policy
                </h2>

                <p className="text-slate-300 leading-relaxed">
                  MAiTROLL may update this Privacy Policy when our services,
                  technology, operations, or legal requirements change. When
                  changes are made, we may update the "Last updated" date
                  displayed on this page.
                </p>

                <p className="text-slate-300 leading-relaxed mt-4">
                  We will continue to maintain our fundamental commitment that
                  MAiTROLL does not sell personal information.
                </p>
              </div>

              {/* Contact */}
              <div className="p-6 bg-slate-900/50 border border-slate-800 rounded-2xl">
                <div className="flex items-center gap-3 mb-4">
                  <Mail className="w-6 h-6 text-purple-400" />
                  <h2 className="text-2xl font-bold text-white m-0">
                    Contact MAiTROLL
                  </h2>
                </div>

                <p className="text-slate-300 leading-relaxed">
                  If you have questions about this Privacy Policy, privacy
                  requests, educational verification, account information, or
                  how MAiTROLL handles information, contact us at{' '}
                  <a
                    href="mailto:ceo@maitroll.com"
                    className="text-purple-400 hover:text-purple-300"
                  >
                    ceo@maitroll.com
                  </a>
                  {' '}or visit our{' '}
                  <Link
                    to="/contact"
                    className="text-purple-400 hover:text-purple-300"
                  >
                    Contact page
                  </Link>
                  .
                </p>
              </div>

            </div>
          </div>
        </div>
      </section>
    </SEOLayout>
  )
}