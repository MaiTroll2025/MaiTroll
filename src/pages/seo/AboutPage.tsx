import React from 'react'
import { Link } from 'react-router-dom'
import SEOLayout, {
  Breadcrumb,
  SEOContentSection,
  CTASection,
} from './SEOLayout'
import {
  Radio,
  Building2,
  GraduationCap,
  BriefcaseBusiness,
  Sparkles,
  TrendingUp,
  DollarSign,
  MessageCircle,
  Gift,
  Shield,
  Zap,
  Star,
  ArrowRight,
  Globe,
  Smartphone,
  Monitor,
  Laptop,
  Tablet,
  Chrome,
  RefreshCw,
  Cpu,
  Wifi,
  CircleAlert,
  CheckCircle2,
  School,
  Trophy,
  Landmark,
  Store,
  Users,
  Lightbulb,
} from 'lucide-react'

const features = [
  {
    icon: GraduationCap,
    title: 'Education',
    description:
      'MAiTROLL connects verified students and instructors with an environment designed around learning, participation, school representation, and opportunity.',
    slug: '/explore',
  },
  {
    icon: BriefcaseBusiness,
    title: 'MAi Business',
    description:
      'Build entrepreneurial ideas, develop skills, and participate in the MAiTROLL business ecosystem. MAi Business access is reserved for eligible verified educational users.',
    slug: '/explore',
  },
  {
    icon: Radio,
    title: 'Broadcasting',
    description:
      'Broadcast live, connect with audiences, participate in school activities, and use real-time communication as one part of the larger MAiTROLL city.',
    slug: '/go-live',
  },
  {
    icon: School,
    title: 'School Battles',
    description:
      'Represent your verified institution in School Battles and compete through organized school-based participation.',
    slug: '/explore',
  },
  {
    icon: Trophy,
    title: 'School Pool',
    description:
      'Eligible school activity contributes toward the School Pool, creating a structured connection between participation and school-focused opportunity.',
    slug: '/explore',
  },
  {
    icon: Store,
    title: 'Marketplace & Economy',
    description:
      'Participate in the MAiTROLL economy through marketplace activity, gifts, services, properties, digital rewards, and other city systems.',
    slug: '/marketplace',
  },
]

const howItWorks = [
  {
    step: '1',
    title: 'Join MAiTROLL',
    description:
      'Create your account and complete the appropriate educational verification or account requirements for your role.',
  },
  {
    step: '2',
    title: 'Enter the City',
    description:
      'Explore education, broadcasting, business, community, government, marketplace, transportation, and other parts of the virtual city.',
  },
  {
    step: '3',
    title: 'Build & Participate',
    description:
      'Broadcast, learn, represent your school, develop ideas, connect with others, participate in events, and build within the MAiTROLL ecosystem.',
  },
  {
    step: '4',
    title: 'Create Your Future',
    description:
      'Use the city as an environment to develop skills, ideas, businesses, communities, and opportunities that can extend beyond the platform.',
  },
]

const supportedDeviceGroups = [
  {
    icon: Smartphone,
    title: 'Phones',
    description:
      'Modern Android phones and iPhones using current operating systems and supported browsers.',
  },
  {
    icon: Tablet,
    title: 'Tablets',
    description:
      'Supported Android tablets and iPads with current browser and operating-system versions.',
  },
  {
    icon: Laptop,
    title: 'Laptops & Chromebooks',
    description:
      'Windows laptops, MacBooks, and Chromebooks with modern browser and media capabilities.',
  },
  {
    icon: Monitor,
    title: 'Desktop Computers',
    description:
      'Windows, macOS, ChromeOS, and compatible Linux computers using an up-to-date browser.',
  },
]

const compatibilityFactors = [
  {
    icon: Chrome,
    title: 'Browser Support',
    description:
      'Use a current version of Chrome, Safari, Edge, or another supported modern browser.',
  },
  {
    icon: RefreshCw,
    title: 'Software Updates',
    description:
      'Keep your operating system, browser, and Android System WebView updated for the best compatibility.',
  },
  {
    icon: Cpu,
    title: 'Device Hardware',
    description:
      'Live video and feature performance can depend on memory, processor capability, graphics support, and media decoding.',
  },
  {
    icon: Wifi,
    title: 'Internet Connection',
    description:
      'A stable broadband, Wi-Fi, or mobile data connection is recommended for live video and real-time features.',
  },
]

const citySystems = [
  {
    icon: GraduationCap,
    title: 'Education',
    description:
      'Verified students and instructors can participate in an environment connected to their educational institutions.',
  },
  {
    icon: BriefcaseBusiness,
    title: 'Entrepreneurship',
    description:
      'MAiTROLL is designed to help people move from ideas and skills toward real entrepreneurial development.',
  },
  {
    icon: Radio,
    title: 'Broadcasting',
    description:
      'Live video, podcasts, events, school activities, and real-time interaction are built into the city.',
  },
  {
    icon: Landmark,
    title: 'Government',
    description:
      'City government, officers, moderation, civic systems, and other administrative features give MAiTROLL its virtual-city structure.',
  },
  {
    icon: Store,
    title: 'Commerce',
    description:
      'Marketplace activity, businesses, services, properties, transportation, and the MAiTROLL economy create a connected digital environment.',
  },
  {
    icon: Users,
    title: 'Community',
    description:
      'Communities, conversations, families, Troll Pods, events, and social systems connect people throughout the city.',
  },
]

export default function AboutPage() {
  return (
    <SEOLayout
      title="About MAiTROLL | Virtual Business City for Students & Entrepreneurs"
      description="Learn about MAiTROLL, a virtual city connecting education, entrepreneurship, broadcasting, commerce, and community for students, instructors, and entrepreneurs."
      keywords={[
        'MAiTROLL',
        'Mai Troll',
        'virtual business city',
        'student entrepreneurship platform',
        'college student business platform',
        'student business opportunities',
        'entrepreneurship education',
        'college broadcasting',
        'school broadcasting',
        'school competition',
        'School Battle',
        'School Pool',
        'student creators',
        'instructor community',
        'college entrepreneurship',
        'virtual business community',
        'student business platform',
        'live broadcasting',
        'student entrepreneurs',
        'virtual city',
      ]}
    >
      <Breadcrumb items={[{ label: 'About' }]} />

      {/* HERO */}
      <section className="relative overflow-hidden py-20 lg:py-32">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-900/20 via-slate-900 to-pink-900/20" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(147,51,234,0.15),transparent_50%)]" />

        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-5xl text-center">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-purple-500/30 bg-purple-600/20 px-4 py-2 text-sm font-medium text-purple-300">
              <TrendingUp className="h-4 w-4" />
              Education • Entrepreneurship • Broadcasting
            </div>

            <h1 className="mb-6 text-4xl font-bold leading-tight text-white md:text-6xl lg:text-7xl">
              Welcome to{' '}
              <span className="bg-gradient-to-r from-purple-400 via-pink-400 to-purple-400 bg-clip-text text-transparent">
                MAiTROLL
              </span>
            </h1>

            <p className="mx-auto max-w-4xl text-xl leading-relaxed text-slate-300 md:text-2xl">
              A virtual city built to connect education, entrepreneurship,
              broadcasting, commerce, and community in one digital environment.
            </p>

            <p className="mx-auto mt-6 max-w-3xl text-base leading-relaxed text-slate-400 md:text-lg">
              MAiTROLL is built for people who want to learn, create, build
              businesses, represent their schools, connect with communities,
              and turn ideas into something real.
            </p>
          </div>
        </div>
      </section>

      {/* WHO MAITROLL IS FOR */}
      <section className="py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto mb-16 max-w-3xl text-center">
            <h2 className="mb-4 text-3xl font-bold text-white md:text-4xl">
              Built for People Who Want to Build
            </h2>

            <p className="text-lg leading-relaxed text-slate-400">
              MAiTROLL brings different parts of the modern educational and
              entrepreneurial experience into one connected virtual city.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-7">
              <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-500/15">
                <GraduationCap className="h-7 w-7 text-blue-400" />
              </div>

              <h3 className="mb-3 text-2xl font-semibold text-white">
                Students
              </h3>

              <p className="text-sm leading-relaxed text-slate-400">
                Verified students can participate in school representation,
                School Battles, educational communities, entrepreneurship
                opportunities, broadcasting, and other city systems.
              </p>
            </div>

            <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-7">
              <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-purple-500/15">
                <School className="h-7 w-7 text-purple-400" />
              </div>

              <h3 className="mb-3 text-2xl font-semibold text-white">
                Instructors
              </h3>

              <p className="text-sm leading-relaxed text-slate-400">
                Verified instructors can connect with educational communities,
                participate in broadcasts and activities, and contribute to
                the learning and development environment.
              </p>
            </div>

            <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-7">
              <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-pink-500/15">
                <Lightbulb className="h-7 w-7 text-pink-400" />
              </div>

              <h3 className="mb-3 text-2xl font-semibold text-white">
                Entrepreneurs
              </h3>

              <p className="text-sm leading-relaxed text-slate-400">
                MAiTROLL creates an environment where ideas, skills, education,
                business development, and entrepreneurial participation can
                connect.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* WHAT IS MAITROLL */}
      <section className="bg-gradient-to-b from-slate-900/50 to-slate-900 py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-4xl">
            <h2 className="mb-6 text-3xl font-bold text-white md:text-4xl">
              What Is MAiTROLL?
            </h2>

            <div className="space-y-6 text-lg leading-relaxed text-slate-300">
              <p>
                <strong className="text-white">MAiTROLL</strong> is a virtual
                city designed around education, entrepreneurship,
                broadcasting, commerce, and community.
              </p>

              <p>
                Instead of separating these experiences across unrelated
                platforms, MAiTROLL brings them together into one connected
                digital environment. The city includes systems for education,
                broadcasting, business, government, community, commerce,
                transportation, properties, services, and more.
              </p>

              <p>
                Broadcasting is an important part of MAiTROLL — but it is not
                the entire purpose of the platform. A person can come to
                broadcast, participate in a School Battle, develop an
                entrepreneurial idea, connect with their community, explore
                the marketplace, or participate in other city systems.
              </p>

              <p className="text-xl font-medium text-white">
                MAiTROLL isn&apos;t designed for people to simply sit around and
                consume content. It is designed to help people build something.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* THE VIRTUAL CITY */}
      <section className="relative overflow-hidden border-y border-slate-800/80 bg-slate-950 py-20">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(124,58,237,0.10),transparent_40%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_right,rgba(236,72,153,0.08),transparent_38%)]" />

        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto mb-14 max-w-3xl text-center">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-purple-500/30 bg-purple-500/10 px-4 py-2 text-sm font-medium text-purple-300">
              <Building2 className="h-4 w-4" />
              One Virtual City
            </div>

            <h2 className="mb-5 text-3xl font-bold text-white md:text-4xl">
              More Than a Streaming Platform
            </h2>

            <p className="text-lg leading-relaxed text-slate-400">
              MAiTROLL uses a city structure to connect systems that normally
              exist across separate services and communities.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {citySystems.map((system) => {
              const Icon = system.icon

              return (
                <div
                  key={system.title}
                  className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6"
                >
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-purple-600/15">
                    <Icon className="h-6 w-6 text-purple-400" />
                  </div>

                  <h3 className="mb-2 text-xl font-semibold text-white">
                    {system.title}
                  </h3>

                  <p className="text-sm leading-relaxed text-slate-400">
                    {system.description}
                  </p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* CORE FEATURES */}
      <section className="py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-16 text-center">
            <h2 className="mb-4 text-3xl font-bold text-white md:text-4xl">
              The MAiTROLL Ecosystem
            </h2>

            <p className="mx-auto max-w-3xl text-lg text-slate-400">
              Education, business, broadcasting, school participation, and
              commerce are connected inside the same virtual environment.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => {
              const Icon = feature.icon

              return (
                <Link
                  key={feature.title}
                  to={feature.slug}
                  className="group rounded-2xl border border-slate-800 bg-slate-900/50 p-6 transition-all hover:border-purple-500/30 hover:bg-slate-800/50"
                >
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-purple-600/20 transition-colors group-hover:bg-purple-600/30">
                    <Icon className="h-6 w-6 text-purple-400" />
                  </div>

                  <h3 className="mb-2 text-xl font-semibold text-white">
                    {feature.title}
                  </h3>

                  <p className="text-sm leading-relaxed text-slate-400">
                    {feature.description}
                  </p>

                  <div className="mt-4 flex items-center text-sm font-medium text-purple-400 group-hover:text-purple-300">
                    Learn more
                    <ArrowRight className="ml-1 h-4 w-4" />
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
      </section>

      {/* SCHOOL ECOSYSTEM */}
      <SEOContentSection
        title="Education Meets Opportunity"
        description="MAiTROLL connects verified educational identity with participation, competition, and entrepreneurial development."
        icon={GraduationCap}
      >
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-5">
          {[
            {
              icon: School,
              title: 'Verified Institution',
            },
            {
              icon: GraduationCap,
              title: 'Student or Instructor',
            },
            {
              icon: Radio,
              title: 'Participate',
            },
            {
              icon: Trophy,
              title: 'School Battle',
            },
            {
              icon: DollarSign,
              title: 'School Pool',
            },
          ].map((item, index) => {
            const Icon = item.icon

            return (
              <div
                key={item.title}
                className="relative rounded-2xl border border-slate-800 bg-slate-900/60 p-5 text-center"
              >
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-purple-500/15">
                  <Icon className="h-6 w-6 text-purple-400" />
                </div>

                <h3 className="text-sm font-semibold text-white">
                  {item.title}
                </h3>

                {index < 4 && (
                  <ArrowRight className="absolute -right-5 top-1/2 hidden h-5 w-5 -translate-y-1/2 text-slate-600 lg:block" />
                )}
              </div>
            )
          })}
        </div>

        <div className="mt-8 rounded-2xl border border-purple-500/20 bg-purple-500/5 p-6">
          <p className="text-center text-sm leading-relaxed text-slate-300">
            School representation is tied to verified educational identity.
            Users do not simply type in a school name and claim representation.
            MAiTROLL&apos;s educational systems are designed to use verified
            institution records and server-side eligibility rules.
          </p>
        </div>
      </SEOContentSection>

      {/* ENTREPRENEURSHIP */}
      <SEOContentSection
        title="From Student Idea to Real Business"
        description="MAiTROLL is designed to create a pathway from education and participation toward entrepreneurship."
        icon={BriefcaseBusiness}
      >
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {[
            {
              icon: GraduationCap,
              title: 'Learn',
              description:
                'Develop knowledge and skills through educational participation.',
            },
            {
              icon: Lightbulb,
              title: 'Develop',
              description:
                'Turn ideas into concepts that can be explored and improved.',
            },
            {
              icon: BriefcaseBusiness,
              title: 'Build',
              description:
                'Develop entrepreneurial skills and participate in business systems.',
            },
            {
              icon: TrendingUp,
              title: 'Grow',
              description:
                'Move toward real-world entrepreneurial opportunities and development.',
            },
          ].map((item) => {
            const Icon = item.icon

            return (
              <div
                key={item.title}
                className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6"
              >
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-pink-500/15">
                  <Icon className="h-6 w-6 text-pink-400" />
                </div>

                <h3 className="mb-2 text-lg font-semibold text-white">
                  {item.title}
                </h3>

                <p className="text-sm leading-relaxed text-slate-400">
                  {item.description}
                </p>
              </div>
            )
          })}
        </div>

        <div className="mt-8 rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
          <p className="text-sm leading-relaxed text-slate-400">
            MAiTROLL may develop additional entrepreneurship programs,
            opportunities, and business initiatives over time. Program
            eligibility and availability are determined by the applicable
            MAiTROLL program rules.
          </p>
        </div>
      </SEOContentSection>

      {/* SCHOOL POOL */}
      <SEOContentSection
        title="School Pool: Turning Participation Into Opportunity"
        description="MAiTROLL connects eligible School Battle activity with a structured school-focused pool."
        icon={Trophy}
      >
        <div className="grid gap-8 lg:grid-cols-2">
          <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-7">
            <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-green-500/15">
              <DollarSign className="h-7 w-7 text-green-400" />
            </div>

            <h3 className="mb-3 text-2xl font-semibold text-white">
              Built Around School Participation
            </h3>

            <p className="text-sm leading-relaxed text-slate-400">
              Eligible School Battle activity can contribute to a school&apos;s
              School Pool amount. Activity is tracked and settled through
              MAiTROLL&apos;s financial systems rather than being treated as a
              normal user wallet.
            </p>
          </div>

          <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-7">
            <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-500/15">
              <Shield className="h-7 w-7 text-blue-400" />
            </div>

            <h3 className="mb-3 text-2xl font-semibold text-white">
              Tracked Separately
            </h3>

            <p className="text-sm leading-relaxed text-slate-400">
              School Pool accounting is separate from Troll Coin balances.
              Contributions, funding sources, weekly settlements, and eventual
              school payouts are tracked through dedicated financial records.
            </p>
          </div>
        </div>
      </SEOContentSection>

      {/* BROADCASTING */}
      <SEOContentSection
        title="Broadcast. Connect. Represent."
        description="Live broadcasting is one of the ways people participate in the MAiTROLL city."
        icon={Radio}
      >
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {[
            {
              icon: Radio,
              title: 'Go Live',
              description:
                'Broadcast live and connect with an audience in real time.',
            },
            {
              icon: Trophy,
              title: 'Represent',
              description:
                'Participate in school-based activities and School Battles.',
            },
            {
              icon: MessageCircle,
              title: 'Connect',
              description:
                'Chat, communicate, participate in communities, and interact with others.',
            },
            {
              icon: Sparkles,
              title: 'Participate',
              description:
                'Use broadcasting as part of a larger ecosystem rather than the entire experience.',
            },
          ].map((item) => {
            const Icon = item.icon

            return (
              <div
                key={item.title}
                className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6"
              >
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-purple-500/15">
                  <Icon className="h-6 w-6 text-purple-400" />
                </div>

                <h3 className="mb-2 text-lg font-semibold text-white">
                  {item.title}
                </h3>

                <p className="text-sm leading-relaxed text-slate-400">
                  {item.description}
                </p>
              </div>
            )
          })}
        </div>
      </SEOContentSection>

      {/* HOW IT WORKS */}
      <SEOContentSection
        title="How MAiTROLL Works"
        description="Getting started means entering a connected virtual city rather than simply joining another content platform."
        icon={Zap}
      >
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {howItWorks.map((item) => (
            <div key={item.step} className="relative">
              <div className="absolute -left-2 -top-2 flex h-8 w-8 items-center justify-center rounded-full bg-purple-600 text-sm font-bold text-white">
                {item.step}
              </div>

              <div className="pl-2 pt-8">
                <h3 className="mb-2 text-lg font-semibold text-white">
                  {item.title}
                </h3>

                <p className="text-sm leading-relaxed text-slate-400">
                  {item.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </SEOContentSection>

      {/* WHY MAITROLL IS DIFFERENT */}
      <SEOContentSection
        title="Why MAiTROLL Is Different"
        description="The difference is not one individual feature. It is how the systems are connected."
        icon={Star}
      >
        <div className="grid gap-6 md:grid-cols-2">
          {[
            {
              icon: GraduationCap,
              title: 'Education + Entrepreneurship',
              description:
                'Education is connected to entrepreneurial development rather than being isolated from the business ecosystem.',
            },
            {
              icon: School,
              title: 'School Representation',
              description:
                'Verified educational identity can connect students and instructors to school participation and School Battles.',
            },
            {
              icon: BriefcaseBusiness,
              title: 'Business Inside the City',
              description:
                'MAi Business is part of the larger MAiTROLL environment, subject to its eligibility and verification requirements.',
            },
            {
              icon: Radio,
              title: 'Broadcasting With Purpose',
              description:
                'Live broadcasting is a tool for communication, participation, entertainment, and school/community activity.',
            },
            {
              icon: DollarSign,
              title: 'A Connected Economy',
              description:
                'Troll Coins, gifting, marketplace activity, services, properties, payments, and school-focused financial systems work within the city.',
            },
            {
              icon: Shield,
              title: 'Safety & Governance',
              description:
                'Moderation, government, officers, court systems, and other city structures support the platform environment.',
            },
          ].map((item) => {
            const Icon = item.icon

            return (
              <div
                key={item.title}
                className="flex items-start gap-4 rounded-2xl border border-slate-800 bg-slate-900/50 p-6"
              >
                <div className="mt-1 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-purple-500/15">
                  <Icon className="h-5 w-5 text-purple-400" />
                </div>

                <div>
                  <h3 className="mb-2 text-lg font-semibold text-white">
                    {item.title}
                  </h3>

                  <p className="text-sm leading-relaxed text-slate-400">
                    {item.description}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      </SEOContentSection>

      {/* DEVICE COMPATIBILITY */}
      <section className="relative overflow-hidden border-y border-slate-800/80 bg-slate-950 py-20">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(124,58,237,0.10),transparent_40%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_right,rgba(236,72,153,0.08),transparent_38%)]" />

        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto mb-14 max-w-3xl text-center">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-blue-500/30 bg-blue-500/10 px-4 py-2 text-sm font-medium text-blue-300">
              <Smartphone className="h-4 w-4" />
              Device Compatibility
            </div>

            <h2 className="mb-5 text-3xl font-bold text-white md:text-4xl">
              Where You Can Use MAiTROLL
            </h2>

            <p className="text-lg leading-relaxed text-slate-400">
              MAiTROLL is designed for modern phones, tablets, laptops,
              Chromebooks, and desktop computers. Actual performance depends
              on the device, browser, operating system, hardware, and internet
              connection.
            </p>
          </div>

          <div className="mb-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {supportedDeviceGroups.map((device) => {
              const Icon = device.icon

              return (
                <div
                  key={device.title}
                  className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6"
                >
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-500/15">
                    <Icon className="h-6 w-6 text-blue-400" />
                  </div>

                  <h3 className="mb-2 text-lg font-semibold text-white">
                    {device.title}
                  </h3>

                  <p className="text-sm leading-relaxed text-slate-400">
                    {device.description}
                  </p>
                </div>
              )
            })}
          </div>

          <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-6 md:p-8">
              <h3 className="mb-6 text-2xl font-semibold text-white">
                What Affects Compatibility?
              </h3>

              <div className="grid gap-6 sm:grid-cols-2">
                {compatibilityFactors.map((factor) => {
                  const Icon = factor.icon

                  return (
                    <div key={factor.title} className="flex items-start gap-4">
                      <div className="mt-1 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-purple-500/15">
                        <Icon className="h-5 w-5 text-purple-400" />
                      </div>

                      <div>
                        <h4 className="mb-1 font-medium text-white">
                          {factor.title}
                        </h4>

                        <p className="text-sm leading-relaxed text-slate-400">
                          {factor.description}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="space-y-6">
              <div className="rounded-3xl border border-amber-500/20 bg-amber-500/5 p-6 md:p-8">
                <div className="mb-4 flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-500/15">
                    <CircleAlert className="h-6 w-6 text-amber-400" />
                  </div>

                  <h3 className="text-xl font-semibold text-white">
                    Older Device Limitations
                  </h3>
                </div>

                <p className="text-sm leading-relaxed text-slate-300">
                  Older devices or browsers may experience limited camera
                  access, delayed playback, black video, reduced stream
                  quality, or slower performance. These issues can result from
                  browser policies, outdated software, unsupported codecs,
                  limited hardware decoding, or device-specific restrictions.
                </p>
              </div>

              <div className="rounded-3xl border border-green-500/20 bg-green-500/5 p-6 md:p-8">
                <div className="mb-4 flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-green-500/15">
                    <CheckCircle2 className="h-6 w-6 text-green-400" />
                  </div>

                  <h3 className="text-xl font-semibold text-white">
                    Recommended Troubleshooting
                  </h3>
                </div>

                <ul className="space-y-3 text-sm leading-relaxed text-slate-300">
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-400" />
                    Update your browser and operating system.
                  </li>

                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-400" />
                    On Android, update Android System WebView and Google Chrome.
                  </li>

                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-400" />
                    Allow camera, microphone, sound, and media permissions.
                  </li>

                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-400" />
                    Try another supported browser if media playback is blocked.
                  </li>

                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-400" />
                    Use a newer device when older hardware cannot support a
                    required media feature.
                  </li>
                </ul>
              </div>
            </div>
          </div>

          <div className="mx-auto mt-12 max-w-4xl rounded-2xl border border-slate-700 bg-slate-900/80 p-6 text-center">
            <p className="text-sm leading-relaxed text-slate-300">
              A feature working on one device but not another does not
              necessarily indicate an account problem. Hardware, browser
              behavior, media permissions, software support, and manufacturer
              restrictions can affect the MAiTROLL experience differently
              across devices.
            </p>
          </div>
        </div>
      </section>

      {/* PHILOSOPHY */}
      <section className="relative overflow-hidden py-24">
        <div className="absolute inset-0 bg-gradient-to-r from-purple-900/10 via-transparent to-pink-900/10" />

        <div className="relative mx-auto max-w-5xl px-4 text-center sm:px-6 lg:px-8">
          <div className="mb-6 flex justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-purple-600/20">
              <Zap className="h-8 w-8 text-purple-400" />
            </div>
          </div>

          <h2 className="mb-6 text-3xl font-bold text-white md:text-5xl">
            Don&apos;t Just Watch Someone Else Build Their Future.
          </h2>

          <p className="mx-auto max-w-3xl text-xl leading-relaxed text-slate-300">
            Build yours.
          </p>

          <p className="mx-auto mt-6 max-w-3xl text-base leading-relaxed text-slate-400 md:text-lg">
            MAiTROLL is a virtual city built for people who want to learn,
            create, build businesses, represent their schools, connect with
            communities, and turn ideas into something real.
          </p>
        </div>
      </section>

      {/* CTA */}
      <CTASection
        title="Enter MAiTROLL"
        description="Join a virtual city built around education, entrepreneurship, broadcasting, commerce, and community."
        primaryAction={{ label: 'Create Your Account', path: '/auth' }}
        secondaryAction={{ label: 'Explore MAiTROLL', path: '/explore' }}
      />
    </SEOLayout>
  )
}

