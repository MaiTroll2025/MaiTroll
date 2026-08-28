import React from 'react'
import { Link } from 'react-router-dom'
import SEOLayout, { Breadcrumb, SEOContentSection, CTASection } from './SEOLayout'
import {
  Radio,
  Building2,
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
} from 'lucide-react'

const features = [
  {
    icon: Radio,
    title: 'Live Broadcasting',
    description:
      'Stream to viewers with real-time interaction, virtual gifts, and creator monetization tools.',
    slug: '/go-live',
  },
  {
    icon: Building2,
    title: 'Government System',
    description:
      'Participate in Mai Troll democracy. Vote for leaders, run for office, and help shape the community.',
    slug: '/government',
  },
  {
    icon: Sparkles,
    title: 'Content Categories',
    description:
      'Discover live and trending content across gaming, music, art, entertainment, and more.',
    slug: '/explore',
  },
  {
    icon: DollarSign,
    title: 'Creator Economy',
    description:
      'Earn as a content creator through virtual gifts, audience support, and platform monetization features.',
    slug: '/creators',
  },
  {
    icon: MessageCircle,
    title: 'Social Communities',
    description:
      'Join families, create groups, participate in conversations, and connect with people who share your interests.',
    slug: '/explore',
  },
  {
    icon: Gift,
    title: 'Virtual Economy',
    description:
      'Participate in Mai Troll through virtual gifts, marketplace activity, property features, and digital rewards.',
    slug: '/marketplace',
  },
]

const howItWorks = [
  {
    step: '1',
    title: 'Create Your Account',
    description:
      'Sign up, choose your username, and customize your profile to begin your Mai Troll experience.',
  },
  {
    step: '2',
    title: 'Discover Content',
    description:
      'Explore live streams, creators, communities, and trending activity across the platform.',
  },
  {
    step: '3',
    title: 'Watch or Go Live',
    description:
      'Join a live audience, participate in chat, or start a broadcast and build your own community.',
  },
  {
    step: '4',
    title: 'Engage & Grow',
    description:
      'Connect with viewers, receive gifts, grow your audience, and participate in Mai Troll features.',
  },
]

const supportedDeviceGroups = [
  {
    icon: Smartphone,
    title: 'Phones',
    description:
      'Modern Android phones and iPhones with current operating systems and updated browsers.',
  },
  {
    icon: Tablet,
    title: 'Tablets',
    description:
      'Supported Android tablets and iPads using current versions of Chrome, Safari, or another compatible browser.',
  },
  {
    icon: Laptop,
    title: 'Laptops & Chromebooks',
    description:
      'Windows laptops, MacBooks, and Chromebooks with modern browser and media playback support.',
  },
  {
    icon: Monitor,
    title: 'Desktop Computers',
    description:
      'Windows, macOS, ChromeOS, and compatible Linux desktops using an up-to-date browser.',
  },
]

const compatibilityFactors = [
  {
    icon: Chrome,
    title: 'Browser Support',
    description:
      'Use the latest available version of Chrome, Safari, Edge, or another modern Chromium-based browser.',
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
      'Live video performance depends on available memory, processor speed, graphics support, and video decoding capabilities.',
  },
  {
    icon: Wifi,
    title: 'Internet Connection',
    description:
      'A stable broadband, Wi-Fi, or mobile data connection is recommended for live video and real-time interaction.',
  },
]

export default function AboutPage() {
  return (
    <SEOLayout
      title="About Mai Troll | Social Streaming Platform"
      description="Learn about Mai Troll (MaiTroll), a social streaming platform for creators, streamers, gamers, and online communities. Review platform features, supported devices, browser compatibility, and live streaming requirements."
      keywords={[
        'MaiTroll',
        'MaiTroll',
        'about Mai Troll',
        'social streaming platform',
        'live streaming',
        'go live',
        'broadcasting',
        'content creator',
        'make money online',
        'live chat',
        'streaming platform',
        'live broadcast',
        'watch live streams',
        'creator economy',
        'monetize content',
        'social streaming',
        'live entertainment',
        'MaiTroll streaming',
        'supported devices',
        'browser compatibility',
        'Android streaming',
        'iPhone streaming',
        'desktop streaming',
        'laptop streaming',
      ]}
    >
      <Breadcrumb items={[{ label: 'About' }]} />

      <section className="relative overflow-hidden py-20 lg:py-32">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-900/20 via-slate-900 to-pink-900/20" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(147,51,234,0.15),transparent_50%)]" />

        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-4xl text-center">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-purple-500/30 bg-purple-600/20 px-4 py-2 text-sm font-medium text-purple-300">
              <TrendingUp className="h-4 w-4" />
              Social Streaming, Community, and Creator Tools
            </div>

            <h1 className="mb-6 text-4xl font-bold leading-tight text-white md:text-6xl lg:text-7xl">
              About{' '}
              <span className="bg-gradient-to-r from-purple-400 via-pink-400 to-purple-400 bg-clip-text text-transparent">
                Mai Troll
              </span>
            </h1>

            <p className="mx-auto max-w-3xl text-xl leading-relaxed text-slate-300">
              Mai Troll, also known as MaiTroll, is a social streaming
              platform built for creators, streamers, gamers, and online
              communities. The platform combines livestreaming, real-time
              interaction, community participation, creator tools, and digital
              engagement in one connected experience.
            </p>
          </div>
        </div>
      </section>

      <section className="py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-16 text-center">
            <h2 className="mb-4 text-3xl font-bold text-white md:text-4xl">
              Everything You Need in One Platform
            </h2>
            <p className="mx-auto max-w-2xl text-lg text-slate-400">
              From live broadcasting and creator tools to communities and
              platform participation, Mai Troll brings social entertainment
              together in one place.
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

      <section className="bg-gradient-to-b from-slate-900/50 to-slate-900 py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-4xl">
            <h2 className="mb-6 text-3xl font-bold text-white md:text-4xl">
              What Is Mai Troll?
            </h2>

            <div className="space-y-6 text-lg leading-relaxed text-slate-300">
              <p>
                <strong className="text-white">Mai Troll</strong> and{' '}
                <strong className="text-white">MaiTroll</strong> refer to
                the same digital platform. Mai Troll is designed for live
                entertainment, social interaction, creator content, and online
                community participation.
              </p>

              <p>
                Users can watch live broadcasts, interact through chat, join
                communities, participate in platform activities, support
                creators, and use features designed around real-time engagement.
              </p>

              <p>
                <strong className="text-white">
                  Mai Troll is a social streaming platform.
                </strong>{' '}
                It is not connected to a physical city, municipality, or
                geographic location. The name represents a digital community
                and entertainment environment.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden border-y border-slate-800/80 bg-slate-950 py-20">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(124,58,237,0.10),transparent_40%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_right,rgba(236,72,153,0.08),transparent_38%)]" />

        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto mb-14 max-w-3xl text-center">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-blue-500/30 bg-blue-500/10 px-4 py-2 text-sm font-medium text-blue-300">
              <Smartphone className="h-4 w-4" />
              Device and Browser Compatibility
            </div>

            <h2 className="mb-5 text-3xl font-bold text-white md:text-4xl">
              Supported Devices & Compatibility
            </h2>

            <p className="text-lg leading-relaxed text-slate-400">
              Mai Troll is designed to work across modern phones, tablets,
              laptops, Chromebooks, and desktop computers. Actual performance
              can vary based on the age of the device, browser version,
              operating system, available memory, hardware video support, and
              manufacturer restrictions. 2024 devices are more reliable to work! All Laptops should work, Ipads and Iphones from 2024 as well!
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

                <p className="mb-4 text-sm leading-relaxed text-slate-300">
                  Some older phones, tablets, computers, or browsers may allow
                  audio playback while preventing live video from starting
                  automatically. Other devices may experience black video,
                  delayed playback, lower stream quality, limited camera access,
                  or reduced performance during feature-heavy broadcasts.
                </p>

                <p className="text-sm leading-relaxed text-slate-400">
                  These differences can be caused by browser autoplay policies,
                  outdated Android System WebView versions, unsupported video
                  codecs, limited hardware decoding, low available memory, or
                  device-specific manufacturer settings.
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
                    Tap the video or audio controls if autoplay is blocked.
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-400" />
                    Try another supported browser or a newer device.
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-400" />
                    Confirm that camera, microphone, sound, and autoplay
                    permissions are enabled.
                  </li>
                </ul>
              </div>
            </div>
          </div>

          <div className="mx-auto mt-12 max-w-4xl rounded-2xl border border-slate-700 bg-slate-900/80 p-6 text-center">
            <p className="text-sm leading-relaxed text-slate-300">
              A feature working on one device but not another does not
              necessarily indicate an account problem. Device hardware, browser
              behavior, media permissions, and software support can affect live
              video differently across manufacturers and operating system
              versions.
            </p>
          </div>
        </div>
      </section>

      <SEOContentSection
        title="How Mai Troll Works"
        description="Getting started is straightforward whether you want to watch, participate, or broadcast."
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
                <p className="text-sm text-slate-400">{item.description}</p>
              </div>
            </div>
          ))}
        </div>
      </SEOContentSection>

      <SEOContentSection
        title="Why Choose Mai Troll?"
        description="Mai Troll combines live entertainment, creator opportunities, and community participation in one platform."
        icon={Star}
      >
        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="mt-1 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-green-500/20">
                <Shield className="h-3 w-3 text-green-400" />
              </div>
              <div>
                <h4 className="font-medium text-white">Safety & Moderation</h4>
                <p className="text-sm text-slate-400">
                  Moderation tools and community standards help support a safer
                  platform environment.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="mt-1 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-purple-500/20">
                <DollarSign className="h-3 w-3 text-purple-400" />
              </div>
              <div>
                <h4 className="font-medium text-white">Creator Opportunities</h4>
                <p className="text-sm text-slate-400">
                  Creators can build audiences and participate in Mai Troll
                  monetization and gifting features.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="mt-1 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-pink-500/20">
                <Globe className="h-3 w-3 text-pink-400" />
              </div>
              <div>
                <h4 className="font-medium text-white">Global Community</h4>
                <p className="text-sm text-slate-400">
                  Connect with creators, viewers, and communities from different
                  locations and backgrounds.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="mt-1 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-blue-500/20">
                <Smartphone className="h-3 w-3 text-blue-400" />
              </div>
              <div>
                <h4 className="font-medium text-white">
                  Multi-Device Availability
                </h4>
                <p className="text-sm text-slate-400">
                  Access Mai Troll from compatible mobile devices, tablets,
                  laptops, Chromebooks, and desktop computers.
                </p>
              </div>
            </div>
          </div>
        </div>
      </SEOContentSection>

      <CTASection
        title="Explore the Mai Troll Community"
        description="Discover live streams, creators, communities, and platform activity."
        primaryAction={{ label: 'Create Free Account', path: '/auth' }}
        secondaryAction={{ label: 'Explore Live Streams', path: '/explore' }}
      />
    </SEOLayout>
  )
}