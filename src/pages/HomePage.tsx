import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import type { Stream, Profile, TipPackage } from '../types/database'
import { supabase } from '../lib/supabase'
import { useLiveContent } from '../contexts/LiveContentContext'
import { useAuth } from '../contexts/AuthContext'
import HomeBroadcastBanner from '../components/HomeBroadcastBanner'

const CATEGORY_ICONS: Record<string, string> = {
  Gaming: '🎮',
  Music: '🎵',
  'Talk Shows': '🎙️',
  Lifestyle: '✨',
  Dating: '💕',
  Entertainment: '🎭',
  Fitness: '💪',
  Business: '💼',
}

export default function HomePage() {
   const { user } = useAuth()
   const { onlineUsers, loadingOnline } = useLiveContent()
   const [streams, setStreams] = useState<Stream[]>([])
  const [creators, setCreators] = useState<Profile[]>([])
  const [packages, setPackages] = useState<TipPackage[]>([])
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState<string | null>(null)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    const [{ data: liveStreams }, { data: creatorProfiles }, { data: tipPackages }] = await Promise.all([
      supabase.from('streams').select('*').eq('status', 'live').order('viewer_count', { ascending: false }).limit(12),
      supabase.from('profiles').select('*').eq('verification_status', 'approved').eq('role', 'creator').limit(8),
      supabase.from('tip_packages').select('*').order('price_cents', { ascending: true })
    ])

    setStreams(liveStreams ?? [])
    setCreators(creatorProfiles ?? [])
    setPackages(tipPackages ?? [])
  }

  const categories = ['Gaming', 'Music', 'Talk Shows', 'Lifestyle', 'Dating', 'Entertainment', 'Fitness', 'Business']

  const filteredCreators = creators.filter((creator) =>
    creator.username.toLowerCase().includes(search.toLowerCase()) ||
    creator.bio?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="min-h-screen text-white noise-overlay">
      <HomeBroadcastBanner />

      {/* Ambient Background Orbs */}
      <div className="ambient-orb w-96 h-96 bg-velvet-purple top-0 left-0" />
      <div className="ambient-orb w-80 h-80 bg-velvet-pink top-1/3 right-0" />
      <div className="ambient-orb w-64 h-64 bg-velvet-gold/30 bottom-1/4 left-1/4" />

      {/* Navbar */}
      <nav className="luxury-header sticky top-0 z-50 px-6 py-4">
        <div className="mx-auto max-w-screen-2xl flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 group">
            <span className="text-2xl font-bold gradient-text group-hover:opacity-80 transition">👑 VELVET</span>
            <span className="text-sm text-velvet-gold font-semibold tracking-widest">GRID</span>
          </Link>
          <div className="hidden md:flex items-center gap-6">
            <a href="#streams" className="text-sm text-gray-300 hover:text-velvet-gold transition">Streams</a>
            <a href="#creators" className="text-sm text-gray-300 hover:text-velvet-gold transition">Creators</a>
            <a href="#categories" className="text-sm text-gray-300 hover:text-velvet-gold transition">Categories</a>
          </div>
          <div className="flex items-center gap-3">
            {user ? (
              <>
                <Link to="/dashboard" className="btn-secondary text-sm py-2 px-4">Dashboard</Link>
                <Link to="/" className="btn-primary text-sm py-2 px-4">Browse</Link>
              </>
            ) : (
              <>
                <Link to="/login" className="text-sm text-gray-300 hover:text-velvet-gold transition py-2 px-3">Sign In</Link>
                <Link to="/register" className="btn-primary text-sm py-2 px-4">Get Started</Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative px-6 py-20 md:py-28 overflow-hidden">
        <div className="mx-auto max-w-screen-2xl">
          <div className="grid gap-12 items-center md:grid-cols-2">
            {/* Left Content */}
            <div className="space-y-8 animate-fade-in-up">
              <div>
                <div className="inline-block badge-premium mb-5">✨ Welcome to Velvet Grid</div>
                <h1 className="text-5xl md:text-7xl font-bold leading-[1.1] tracking-tight">
                  <span className="block">Luxury</span>
                  <span className="gradient-text">Streaming.</span>
                  <span className="block text-velvet-gold">Real Connections.</span>
                </h1>
              </div>
              <p className="text-lg text-gray-300 leading-relaxed max-w-lg">
                Discover creators, private rooms, exclusive broadcasts, and premium live experiences. Join 250k+ members experiencing luxury streaming.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <a href="#streams" className="btn-primary text-base">Explore Streams</a>
                <Link to="/register" className="btn-secondary text-base">Become a Creator</Link>
              </div>
              <div className="flex items-center gap-4 pt-4">
                <div className="flex -space-x-2">
                  {[...Array(5)].map((_, i) => (
                    <div
                      key={i}
                      className="w-9 h-9 rounded-full bg-gradient-to-br from-velvet-pink to-velvet-purple border-2 border-velvet-dark"
                      style={{ opacity: 1 - i * 0.1 }}
                    />
                  ))}
                </div>
                <div>
                  <div className="flex items-center gap-1">
                    {[...Array(5)].map((_, i) => (
                      <span key={i} className="text-velvet-gold text-sm">★</span>
                    ))}
                  </div>
                  <p className="text-sm text-gray-400">250k+ members · 4.9 rating</p>
                </div>
              </div>
            </div>

            {/* Right Featured Stream */}
            <div className="relative group animate-fade-in" style={{ animationDelay: '0.2s' }}>
              <div className="absolute inset-0 bg-gradient-to-br from-velvet-pink via-velvet-purple to-transparent opacity-20 blur-3xl rounded-3xl group-hover:opacity-30 transition-opacity duration-700" />
              <div className="relative glass-card overflow-hidden rounded-2xl border-2 border-velvet-gold/20 p-1 animate-glow-pulse">
                <div className="relative aspect-video bg-gradient-to-br from-purple-900 via-pink-900 to-black overflow-hidden rounded-xl">
                  {/* Featured Stream Thumbnail */}
                  <div className="absolute inset-0 bg-gradient-to-br from-purple-600/30 via-pink-600/30 to-black/50 flex items-center justify-center">
                    <div className="text-center">
                      <div className="text-7xl mb-4 animate-float">🎤</div>
                      <p className="text-white/70 text-sm">Featured Stream</p>
                    </div>
                  </div>

                  {/* Stream Badge */}
                  <div className="absolute top-4 left-4 badge-live">LIVE</div>
                  <div className="absolute top-4 right-4 flex items-center gap-2 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full text-sm">
                    <span>👁️</span>
                    <span>2.8K</span>
                  </div>

                  {/* Play Button Overlay */}
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/30">
                      <span className="text-2xl ml-1">▶</span>
                    </div>
                  </div>

                  {/* Creator Info Overlay */}
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black via-black/70 to-transparent p-6">
                    <div className="flex items-end gap-4">
                      <div className="w-14 h-14 rounded-full border-2 border-velvet-gold bg-gradient-to-br from-velvet-pink to-velvet-purple flex items-center justify-center text-xl">
                        👑
                      </div>
                      <div>
                        <p className="font-bold text-lg">Luna Velvet</p>
                        <p className="text-gray-300 text-sm">Just Chatting · 2.8K viewers</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Bar */}
      <section className="px-6 py-8 border-y border-velvet-gold/10">
        <div className="mx-auto max-w-screen-2xl">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
{[
               { label: 'Active Streams', value: streams.length.toString(), icon: '📡' },
               { label: 'Users Online', value: loadingOnline ? '...' : onlineUsers.toLocaleString(), icon: '👥' },
               { label: 'Creators', value: creators.length.toString(), icon: '👑' },
             ].map((stat) => (
               <div key={stat.label} className="stat-card text-center">
                 <div className="text-2xl mb-2">{stat.icon}</div>
                 <p className="text-2xl md:text-3xl font-bold gradient-text">{stat.value}</p>
                 <p className="text-xs text-gray-400 mt-1 uppercase tracking-widest">{stat.label}</p>
               </div>
             ))}
          </div>
        </div>
      </section>

      {/* Mai Sing Off Featured Card */}
      <section className="px-6 py-12">
        <div className="mx-auto max-w-screen-2xl">
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-pink-600 via-rose-600 to-pink-700 p-6 md:p-10">
            <div className="absolute -top-24 -right-24 h-72 w-72 rounded-full bg-yellow-300/20 blur-3xl" />
            <div className="flex flex-col items-start gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <span className="inline-block rounded-full bg-yellow-400 px-3 py-1 text-xs font-bold text-black">LIVE</span>
                <h2 className="mt-3 text-3xl font-extrabold text-white md:text-4xl">Mai Sing Off</h2>
                <p className="mt-2 max-w-lg text-sm text-zinc-100">
                  The ultimate live singing competition. Perform on stage, judge with your voice, send gifts, and compete for the Mai Winner crown.
                </p>
              </div>
              <button
                onClick={() => {
                  window.location.href = '/mai-sing-off'
                }}
                className="rounded-full bg-white px-6 py-2.5 text-sm font-bold text-pink-700 shadow-xl hover:bg-yellow-300"
              >
                Enter the Stage
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Categories Section */}
      <section id="categories" className="px-6 py-16">
        <div className="mx-auto max-w-screen-2xl">
          <div className="text-center mb-10">
            <h2 className="text-sm font-bold tracking-[0.25em] text-velvet-gold mb-2">EXPLORE CATEGORIES</h2>
            <p className="text-gray-400 text-sm">Find your favorite content category</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 stagger-children">
            {categories.map((category) => (
              <button
                key={category}
                onClick={() => setActiveCategory(activeCategory === category ? null : category)}
                className={`group glass-card p-5 rounded-xl text-center transition-all duration-300 ${
                  activeCategory === category
                    ? 'border-velvet-gold/50 bg-velvet-gold/5'
                    : 'hover:border-velvet-gold/40'
                }`}
              >
                <div className="text-3xl mb-2 group-hover:scale-110 transition-transform duration-300">
                  {CATEGORY_ICONS[category] || '📺'}
                </div>
                <p className={`text-xs font-semibold transition-colors duration-300 ${
                  activeCategory === category ? 'text-velvet-gold' : 'text-gray-300 group-hover:text-velvet-gold'
                }`}>
                  {category}
                </p>
              </button>
            ))}
          </div>
        </div>
      </section>

      <div className="section-divider mx-6" />

      {/* Search Bar */}
      <section className="px-6 py-12">
        <div className="mx-auto max-w-screen-2xl">
          <div className="text-center mb-8">
            <h2 className="text-sm font-bold tracking-[0.25em] text-velvet-gold mb-2">FIND CREATORS</h2>
            <p className="text-gray-400 text-sm">Search for your favorite creators and streams</p>
          </div>
          <div className="relative max-w-2xl mx-auto">
            <input
              className="velvet-input pl-6 pr-14 py-4 text-base"
              placeholder="Search creators, streams, or categories..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <button className="absolute right-2 top-1/2 -translate-y-1/2 bg-gradient-to-r from-velvet-purple to-velvet-pink text-white rounded-full w-10 h-10 flex items-center justify-center hover:scale-110 transition-transform">
              🔍
            </button>
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="glass-card p-6">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold">Live Now</h2>
              <p className="text-sm text-slate-400">Browse the hottest streams and join when you�re ready.</p>
            </div>
            <span className="rounded-full bg-purple-600/20 px-3 py-1 text-xs uppercase tracking-[0.2em] text-purple-200">Realtime</span>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {streams.length === 0 ? (
              <div className="rounded-3xl border border-white/10 bg-white/5 p-8 text-center text-slate-400">
                No streams are live right now. Check back soon.
              </div>
            ) : (
              streams.map((stream) => (
                <Link key={stream.id} to={user ? `/stream/${stream.id}` : '/login'} className="group block overflow-hidden rounded-3xl border border-blue-500/10 bg-slate-950/80 shadow-[0_20px_80px_rgba(56,189,248,0.16)] transition hover:-translate-y-1 hover:border-blue-400/40">
                  <div className="aspect-video bg-gradient-to-br from-sky-700 via-blue-900 to-indigo-900 p-4">
                    <div className="flex items-center justify-between text-sm text-white">
                      <span className="rounded-full bg-blue-500 px-3 py-1">LIVE</span>
                      <span>{stream.viewer_count} viewers</span>
                    </div>
                  </div>
                  <div className="p-4">
                    <p className="text-lg font-semibold text-white">{stream.title}</p>
                    <p className="mt-2 text-sm text-slate-400 line-clamp-2">{stream.description ?? 'Creator has not added a description yet.'}</p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <span className="rounded-full bg-blue-500/10 px-3 py-1 text-xs uppercase tracking-[0.18em] text-blue-200">{stream.category}</span>
                    </div>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>

        <aside className="space-y-6">
          <div className="glass-card p-6">
            <h3 className="text-lg font-semibold">Top creators</h3>
            <div className="mt-5 space-y-4">
              {filteredCreators.length === 0 ? (
                <p className="text-slate-400">No creators match your search.</p>
              ) : (
                filteredCreators.slice(0, 6).map((creator) => (
                  <Link key={creator.id} to={user ? `/creator/${creator.id}` : '/login'} className="block rounded-3xl border border-white/10 bg-slate-950/70 p-4 transition hover:border-purple-500/40">
                    <div className="flex items-center gap-4">
                      <div className="h-12 w-12 rounded-2xl bg-purple-600/20" />
                      <div>
                        <p className="font-semibold">{creator.username}</p>
                        <p className="text-sm text-slate-400">{creator.bio || 'Creator profile'}</p>
                      </div>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </div>

          <div className="glass-card p-6">
            <h3 className="text-lg font-semibold">Tip bundles</h3>
            <div className="mt-5 space-y-4">
              {packages.map((pkg) => (
                <div key={pkg.id} className="rounded-3xl border border-white/10 bg-slate-950/70 p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="font-semibold">{pkg.name}</p>
                      <p className="text-sm text-slate-400">{pkg.tip_amount} tips + {pkg.bonus_amount} bonus</p>
                    </div>
                    <span className="rounded-full bg-purple-600/20 px-3 py-1 text-sm text-purple-100">${(pkg.price_cents / 100).toFixed(2)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </section>
    </div>
  )
}
