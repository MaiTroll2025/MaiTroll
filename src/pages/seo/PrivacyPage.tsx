```tsx
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
  Video,
  Megaphone,
  FileText,
  UserCheck,
} from 'lucide-react'

export default function PrivacyPage() {
  return (
    <SEOLayout
      title="Privacy Policy | Mai Troll"
      description="Read the Mai Troll (MAiTROLL) Privacy Policy. Learn how we collect, use, protect, record, and process information and broadcast content."
      keywords={[
        'MaiTroll privacy policy',
        'MaiTroll privacy',
        'MAiTROLL privacy',
        'data protection',
        'personal information',
        'privacy',
        'GDPR',
        'data collection',
        'broadcast recording',
        'stream recording',
        'content rights',
        'MaiTroll terms',
        'user data',
      ]}
    >
      <Breadcrumb items={[{ label: 'Privacy Policy' }]} />

      <section className="relative py-20 lg:py-24 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-900/20 via-slate-900 to-pink-900/20" />

        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-purple-600/20 border border-purple-500/30 text-purple-300 text-sm font-medium mb-6">
              <Shield className="w-4 h-4" />
              Legal
            </div>

            <h1 className="text-4xl md:text-5xl font-bold text-white mb-6 leading-tight">
              Privacy{' '}
              <span className="bg-gradient-to-r from-purple-400 via-pink-400 to-purple-400 bg-clip-text text-transparent">
                Policy
              </span>
            </h1>

            <p className="text-slate-400">
              Last updated: September 2026
            </p>
          </div>
        </div>
      </section>

      <section className="py-12">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="prose prose-invert max-w-none">

            <div className="p-6 bg-slate-900/50 border border-purple-500/20 rounded-2xl mb-8">
              <p className="text-slate-300 leading-relaxed m-0">
                This Privacy Policy describes how Mai Troll ("we", "us", or "our")
                collects, uses, stores, protects, and shares information when you use
                the MAiTROLL platform, website, mobile applications, broadcasts, and
                related services.
              </p>

              <p className="text-slate-300 leading-relaxed mt-4 mb-0">
                By creating an account or continuing to use MAiTROLL, you acknowledge
                that you have read and understand this Privacy Policy. This includes
                the Broadcast Recording and Content Use provisions below. If you do not
                agree with these provisions, you must stop using MAiTROLL and delete
                your account.
              </p>
            </div>

            <div className="space-y-8">

              {/* INFORMATION WE COLLECT */}

              <div className="p-6 bg-slate-900/50 border border-slate-800 rounded-2xl">
                <div className="flex items-center gap-3 mb-4">
                  <Eye className="w-6 h-6 text-purple-400" />
                  <h2 className="text-2xl font-bold text-white m-0">
                    1. Information We Collect
                  </h2>
                </div>

                <div className="text-slate-300 space-y-3">
                  <p>
                    We collect information you provide directly to us and information
                    generated through your use of MAiTROLL. This may include:
                  </p>

                  <ul className="list-disc pl-6 space-y-2">
                    <li>
                      <strong className="text-white">Account Information:</strong>{' '}
                      Username, email address, date of birth, profile information,
                      avatar, and other information you choose to provide.
                    </li>

                    <li>
                      <strong className="text-white">Identity Verification:</strong>{' '}
                      Legal name, address, tax information, and government
                      identification information when required for payouts, age
                      verification, fraud prevention, or legal compliance.
                    </li>

                    <li>
                      <strong className="text-white">Payment Information:</strong>{' '}
                      Transaction history, purchases, payouts, payment status, and
                      related financial transaction information. Payment credentials
                      are processed by applicable payment providers and are not stored
                      by MAiTROLL unless expressly stated otherwise.
                    </li>

                    <li>
                      <strong className="text-white">User Content:</strong>{' '}
                      Broadcasts, livestreams, video, audio, images, messages,
                      comments, profile content, interactions, and other material you
                      create, upload, transmit, or make available through MAiTROLL.
                    </li>

                    <li>
                      <strong className="text-white">Technical Information:</strong>{' '}
                      Browser type, operating system, device information, device
                      identifiers, IP address, connection information, logs, and
                      security-related information.
                    </li>

                    <li>
                      <strong className="text-white">Usage Information:</strong>{' '}
                      Pages visited, features used, broadcasts joined, broadcasts
                      hosted, interactions, purchases, transactions, and other
                      activity associated with your use of MAiTROLL.
                    </li>
                  </ul>
                </div>
              </div>

              {/* BROADCAST RECORDING */}

              <div className="p-6 bg-slate-900/50 border border-purple-500/30 rounded-2xl">
                <div className="flex items-center gap-3 mb-4">
                  <Video className="w-6 h-6 text-purple-400" />
                  <h2 className="text-2xl font-bold text-white m-0">
                    2. Broadcast Recording and Content Use
                  </h2>
                </div>

                <div className="text-slate-300 space-y-4">

                  <div className="p-4 bg-purple-950/30 border border-purple-500/20 rounded-xl">
                    <p className="text-white font-semibold mb-2">
                      Important Notice Regarding Broadcast Recording
                    </p>

                    <p className="m-0">
                      MAiTROLL is a broadcast platform and broadcasts may be recorded.
                      When you host, participate in, or appear in a MAiTROLL broadcast,
                      you acknowledge and agree that the broadcast may be recorded,
                      stored, processed, clipped, reproduced, displayed, and
                      distributed by MAiTROLL for platform operations, moderation,
                      security, documentation, advertising, and promotional purposes.
                    </p>
                  </div>

                  <p>
                    Broadcast recordings may include your video, voice, screen,
                    gameplay, broadcast interactions, chat activity, and other content
                    made available during a broadcast.
                  </p>

                  <h3 className="text-xl font-semibold text-white">
                    2.1 Promotional and Marketing Use
                  </h3>

                  <p>
                    MAiTROLL may use broadcasts and portions of broadcasts to create
                    promotional and marketing materials for MAiTROLL.
                  </p>

                  <p>This may include:</p>

                  <ul className="list-disc pl-6 space-y-2">
                    <li>Broadcast clips and highlights.</li>
                    <li>Battle highlights and memorable moments.</li>
                    <li>Short-form videos and social media clips.</li>
                    <li>Promotional videos and advertisements.</li>
                    <li>Website and application promotional material.</li>
                    <li>App Store and Google Play promotional material.</li>
                    <li>Trailers, announcements, and demonstrations.</li>
                    <li>Screenshots, thumbnails, previews, and promotional graphics.</li>
                    <li>Examples demonstrating MAiTROLL features.</li>
                    <li>Other marketing and promotional content related to MAiTROLL.</li>
                  </ul>

                  <p>
                    MAiTROLL may edit, crop, combine, caption, subtitle, format, or
                    otherwise modify recorded broadcast material for these purposes.
                    Promotional material may be distributed through the MAiTROLL
                    website, applications, social media, advertising platforms,
                    video platforms, and other channels used to market or promote
                    MAiTROLL.
                  </p>

                  <h3 className="text-xl font-semibold text-white">
                    2.2 Your Ownership of User Content
                  </h3>

                  <p>
                    You retain ownership of the original content you create and submit
                    to MAiTROLL, except for rights you do not own or rights otherwise
                    granted under applicable agreements.
                  </p>

                  <p>
                    By using MAiTROLL, you grant MAiTROLL a worldwide, non-exclusive,
                    royalty-free license to host, store, reproduce, process, display,
                    distribute, modify, create clips from, and otherwise use your
                    content as reasonably necessary to operate, maintain, moderate,
                    improve, advertise, and promote MAiTROLL.
                  </p>

                  <p>
                    This license does not transfer ownership of your underlying content
                    to MAiTROLL. It provides MAiTROLL with the rights necessary to
                    operate the platform and promote the service using broadcast
                    content.
                  </p>

                  <h3 className="text-xl font-semibold text-white">
                    2.3 Public Broadcasts and Other Users
                  </h3>

                  <p>
                    MAiTROLL is a social broadcast platform. Content intentionally made
                    available through public broadcasts may be viewed, captured,
                    shared, clipped, screenshot, downloaded, or otherwise recorded by
                    other users or third parties.
                  </p>

                  <p>
                    MAiTROLL cannot guarantee that another user or third party will not
                    record, screenshot, download, reproduce, or redistribute content
                    that you make publicly available.
                  </p>

                  <h3 className="text-xl font-semibold text-white">
                    2.4 Guests and Participants
                  </h3>

                  <p>
                    If you invite another person to participate in a broadcast, you
                    are responsible for ensuring that you have the authority to include
                    that person and that the person understands that the broadcast may
                    be recorded and potentially used for platform operations and
                    promotional purposes.
                  </p>

                  <p>
                    Users must not intentionally broadcast or upload content that they
                    do not have the right to record, distribute, or make available
                    through MAiTROLL.
                  </p>

                  <h3 className="text-xl font-semibold text-white">
                    2.5 If You Do Not Consent to Broadcast Recording
                  </h3>

                  <div className="p-4 bg-red-950/20 border border-red-500/20 rounded-xl">
                    <p className="text-white font-semibold mb-2">
                      Recording Consent Is Required
                    </p>

                    <p className="m-0">
                      Participation in MAiTROLL broadcasts is subject to the recording
                      and content-use provisions described in this Privacy Policy and
                      the applicable Terms of Service.
                    </p>
                  </div>

                  <p>
                    <strong className="text-white">
                      If you do not consent to MAiTROLL recording, processing, or using
                      broadcast content as described in this Privacy Policy and the
                      applicable Terms of Service, you must not participate in MAiTROLL
                      broadcasts and must stop using the service.
                    </strong>
                  </p>

                  <p>
                    If you do not agree to these provisions and do not wish to use
                    MAiTROLL under these terms, you must delete your MAiTROLL account
                    and discontinue use of the service.
                  </p>
                </div>
              </div>

              {/* HOW WE USE INFORMATION */}

              <div className="p-6 bg-slate-900/50 border border-slate-800 rounded-2xl">
                <div className="flex items-center gap-3 mb-4">
                  <Database className="w-6 h-6 text-purple-400" />
                  <h2 className="text-2xl font-bold text-white m-0">
                    3. How We Use Your Information
                  </h2>
                </div>

                <div className="text-slate-300">
                  <p>We use information collected through MAiTROLL to:</p>

                  <ul className="list-disc pl-6 space-y-2">
                    <li>Operate and maintain the MAiTROLL platform.</li>
                    <li>Provide livestreaming and broadcast functionality.</li>
                    <li>Host, process, and deliver user content.</li>
                    <li>Record and process broadcasts as described in this policy.</li>
                    <li>Create clips, highlights, previews, and promotional content.</li>
                    <li>Process transactions, purchases, and payouts.</li>
                    <li>Verify identity and age when required.</li>
                    <li>Provide customer support.</li>
                    <li>Moderate content and enforce platform rules.</li>
                    <li>Detect fraud, abuse, manipulation, and security incidents.</li>
                    <li>Improve platform performance and user experience.</li>
                    <li>Communicate with users about their accounts and the service.</li>
                    <li>Market and promote MAiTROLL.</li>
                    <li>Comply with legal and regulatory obligations.</li>
                  </ul>
                </div>
              </div>

              {/* INFORMATION SHARING */}

              <div className="p-6 bg-slate-900/50 border border-slate-800 rounded-2xl">
                <div className="flex items-center gap-3 mb-4">
                  <Share2 className="w-6 h-6 text-purple-400" />
                  <h2 className="text-2xl font-bold text-white m-0">
                    4. Information Sharing
                  </h2>
                </div>

                <div className="text-slate-300 space-y-3">
                  <p>
                    We do not sell your personal information. We may share information
                    when reasonably necessary to operate MAiTROLL, provide services,
                    protect users, or comply with legal obligations.
                  </p>

                  <ul className="list-disc pl-6 space-y-2">
                    <li>
                      <strong className="text-white">Other Users:</strong>{' '}
                      Your profile and content may be visible to other users depending
                      on how you use the platform and applicable privacy settings.
                    </li>

                    <li>
                      <strong className="text-white">Service Providers:</strong>{' '}
                      Companies that provide hosting, storage, payment processing,
                      authentication, broadcasting, analytics, communications,
                      security, and other infrastructure services.
                    </li>

                    <li>
                      <strong className="text-white">Legal Requirements:</strong>{' '}
                      When required by law, subpoena, court order, governmental
                      request, or other legal process.
                    </li>

                    <li>
                      <strong className="text-white">Safety and Security:</strong>{' '}
                      When reasonably necessary to protect MAiTROLL, users, third
                      parties, property, or platform security.
                    </li>

                    <li>
                      <strong className="text-white">Business Transfers:</strong>{' '}
                      Information may be transferred as part of a merger, acquisition,
                      financing, restructuring, sale of assets, or other business
                      transaction involving MAiTROLL.
                    </li>
                  </ul>
                </div>
              </div>

              {/* DATA SECURITY */}

              <div className="p-6 bg-slate-900/50 border border-slate-800 rounded-2xl">
                <div className="flex items-center gap-3 mb-4">
                  <Lock className="w-6 h-6 text-purple-400" />
                  <h2 className="text-2xl font-bold text-white m-0">
                    5. Data Security
                  </h2>
                </div>

                <p className="text-slate-300">
                  We implement commercially reasonable and industry-standard
                  technical and organizational measures designed to protect your
                  personal information from unauthorized access, disclosure,
                  alteration, or destruction.
                </p>

                <p className="text-slate-300">
                  However, no method of transmission, storage, or processing over the
                  Internet can be guaranteed to be completely secure.
                </p>
              </div>

              {/* DATA RETENTION */}

              <div className="p-6 bg-slate-900/50 border border-slate-800 rounded-2xl">
                <div className="flex items-center gap-3 mb-4">
                  <FileText className="w-6 h-6 text-purple-400" />
                  <h2 className="text-2xl font-bold text-white m-0">
                    6. Data Retention
                  </h2>
                </div>

                <div className="text-slate-300 space-y-3">
                  <p>
                    We retain information for as long as reasonably necessary to
                    provide the service, operate the platform, maintain security,
                    resolve disputes, enforce agreements, process financial
                    transactions, comply with legal obligations, and protect our
                    rights.
                  </p>

                  <p>
                    Recorded broadcasts and other user content may be retained for
                    operational, moderation, security, legal, archival, or promotional
                    purposes, subject to applicable law and our internal retention
                    practices.
                  </p>

                  <p>
                    Promotional materials that have already been published may continue
                    to exist after an account is deleted, particularly where they have
                    been distributed through third-party websites, social media
                    platforms, search engines, advertising networks, or other external
                    services.
                  </p>
                </div>
              </div>

              {/* YOUR RIGHTS */}

              <div className="p-6 bg-slate-900/50 border border-slate-800 rounded-2xl">
                <div className="flex items-center gap-3 mb-4">
                  <UserCheck className="w-6 h-6 text-purple-400" />
                  <h2 className="text-2xl font-bold text-white m-0">
                    7. Your Rights
                  </h2>
                </div>

                <div className="text-slate-300 space-y-3">
                  <p>
                    Depending on your location and applicable law, you may have
                    rights to access, correct, export, or delete certain personal
                    information.
                  </p>

                  <p>
                    You may manage certain account information through your Profile
                    Settings. For additional privacy requests, contact MAiTROLL
                    support.
                  </p>

                  <p>
                    Deleting your account does not necessarily require MAiTROLL to
                    immediately delete information that we are legally required or
                    permitted to retain, including transaction records, security
                    records, fraud-prevention records, or information necessary to
                    establish, exercise, or defend legal claims.
                  </p>
                </div>
              </div>

              {/* ACCOUNT DELETION */}

              <div className="p-6 bg-slate-900/50 border border-slate-800 rounded-2xl">
                <h2 className="text-2xl font-bold text-white mb-4">
                  8. Account Deletion
                </h2>

                <div className="text-slate-300 space-y-3">
                  <p>
                    You may request deletion of your MAiTROLL account through the
                    available account deletion functionality or by contacting support.
                  </p>

                  <p>
                    Once an account deletion request is processed, MAiTROLL will take
                    commercially reasonable steps to delete or de-identify information
                    that is no longer required for legitimate business, legal,
                    security, or operational purposes.
                  </p>

                  <p>
                    Content that has already been incorporated into published
                    promotional materials, advertisements, clips, screenshots,
                    trailers, or other marketing materials may not be technically or
                    practically removable from third-party platforms or previously
                    distributed copies.
                  </p>
                </div>
              </div>

              {/* CHILDREN */}

              <div className="p-6 bg-slate-900/50 border border-slate-800 rounded-2xl">
                <h2 className="text-2xl font-bold text-white mb-4">
                  9. Children's Privacy
                </h2>

                <p className="text-slate-300">
                  MAiTROLL is not intended for children under 13. We do not knowingly
                  collect personal information from children under 13. If we learn
                  that we have knowingly collected personal information from a child
                  under 13, we will take appropriate steps to delete the information
                  as required by applicable law.
                </p>

                <p className="text-slate-300 mt-4">
                  Users must meet applicable minimum age requirements to create an
                  account, participate in monetization, or use paid features.
                </p>
              </div>

              {/* COOKIES */}

              <div className="p-6 bg-slate-900/50 border border-slate-800 rounded-2xl">
                <div className="flex items-center gap-3 mb-4">
                  <Cookie className="w-6 h-6 text-purple-400" />
                  <h2 className="text-2xl font-bold text-white m-0">
                    10. Cookies & Tracking
                  </h2>
                </div>

                <p className="text-slate-300">
                  We may use cookies, local storage, session technologies, analytics,
                  and similar technologies to maintain sessions, remember preferences,
                  improve functionality, measure performance, maintain security, and
                  understand how users interact with MAiTROLL.
                </p>
              </div>

              {/* THIRD PARTY */}

              <div className="p-6 bg-slate-900/50 border border-slate-800 rounded-2xl">
                <h2 className="text-2xl font-bold text-white mb-4">
                  11. Third-Party Services
                </h2>

                <p className="text-slate-300">
                  MAiTROLL may use third-party services for hosting, authentication,
                  broadcasting, storage, payments, analytics, communications,
                  security, and other platform functions.
                </p>

                <p className="text-slate-300 mt-4">
                  These third parties may process information according to their own
                  privacy policies and applicable agreements. MAiTROLL does not control
                  the privacy practices of third-party services.
                </p>
              </div>

              {/* CHANGES */}

              <div className="p-6 bg-slate-900/50 border border-slate-800 rounded-2xl">
                <h2 className="text-2xl font-bold text-white mb-4">
                  12. Changes to This Policy
                </h2>

                <p className="text-slate-300">
                  We may update this Privacy Policy from time to time as MAiTROLL
                  develops, adds features, changes infrastructure, or as legal
                  requirements change.
                </p>

                <p className="text-slate-300 mt-4">
                  When we make material changes, we may provide notice through the
                  MAiTROLL application, website, email, or other reasonable
                  communication methods.
                </p>

                <p className="text-slate-300 mt-4">
                  Your continued use of MAiTROLL after an updated Privacy Policy
                  becomes effective constitutes acceptance of the updated policy to
                  the extent permitted by applicable law. If you do not agree to an
                  updated policy, you must stop using the service and delete your
                  account.
                </p>
              </div>

              {/* CONTACT */}

              <div className="p-6 bg-slate-900/50 border border-slate-800 rounded-2xl">
                <div className="flex items-center gap-3 mb-4">
                  <Mail className="w-6 h-6 text-purple-400" />
                  <h2 className="text-2xl font-bold text-white m-0">
                    13. Contact Us
                  </h2>
                </div>

                <p className="text-slate-300">
                  If you have questions about this Privacy Policy, data requests,
                  broadcast recording, or content use, please contact us at{' '}
                  <a
                    href="mailto:privacy@MaiTroll.com"
                    className="text-purple-400 hover:text-purple-300"
                  >
                    privacy@MaiTroll.com
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
              </div>

              {/* PROMINENT RECORDING NOTICE */}

              <div className="p-6 bg-purple-950/20 border border-purple-500/30 rounded-2xl">
                <div className="flex items-center gap-3 mb-4">
                  <Megaphone className="w-6 h-6 text-purple-400" />

                  <h2 className="text-2xl font-bold text-white m-0">
                    Broadcast Recording Notice
                  </h2>
                </div>

                <p className="text-slate-300 leading-relaxed">
                  By participating in MAiTROLL broadcasts, you acknowledge that
                  broadcasts may be recorded and that MAiTROLL may use recordings,
                  clips, screenshots, highlights, and portions of broadcasts for
                  platform operations and promotional purposes as described in this
                  Privacy Policy and the applicable Terms of Service.
                </p>

                <p className="text-white font-semibold mt-4 mb-0">
                  If you do not consent to these recording and content-use provisions,
                  you must not participate in broadcasts, must stop using MAiTROLL,
                  and must delete your account.
                </p>
              </div>

            </div>
          </div>
        </div>
      </section>
    </SEOLayout>
  )
}
```
