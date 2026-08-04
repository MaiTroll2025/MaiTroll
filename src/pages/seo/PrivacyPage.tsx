import React from 'react'
import { Link } from 'react-router-dom'
import SEOLayout, { Breadcrumb } from './SEOLayout'
import { Shield, Eye, Lock, Database, Cookie, Share2, Mail } from 'lucide-react'

export default function PrivacyPage() {
  return (
    <SEOLayout
      title="Privacy Policy | Mai Troll"
      description="Read the Mai Troll (MaiMaiTroll) Privacy Policy. Learn how we collect, use, and protect your personal information."
      keywords={[
        'MaiTroll privacy policy', 'MaiMaiTroll privacy', 'data protection',
        'personal information', 'privacy', 'GDPR', 'data collection',
        'MaiTroll terms', 'user data'
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

            <p className="text-slate-400">Last updated: January 1, 2026</p>
          </div>
        </div>
      </section>

      <section className="py-12">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="prose prose-invert max-w-none">
            <div className="p-6 bg-slate-900/50 border border-slate-800 rounded-2xl mb-8">
              <p className="text-slate-300 leading-relaxed">
                This Privacy Policy describes how Mai Troll ("we", "us", or "our") collects, uses, and shares information
                when you use our platform. By using Mai Troll, you agree to the collection and use of information in accordance
                with this policy.
              </p>
            </div>

            <div className="space-y-8">
              <div className="p-6 bg-slate-900/50 border border-slate-800 rounded-2xl">
                <div className="flex items-center gap-3 mb-4">
                  <Eye className="w-6 h-6 text-purple-400" />
                  <h2 className="text-2xl font-bold text-white m-0">Information We Collect</h2>
                </div>
                <div className="text-slate-300 space-y-3">
                  <p>We collect the following types of information:</p>
                  <ul className="list-disc pl-6 space-y-2">
                    <li><strong className="text-white">Account Information:</strong> Name, email address, username, and password when you register.</li>
                    <li><strong className="text-white">Profile Information:</strong> Avatar, bio, date of birth, and other information you choose to provide.</li>
                    <li><strong className="text-white">Content:</strong> Streams, messages, and other content you create or share on the platform.</li>
                    <li><strong className="text-white">Usage Data:</strong> Pages visited, features used, and interactions within the platform.</li>
                    <li><strong className="text-white">Device Information:</strong> Browser type, operating system, device identifiers, and IP address.</li>
                    <li><strong className="text-white">Payment Information:</strong> Processed securely through our payment processors. We do not store full credit card numbers.</li>
                  </ul>
                </div>
              </div>

              <div className="p-6 bg-slate-900/50 border border-slate-800 rounded-2xl">
                <div className="flex items-center gap-3 mb-4">
                  <Database className="w-6 h-6 text-purple-400" />
                  <h2 className="text-2xl font-bold text-white m-0">How We Use Your Information</h2>
                </div>
                <div className="text-slate-300 space-y-3">
                  <p>We use the information we collect to:</p>
                  <ul className="list-disc pl-6 space-y-2">
                    <li>Provide, maintain, and improve our services</li>
                    <li>Process transactions and send related information</li>
                    <li>Send notifications, updates, and support messages</li>
                    <li>Detect, prevent, and address technical issues and abuse</li>
                    <li>Comply with legal obligations</li>
                    <li>Personalize your experience and deliver relevant content</li>
                  </ul>
                </div>
              </div>

              <div className="p-6 bg-slate-900/50 border border-slate-800 rounded-2xl">
                <div className="flex items-center gap-3 mb-4">
                  <Share2 className="w-6 h-6 text-purple-400" />
                  <h2 className="text-2xl font-bold text-white m-0">Information Sharing</h2>
                </div>
                <div className="text-slate-300 space-y-3">
                  <p>We do not sell your personal information. We may share information with:</p>
                  <ul className="list-disc pl-6 space-y-2">
                    <li><strong className="text-white">Other Users:</strong> Your profile and content may be visible to other users based on your privacy settings.</li>
                    <li><strong className="text-white">Service Providers:</strong> Third parties who help us operate the platform (hosting, analytics, payment processing).</li>
                    <li><strong className="text-white">Legal Requirements:</strong> When required by law or to protect rights and safety.</li>
                  </ul>
                </div>
              </div>

              <div className="p-6 bg-slate-900/50 border border-slate-800 rounded-2xl">
                <div className="flex items-center gap-3 mb-4">
                  <Lock className="w-6 h-6 text-purple-400" />
                  <h2 className="text-2xl font-bold text-white m-0">Data Security</h2>
                </div>
                <p className="text-slate-300">
                  We implement appropriate technical and organizational measures to protect your personal information.
                  However, no method of transmission over the Internet is 100% secure, and we cannot guarantee absolute security.
                </p>
              </div>

              <div className="p-6 bg-slate-900/50 border border-slate-800 rounded-2xl">
                <div className="flex items-center gap-3 mb-4">
                  <Cookie className="w-6 h-6 text-purple-400" />
                  <h2 className="text-2xl font-bold text-white m-0">Cookies & Tracking</h2>
                </div>
                <p className="text-slate-300">
                  We use cookies and similar tracking technologies to enhance your experience, analyze usage, and deliver
                  personalized content. You can control cookie preferences through your browser settings.
                </p>
              </div>

              <div className="p-6 bg-slate-900/50 border border-slate-800 rounded-2xl">
                <h2 className="text-2xl font-bold text-white mb-4">Children's Privacy</h2>
                <p className="text-slate-300">
                  Our platform is not intended for children under 13. We do not knowingly collect personal information
                  from children under 13. If you believe we have collected such information, please contact us immediately.
                </p>
              </div>

              <div className="p-6 bg-slate-900/50 border border-slate-800 rounded-2xl">
                <h2 className="text-2xl font-bold text-white mb-4">Changes to This Policy</h2>
                <p className="text-slate-300">
                  We may update this Privacy Policy from time to time. We will notify you of any changes by posting the
                  new policy on this page and updating the "Last updated" date.
                </p>
              </div>

              <div className="p-6 bg-slate-900/50 border border-slate-800 rounded-2xl">
                <div className="flex items-center gap-3 mb-4">
                  <Mail className="w-6 h-6 text-purple-400" />
                  <h2 className="text-2xl font-bold text-white m-0">Contact Us</h2>
                </div>
                <p className="text-slate-300">
                  If you have any questions about this Privacy Policy, please contact us at{' '}
                  <a href="mailto:privacy@maiMaiTroll.com" className="text-purple-400 hover:text-purple-300">
                    privacy@maiMaiTroll.com
                  </a>{' '}
                  or visit our <Link to="/contact" className="text-purple-400 hover:text-purple-300">Contact page</Link>.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </SEOLayout>
  )
}
