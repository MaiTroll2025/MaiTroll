import React from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Radio, Users } from 'lucide-react'
import SEOLayout, { Breadcrumb } from './SEOLayout'

function FeatureSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8 rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
      <h2 className="mb-3 text-2xl font-bold text-white">{title}</h2>
      <div className="space-y-3 leading-relaxed text-slate-300">{children}</div>
    </section>
  )
}

export function BroadcastingAppPage() {
  return (
    <SEOLayout
      title="Live Broadcasting App for Creators"
      description="Explore MaiTroll, a live broadcasting app for creators to stream games, connect with viewers, and build an audience from supported phones, tablets, and computers."
      keywords={['broadcasting app', 'new broadcasting app', 'broadcast app', 'live streaming app', 'stream games', 'creator app']}
    >
      <div className="mx-auto max-w-5xl px-4 py-12">
        <Breadcrumb items={[{ label: 'Features', path: '/about' }, { label: 'Broadcasting App' }]} />
        <header className="mb-10">
          <Radio className="mb-4 h-10 w-10 text-purple-300" />
          <p className="mb-2 text-sm font-bold uppercase tracking-widest text-purple-300">Broadcasting on MaiTroll</p>
          <h1 className="mb-4 text-4xl font-black text-white md:text-5xl">A live broadcasting app made for creators</h1>
          <p className="max-w-3xl text-lg leading-relaxed text-slate-300">
            MaiTroll brings live broadcasts, creator profiles, and community interaction together. Stream games and other content from a supported device, then connect with viewers through live chat and the wider MaiTroll community.
          </p>
        </header>

        <FeatureSection title="Go live from the setup that fits you">
          <p>Use a compatible phone, tablet, laptop, or desktop browser to access MaiTroll. Device capabilities and browser support vary, so check your camera, microphone, and network before starting a broadcast.</p>
          <p>Creators can use a mobile setup for convenient streaming or a computer setup when they want to work with their preferred streaming equipment. No single setup is required for every broadcast.</p>
        </FeatureSection>

        <FeatureSection title="Video quality and latency depend on your connection">
          <p>Broadcast quality and delay are affected by your network, device, browser, and streaming conditions. A stable connection and supported, up-to-date device can help provide a smoother viewing experience.</p>
          <p>MaiTroll does not promise a fixed latency or video resolution across every device and connection. Viewers can join the broadcast conversation and engage with creators while watching.</p>
        </FeatureSection>

        <FeatureSection title="More than a broadcast player">
          <p>Live broadcasts are part of MaiTroll’s social platform. Public creator profiles, short-form video, community spaces, and creator-focused features help viewers discover more content and stay connected.</p>
          <p>Explore the latest platform announcements on the <Link className="text-purple-300 underline" to="/updates">MaiTroll updates page</Link>, or read articles on the <Link className="text-purple-300 underline" to="/blog">MaiTroll blog</Link>.</p>
        </FeatureSection>

        <Link className="inline-flex items-center gap-2 rounded-xl bg-purple-600 px-5 py-3 font-bold text-white hover:bg-purple-500" to="/auth">
          Explore MaiTroll <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </SEOLayout>
  )
}

export function SocialMediaFeaturePage() {
  return (
    <SEOLayout
      title="Social Media Platform and Virtual Community"
      description="Discover MaiTroll’s social media platform, with creator profiles, live chat, short-form video, community spaces, and interactive virtual city features."
      keywords={['social media platform', 'social media network', 'creator community', 'live chat', 'virtual community', 'MaiTroll']}
    >
      <div className="mx-auto max-w-5xl px-4 py-12">
        <Breadcrumb items={[{ label: 'Features', path: '/about' }, { label: 'Social Media' }]} />
        <header className="mb-10">
          <Users className="mb-4 h-10 w-10 text-purple-300" />
          <p className="mb-2 text-sm font-bold uppercase tracking-widest text-purple-300">Community on MaiTroll</p>
          <h1 className="mb-4 text-4xl font-black text-white md:text-5xl">A social media platform built around participation</h1>
          <p className="max-w-3xl text-lg leading-relaxed text-slate-300">
            MaiTroll combines creator profiles, live broadcasts, short-form video, chat, and virtual community spaces. Members can discover people and content, then take part in shared experiences across the platform.
          </p>
        </header>

        <FeatureSection title="Profiles, posts, and live conversations">
          <p>Public profiles help people find creators and see their public content. Live chat makes it possible for viewers to take part in a broadcast conversation, while short-form video offers another way to share and discover content.</p>
          <p>Explore <Link className="text-purple-300 underline" to="/explore">public creators and content</Link> or view recent <Link className="text-purple-300 underline" to="/updates">MaiTroll feature updates</Link>.</p>
        </FeatureSection>

        <FeatureSection title="A virtual city with civic-style systems">
          <p>The MaiTroll virtual city includes interactive civic-style features such as city laws and an elected president, alongside community events and shared spaces. These are digital platform experiences, not a physical municipality or government.</p>
          <p>Members can explore public government and community features while following the platform’s published rules and safety guidance.</p>
        </FeatureSection>

        <FeatureSection title="Community tools for creators and viewers">
          <p>MaiTroll brings broadcasting and social interaction into one platform, so creators can build relationships with viewers and audiences can participate in more than passive viewing.</p>
          <p>Feature access may depend on account eligibility, device support, and platform availability.</p>
        </FeatureSection>

        <Link className="inline-flex items-center gap-2 rounded-xl bg-purple-600 px-5 py-3 font-bold text-white hover:bg-purple-500" to="/auth">
          Join the community <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </SEOLayout>
  )
}
