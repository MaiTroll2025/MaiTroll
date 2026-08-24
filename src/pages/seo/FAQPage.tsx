import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import SEOLayout, { Breadcrumb, SEOContentSection, CTASection } from './SEOLayout'
import { HelpCircle, ChevronDown, Mail, Play, Shield, CreditCard, Zap, Gamepad2, Users, Radio } from 'lucide-react'

const faqData = [
  {
    category: 'General Questions',
    icon: HelpCircle,
    questions: [
      {
        question: 'What is Mai Troll?',
        answer: 'MaiTroll is an interactive live-streaming and social platform where viewers do more than watch—they participate through live broadcasts, battles, communities, games, creator events, and real-time interaction.'
      },
      {
        question: 'How is Mai Troll different from TikTok Live?',
        answer: 'MaiTroll focuses on audience participation, creator interaction, battles, community engagement, and creator-friendly monetization instead of endless scrolling.'
      },
      {
        question: 'Is Mai Troll free to use?',
        answer: 'Yes. Creating an account, watching broadcasts, posting content, and joining the community are completely free.'
      },
      {
        question: 'Do I need to download an app?',
        answer: 'No. Mai Troll runs directly in your browser as a Progressive Web App (PWA).'
      },
      {
        question: 'Can I use Mai Troll on desktop and mobile?',
        answer: 'Yes. Mai Troll works on desktops, tablets, and mobile devices.'
      },
      {
        question: 'How do I create an account?',
        answer: 'Click Sign Up, choose a username, enter your information, and complete account verification.'
      },
      {
        question: 'Can I sign up with Google, Facebook, or Apple?',
        answer: 'Social login options may be available depending on future platform updates.'
      },
      {
        question: 'Is Mai Troll currently in beta?',
        answer: 'Yes. Mai Troll is currently in beta. Features, events, and functionality may evolve as we continue improving the platform based on community feedback.'
      },
    ]
  },
  {
    category: 'Broadcasting & Streaming',
    icon: Radio,
    questions: [
      {
        question: 'How do I start a live broadcast?',
        answer: 'After logging in, click Go Live, configure your settings, and select Start Broadcast.'
      },
      {
        question: 'Can I stream from OBS?',
        answer: 'No. Mai Troll includes HytroGaming, a dedicated game-streaming page that allows direct PC screen sharing without the need for OBS or third-party streaming software.'
      },
      {
        question: 'Can I stream from my phone?',
        answer: 'Yes. Mobile broadcasting is supported on compatible devices.'
      },
      {
        question: 'Can I stream games?',
        answer: 'Yes. Creators can stream gameplay, gaming content, and esports events.'
      },
      {
        question: 'Can I share my screen?',
        answer: 'Yes. Screen sharing is available through HytroGaming.'
      },
      {
        question: 'How many viewers can I have?',
        answer: 'There is currently no fixed viewer limit for standard broadcasts.'
      },
      {
        question: 'Can I invite guests onto my stream?',
        answer: 'Yes. Guest participation is supported. Currently up to 6 guests can join a broadcast, though limits may increase in future updates.'
      },
      {
        question: 'Can viewers join my broadcast?',
        answer: 'Yes. Creators can allow viewers to join through audience seats and guest slots.'
      },
      {
        question: 'Can I schedule broadcasts?',
        answer: 'Not currently. Scheduled broadcasts may be added in a future update.'
      },
    ]
  },
  {
    category: 'Coins, Gifts & Earnings',
    icon: CreditCard,
    questions: [
      {
        question: 'How do creators make money?',
        answer: 'Creators earn through gifts, Troll Coins, subscriptions, battles, events, and future monetization opportunities.'
      },
      {
        question: 'What are Troll Coins?',
        answer: "Troll Coins are the platform's virtual currency used for gifts, events, creator support, and participation in various platform activities."
      },
      {
        question: 'What are gifts worth?',
        answer: 'Gift values vary depending on the gift sent. Currently, 1 Troll Coin equals $0.01 USD.'
      },
      {
        question: 'What percentage do creators keep?',
        answer: 'Creators keep 100% of gift earnings. A $0.25 PayPal fee (50 coins) or 5% Venmo/Cash App fee applies when cashing out.'
      },
        {
          question: 'When do payouts happen?',
          answer: 'Payouts are processed once per day through MAI Pay.'
        },
        {
          question: 'What is the minimum cashout amount?',
          answer: 'The minimum cashout is 2,000 Troll Coins, which equals $10 USD.'
        },
        {
          question: 'What is the maximum cashout amount?',
          answer: 'The highest available payout tier is 1,000,000 Troll Coins, which equals $5,000 USD.'
        },
      {
        question: 'How long do payouts take?',
        answer: 'Processing times vary depending on verification status and payment method.'
      },
      {
        question: 'Are there payout fees?',
        answer: 'PayPal has a $0.25 fee (50 coins). Venmo and Cash App charge a 5% fee (in coins). Other providers are free.'
      },
      {
        question: 'Do I need verification to cash out?',
        answer: 'Yes. Account verification requirements must be completed before receiving payouts.'
      },
    ]
  },
  {
    category: 'Community Features',
    icon: Users,
    questions: [
      {
        question: 'Can I message other users?',
        answer: 'Yes. Mai Troll includes private messaging through UTroMail. The feature is located under the Chats tab.'
      },
      {
        question: 'Can I follow creators?',
        answer: 'Yes. Following creators allows you to stay updated on broadcasts, content, and activities.'
      },
      {
        question: 'Can I create a group or family?',
        answer: 'Yes. Users can create and join Troll Families and other community groups.'
      },
      {
        question: 'Can I post videos when I\'m not live?',
        answer: 'Yes. Users can share content outside of live broadcasts.'
      },
      {
        question: 'Can I upload photos?',
        answer: 'Yes. Photo uploads are supported.'
      },
      {
        question: 'Can I comment on posts?',
        answer: 'Yes. Users can interact through comments, reactions, and engagement features.'
      },
      {
        question: 'Can I block users?',
        answer: 'Yes. Blocking tools are available for privacy and safety.'
      },
    ]
  },
  {
    category: 'Battles & Competitions',
    icon: Gamepad2,
    questions: [
      {
        question: 'What are battles?',
        answer: 'Battles are competitive live events where creators compete for support, gifts, and points.'
      },
      {
        question: 'How do random battles work?',
        answer: 'After starting a broadcast, enable Random Battle. While live, click Join Random Battle Queue to be automatically matched with another creator.'
      },
      {
        question: 'Can I battle specific creators?',
        answer: 'Yes. Creators can challenge other creators directly.'
      },
      {
        question: 'How are winners determined?',
        answer: 'Battle winners are determined by gifts, points, and overall support received during the battle.'
      },
      {
        question: 'Are there leaderboards?',
        answer: 'Yes. Leaderboards track creator performance, rankings, and achievements.'
      },
      {
        question: 'Can states compete against each other?',
        answer: 'Yes. State Battles allow users to represent their state and compete for rankings and rewards.'
      },
      {
        question: 'Are there tournaments?',
        answer: 'Yes. Special tournaments and seasonal competitions may be available throughout the year.'
      },
      {
        question: 'What rewards do winners receive?',
        answer: 'Rewards may include Troll Coins, badges, recognition, leaderboard placement, promotional opportunities, and special prizes.'
      },
    ]
  },
  {
    category: 'Safety & Moderation',
    icon: Shield,
    questions: [
      {
        question: 'How do I report someone?',
        answer: 'Use the Report feature available on profiles, broadcasts, messages, and content.'
      },
      {
        question: 'Is there content moderation?',
        answer: 'Yes. Mai Troll actively moderates content to maintain community standards and user safety.'
      },
      {
        question: 'What content is allowed?',
        answer: "Content must comply with Mai Troll's Community Guidelines and Terms of Service."
      },
      {
        question: 'What happens if someone violates the rules?',
        answer: 'Violations may result in warnings, restrictions, suspensions, or permanent account removal.'
      },
      {
        question: 'How do I appeal a suspension?',
        answer: "Users can submit an appeal through the platform's appeals system."
      },
    ]
  },
  {
    category: 'Account Management',
    icon: Users,
    questions: [
      {
        question: 'How do I verify my account?',
        answer: 'Follow the verification process available within your account settings.'
      },
      {
        question: 'Can I change my username?',
        answer: 'Yes. Usernames can be updated through the Edit Profile section.'
      },
      {
        question: 'Can I have multiple accounts?',
        answer: 'No. Multiple accounts are prohibited and may result in account restrictions or removal.'
      },
      {
        question: 'How do I delete my account?',
        answer: 'Account deletion options are available in your profile settings.'
      },
    ]
  },
  {
    category: 'Technical Questions',
    icon: Zap,
    questions: [
      {
        question: 'Why is my stream lagging?',
        answer: 'Lag may be caused by internet connection issues, device limitations, or network congestion.'
      },
      {
        question: 'What internet speed is recommended?',
        answer: 'A stable high-speed internet connection is recommended for broadcasting and viewing.'
      },
      {
        question: 'What browsers are supported?',
        answer: 'Modern versions of Chrome, Edge, Firefox, and Safari are supported.'
      },
      {
        question: 'Can I stream in HD?',
        answer: 'Yes. HD streaming is supported on compatible devices and connections.'
      },
      {
        question: 'Can I download my broadcasts later?',
        answer: 'Not currently. Broadcast downloads are not available at this time.'
      },
    ]
  },
  {
    category: 'For Creators',
    icon: Play,
    questions: [
      {
        question: 'Why should I choose Mai Troll over TikTok Live?',
        answer: 'MaiTroll focuses on community interaction, creator participation, battles, audience engagement, and creator-focused monetization.'
      },
      {
        question: 'Can I bring my audience with me?',
        answer: 'Yes. Creators are encouraged to invite their existing audiences to join Mai Troll.'
      },
      {
        question: 'What creator tools are available?',
        answer: 'Creators have access to live broadcasting, battles, analytics, monetization tools, audience participation features, and community-building systems.'
      },
      {
        question: 'How is content moderated?',
        answer: 'MaiTroll focuses on fair, transparent moderation while maintaining community safety and platform integrity.'
      },
      {
        question: 'Are payouts competitive?',
        answer: 'MaiTroll is designed to provide competitive creator earnings and transparent monetization opportunities.'
      },
      {
        question: 'Is it easier to grow on Mai Troll?',
        answer: 'Early creators often have a greater opportunity to build an audience before the platform becomes crowded.'
      },
      {
        question: 'Do new creators get promoted?',
        answer: 'New creators may receive discovery opportunities through events, recommendations, featured sections, and platform promotions.'
      },
      {
        question: 'How can I provide feedback?',
        answer: 'Feedback can be submitted through weekly surveys, support requests, bug reports, and community discussions.'
      },
    ]
  },
]

export default function FAQPage() {
  const [openIndex, setOpenIndex] = useState<string | null>(null)

  const toggleQuestion = (key: string) => {
    setOpenIndex(openIndex === key ? null : key)
  }

  return (
    <SEOLayout
      title="Frequently Asked Questions | Mai Troll"
      description="Find answers to frequently asked questions about Mai Troll. Learn about streaming, battles, coins, payouts, safety, account management, and more."
      keywords={[
        'MaiTroll FAQ', 'MaiTroll questions', 'MaiMaiTroll FAQ',
        'help', 'how to', 'streaming help', 'account help',
        'payment FAQ', 'creator FAQ', 'MaiTroll guide',
        'Troll Coins', 'battles', 'payouts', 'HytroGaming'
      ]}
    >
      <Breadcrumb items={[{ label: 'FAQ' }]} />

      <section className="relative py-20 lg:py-28 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-900/20 via-slate-900 to-pink-900/20" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-purple-600/20 border border-purple-500/30 text-purple-300 text-sm font-medium mb-6">
              <HelpCircle className="w-4 h-4" />
              FAQ
            </div>

            <h1 className="text-4xl md:text-6xl font-bold text-white mb-6 leading-tight">
              Frequently Asked{' '}
              <span className="bg-gradient-to-r from-purple-400 via-pink-400 to-purple-400 bg-clip-text text-transparent">
                Questions
              </span>
            </h1>

            <p className="text-xl text-slate-300 leading-relaxed">
              Find quick answers to the most common questions about Mai Troll.
              Can't find what you're looking for? <Link to="/contact" className="text-purple-400 hover:text-purple-300">Contact us</Link>.
            </p>
          </div>
        </div>
      </section>

      <section className="py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          {faqData.map((category, catIndex) => {
            const Icon = category.icon
            return (
              <div key={catIndex} className="mb-12">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-xl bg-purple-600/20 flex items-center justify-center">
                    <Icon className="w-5 h-5 text-purple-400" />
                  </div>
                  <h2 className="text-2xl font-bold text-white">{category.category}</h2>
                </div>

                <div className="space-y-3">
                  {category.questions.map((faq, qIndex) => {
                    const key = `${catIndex}-${qIndex}`
                    const isOpen = openIndex === key
                    return (
                      <div
                        key={qIndex}
                        className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden"
                      >
                        <button
                          onClick={() => toggleQuestion(key)}
                          className="w-full flex items-center justify-between p-5 text-left hover:bg-slate-800/50 transition-colors"
                        >
                          <span className="text-white font-medium pr-4">{faq.question}</span>
                          <ChevronDown
                            className={`w-5 h-5 text-slate-400 flex-shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                          />
                        </button>
                        {isOpen && (
                          <div className="px-5 pb-5 text-slate-400 leading-relaxed border-t border-slate-800 pt-4">
                            {faq.answer}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </section>

      <SEOContentSection
        title="Can't Find Your Answer?"
        description="Our support team is ready to help with any questions we haven't covered."
        icon={Mail}
      >
        <div className="grid md:grid-cols-3 gap-6">
          <Link
            to="/contact"
            className="p-6 bg-slate-900/50 border border-slate-800 hover:border-purple-500/30 rounded-xl transition-all text-center"
          >
            <Mail className="w-8 h-8 text-purple-400 mx-auto mb-3" />
            <h4 className="text-white font-medium mb-1">Contact Us</h4>
            <p className="text-slate-400 text-sm">Send us a message</p>
          </Link>
          <Link
            to="/support"
            className="p-6 bg-slate-900/50 border border-slate-800 hover:border-purple-500/30 rounded-xl transition-all text-center"
          >
            <HelpCircle className="w-8 h-8 text-pink-400 mx-auto mb-3" />
            <h4 className="text-white font-medium mb-1">Help Center</h4>
            <p className="text-slate-400 text-sm">Browse all articles</p>
          </Link>
          <a
            href="mailto:Mai Troll2025@gmail.com"
            className="p-6 bg-slate-900/50 border border-slate-800 hover:border-purple-500/30 rounded-xl transition-all text-center"
          >
            <Mail className="w-8 h-8 text-blue-400 mx-auto mb-3" />
            <h4 className="text-white font-medium mb-1">Email Us</h4>
            <p className="text-slate-400 text-sm">Mai Troll2025@gmail.com</p>
          </a>
        </div>
      </SEOContentSection>

      <CTASection
        title="Have More Questions?"
        description="We're here to help. Reach out to our support team anytime."
        primaryAction={{ label: 'Contact Support', path: '/contact' }}
        secondaryAction={{ label: 'Back to Home', path: '/' }}
      />
    </SEOLayout>
  )
}
