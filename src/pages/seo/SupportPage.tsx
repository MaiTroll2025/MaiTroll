import React from 'react'
import { Link } from 'react-router-dom'
import SEOLayout, { Breadcrumb, SEOContentSection, CTASection } from './SEOLayout'
import { HelpCircle, Mail, MessageSquare, BookOpen, Shield, Zap, Users, AlertTriangle, FileText, Settings, User, CreditCard, Ban } from 'lucide-react'

const helpCategories = [
  {
    icon: User,
    title: 'Account & Profile',
    description: 'Manage your account settings, profile information, and preferences.',
    articles: [
      'How to create an account',
      'How to reset your password',
      'How to update your profile',
      'How to delete your account',
      'How to change your username',
    ]
  },
  {
    icon: Shield,
    title: 'Safety & Privacy',
    description: 'Learn about our safety features, privacy settings, and community guidelines.',
    articles: [
      'Community guidelines',
      'How to block and report users',
      'Privacy settings explained',
      'Content moderation policies',
      'Age restrictions',
    ]
  },
  {
    icon: CreditCard,
    title: 'Payments & Earnings',
    description: 'Information about virtual currency, payouts, subscriptions, and monetization.',
    articles: [
      'How to purchase Troll Coins',
      'How payouts work',
      'Creator earnings explained',
      'Subscription plans',
      'Refund policy',
    ]
  },
  {
    icon: Zap,
    title: 'Streaming & Broadcasting',
    description: 'Get help with live streaming, broadcasting tools, and stream quality.',
    articles: [
      'How to go live',
      'Streaming quality settings',
      'Virtual gifts explained',
      'Moderation tools for streamers',
      'Stream categories',
    ]
  },
  {
    icon: AlertTriangle,
    title: 'Reporting & Appeals',
    description: 'Report violations, appeal decisions, and understand our enforcement process.',
    articles: [
      'How to report a user',
      'How to appeal a ban',
      'Understanding violations',
      'Court system explained',
      'Escalation process',
    ]
  },
  {
    icon: Settings,
    title: 'Technical Support',
    description: 'Troubleshoot technical issues, bugs, and performance problems.',
    articles: [
      'Common error messages',
      'App not loading',
      'Audio/video issues',
      'Push notifications not working',
      'Report a bug',
    ]
  },
]

const popularArticles = [
  {
    title: 'How do I get started on Mai Troll?',
    excerpt: 'Create a free account, set up your profile, and start exploring live streams or go live yourself.',
    link: '/about'
  },
  {
    title: 'How do I earn money on Mai Troll?',
    excerpt: 'Go live and receive virtual gifts from viewers. Gifts convert to Troll Coins that can be redeemed for cash payouts.',
    link: '/faq'
  },
  {
    title: 'What are the community guidelines?',
    excerpt: 'We maintain a safe and respectful environment. Review our guidelines to understand what is and isn\'t allowed.',
    link: '/legal/safety'
  },
  {
    title: 'How do I report inappropriate content?',
    excerpt: 'Use the report button on any stream, profile, or message. Our moderation team reviews all reports.',
    link: '/contact'
  },
  {
    title: 'Why was my account suspended?',
    excerpt: 'Accounts may be suspended for violating our Terms of Service. You can appeal through the court system.',
    link: '/contact'
  },
  {
    title: 'How do payouts work?',
    creators: 'Create content, earn gifts, convert to coins, and request a payout. Minimum payout thresholds apply.',
    link: '/faq'
  },
]

export default function SupportPage() {
  return (
    <SEOLayout
      title="Support & Help Center | Mai Troll"
      description="Get help with Mai Troll (MaiMaiTroll). Find answers to common questions about your account, streaming, payments, safety, and more."
      keywords={[
        'MaiTroll help', 'MaiTroll support', 'MaiMaiTroll support',
        'help center', 'FAQ', 'customer support', 'troubleshooting',
        'account help', 'payment support', 'report issue', 'bug report'
      ]}
    >
      <Breadcrumb items={[{ label: 'Support' }]} />

      <section className="relative py-20 lg:py-28 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-900/20 via-slate-900 to-pink-900/20" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-purple-600/20 border border-purple-500/30 text-purple-300 text-sm font-medium mb-6">
              <HelpCircle className="w-4 h-4" />
              Help Center
            </div>

            <h1 className="text-4xl md:text-6xl font-bold text-white mb-6 leading-tight">
              How Can We{' '}
              <span className="bg-gradient-to-r from-purple-400 via-pink-400 to-purple-400 bg-clip-text text-transparent">
                Help You?
              </span>
            </h1>

            <p className="text-xl text-slate-300 mb-8 leading-relaxed">
              Find answers to common questions, browse help articles, or contact our support team.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                to="/contact"
                className="w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold rounded-xl hover:from-purple-500 hover:to-pink-500 transition-all flex items-center justify-center gap-2"
              >
                <Mail className="w-5 h-5" />
                Contact Support
              </Link>
              <Link
                to="/faq"
                className="w-full sm:w-auto px-8 py-4 border border-slate-600 text-white font-semibold rounded-xl hover:bg-slate-800 transition-colors flex items-center justify-center gap-2"
              >
                <BookOpen className="w-5 h-5" />
                View FAQ
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-white mb-4">Browse by Category</h2>
            <p className="text-slate-400">Find the help you need by topic</p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {helpCategories.map((category, index) => {
              const Icon = category.icon
              return (
                <div
                  key={index}
                  className="p-6 bg-slate-900/50 border border-slate-800 hover:border-purple-500/30 rounded-2xl transition-all"
                >
                  <div className="w-12 h-12 rounded-xl bg-purple-600/20 flex items-center justify-center mb-4">
                    <Icon className="w-6 h-6 text-purple-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-2">{category.title}</h3>
                  <p className="text-slate-400 text-sm mb-4">{category.description}</p>
                  <ul className="space-y-2">
                    {category.articles.map((article, aIndex) => (
                      <li key={aIndex} className="text-slate-500 text-sm flex items-center gap-2">
                        <span className="w-1 h-1 bg-purple-400 rounded-full flex-shrink-0" />
                        {article}
                      </li>
                    ))}
                  </ul>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      <section className="py-16 bg-slate-900/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-white mb-4">Popular Articles</h2>
            <p className="text-slate-400">Most frequently asked questions and topics</p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {popularArticles.map((article, index) => (
              <Link
                key={index}
                to={article.link}
                className="p-6 bg-slate-900/50 border border-slate-800 hover:border-purple-500/30 rounded-2xl transition-all group"
              >
                <h3 className="text-lg font-semibold text-white mb-2 group-hover:text-purple-300 transition-colors">
                  {article.title}
                </h3>
                <p className="text-slate-400 text-sm">{article.excerpt}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <SEOContentSection
        title="Still Need Help?"
        description="If you couldn't find what you were looking for, our support team is ready to assist you."
        icon={MessageSquare}
      >
        <div className="grid md:grid-cols-2 gap-6">
          <a
            href="mailto:Mai Troll2025@gmail.com"
            className="p-6 bg-slate-900/50 border border-slate-800 hover:border-purple-500/30 rounded-xl transition-all flex items-center gap-4"
          >
            <div className="w-12 h-12 rounded-xl bg-purple-600/20 flex items-center justify-center flex-shrink-0">
              <Mail className="w-6 h-6 text-purple-400" />
            </div>
            <div>
              <h4 className="text-white font-medium">Email Support</h4>
              <p className="text-slate-400 text-sm">Mai Troll2025@gmail.com</p>
            </div>
          </a>
          <Link
            to="/contact"
            className="p-6 bg-slate-900/50 border border-slate-800 hover:border-purple-500/30 rounded-xl transition-all flex items-center gap-4"
          >
            <div className="w-12 h-12 rounded-xl bg-pink-600/20 flex items-center justify-center flex-shrink-0">
              <MessageSquare className="w-6 h-6 text-pink-400" />
            </div>
            <div>
              <h4 className="text-white font-medium">Submit a Ticket</h4>
              <p className="text-slate-400 text-sm">Get personalized help from our team</p>
            </div>
          </Link>
        </div>
      </SEOContentSection>

      <CTASection
        title="Ready to Get Started?"
        description="Join Mai Troll today and become part of our growing community."
        primaryAction={{ label: 'Create Free Account', path: '/auth' }}
        secondaryAction={{ label: 'Learn More', path: '/about' }}
      />
    </SEOLayout>
  )
}
