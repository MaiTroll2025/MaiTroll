import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import SEOLayout, {
  Breadcrumb,
  SEOContentSection,
  CTASection,
} from './SEOLayout'
import {
  HelpCircle,
  ChevronDown,
  Mail,
  Play,
  Shield,
  CreditCard,
  Zap,
  Gamepad2,
  Users,
  Radio,
  GraduationCap,
  Trophy,
  BriefcaseBusiness,
  Landmark,
  Coins,
  School,
  Wallet,
  Smartphone,
} from 'lucide-react'

type FAQ = {
  question: string
  answer: string
}

type FAQCategory = {
  category: string
  icon: React.ComponentType<{ className?: string }>
  questions: FAQ[]
}

const faqData: FAQCategory[] = [
  {
    category: 'About MAiTROLL',
    icon: HelpCircle,
    questions: [
      {
        question: 'What is MAiTROLL?',
        answer:
          'MAiTROLL is a virtual city built around education, entrepreneurship, broadcasting, commerce, and community. It brings city-style systems, live interaction, business opportunities, social experiences, competitions, public services, and community features together in one digital environment.',
      },
      {
        question: 'Is MAiTROLL just a streaming platform?',
        answer:
          'No. Broadcasting is one part of MAiTROLL, but it is not the entire purpose of the platform. MAiTROLL is designed for people who want to learn, create, build businesses, represent their schools, participate in competitions, connect with communities, and build something real.',
      },
      {
        question: 'Who is MAiTROLL built for?',
        answer:
          'MAiTROLL is designed around students, instructors, entrepreneurs, creators, broadcasters, and community members who want to participate in a virtual city built around opportunity and creation.',
      },
      {
        question: 'What makes MAiTROLL different from traditional social platforms?',
        answer:
          'MAiTROLL combines education, entrepreneurship, broadcasting, commerce, community, government-style systems, public services, competitions, and city experiences instead of focusing primarily on endless content consumption.',
      },
      {
        question: 'Can I use MAiTROLL on desktop and mobile?',
        answer:
          'Yes. MAiTROLL is designed to work across modern desktop and mobile web experiences. Android access is also supported through the MAiTROLL application.',
      },
      {
        question: 'Do I need to download an app?',
        answer:
          'No. MAiTROLL can be accessed through the web. Mobile users can also use the available Android application.',
      },
      {
        question: 'How do I create an account?',
        answer:
          'Select Sign Up and complete the account registration process. The information required depends on the account type you select, including whether you are registering as a student, instructor, or regular user.',
      },
    ],
  },
  {
    category: 'Education & Verification',
    icon: GraduationCap,
    questions: [
      {
        question: 'What account types are available?',
        answer:
          'MAiTROLL supports educational users such as students and instructors, as well as regular users under the current registration rules.',
      },
      {
        question: 'How does student or instructor verification work?',
        answer:
          'Educational registration requires selecting an eligible educational institution and providing the appropriate institutional email information. Verification is tied to the selected institution and its verified email domain rather than relying only on an .edu address.',
      },
      {
        question: 'Can I type any school name during registration?',
        answer:
          'No. Educational institutions are selected from the verified institution system. Users cannot create an arbitrary school identity by typing a school name that does not exist in the approved institution records.',
      },
      {
        question: 'What happens if I cannot find my school?',
        answer:
          'If your institution is not available, use the available school verification or support process so MAiTROLL can review the institution and its official information.',
      },
      {
        question: 'Does an institutional email automatically verify me?',
        answer:
          'No. The institution, verified institutional domain, account email confirmation, and educational verification status must align. An email address alone does not grant educational privileges.',
      },
      {
        question: 'Can instructors access the same educational systems as students?',
        answer:
          'Eligible instructors can participate in the educational ecosystem according to their verified account status and the permissions assigned to their account. Selecting instructor during registration does not grant administrative or officer privileges.',
      },
    ],
  },
  {
    category: 'MAi Business',
    icon: BriefcaseBusiness,
    questions: [
      {
        question: 'What is MAi Business?',
        answer:
          'MAi Business is the business and entrepreneurial side of the MAiTROLL ecosystem, designed to help eligible educational users develop ideas, opportunities, and businesses within the MAiTROLL environment.',
      },
      {
        question: 'Who can access MAi Business?',
        answer:
          'MAi Business is restricted to eligible educational users whose MAiTROLL account has been verified through the educational verification system. A regular user does not receive MAi Business access simply by creating an account.',
      },
      {
        question: 'Can a regular MAiTROLL user become eligible for MAi Business later?',
        answer:
          'Yes. If a regular user later enrolls in an eligible college, university, trade school, or other approved educational institution, they must use the MAiTROLL verification or support process to have their account reviewed and updated. Access is not granted automatically based only on a claim of enrollment.',
      },
      {
        question: 'Does selecting student or instructor automatically grant MAi Business access?',
        answer:
          'No. Account type selection is not the same as verification. MAi Business access depends on successful educational verification and the applicable backend eligibility rules.',
      },
      {
        question: 'Why is MAi Business restricted?',
        answer:
          'MAi Business is intentionally connected to the educational side of MAiTROLL so the platform can focus its business-building environment on verified students and instructors rather than unrestricted public access.',
      },
    ],
  },
  {
    category: 'Broadcasting & HytroGaming',
    icon: Radio,
    questions: [
      {
        question: 'How do I start a live broadcast?',
        answer:
          'After logging in, use the broadcasting controls available in MAiTROLL, configure the broadcast settings, and start the broadcast when you are ready.',
      },
      {
        question: 'Can I stream from my phone?',
        answer:
          'Mobile broadcasting is supported on compatible devices and browsers.',
      },
      {
        question: 'Can I stream games?',
        answer:
          'Yes. MAiTROLL supports gaming and gameplay broadcasting, including the HytroGaming experience.',
      },
      {
        question: 'What is HytroGaming?',
        answer:
          'HytroGaming is the gaming-focused broadcasting experience within MAiTROLL. It is designed for direct game and PC screen-sharing workflows without requiring OBS for the supported experience.',
      },
      {
        question: 'Can I share my screen?',
        answer:
          'Yes. Screen sharing is supported for compatible broadcasting experiences, including HytroGaming.',
      },
      {
        question: 'Can viewers participate in broadcasts?',
        answer:
          'Yes. MAiTROLL supports audience participation and broadcast seats so viewers can participate when the broadcaster allows it.',
      },
      {
        question: 'Can guests join a broadcast?',
        answer:
          'Yes. Guest and seat participation are supported. Availability and seat limits are controlled by the current broadcast system and may change as the platform evolves.',
      },
      {
        question: 'Can I schedule broadcasts?',
        answer:
          'Scheduled broadcasting availability depends on the current MAiTROLL feature set. If scheduling is not available in your account, use the standard Go Live workflow.',
      },
    ],
  },
  {
    category: 'Troll Coins, MAi Pay & Cashouts',
    icon: Coins,
    questions: [
      {
        question: 'What are Troll Coins?',
        answer:
          'Troll Coins are MAiTROLL virtual currency used throughout supported platform experiences such as gifts, participation, events, and other city systems.',
      },
      {
        question: 'How do creators earn through MAiTROLL?',
        answer:
          'Eligible creators can earn through supported gifts, battles, events, and other monetization systems made available by MAiTROLL. Eligibility and payout requirements apply.',
      },
      {
        question: 'What is MAi Pay?',
        answer:
          'MAi Pay is the payment and cashout system used for eligible earnings and supported financial transactions within the MAiTROLL ecosystem.',
      },
      {
        question: 'What is the current MAi Pay cashout conversion?',
        answer:
          'The current MAi Pay conversion used for eligible cashout calculations is 150 Troll Coins = $1 USD.',
      },
      {
        question: 'Is the Coin Store conversion the same as the MAi Pay cashout conversion?',
        answer:
          'Not necessarily. Coin Store pricing and MAi Pay cashout calculations are separate financial systems. School Pool calculations specifically use the MAi Pay cashout ratio rather than Coin Store pricing.',
      },
      {
        question: 'Are cashout fees charged?',
        answer:
          'Cashout fees depend on the payment method and the current MAi Pay fee configuration. Current fees are displayed through the applicable cashout workflow.',
      },
      {
        question: 'Where do MAi Pay cashout fees go?',
        answer:
          'Under the current School Pool funding rules, eligible MAi Pay cashout fees are earmarked for the School Pool Funding Reserve.',
      },
      {
        question: 'Can every Troll Coin balance be cashed out?',
        answer:
          'No. MAiTROLL maintains different balance categories. Eligible earned balances may be withdrawable, while administrative, bonus, loan, credit, or other restricted balances may not be withdrawable.',
      },
      {
        question: 'Do I need verification to cash out?',
        answer:
          'Yes. Required account, payment, and eligibility verification must be completed before an eligible cashout can be processed.',
      },
    ],
  },
  {
    category: 'School Battles',
    icon: Trophy,
    questions: [
      {
        question: 'What are School Battles?',
        answer:
          'School Battles allow eligible broadcasters to represent a verified educational institution during competitive broadcast events while participating in the existing MAiTROLL battle system.',
      },
      {
        question: 'What school am I representing?',
        answer:
          'The represented school is tied to the authenticated user’s verified educational institution. Users cannot simply type an arbitrary school name and have it treated as verified.',
      },
      {
        question: 'Can State Battle and World Battle still be used?',
        answer:
          'MAiTROLL can retain its existing battle types and historical battle records while School Battle adds school representation as an additional attribution layer. Existing battle functionality should not be discarded simply because school representation was added.',
      },
      {
        question: 'How are School Battle winners determined?',
        answer:
          'School Battle results use the existing MAiTROLL battle engine, including its supported scoring, gifts, points, timers, participants, and winner logic. School attribution is added to that existing system.',
      },
      {
        question: 'Does representing a school mean the school owns my Troll Coins?',
        answer:
          'No. A user’s personal Troll Coin balances remain separate from School Pool accounting. School representation creates an attribution and competition relationship; it does not transfer personal balances to a school.',
      },
      {
        question: 'Will my school appear during a School Battle?',
        answer:
          'Yes. When a verified school is associated with an active School Battle participant, the represented school can be displayed as part of the broadcast experience, including beneath the City Status Orb where supported.',
      },
    ],
  },
  {
    category: 'School Pool',
    icon: School,
    questions: [
      {
        question: 'What is the School Pool?',
        answer:
          'The School Pool is a school-focused funding and recognition system connected to eligible School Battle activity. It tracks school contributions, weekly activity, lifetime amounts, settlements, and eventual graduation payouts.',
      },
      {
        question: 'How does a school earn School Pool money?',
        answer:
          'Eligible School Battle activity is converted into a USD contribution using the MAi Pay cashout ratio, and the applicable School Pool percentage is recorded for the represented school.',
      },
      {
        question: 'What percentage is contributed to the School Pool?',
        answer:
          'The current School Pool rule uses 5% of eligible school battle activity after converting the applicable Troll Coin amount into USD using the MAi Pay cashout ratio.',
      },
      {
        question: 'Is the 5% calculated using Coin Store prices?',
        answer:
          'No. School Pool accounting does not use Coin Store pricing. It uses the current MAi Pay cashout conversion of 150 Troll Coins = $1 USD for the applicable calculation.',
      },
      {
        question: 'Does the school with the most wins receive the entire School Pool?',
        answer:
          'No. School Pool contributions are tracked for participating schools according to the applicable contribution rules. Weekly wins identify the weekly winning school and are tracked separately from each school’s accumulated School Pool amount.',
      },
      {
        question: 'What happens every Friday?',
        answer:
          'The School Pool system performs its scheduled weekly settlement, records eligible school activity and wins, calculates the applicable contributions, and updates the school accounting records. The settlement is designed to run server-side and be idempotent so the same week is not settled twice.',
      },
      {
        question: 'Can users withdraw School Pool money?',
        answer:
          'No. School Pool funds are not a user wallet, creator balance, or transferable Troll Coin balance. They are tracked as school-related financial obligations and funding records.',
      },
      {
        question: 'When does a school receive its School Pool donation?',
        answer:
          'Eligible accumulated School Pool amounts are intended to be paid to the applicable school at graduation according to MAi Corp’s payout process. The system records the graduation payout status and payment information rather than allowing users to withdraw the funds themselves.',
      },
      {
        question: 'Are School Pool obligations and actual funding the same thing?',
        answer:
          'No. MAiTROLL tracks the School Pool obligation separately from the School Pool Funding Reserve. This allows the financial system to distinguish amounts attributed to schools from money actually reserved or funded for future payouts.',
      },
      {
        question: 'What other money can fund the School Pool reserve?',
        answer:
          'Under the current funding rules, eligible MAi Pay cashout fees and the $1 administration fees paid by regular users are earmarked for the School Pool Funding Reserve.',
      },
    ],
  },
  {
    category: 'Regular Users & Administration Fee',
    icon: Wallet,
    questions: [
      {
        question: 'Can regular users sign up for MAiTROLL?',
        answer:
          'Yes. Regular users may register under the current MAiTROLL registration rules.',
      },
      {
        question: 'What is the regular-user administration fee?',
        answer:
          'Regular users are required to pay a $1 administration fee directly through PayPal as part of the applicable registration process.',
      },
      {
        question: 'Do students and instructors pay the regular-user administration fee?',
        answer:
          'The $1 administration fee applies specifically to the regular-user registration flow. Eligible students and instructors should use the educational registration and verification process rather than being incorrectly routed through the regular-user flow.',
      },
      {
        question: 'What happens if the $1 administration payment fails?',
        answer:
          'A failed or declined administration payment should not leave an unauthorized regular-user account active. The registration flow is designed to prevent access until the applicable payment requirement is satisfied.',
      },
      {
        question: 'Where does the $1 administration fee go?',
        answer:
          'Under the current funding plan, eligible $1 regular-user administration fees are earmarked for the School Pool Funding Reserve.',
      },
    ],
  },
  {
    category: 'Community Features',
    icon: Users,
    questions: [
      {
        question: 'Can I message other users?',
        answer:
          'Yes. MAiTROLL includes messaging and communication features for supported user interactions.',
      },
      {
        question: 'Can I follow creators?',
        answer:
          'Yes. Following and other community features can help users stay connected to creators and activities they care about.',
      },
      {
        question: 'Can I create or join a group?',
        answer:
          'MAiTROLL includes community-oriented systems such as groups, families, pods, and other social experiences where supported.',
      },
      {
        question: 'Can I post content when I am not live?',
        answer:
          'Yes. MAiTROLL supports community and content experiences beyond live broadcasting.',
      },
      {
        question: 'Can I upload photos?',
        answer:
          'Supported MAiTROLL community areas allow users to share media according to the applicable content and moderation rules.',
      },
      {
        question: 'Can I comment on posts?',
        answer:
          'Yes. Supported community experiences include interaction features such as comments and reactions.',
      },
      {
        question: 'Can I block users?',
        answer:
          'Yes. Blocking and other safety tools are available in supported areas of MAiTROLL.',
      },
    ],
  },
  {
    category: 'City Systems & Services',
    icon: Landmark,
    questions: [
      {
        question: 'What does it mean that MAiTROLL is a virtual city?',
        answer:
          'The city concept organizes MAiTROLL into connected systems and destinations instead of treating the platform as a single social feed. Users can interact with areas focused on business, government, broadcasting, community, public services, transportation, commerce, living, and more.',
      },
      {
        question: 'What is City Hall?',
        answer:
          'City Hall is part of the MAiTROLL city experience and can contain civic and administrative-style activities. It is not simply a traditional software administration dashboard.',
      },
      {
        question: 'What public services are available?',
        answer:
          'MAiTROLL includes or is developing city-style public services and destinations such as transportation and licensing, support, safety, court systems, and other community services.',
      },
      {
        question: 'Does MAiTROLL have a court system?',
        answer:
          'Yes. Troll Court is part of the MAiTROLL city experience and supports applicable moderation, penalties, jail, payment, mute, and other court-related mechanics.',
      },
      
    ],
  },
  {
    category: 'Battles, Events & Competitions',
    icon: Gamepad2,
    questions: [
      {
        question: 'What are battles?',
        answer:
          'Battles are competitive live events where broadcasters can compete using the existing MAiTROLL battle mechanics, including supported gifts, points, timers, audience participation, and winner logic.',
      },
      {
        question: 'How do random battles work?',
        answer:
          'When Random Battle is available for your broadcast, the existing battle system can place eligible broadcasters into the appropriate matchmaking flow.',
      },
      {
        question: 'Can I challenge a specific creator?',
        answer:
          'Supported battle modes can allow broadcasters to challenge or compete against specific creators.',
      },
      {
        question: 'Are there leaderboards?',
        answer:
          'Yes. MAiTROLL includes leaderboard and ranking experiences for supported activities and competitions.',
      },
      {
        question: 'Are there school competitions?',
        answer:
          'Yes. School Battles add verified educational institution representation to the existing competition system.',
      },
      {
        question: 'What rewards can competitions provide?',
        answer:
          'Depending on the event, rewards may include Troll Coins, recognition, rankings, badges, promotional opportunities, or other event-specific rewards.',
      },
    ],
  },
  {
    category: 'Safety, Moderation & Governance',
    icon: Shield,
    questions: [
      {
        question: 'How do I report someone?',
        answer:
          'Use the available Report tools on supported profiles, broadcasts, messages, or content.',
      },
      {
        question: 'Does MAiTROLL moderate content?',
        answer:
          'Yes. MAiTROLL uses moderation and governance systems intended to maintain platform safety, integrity, and community standards.',
      },
      {
        question: 'What happens when someone violates the rules?',
        answer:
          'Depending on the violation and applicable enforcement rules, consequences can include warnings, restrictions, moderation actions, suspension, removal from activities, or permanent account removal.',
      },
      {
        question: 'Can moderators or officers access everything?',
        answer:
          'No. MAiTROLL uses role-based access controls for administrative and moderation systems. Privileged access must be granted through the appropriate backend permissions.',
      },
      {
        question: 'Can a user give themselves an officer or admin role?',
        answer:
          'No. Administrative, officer, lead officer, secretary, and other privileged roles must be controlled by the authorized backend role-management system.',
      },
      {
        question: 'How do I appeal a moderation action?',
        answer:
          'Use the applicable support or appeals process available through MAiTROLL.',
      },
    ],
  },
  {
    category: 'Account Management',
    icon: Users,
    questions: [
      {
        question: 'How do I verify my account?',
        answer:
          'Account verification requirements depend on the account type. Educational users must complete the applicable institution and email verification process, while other account verification requirements are handled through the relevant account workflow.',
      },
      {
        question: 'Can I change my username?',
        answer:
          'If username changes are enabled for your account, they can be managed through the applicable profile settings.',
      },
      {
        question: 'Can I have multiple accounts?',
        answer:
          'MAiTROLL account rules may restrict duplicate or abusive accounts. Users should maintain accounts according to the current Terms of Service and account policies.',
      },
      {
        question: 'How do I delete my account?',
        answer:
          'Account deletion can be initiated through the supported account settings or deletion workflow.',
      },
      {
        question: 'What happens to my account if I lose educational eligibility?',
        answer:
          'Educational verification and MAi Business eligibility are controlled separately from basic account existence. If an educational verification expires, is rejected, or otherwise becomes invalid, the applicable educational privileges can be restricted while the account itself is handled according to MAiTROLL account rules.',
      },
    ],
  },
  {
    category: 'Technical Questions',
    icon: Zap,
    questions: [
      {
        question: 'Why is my stream lagging?',
        answer:
          'Streaming performance can be affected by network quality, device performance, browser permissions, camera or microphone availability, and network congestion.',
      },
      {
        question: 'What internet connection is recommended?',
        answer:
          'A stable high-speed internet connection is recommended for broadcasting and high-quality viewing.',
      },
      {
        question: 'What browsers are supported?',
        answer:
          'Use a current version of a modern browser such as Chrome, Edge, Firefox, or Safari for the best compatibility.',
      },
      {
        question: 'Can I stream in HD?',
        answer:
          'HD availability depends on the broadcasting system, device, network, and current MAiTROLL streaming configuration.',
      },
      {
        question: 'Why can my microphone or camera fail to start?',
        answer:
          'Camera and microphone access can fail when browser permissions are denied, another application is using the device, the selected device is unavailable, or the device does not support the required media features.',
      },
      {
        question: 'What should I do if a page does not load correctly?',
        answer:
          'Refresh the page, confirm your internet connection, update your browser, and try again. If the issue continues, submit a support request with the page, device, browser, and error information.',
      },
    ],
  },
  {
    category: 'For Students & Entrepreneurs',
    icon: GraduationCap,
    questions: [
      {
        question: 'Can MAiTROLL help me build a business?',
        answer:
          'That is a core direction of the MAiTROLL ecosystem. MAiTROLL connects education and entrepreneurship so eligible educational users can use the platform as an environment for developing ideas, opportunities, and businesses.',
      },
      {
        question: 'What is the goal of MAi Business?',
        answer:
          'MAi Business is intended to give eligible educational users a dedicated environment for entrepreneurial development inside the broader MAiTROLL city.',
      },
      {
        question: 'Does MAiTROLL encourage people to only broadcast?',
        answer:
          'No. Broadcasting is a tool within MAiTROLL. The broader goal is to help users learn, create, build businesses, participate in their communities, and develop opportunities rather than simply spend time consuming content.',
      },
      {
        question: 'Can students represent their school?',
        answer:
          'Eligible verified educational users can represent their verified institution in supported School Battle experiences.',
      },
      {
        question: 'Can my school benefit from my participation?',
        answer:
          'Eligible School Battle activity can contribute to the applicable School Pool accounting for the represented institution.',
      },
    ],
  },
  {
    category: 'For Creators & Broadcasters',
    icon: Play,
    questions: [
      {
        question: 'Why should a creator use MAiTROLL?',
        answer:
          'MAiTROLL gives creators more than a live video window. Creators can participate in broadcasts, battles, community systems, events, school representation where eligible, and the broader virtual city.',
      },
      {
        question: 'Can I bring my existing audience?',
        answer:
          'Yes. Creators can invite their audiences to participate in MAiTROLL and experience the broader city ecosystem.',
      },
      {
        question: 'What creator tools are available?',
        answer:
          'Creator capabilities include live broadcasting, audience participation, battles, gifts, community interaction, gaming broadcasts, and other platform tools depending on account eligibility and the current feature set.',
      },
      {
        question: 'How is creator content moderated?',
        answer:
          'Creator content is subject to MAiTROLL safety, moderation, and community rules.',
      },
      {
        question: 'Are creator earnings guaranteed?',
        answer:
          'No. MAiTROLL does not guarantee creator income. Earnings depend on eligible activity, gifts, events, platform rules, payment eligibility, and other applicable factors.',
      },
      {
        question: 'Can creators grow on MAiTROLL?',
        answer:
          'MAiTROLL provides discovery, community, event, and participation opportunities that can help creators build an audience. Growth is not guaranteed and depends on creator activity and audience engagement.',
      },
      {
        question: 'How can creators provide feedback?',
        answer:
          'Feedback can be submitted through available support requests, bug reports, community discussions, or other feedback channels provided by MAiTROLL.',
      },
    ],
  },
  {
    category: 'Payments & Purchases',
    icon: CreditCard,
    questions: [
      {
        question: 'What payment methods does MAiTROLL support?',
        answer:
          'Payment methods depend on the transaction. MAiTROLL uses supported payment providers for purchases, administration fees, and eligible cashouts.',
      },
      {
        question: 'How are Troll Coin purchases handled?',
        answer:
          'Troll Coin purchases are processed through the applicable MAiTROLL payment flow. Purchased coins are separate from earned balances and other restricted balance categories.',
      },
      {
        question: 'Are Google Play purchases different from web purchases?',
        answer:
          'Mobile application purchases can use the applicable platform billing system. Coin quantities and pricing can differ between platforms and should be displayed by the applicable purchase flow.',
      },
      {
        question: 'What is the $1 administration payment?',
        answer:
          'It is the current administration fee required for applicable regular-user registration and is paid directly through PayPal rather than being converted into Troll Coins.',
      },
      {
        question: 'Can payment fees be used for School Pool funding?',
        answer:
          'Under the current funding rules, eligible MAi Pay cashout fees and regular-user $1 administration fees are earmarked for the School Pool Funding Reserve.',
      },
    ],
  },
  {
    category: 'MAiTROLL Mobile & Devices',
    icon: Smartphone,
    questions: [
      {
        question: 'Does MAiTROLL work on Android?',
        answer:
          'Yes. MAiTROLL is available for Android through the current application distribution process.',
      },
      {
        question: 'Does MAiTROLL work on iPhone?',
        answer:
          'MAiTROLL can be accessed through the web on iPhone and supported browsers. The web experience can be saved to the device for convenient access.',
      },
      {
        question: 'Can I broadcast from a mobile device?',
        answer:
          'Mobile broadcasting is supported on compatible devices when browser and device permissions are available.',
      },
      {
        question: 'Can I use MAiTROLL from a computer?',
        answer:
          'Yes. Desktop web access is supported and is especially useful for features such as PC gaming and screen-sharing experiences.',
      },
    ],
  },
]

export default function FAQPage() {
  const [openIndex, setOpenIndex] = useState<string | null>(null)

  const toggleQuestion = (key: string) => {
    setOpenIndex((current) => (current === key ? null : key))
  }

  return (
    <SEOLayout
      title="Frequently Asked Questions | MAiTROLL"
      description="Find answers about MAiTROLL, including education, entrepreneurship, MAi Business, broadcasting, School Battles, School Pool, Troll Coins, MAi Pay, payments, safety, and city systems."
      keywords={[
        'MAiTROLL FAQ',
        'MAiTROLL questions',
        'MAiTROLL help',
        'MAiTROLL education',
        'MAiTROLL students',
        'MAiTROLL instructors',
        'MAi Business',
        'School Battle',
        'School Pool',
        'MAi Pay',
        'Troll Coins',
        'broadcasting',
        'HytroGaming',
        'entrepreneurship',
        'virtual business city',
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
              Find answers about MAiTROLL, its virtual city systems, education,
              entrepreneurship, broadcasting, commerce, School Battles, School
              Pool, and more.{' '}
              <Link
                to="/contact"
                className="text-purple-400 hover:text-purple-300"
              >
                Contact us
              </Link>{' '}
              if you need additional help.
            </p>
          </div>
        </div>
      </section>

      <section className="py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          {faqData.map((category, catIndex) => {
            const Icon = category.icon

            return (
              <div key={category.category} className="mb-12">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-xl bg-purple-600/20 flex items-center justify-center">
                    <Icon className="w-5 h-5 text-purple-400" />
                  </div>

                  <h2 className="text-2xl font-bold text-white">
                    {category.category}
                  </h2>
                </div>

                <div className="space-y-3">
                  {category.questions.map((faq, qIndex) => {
                    const key = `${catIndex}-${qIndex}`
                    const isOpen = openIndex === key

                    return (
                      <div
                        key={key}
                        className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden"
                      >
                        <button
                          type="button"
                          onClick={() => toggleQuestion(key)}
                          aria-expanded={isOpen}
                          aria-controls={`faq-answer-${key}`}
                          className="w-full flex items-center justify-between p-5 text-left hover:bg-slate-800/50 transition-colors"
                        >
                          <span className="text-white font-medium pr-4">
                            {faq.question}
                          </span>

                          <ChevronDown
                            className={`w-5 h-5 text-slate-400 flex-shrink-0 transition-transform ${
                              isOpen ? 'rotate-180' : ''
                            }`}
                          />
                        </button>

                        {isOpen && (
                          <div
                            id={`faq-answer-${key}`}
                            className="px-5 pb-5 text-slate-400 leading-relaxed border-t border-slate-800 pt-4"
                          >
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
        description="Our support team is ready to help with questions that are not covered in the FAQ."
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

            <p className="text-slate-400 text-sm">
              Browse available support resources
            </p>
          </Link>

          <a
            href="mailto:ceo@maitroll.com"
            className="p-6 bg-slate-900/50 border border-slate-800 hover:border-purple-500/30 rounded-xl transition-all text-center"
          >
            <Mail className="w-8 h-8 text-blue-400 mx-auto mb-3" />

            <h4 className="text-white font-medium mb-1">Email Us</h4>

            <p className="text-slate-400 text-sm">
              ceo@maitroll.com
            </p>
          </a>
        </div>
      </SEOContentSection>

      <CTASection
        title="Have More Questions?"
        description="We're here to help. Reach out to the MAiTROLL support team."
        primaryAction={{
          label: 'Contact Support',
          path: '/contact',
        }}
        secondaryAction={{
          label: 'Back to Home',
          path: '/',
        }}
      />
    </SEOLayout>
  )
}