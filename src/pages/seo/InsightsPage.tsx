
import React from "react"
import SEOLayout, {
  Breadcrumb,
  SEOContentSection,
  CTASection,
} from "./SEOLayout"

import {
  Sparkles,
  Users,
  Radio,
  Gift,
  Coins,
  CheckCircle,
  MessageSquare,
  Globe,
  Wallet,
  Gamepad2,
  ShoppingBag,
  ShieldCheck,
  Swords,
} from "lucide-react"

const buyerQuestions = [
  {
    question: "What is Mai Troll?",
    answer:
      "Mai Troll is a Broadcast City, similar to TikTok and BIGO LIVE, where users can broadcast live, battle other creators, share games, watch podcasts, connect with people, and build their own audience. Whether you want to entertain, compete, socialize, or earn money, Mai Troll gives you a place to do it all.",
  },
  {
    question: "Can I make money on Mai Troll?",
    answer:
      "Yes! You can earn real money on Mai Troll by receiving gifts during broadcasts, participating in battles, charging for seats when available, charging for chats, using Mai Piks picture chat and video features, and selling products in the Marketplace. Eligible earnings can be cashed out through Mai Pay. Daily cashouts are available, subject to applicable requirements and processing rules.",
  },
  {
    question: "How do I create an account on Mai Troll?",
    answer:
      "Creating an account takes less than 30 seconds. Visit the Mai Troll homepage, click Sign Up, and follow the registration steps. Once your account is created, you can explore the city, watch broadcasts, interact with creators, and start your journey.",
  },
  {
    question: "How do I start broadcasting on Mai Troll?",
    answer:
      "Starting a broadcast is simple. Click Go Live, enter your stream title or keep the default title, and click Start Broadcasting. You are live and ready to connect with your audience.",
  },
  {
    question: "How do I earn Troll Coins?",
    answer:
      "You can earn Troll Coins by receiving virtual gifts from viewers, participating in battles, charging for seats when available, charging for chats, using Mai Piks picture chat and video features, and selling products through the Marketplace. Explore the earning opportunities available throughout Mai Troll.",
  },
  {
    question: "How do I purchase Troll Coins?",
    answer:
      "You can purchase Troll Coins through the platform's coin purchasing feature. Browse the available coin packages and select the option you want to purchase.",
  },
  {
    question: "How do I send gifts to my favorite broadcasters?",
    answer:
      "Open the live broadcast you want to watch, enter the stream, and click Gift. Choose an available virtual gift and send it to show your support for your favorite broadcaster. Gifts can help creators earn Troll Coins.",
  },
  {
    question: "How do I cash out my earnings on Mai Troll?",
    answer:
      "Open the More tab and navigate to Mai Pay. Complete your initial Mai Pay application, which is automatically approved through the current application process. After completing the application, follow the available cashout steps to withdraw your eligible earnings. Daily cashouts are subject to applicable requirements and processing rules.",
  },
  {
    question: "How do I join battles on Mai Troll?",
    answer:
      "Start a broadcast and earn at least 100 Troll Coins to unlock Battle Mode. Once enabled, you can compete against other broadcasters. Build your audience and encourage viewers to support you with gifts before and during battles.",
  },
  {
    question:
      "Can I watch podcasts, gaming streams, and other live content on Mai Troll?",
    answer:
      "Absolutely! Mai Troll features live broadcasts, podcasts, and HytroStreams, where you can discover gaming and other streaming content. Explore the city, find creators you enjoy, interact with the community, and discover something new to watch.",
  },
  {
    question: "How do I become a verified broadcaster on Mai Troll?",
    answer:
      "You can purchase a Verified Badge through the Coin Store. Visit the store to find the available verification option and follow the purchase instructions.",
  },
]

export default function InsightsPage() {
  return (
    <SEOLayout
      title="Mai Troll FAQs | Your Broadcast City"
      description="Learn about Mai Troll, the Broadcast City. Discover how to create an account, broadcast live, earn Troll Coins, join battles, cash out through Mai Pay, send gifts, and explore HytroStreams and the Marketplace."
      keywords={[
        "Mai Troll",
        "Mai Troll Broadcast City",
        "what is Mai Troll",
        "can I make money on Mai Troll",
        "Mai Troll frequently asked questions",
        "Mai Troll account registration",
        "live broadcasting platform",
        "earn Troll Coins",
        "Mai Pay cashouts",
        "",
        "Mai Piks",
        "Mai Troll battles",
        "HytroStreams",
        "live streaming gifts",
        "creator monetization",
        "Mai Troll Marketplace",
      ]}
      section="Insights"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <Breadcrumb
          items={[
            { label: "Home", path: "/" },
            { label: "Insights" },
          ]}
        />

        <header className="mb-12 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-purple-600/20 border border-purple-500/30 mb-6">
            <Sparkles className="w-5 h-5 text-purple-400" />
            <span className="text-purple-300 font-medium">
              Welcome to Mai Troll
            </span>
          </div>

          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-6">
            Welcome to Your Broadcast City
          </h1>

          <p className="text-xl text-slate-300 max-w-3xl mx-auto">
            Broadcast live, battle other creators, share games, watch
            podcasts, connect with your community, and discover ways to
            earn on Mai Troll.
          </p>
        </header>

        <SEOContentSection
          title="What Is Mai Troll?"
          icon={Sparkles}
          description="Discover your Broadcast City."
        >
          <p className="text-slate-300 leading-relaxed mb-4">
            Mai Troll is a social broadcasting platform similar to TikTok
            and BIGO LIVE. It brings live broadcasting, creator battles,
            gaming streams, podcasts, virtual gifts, and community
            interaction together in one Broadcast City.
          </p>

          <p className="text-slate-300 leading-relaxed">
            Start your own broadcast, watch your favorite creators, send
            gifts, participate in battles, explore Mai Piks, and discover
            products in the Marketplace. Whether you want to entertain,
            socialize, compete, or earn, there is a place for you in
            Mai Troll.
          </p>
        </SEOContentSection>

        <SEOContentSection
          title="Can You Make Money on Mai Troll?"
          icon={Coins}
          description="Explore ways to earn Troll Coins and cash out eligible earnings."
        >
          <p className="text-slate-300 leading-relaxed mb-6">
            Yes! Mai Troll offers multiple earning opportunities. Users
            can earn Troll Coins through gifts, battles, available paid
            seats, paid chats, Mai Piks, and Marketplace sales. Eligible
            earnings can be cashed out through Mai Pay, subject to
            applicable requirements and processing rules.
          </p>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
              <Gift className="w-8 h-8 text-pink-400 mb-3" />
              <h3 className="text-xl font-semibold text-white mb-2">
                Virtual Gifts
              </h3>
              <p className="text-slate-300">
                Receive gifts from viewers during broadcasts and build
                engagement with your audience.
              </p>
            </div>

            <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
              <Swords className="w-8 h-8 text-purple-400 mb-3" />
              <h3 className="text-xl font-semibold text-white mb-2">
                Live Battles
              </h3>
              <p className="text-slate-300">
                Compete against other broadcasters and invite your
                audience to support you.
              </p>
            </div>

            <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
              <Users className="w-8 h-8 text-cyan-400 mb-3" />
              <h3 className="text-xl font-semibold text-white mb-2">
                Paid Seats and Chats
              </h3>
              <p className="text-slate-300">
                Explore paid seats when available and charge for eligible
                chat features.
              </p>
            </div>

            <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
              <MessageSquare className="w-8 h-8 text-pink-300 mb-3" />
              <h3 className="text-xl font-semibold text-white mb-2">
                Mai Piks
              </h3>
              <p className="text-slate-300">
                Explore Mai Troll&apos;s picture chat and video features to
                connect with your community.
              </p>
            </div>

            <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
              <ShoppingBag className="w-8 h-8 text-green-400 mb-3" />
              <h3 className="text-xl font-semibold text-white mb-2">
                Marketplace
              </h3>
              <p className="text-slate-300">
                Sell products through the Mai Troll Marketplace and
                explore additional earning opportunities.
              </p>
            </div>

            <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
              <Wallet className="w-8 h-8 text-yellow-400 mb-3" />
              <h3 className="text-xl font-semibold text-white mb-2">
                Mai Pay
              </h3>
              <p className="text-slate-300">
                Complete your Mai Pay application and access cashout
                options for eligible earnings.
              </p>
            </div>
          </div>
        </SEOContentSection>

        <SEOContentSection
          title="Explore Mai Troll Features"
          icon={Users}
          description="Broadcast, connect, compete, and discover."
        >
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
              <Radio className="w-8 h-8 text-purple-400 mb-3" />
              <h3 className="text-xl font-semibold text-white mb-2">
                Live Broadcasting
              </h3>
              <p className="text-slate-300">
                Click Go Live, set your stream title, and click Start
                Broadcasting to connect with viewers in real time.
              </p>
            </div>

            <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
              <Gamepad2 className="w-8 h-8 text-cyan-400 mb-3" />
              <h3 className="text-xl font-semibold text-white mb-2">
                HytroStreams and Gaming
              </h3>
              <p className="text-slate-300">
                Discover gaming streams and other live entertainment
                from creators across the city.
              </p>
            </div>

            <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
              <Wallet className="w-8 h-8 text-yellow-400 mb-3" />
              <h3 className="text-xl font-semibold text-white mb-2">
                
              </h3>
              <p className="text-slate-300">
                Visit the web coin store to explore available Troll Coin
                packages and the Verified Badge purchase option.
              </p>
            </div>

            <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
              <ShieldCheck className="w-8 h-8 text-green-400 mb-3" />
              <h3 className="text-xl font-semibold text-white mb-2">
                Verified Badges
              </h3>
              <p className="text-slate-300">
                Explore the available Verified Badge option in the Coin
                Store to identify your profile as a verified broadcaster.
              </p>
            </div>
          </div>
        </SEOContentSection>

        <SEOContentSection
          title="Frequently Asked Questions About Mai Troll"
          icon={MessageSquare}
          description="Find answers about accounts, broadcasting, Troll Coins, battles, Mai Pay, and more."
        >
          <div className="space-y-6">
            {buyerQuestions.map((item, _idx) => (
              <div
                key={item.question}
                className="bg-slate-800/30 rounded-xl p-6 border border-slate-700"
              >
                <h3 className="text-lg font-semibold text-white mb-3 flex items-start gap-2">
                  <CheckCircle className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
                  <span>{item.question}</span>
                </h3>

                <p className="text-slate-300 leading-relaxed pl-7">
                  {item.answer}
                </p>
              </div>
            ))}
          </div>
        </SEOContentSection>

        <SEOContentSection
          title="Get Started with Mai Troll"
          icon={Globe}
          description="Your Broadcast City is ready to explore."
        >
          <ul className="space-y-4 text-slate-300">
            <li className="flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
              <span>
                <strong className="text-white">Create an account:</strong>{" "}
                Sign up in less than 30 seconds.
              </span>
            </li>

            <li className="flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
              <span>
                <strong className="text-white">Go live:</strong>{" "}
                Start broadcasting and build your audience.
              </span>
            </li>

            <li className="flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
              <span>
                <strong className="text-white">Explore earning options:</strong>{" "}
                Receive gifts, participate in battles, and explore
                available monetization features.
              </span>
            </li>

            <li className="flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
              <span>
                <strong className="text-white">Connect with creators:</strong>{" "}
                Watch broadcasts, podcasts, and HytroStreams.
              </span>
            </li>
          </ul>
        </SEOContentSection>

        <CTASection
          title="Ready to Enter the Broadcast City?"
          description="Join Mai Troll, start broadcasting, connect with your community, compete in battles, and explore the opportunities waiting for you."
          primaryAction={{
            label: "Get Started",
            path: "/auth",
          }}
          secondaryAction={{
            label: "Learn More",
            path: "/about",
          }}
        />
      </div>
    </SEOLayout>
  )
}

