
import React from 'react'
import { Link } from 'react-router-dom'
import SEOLayout, {
  Breadcrumb,
  SEOContentSection,
  CTASection,
} from './SEOLayout'
import {
  HelpCircle,
  Mail,
  MessageSquare,
  BookOpen,
  Shield,
  Zap,
  Users,
  AlertTriangle,
  Settings,
  User,
  CreditCard,
  GraduationCap,
  BriefcaseBusiness,
  Trophy,
  Landmark,
  Wallet,
  Radio,
  Smartphone,
} from 'lucide-react'

const helpCategories = [
  {
    icon: User,
    title: 'Account & Profile',
    description:
      'Manage your MAiTROLL account, profile information, verification, and account settings.',
    articles: [
      'How to create an account',
      'Student and instructor registration',
      'How educational verification works',
      'How to update your profile',
      'How to change your username',
      'How to delete your account',
    ],
  },
  {
    icon: GraduationCap,
    title: 'Education & Verification',
    description:
      'Learn how institution verification works for students and instructors.',
    articles: [
      'How to verify your institution',
      'Selecting your school',
      'Institutional email verification',
      'What to do if your school is missing',
      'Verification status explained',
      'Educational account requirements',
    ],
  },
  {
    icon: BriefcaseBusiness,
    title: 'MAi Business',
    description:
      'Get help with MAi Business eligibility and the entrepreneurial side of the MAiTROLL ecosystem.',
    articles: [
      'What is MAi Business?',
      'Who can access MAi Business?',
      'MAi Business eligibility',
      'Becoming an eligible educational user',
      'Student entrepreneurship',
      'Business access and verification',
    ],
  },
  {
    icon: Radio,
    title: 'Broadcasting & HytroGaming',
    description:
      'Get help with live broadcasting, audience participation, gaming, and screen sharing.',
    articles: [
      'How to go live',
      'Mobile broadcasting',
      'HytroGaming',
      'Screen sharing',
      'Camera and microphone issues',
      'Broadcast participation',
    ],
  },
  {
    icon: CreditCard,
    title: 'MAi Pay & Payments',
    description:
      'Learn about Troll Coins, MAi Pay, purchases, administration fees, and eligible cashouts.',
    articles: [
      'Troll Coins explained',
      'MAi Pay explained',
      'How eligible cashouts work',
      'Payment methods',
      'Cashout fees',
      'Regular-user administration fee',
    ],
  },
  {
    icon: Trophy,
    title: 'School Battles & School Pool',
    description:
      'Learn how school representation, School Battles, weekly settlements, and School Pool accounting work.',
    articles: [
      'What are School Battles?',
      'How school representation works',
      'School Battle results',
      'How School Pool contributions work',
      'Friday settlement explained',
      'Graduation donations',
    ],
  },
  {
    icon: Shield,
    title: 'Safety, Privacy & Moderation',
    description:
      'Learn about safety tools, privacy, community standards, moderation, and account enforcement.',
    articles: [
      'Community guidelines',
      'How to block and report users',
      'Privacy and account safety',
      'Content moderation',
      'Moderation actions',
      'Appeals and enforcement',
    ],
  },
  {
    icon: AlertTriangle,
    title: 'Reporting & Appeals',
    description:
      'Report violations, request assistance, and understand MAiTROLL enforcement and appeal processes.',
    articles: [
      'How to report a user',
      'How to report content',
      'How to appeal a moderation action',
      'Understanding violations',
      'Troll Court explained',
      'Escalation and support',
    ],
  },
  {
    icon: Landmark,
    title: 'City Systems & Services',
    description:
      'Get help navigating the different systems and destinations inside the MAiTROLL virtual city.',
    articles: [
      'Understanding the MAiTROLL city',
      'City Hall',
      'Troll Court',
      'Transportation and TMV',
      'KT Auto',
      'Public services',
    ],
  },
  {
    icon: Users,
    title: 'Community & Social',
    description:
      'Learn about messaging, communities, Troll Families, Troll Pods, content, and social participation.',
    articles: [
      'Messaging and communication',
      'Community features',
      'Troll Families',
      'Troll Pods',
      'Posting and sharing content',
      'Blocking and privacy tools',
    ],
  },
  {
    icon: Zap,
    title: 'Technical Support',
    description:
      'Troubleshoot browser, mobile, broadcasting, camera, microphone, and performance issues.',
    articles: [
      'Common technical problems',
      'MAiTROLL not loading',
      'Camera and microphone issues',
      'Broadcast connection issues',
      'Mobile troubleshooting',
      'How to report a bug',
    ],
  },
  {
    icon: Smartphone,
    title: 'Mobile & Devices',
    description:
      'Get help using MAiTROLL on Android, iPhone, tablets, and desktop computers.',
    articles: [
      'Android access',
      'iPhone web access',
      'Desktop access',
      'Mobile broadcasting',
      'Browser compatibility',
      'Device permissions',
    ],
  },
]

const popularArticles = [
  {
    title: 'What is MAiTROLL?',
    excerpt:
      'Learn how MAiTROLL brings education, entrepreneurship, broadcasting, commerce, and community together inside a virtual city.',
    link: '/about',
  },
  {
    title: 'How do I create a MAiTROLL account?',
    excerpt:
      'Learn about student, instructor, and regular-user registration and the requirements associated with each account type.',
    link: '/faq',
  },
  {
    title: 'How does educational verification work?',
    excerpt:
      'Educational access uses your selected institution, verified institutional domain, email confirmation, and verification status.',
    link: '/faq',
  },
  {
    title: 'Who can access MAi Business?',
    excerpt:
      'MAi Business is restricted to eligible educational users whose MAiTROLL accounts have completed the applicable verification process.',
    link: '/faq',
  },
  {
    title: 'What are School Battles?',
    excerpt:
      'Eligible verified educational users can represent their school in supported competitive broadcast experiences.',
    link: '/faq',
  },
  {
    title: 'What is the School Pool?',
    excerpt:
      'Learn how eligible School Battle activity contributes to school-focused financial accounting and future graduation donations.',
    link: '/faq',
  },
  {
    title: 'How does MAi Pay work?',
    excerpt:
      'Learn about eligible earnings, Troll Coins, the current MAi Pay cashout conversion, payment methods, and cashout requirements.',
    link: '/faq',
  },
  {
    title: 'How do I report a problem?',
    excerpt:
      'Use the support process to report technical issues, account problems, moderation concerns, payment issues, or other platform problems.',
    link: '/contact',
  },
]

export default function SupportPage() {
  return (
    <SEOLayout
      title="MAiTROLL Support & Help Center"
      description="Get help with MAiTROLL. Find support for accounts, educational verification, MAi Business, broadcasting, MAi Pay, School Battles, School Pool, safety, city systems, and technical issues."
      keywords={[
        'MAiTROLL support',
        'MAiTROLL help',
        'MAiTROLL help center',
        'MAiTROLL customer support',
        'MAiTROLL account help',
        'MAiTROLL education verification',
        'MAi Business support',
        'MAi Pay support',
        'School Battle support',
        'School Pool support',
        'broadcasting support',
        'HytroGaming support',
        'payment support',
        'technical support',
        'report issue',
        'bug report',
      ]}
    >
      <Breadcrumb items={[{ label: 'Support' }]} />

      <section className="relative py-20 lg:py-28 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-900/20 via-slate-900 to-pink-900/20" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-purple-600/20 border border-purple-500/30 text-purple-300 text-sm font-medium mb-6">
              <HelpCircle className="w-4 h-4" />
              MAiTROLL Support
            </div>

            <h1 className="text-4xl md:text-6xl font-bold text-white mb-6 leading-tight">
              How Can We{' '}
              <span className="bg-gradient-to-r from-purple-400 via-pink-400 to-purple-400 bg-clip-text text-transparent">
                Help You?
              </span>
            </h1>

            <p className="text-xl text-slate-300 mb-8 leading-relaxed">
              Find answers about your account, education verification, MAi
              Business, broadcasting, MAi Pay, School Battles, School Pool,
              safety, city systems, and technical issues.
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
            <h2 className="text-3xl font-bold text-white mb-4">
              Browse Support by Category
            </h2>

            <p className="text-slate-400">
              Find help for the system or experience you are using
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {helpCategories.map((category) => {
              const Icon = category.icon

              return (
                <div
                  key={category.title}
                  className="p-6 bg-slate-900/50 border border-slate-800 hover:border-purple-500/30 rounded-2xl transition-all"
                >
                  <div className="w-12 h-12 rounded-xl bg-purple-600/20 flex items-center justify-center mb-4">
                    <Icon className="w-6 h-6 text-purple-400" />
                  </div>

                  <h3 className="text-lg font-semibold text-white mb-2">
                    {category.title}
                  </h3>

                  <p className="text-slate-400 text-sm mb-4">
                    {category.description}
                  </p>

                  <ul className="space-y-2">
                    {category.articles.map((article) => (
                      <li
                        key={article}
                        className="text-slate-500 text-sm flex items-center gap-2"
                      >
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
            <h2 className="text-3xl font-bold text-white mb-4">
              Popular Support Topics
            </h2>

            <p className="text-slate-400">
              Start with the questions MAiTROLL users ask most often
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {popularArticles.map((article) => (
              <Link
                key={article.title}
                to={article.link}
                className="p-6 bg-slate-900/50 border border-slate-800 hover:border-purple-500/30 rounded-2xl transition-all group"
              >
                <h3 className="text-lg font-semibold text-white mb-2 group-hover:text-purple-300 transition-colors">
                  {article.title}
                </h3>

                <p className="text-slate-400 text-sm">
                  {article.excerpt}
                </p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <SEOContentSection
        title="Need Personalized Help?"
        description="If you cannot find the answer you need, contact the MAiTROLL support team and provide as much relevant information as possible."
        icon={MessageSquare}
      >
        <div className="grid md:grid-cols-2 gap-6">
          <a
            href="mailto:ceo@maitroll.com"
            className="p-6 bg-slate-900/50 border border-slate-800 hover:border-purple-500/30 rounded-xl transition-all flex items-center gap-4"
          >
            <div className="w-12 h-12 rounded-xl bg-purple-600/20 flex items-center justify-center flex-shrink-0">
              <Mail className="w-6 h-6 text-purple-400" />
            </div>

            <div>
              <h4 className="text-white font-medium">Email Support</h4>

              <p className="text-slate-400 text-sm">
                ceo@maitroll.com
              </p>
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

              <p className="text-slate-400 text-sm">
                Get personalized help from MAiTROLL
              </p>
            </div>
          </Link>
        </div>
      </SEOContentSection>

      <CTASection
        title="Need Help With MAiTROLL?"
        description="Explore the FAQ or contact the MAiTROLL support team for assistance."
        primaryAction={{
          label: 'Contact Support',
          path: '/contact',
        }}
        secondaryAction={{
          label: 'View FAQ',
          path: '/faq',
        }}
      />
    </SEOLayout>
  )
}