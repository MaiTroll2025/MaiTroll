import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import SEOLayout, { Breadcrumb, CTASection } from './SEOLayout'
import { Play, Radio, Camera, Mic, Monitor, Smartphone, Wifi, Clock, Users, Gift, MessageCircle, ChevronRight, ArrowRight, Zap, Settings, Eye, TrendingUp, CheckCircle, Lock, Unlock } from 'lucide-react'
import { supabase } from '@/lib/supabase'

const steps = [
  {
    step: '1',
    title: 'Sign Up Free',
    description: 'Create your account in seconds. No credit card required.',
    icon: Users,
  },
  {
    step: '2',
    title: 'Start Streaming',
    description: 'Click go live and start broadcasting to the world.',
    icon: Radio,
  },
  {
    step: '3',
    title: 'Grow Audience',
    description: 'Receive gifts, tips, and build your community.',
    icon: Gift,
  },
]

function VideoPlayer() {
  const [isPlaying, setIsPlaying] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  
  const youtubeVideoId = 'Zmoqz2RbWjA'
  const youtubeUrl = `https://www.youtube.com/embed/${youtubeVideoId}?autoplay=1&mute=1&loop=1&playlist=${youtubeVideoId}&showinfo=0&controls=1&modestbranding=1&rel=0`
  
  const handlePlay = () => {
    setIsPlaying(true)
  }
  
  return (
    <div 
      className="w-full max-w-4xl mx-auto h-[500px] rounded-2xl bg-slate-900 border border-slate-700 overflow-hidden relative shadow-2xl cursor-pointer"
      onClick={!isPlaying ? handlePlay : undefined}
      style={{ zIndex: 10 }}
    >
      {isPlaying ? (
        <iframe
          src={youtubeUrl}
          className="w-full h-full"
          style={{ zIndex: 11 }}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      ) : (
        <>
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent z-20" />
          <div className="absolute inset-0 flex items-center justify-center z-10">
            <div className="group cursor-pointer" onClick={handlePlay}>
              <div className="w-24 h-24 rounded-full bg-pink-600/90 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Play className="w-10 h-10 text-white ml-1" />
              </div>
            </div>
          </div>
          <div className="absolute bottom-6 left-6 right-6 z-30">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 rounded-full bg-gradient-to-r from-purple-500 to-pink-500" />
              <div>
                <div className="text-white font-semibold">Your Stream Preview</div>
                <div className="text-slate-300 text-sm">Ready to go live</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-1 bg-pink-600 text-white text-xs font-bold rounded">LIVE</span>
              <span className="text-slate-300 text-sm">0 viewers</span>
            </div>
          </div>
          <img 
            src={`https://img.youtube.com/vi/${youtubeVideoId}/maxresdefault.jpg`}
            alt="Stream preview"
            className="w-full h-full object-cover"
          />
        </>
      )}
    </div>
  )
}

const features = [
  { icon: Monitor, title: 'Browser Streaming', description: 'No software needed. Stream directly from your browser.' },
  { icon: Mic, title: 'Pro Audio', description: 'Crystal clear audio with noise cancellation.' },
  { icon: Camera, title: 'HD Video', description: 'Broadcast in high definition quality.' },
  { icon: Wifi, title: 'Auto Quality', description: 'Adaptive bitrate for any connection.' },
  { icon: MessageCircle, title: 'Live Chat', description: 'Real-time engagement with viewers.' },
  { icon: Gift, title: 'Virtual Gifts', description: 'Earn from supportive fans.' },
]

const requirements = [
  { icon: CheckCircle, text: 'Account in good standing' },
  { icon: CheckCircle, text: 'Verified email address' },
  { icon: CheckCircle, text: 'Accept community guidelines' },
]

interface GoLiveStats {
  dailyStreams: number;
  monthlyViewers: number;
}

function GoLiveStatsSection() {
  const [stats, setStats] = useState<GoLiveStats>({
    dailyStreams: 0,
    monthlyViewers: 0,
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true

    const fetchStats = async () => {
      try {
        const { count: dailyStreams } = await supabase
          .from('streams')
          .select('*', { count: 'exact', head: true })
          .eq('is_live', true)

        const { count: monthlyViewers } = await supabase
          .from('user_profiles')
          .select('*', { count: 'exact', head: true })

        if (mounted) {
          setStats({
            dailyStreams: dailyStreams || 0,
            monthlyViewers: monthlyViewers || 0,
          })
          setLoading(false)
        }
      } catch (error) {
        console.error('Error fetching stats:', error)
        if (mounted) setLoading(false)
      }
    }

    fetchStats()
    const interval = setInterval(fetchStats, 60000)
    return () => {
      mounted = false
      clearInterval(interval)
    }
  }, [])

  const formatNumber = (num: number): string => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M+'
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K+'
    return num.toString()
  }

  return (
    <section className="py-16 bg-slate-900/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid md:grid-cols-3 gap-6">
          <div className="text-center p-6">
            <div className="text-4xl font-bold text-white mb-2">{loading ? '...' : formatNumber(stats.dailyStreams)}</div>
            <div className="text-slate-400">Daily Streams</div>
          </div>
          <div className="text-center p-6">
            <div className="text-4xl font-bold text-white mb-2">{loading ? '...' : formatNumber(stats.monthlyViewers)}</div>
            <div className="text-slate-400">Monthly Viewers</div>
          </div>
          <div className="text-center p-6">
            <div className="text-4xl font-bold text-white mb-2">100+</div>
            <div className="text-slate-400">Countries</div>
          </div>
        </div>
      </div>
    </section>
  )
}

const tips = [
  'Use a consistent streaming schedule',
  'Interact with chat viewers',
  'Create appealing stream titles',
  'Use relevant categories',
  'Promote on social media',
  'Play music with proper licenses',
  'Engage with other creators',
  'Build a Discord community',
]

const trendingSearches = [
  { term: 'go live app', category: 'App' },
  { term: 'start streaming', category: 'How-To' },
  { term: 'live broadcast', category: 'Streaming' },
  { term: 'stream to fans', category: 'Creator' },
  { term: 'become streamer', category: 'Career' },
  { term: 'live video', category: 'Content' },
  { term: 'start直播', category: 'Chinese' },
  { term: ' directo', category: 'Spanish' },
]

export default function GoLivePage() {
  return (
    <SEOLayout
      title="Go Live on Mai Troll | Livestreaming on Mai Troll"
      description="Start broadcasting live on Mai Troll (MaiMaiTroll). Go live in minutes with free streaming tools on our social streaming platform. Stream from phone, PC, or browser."
      keywords={[
        'MaiTroll', 'MaiMaiTroll', 'go live', 'start streaming', 'live broadcast', 'start live stream',
        'broadcasting', 'live video', 'video streaming', 'stream live',
        'how to go live', 'start streaming free', 'live stream app',
        'go live streaming', 'start broadcasting', 'live video app',
        'direct streaming', 'stream now', 'start livestream', 'MaiTroll streaming',
        'livestreaming on Mai Troll', 'social streaming platform'
      ]}
    >
      <Breadcrumb items={[{ label: 'Home', path: '/' }, { label: 'Go Live' }]} />

      <section className="relative py-20 lg:py-32 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-pink-900/20 via-slate-900 to-purple-900/20" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,rgba(236,72,153,0.2),transparent_50%)]" />
        
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-pink-600/20 border border-pink-500/30 text-pink-300 text-sm font-medium mb-6">
                <Zap className="w-4 h-4" />
                Free to Start
              </div>
              
              <h1 className="text-4xl md:text-6xl font-bold text-white mb-6 leading-tight">
                Go Live on{' '}
                <span className="bg-gradient-to-r from-pink-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                  Mai Troll
                </span>
              </h1>
              
              <p className="text-xl text-slate-300 mb-8 leading-relaxed">
                Start broadcasting in seconds on <strong>Mai Troll</strong> (MaiMaiTroll). No equipment needed – just a device and internet connection. 
                Join creators worldwide on our social streaming platform who are sharing their passion with millions of viewers.
              </p>
              
              <div className="flex flex-col sm:flex-row items-start gap-4 mb-8">
                <Link
                  to="/broadcast/setup"
                  className="px-8 py-4 bg-gradient-to-r from-pink-600 to-purple-600 text-white font-semibold rounded-xl hover:from-pink-500 hover:to-purple-500 transition-all flex items-center gap-2"
                >
                  <Play className="w-5 h-5" />
                  Start Broadcasting
                </Link>
                <Link
                  to="/explore"
                  className="px-8 py-4 border border-slate-600 text-white font-semibold rounded-xl hover:bg-slate-800 transition-colors flex items-center gap-2"
                >
                  <Eye className="w-5 h-5" />
                  Watch First
                </Link>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-white">Free</div>
                  <div className="text-slate-400 text-sm">To Start</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-white">10 sec</div>
                  <div className="text-slate-400 text-sm">Setup Time</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-white">Any</div>
                  <div className="text-slate-400 text-sm">Device</div>
                </div>
              </div>
            </div>

            <div className="relative" style={{ zIndex: 1 }}>
              <VideoPlayer />
              <div className="absolute -bottom-8 -right-8 w-64 h-64 bg-pink-600/20 rounded-full blur-3xl" />
            </div>
          </div>
        </div>
      </section>

      <section className="py-12 bg-slate-900/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap justify-center gap-3">
            {trendingSearches.map((search, index) => (
              <Link
                key={index}
                to={`/explore?q=${encodeURIComponent(search.term)}`}
                className="px-4 py-2 bg-slate-800 hover:bg-pink-600/20 border border-slate-700 hover:border-pink-500/30 rounded-full text-slate-300 hover:text-pink-300 text-sm transition-colors"
              >
                {search.term}
                <span className="ml-2 text-xs text-slate-500">• {search.category}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Go Live in 4 Simple Steps
            </h2>
            <p className="text-slate-400 text-lg max-w-2xl mx-auto">
              No expensive equipment or technical knowledge required. 
              Start streaming in minutes with just your phone or computer.
            </p>
          </div>

          <div className="grid md:grid-cols-4 gap-6">
            {steps.map((item, index) => {
              const Icon = item.icon
              return (
                <div key={index} className="relative text-center">
                  <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-pink-600 to-purple-600 flex items-center justify-center mx-auto mb-4">
                    <Icon className="w-8 h-8 text-white" />
                  </div>
                  <div className="text-pink-400 font-bold text-lg mb-2">Step {item.step}</div>
                  <h3 className="text-xl font-semibold text-white mb-2">{item.title}</h3>
                  <p className="text-slate-400 text-sm">{item.description}</p>
                  {index < steps.length - 1 && (
                    <ChevronRight className="hidden md:block absolute top-10 -right-3 w-6 h-6 text-slate-600" />
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </section>

      <section className="py-16 bg-slate-900/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-2xl font-bold text-white mb-4">Streaming Tools Included</h2>
            <p className="text-slate-400">Everything you need to broadcast professionally</p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, index) => {
              const Icon = feature.icon
              return (
                <div key={index} className="flex items-center gap-4 p-4 bg-slate-800/50 rounded-xl">
                  <Icon className="w-8 h-8 text-purple-400 flex-shrink-0" />
                  <div>
                    <h3 className="text-white font-semibold">{feature.title}</h3>
                    <p className="text-slate-400 text-sm">{feature.description}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-2xl font-bold text-white mb-4">Requirements to Go Live</h2>
              <p className="text-slate-400 mb-6">Before you start broadcasting, make sure you have:</p>
              
              <div className="space-y-4">
                {requirements.map((req, index) => {
                  const Icon = req.icon
                  return (
                    <div key={index} className="flex items-center gap-3">
                      <Icon className="w-5 h-5 text-green-400" />
                      <span className="text-slate-300">{req.text}</span>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
              <h3 className="text-white font-semibold mb-4">Pro Tips for Success</h3>
              <div className="space-y-3">
                {tips.map((tip, index) => (
                  <div key={index} className="flex items-start gap-3">
                    <CheckCircle className="w-4 h-4 text-purple-400 flex-shrink-0 mt-1" />
                    <span className="text-slate-300 text-sm">{tip}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <GoLiveStatsSection />

      <CTASection
        title="What Are You Waiting For?"
        description="Start broadcasting today. It's free, easy, and anyone can do it."
        primaryAction={{ label: 'Go Live Now', path: '/broadcast/setup' }}
        secondaryAction={{ label: 'Learn More', path: '/about' }}
      />
    </SEOLayout>
  )
}