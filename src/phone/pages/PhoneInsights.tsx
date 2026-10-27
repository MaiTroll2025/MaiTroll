
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Sparkles,
  ChevronDown,
  ChevronUp,
  Radio,
  Coins,
  UserPlus,
  Gift,
  Wallet,
  Swords,
  ShieldCheck,
  MessageCircle,
  Home,
  Search,
} from 'lucide-react'
import PhoneDrawer from '../PhoneDrawer'

const faqs = [
  {
    question: 'What is Mai Troll?',
    answer:
      'Mai Troll is a Broadcast City, similar to TikTok and BIGO LIVE, where users can broadcast live, battle other creators, share games, watch podcasts, connect with people, and build their own audience. Whether you want to entertain, compete, socialize, or earn money, Mai Troll gives you a place to do it all.',
    icon: Sparkles,
  },
  {
    question: 'Can I make money on Mai Troll?',
    answer:
      'Yes! You can earn real money on Mai Troll. Earn Troll Coins by receiving gifts during broadcasts, participating in battles, charging for seats when available, charging for chats, using Mai Piks picture chat and video features, and selling products in the Marketplace. Once you have eligible earnings, you can cash out through Mai Pay. Daily cashouts are available, subject to applicable requirements and processing rules.',
    icon: Coins,
  },
  {
    question: 'How do I create an account on Mai Troll?',
    answer:
      'Creating an account takes less than 30 seconds. Visit the Mai Troll homepage and click Sign Up. Follow the registration steps to create your account and start exploring the city.',
    icon: UserPlus,
  },
  {
    question: 'How do I start broadcasting on Mai Troll?',
    answer:
      'Starting a broadcast is simple. Click Go Live, enter your stream title or keep the default title, and click Start Broadcasting. You are live and ready to connect with your audience!',
    icon: Radio,
  },
  {
    question: 'How do I earn Troll Coins?',
    answer:
      'You can earn Troll Coins by receiving virtual gifts from viewers, participating in battles, charging for seats when available, charging for chats, using Mai Piks picture chat and video features, and selling products through the Marketplace. Explore the earning opportunities available throughout Mai Troll.',
    icon: Coins,
  },
  {
    question: 'How do I purchase Troll Coins?',
    answer:
      "You can purchase Troll Coins through the platform's coin purchasing feature. Browse the available coin packages and select the option you want to purchase.",
    icon: Wallet,
  },
  {
    question: 'How do I send gifts to broadcasters?',
    answer:
      'Open the live broadcast you want to watch, enter the stream, and tap Gift. Select an available virtual gift and send it to show your support for the broadcaster. Gifts can help creators earn Troll Coins.',
    icon: Gift,
  },
  {
    question: 'How do I cash out my earnings on Mai Troll?',
    answer:
      'Open the More tab and find Mai Pay. Complete your initial Mai Pay application, which is automatically approved through the current application process. After completing the application, follow the available cashout steps to withdraw your eligible earnings. Daily cashouts are subject to applicable requirements and processing rules.',
    icon: Wallet,
  },
  {
    question: 'How do I join battles on Mai Troll?',
    answer:
      'Start a broadcast and earn at least 100 Troll Coins to unlock Battle Mode. Once enabled, you can compete against other broadcasters. Build your audience and encourage viewers to support you with gifts before and during battles.',
    icon: Swords,
  },
  {
    question:
      'Can I watch podcasts, gaming streams, and other live content on Mai Troll?',
    answer:
      'Absolutely! Mai Troll features live broadcasts, podcasts, and HytroStreams, where you can discover gaming and other streaming content. Explore the city, find creators you enjoy, interact with the community, and discover something new to watch.',
    icon: Gamepad2,
  },
  {
    question: 'How do I become a verified broadcaster on Mai Troll?',
    answer:
      'You can purchase a Verified Badge through the Coin Store. Visit the store to find the available verification option and follow the purchase instructions.',
    icon: ShieldCheck,
  },
]

export default function PhoneInsights() {
  const navigate = useNavigate()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [openFaq, setOpenFaq] = useState<number | null>(0)
  const [searchQuery, setSearchQuery] = useState('')

  const filteredFaqs = faqs.filter(
    (faq) =>
      faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      faq.answer.toLowerCase().includes(searchQuery.toLowerCase()),
  )

  return (
    <div className="relative min-h-screen w-full overflow-x-hidden bg-[#08041A] pb-24 text-white">
      <PhoneDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      />

      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-[#BF00FF]/30 bg-[#0a0420]/90 px-4 py-3 backdrop-blur-xl">
        <button
          type="button"
          className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/[0.06] text-white transition hover:bg-white/10"
          aria-label="Open menu"
          onClick={() => setDrawerOpen(true)}
        >
          <span className="text-2xl" aria-hidden="true">
            ☰
          </span>
        </button>

        <div className="text-center">
          <p className="text-base font-black tracking-tight">
            Mai <span className="text-[#00D4FF]">Troll</span>
          </p>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/50">
            Broadcast City
          </p>
        </div>

        <button
          type="button"
          onClick={() => navigate('/')}
          aria-label="Go home"
          className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/[0.06] text-white/80 transition hover:bg-white/10"
        >
          <Home size={19} />
        </button>
      </header>

      <main className="mx-auto w-full max-w-2xl px-4 pb-8 pt-6">
        <section className="relative overflow-hidden rounded-3xl border border-[#BF00FF]/30 bg-gradient-to-br from-[#24104B] via-[#10082B] to-[#061B35] p-6">
          <div className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-[#BF00FF]/15 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-12 -left-8 h-36 w-36 rounded-full bg-[#00D4FF]/10 blur-3xl" />

          <div className="relative">
            <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-[#BF00FF]/40 bg-[#BF00FF]/15 shadow-[0_0_30px_rgba(191,0,255,0.12)]">
              <Sparkles size={28} className="text-[#D9A3FF]" />
            </div>

            <p className="mb-2 text-xs font-bold uppercase tracking-[0.22em] text-[#00D4FF]">
              Help Center
            </p>

            <h1 className="text-3xl font-black leading-tight tracking-tight">
              Welcome to
              <span className="block bg-gradient-to-r from-[#00D4FF] via-[#BF00FF] to-[#00F59B] bg-clip-text text-transparent">
                Mai Troll
              </span>
            </h1>

            <p className="mt-3 max-w-md text-sm leading-6 text-white/70">
              Your Broadcast City. Find out how to go live, earn Troll Coins,
              battle creators, and explore everything Mai Troll has to offer.
            </p>

            <div className="mt-5 flex flex-wrap gap-2">
              <span className="rounded-full border border-[#00D4FF]/25 bg-[#00D4FF]/10 px-3 py-1.5 text-xs font-semibold text-[#8CEAFF]">
                Go Live
              </span>
              <span className="rounded-full border border-[#00F59B]/25 bg-[#00F59B]/10 px-3 py-1.5 text-xs font-semibold text-[#73FFC7]">
                Earn Coins
              </span>
              <span className="rounded-full border border-[#BF00FF]/25 bg-[#BF00FF]/10 px-3 py-1.5 text-xs font-semibold text-[#D9A3FF]">
                Join Battles
              </span>
            </div>
          </div>
        </section>

        <section className="mt-6">
          <label
            htmlFor="faq-search"
            className="mb-2 block text-sm font-semibold text-white/80"
          >
            What would you like to know?
          </label>

          <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 transition focus-within:border-[#00D4FF]/60">
            <Search size={19} className="shrink-0 text-[#00D4FF]" />
            <input
              id="faq-search"
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search frequently asked questions..."
              className="min-w-0 flex-1 bg-transparent py-4 text-sm text-white outline-none placeholder:text-white/35"
            />
          </div>
        </section>

        <section className="mt-7">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-black">Frequently Asked Questions</h2>
              <p className="mt-1 text-xs text-white/50">
                Answers to help you explore the city.
              </p>
            </div>
            <span className="shrink-0 rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5 text-xs font-semibold text-white/70">
              {filteredFaqs.length} questions
            </span>
          </div>

          <div className="space-y-3">
            {filteredFaqs.map((faq) => {
              const originalIndex = faqs.indexOf(faq)
              const isOpen = openFaq === originalIndex
              const Icon = faq.icon

              return (
                <article
                  key={faq.question}
                  className={`overflow-hidden rounded-2xl border transition-colors duration-200 ${
                    isOpen
                      ? 'border-[#BF00FF]/40 bg-[#180D32]'
                      : 'border-white/10 bg-white/[0.035]'
                  }`}
                >
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    onClick={() =>
                      setOpenFaq(isOpen ? null : originalIndex)
                    }
                    className="flex w-full items-center gap-3 p-4 text-left"
                  >
                    <span
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${
                        isOpen
                          ? 'border-[#BF00FF]/30 bg-[#BF00FF]/15 text-[#D9A3FF]'
                          : 'border-white/10 bg-white/[0.05] text-[#00D4FF]'
                      }`}
                    >
                      <Icon size={20} />
                    </span>

                    <span className="flex-1 text-sm font-bold leading-5 text-white">
                      {faq.question}
                    </span>

                    <span className="shrink-0 text-white/50">
                      {isOpen ? (
                        <ChevronUp size={19} />
                      ) : (
                        <ChevronDown size={19} />
                      )}
                    </span>
                  </button>

                  {isOpen && (
                    <div className="px-4 pb-5">
                      <div className="ml-[52px] border-l-2 border-[#BF00FF]/30 pl-4">
                        <p className="text-sm leading-7 text-white/70">
                          {faq.answer}
                        </p>
                      </div>
                    </div>
                  )}
                </article>
              )
            })}

            {filteredFaqs.length === 0 && (
              <div className="rounded-2xl border border-white/10 bg-white/[0.035] px-5 py-10 text-center">
                <Search
                  size={30}
                  className="mx-auto mb-3 text-white/35"
                />
                <h3 className="font-bold text-white">
                  No matching questions
                </h3>
                <p className="mt-2 text-sm leading-6 text-white/50">
                  Try another search term to find the answer you need.
                </p>
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="mt-4 rounded-xl border border-[#00D4FF]/30 bg-[#00D4FF]/10 px-4 py-2.5 text-sm font-bold text-[#8CEAFF]"
                >
                  Clear Search
                </button>
              </div>
            )}
          </div>
        </section>

        <section className="mt-8 overflow-hidden rounded-2xl border border-[#00D4FF]/20 bg-gradient-to-r from-[#071D35] to-[#190A35] p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#00D4FF]/10 text-[#00D4FF]">
              <MessageCircle size={22} />
            </div>
            <div>
              <h2 className="text-lg font-black">Ready to enter the city?</h2>
              <p className="mt-2 text-sm leading-6 text-white/60">
                Create your account, meet the community, and discover your
                place in Mai Troll.
              </p>
              <button
                type="button"
                onClick={() => navigate('/auth')}
                className="mt-4 rounded-xl bg-gradient-to-r from-[#00BFFF] to-[#007BFF] px-5 py-3 text-sm font-extrabold text-white shadow-lg shadow-blue-950/30 transition hover:brightness-110 active:scale-[0.98]"
              >
                Create Your Account
              </button>
            </div>
          </div>
        </section>

        <footer className="px-4 pb-5 pt-8 text-center">
          <p className="text-xs font-semibold tracking-wide text-white/35">
            MAI TROLL · YOUR BROADCAST CITY
          </p>
          <button
            type="button"
            onClick={() => navigate('/')}
            className="mt-3 text-sm font-semibold text-[#00D4FF] transition hover:text-white"
          >
            Back to Home
          </button>
        </footer>
      </main>
    </div>
  )
}

