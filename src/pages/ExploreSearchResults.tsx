import { useEffect, useState, useMemo, useCallback } from 'react'
import { useSearchParams, useNavigate, Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/lib/store'
import { Users, Radio, Store, Award, Gavel, Newspaper, Hash, FileText, User as UserIcon, Search, Briefcase, BookOpen, Shield, Heart } from 'lucide-react'

type TabKey = 'all' | 'posts' | 'users' | 'streams' | 'stores' | 'broadcasters' | 'auctions' | 'articles' | 'hashtags' | 'pages'

const TABS: { key: TabKey; label: string; icon: any }[] = [
  { key: 'all', label: 'All', icon: Search },
  { key: 'posts', label: 'Posts', icon: FileText },
  { key: 'users', label: 'Users', icon: Users },
  { key: 'streams', label: 'Streams', icon: Radio },
  { key: 'stores', label: 'Stores', icon: Store },
  { key: 'broadcasters', label: 'Broadcasters', icon: Award },
  { key: 'auctions', label: 'Auctions', icon: Gavel },
  { key: 'articles', label: 'TCNN', icon: Newspaper },
  { key: 'hashtags', label: 'Hashtags', icon: Hash },
  { key: 'pages', label: 'Pages', icon: BookOpen },
]

export default function ExploreSearchResults() {
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const q = params.get('q') || ''
  const activeTab = (params.get('tab') as TabKey) || 'all'

  const [loading, setLoading] = useState(false)
  const [posts, setPosts] = useState<any[]>([])
  const [users, setUsers] = useState<any[]>([])
  const [streams, setStreams] = useState<any[]>([])
  const [stores, setStores] = useState<any[]>([])
  const [broadcasters, setBroadcasters] = useState<any[]>([])
  const [auctions, setAuctions] = useState<any[]>([])
  const [articles, setArticles] = useState<any[]>([])
  const [hashtags, setHashtags] = useState<{ tag: string; count: number }[]>([])
  const [pages] = useState<{ title: string; path: string; icon: any; color: string }[]>([
    { title: 'Careers', path: '/careers', icon: Briefcase, color: 'text-amber-300' },
    { title: 'Academy', path: '/academy', icon: BookOpen, color: 'text-emerald-300' },
    { title: 'Support', path: '/support', icon: Shield, color: 'text-sky-300' },
    { title: 'Troll Court', path: '/troll-court', icon: Gavel, color: 'text-violet-300' },
    { title: 'Church', path: '/church', icon: Heart, color: 'text-pink-300' },
    { title: 'Podcast', path: '/podcast', icon: Radio, color: 'text-orange-300' },
    { title: 'Marketplace', path: '/marketplace', icon: Store, color: 'text-cyan-300' },
    { title: 'Leaderboard', path: '/leaderboard', icon: Award, color: 'text-yellow-300' },
  ])

  const setQuery = useCallback((value: string) => {
    const next = new URLSearchParams(params)
    if (value) next.set('q', value); else next.delete('q')
    setParams(next, { replace: true })
  }, [params, setParams])

  const setTab = useCallback((tab: TabKey) => {
    const next = new URLSearchParams(params)
    next.set('tab', tab)
    setParams(next, { replace: true })
  }, [params, setParams])

  const runSearch = useCallback(async () => {
    setLoading(true)
    const term = q.trim()
    try {
      const like = term ? `%${term}%` : '%'

      const [postsRes, usersRes, streamsRes, storesRes, broadRes, auctionsRes, articlesRes, postsForTags] =
        await Promise.all([
          supabase.from('troll_wall_posts').select('id, user_id, username, avatar_url, content, created_at, likes').ilike('content', like).order('created_at', { ascending: false }).limit(20),
          supabase.from('user_profiles').select('id, username, avatar_url, role, followers_count').ilike('username', like).neq('id', user?.id || '').order('followers_count', { ascending: false }).limit(20),
          supabase.from('streams').select('id, title, broadcaster_id, category, current_viewers, is_live, thumbnail_url').ilike('title', like).eq('is_live', true).order('current_viewers', { ascending: false }).limit(20),
          supabase.from('shop_items').select('id, name, shop_id, price_coins, image_url, created_at').ilike('name', like).order('created_at', { ascending: false }).limit(20),
          supabase.from('broadcaster_stats').select('user_id, total_gifts_all_time').order('total_gifts_all_time', { ascending: false }).limit(20),
          supabase.from('auction_shows').select('id, title, status, thumbnail_url, created_at').ilike('title', like).order('created_at', { ascending: false }).limit(20),
          supabase.from('tcnn_articles').select('id, title, slug, excerpt, view_count, is_breaking, published_at, category').ilike('title', like).eq('status', 'published').order('view_count', { ascending: false }).limit(20),
          term ? supabase.from('troll_wall_posts').select('content').ilike('content', `%#${term.replace(/^#/, '')}%`).order('created_at', { ascending: false }).limit(200) : { data: [] as any[] },
        ])

      setPosts(postsRes.data || [])
      setUsers(usersRes.data || [])
      setStreams(streamsRes.data || [])
      setStores(storesRes.data || [])
      setBroadcasters(broadRes.data || [])
      setAuctions(auctionsRes.data || [])
      setArticles(articlesRes.data || [])

      // Hashtags: count distinct users per tag from recent posts
      const tagCounts: Record<string, Set<string>> = {}
      ;(postsForTags.data || []).forEach((p: any) => {
        const matches = (p.content || '').match(/#\w+/g) || []
        matches.forEach((t: string) => {
          const tag = t.toLowerCase()
          if (!tagCounts[tag]) tagCounts[tag] = new Set()
          tagCounts[tag].add(p.user_id)
        })
      })
      setHashtags(
        Object.entries(tagCounts)
          .map(([tag, set]) => ({ tag, count: set.size }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 20)
      )
    } catch (err) {
      console.error('[ExploreSearchResults] search error', err)
    } finally {
      setLoading(false)
    }
  }, [q, user?.id])

  useEffect(() => {
    runSearch()
  }, [runSearch])

  const showSection = (key: TabKey) => activeTab === 'all' || activeTab === key

  return (
    <div className="min-h-screen bg-[#050714] px-3 pb-24 pt-20 text-white md:px-6">
      <div className="mx-auto max-w-5xl">
        <h1 className="mb-4 text-2xl font-black">Explore</h1>

        <div className="sticky top-16 z-30 -mx-3 mb-4 bg-[#050714]/95 px-3 py-3 backdrop-blur md:-mx-6 md:px-6">
          <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2">
            <Search className="h-4 w-4 text-slate-400" />
            <input
              value={q}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search posts, users, streams, stores, broadcasters, auctions, TCNN, #hashtags"
              className="w-full bg-transparent text-sm text-white outline-none placeholder:text-slate-500"
            />
          </div>
          <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1">
            {TABS.map((t) => {
              const Icon = t.icon
              const active = activeTab === t.key
              return (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={`flex shrink-0 items-center gap-1 rounded-full px-3 py-1.5 text-xs font-bold transition ${
                    active ? 'bg-cyan-500 text-slate-950' : 'bg-white/5 text-slate-300 hover:bg-white/10'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {t.label}
                </button>
              )
            })}
          </div>
        </div>

        {loading && <div className="py-10 text-center text-sm text-slate-400">Searching…</div>}

        {!loading && (
          <div className="space-y-8">
            {showSection('posts') && posts.length > 0 && (
              <Section title="Posts">
                <div className="space-y-3">
                  {posts.map((p) => (
                    <div key={p.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                      <div className="mb-1 flex items-center gap-2 text-xs text-slate-400">
                        <span className="font-semibold text-white">@{p.username}</span>
                        <span>{new Date(p.created_at).toLocaleDateString()}</span>
                      </div>
                      <p className="whitespace-pre-wrap text-sm text-slate-200">{p.content}</p>
                      <div className="mt-2 text-xs text-slate-500">{p.likes || 0} likes · {p.replies || 0} replies</div>
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {showSection('users') && users.length > 0 && (
              <Section title="Users">
                <Grid>
                  {users.map((u) => (
                    <Link key={u.id} to={`/profile/${u.username}`} className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-3 hover:bg-white/[0.07]">
                      {u.avatar_url ? <img src={u.avatar_url} className="h-9 w-9 rounded-full object-cover" /> : <UserIcon className="h-9 w-9 text-slate-400" />}
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold">@{u.username}</p>
                        <p className="truncate text-xs text-slate-400">{u.followers_count || 0} followers</p>
                      </div>
                    </Link>
                  ))}
                </Grid>
              </Section>
            )}

            {showSection('streams') && streams.length > 0 && (
              <Section title="Streams">
                <Grid>
                  {streams.map((s) => (
                    <Link key={s.id} to={`/watch/${s.id}`} className="rounded-xl border border-white/10 bg-white/[0.03] p-3 hover:bg-white/[0.07]">
                      <p className="truncate text-sm font-bold">{s.title || 'Live stream'}</p>
                      <p className="text-xs text-slate-400">{s.current_viewers || 0} watching · {s.category || 'live'}</p>
                    </Link>
                  ))}
                </Grid>
              </Section>
            )}

            {showSection('stores') && stores.length > 0 && (
              <Section title="Stores / Items">
                <Grid>
                  {stores.map((item) => (
                    <Link key={item.id} to={`/marketplace`} className="rounded-xl border border-white/10 bg-white/[0.03] p-3 hover:bg-white/[0.07]">
                      <p className="truncate text-sm font-bold">{item.name}</p>
                      <p className="text-xs text-slate-400">{item.price_coins} coins</p>
                    </Link>
                  ))}
                </Grid>
              </Section>
            )}

            {showSection('broadcasters') && broadcasters.length > 0 && (
              <Section title="Top Broadcasters">
                <Grid>
                  {broadcasters.map((b: any) => (
                    <Link key={b.user_id} to={`/profile/${b.user_id}`} className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-3 hover:bg-white/[0.07]">
                      <Award className="h-9 w-9 text-amber-300" />
                      <div>
                        <p className="truncate text-sm font-bold">Broadcaster</p>
                        <p className="text-xs text-slate-400">{b.total_gifts_all_time || 0} gifts</p>
                      </div>
                    </Link>
                  ))}
                </Grid>
              </Section>
            )}

            {showSection('auctions') && auctions.length > 0 && (
              <Section title="Auctions">
                <Grid>
                  {auctions.map((a) => (
                    <Link key={a.id} to={`/auctions`} className="rounded-xl border border-white/10 bg-white/[0.03] p-3 hover:bg-white/[0.07]">
                      <p className="truncate text-sm font-bold">{a.title}</p>
                      <p className="text-xs text-slate-400">{a.status}</p>
                    </Link>
                  ))}
                </Grid>
              </Section>
            )}

            {showSection('articles') && articles.length > 0 && (
              <Section title="TCNN / Articles">
                <Grid>
                  {articles.map((a) => (
                    <Link key={a.id} to={`/tcnn/${a.slug || a.id}`} className="rounded-xl border border-white/10 bg-white/[0.03] p-3 hover:bg-white/[0.07]">
                      <p className="truncate text-sm font-bold">{a.title}</p>
                      <p className="text-xs text-slate-400">{a.view_count || 0} views{a.is_breaking ? ' · BREAKING' : ''}</p>
                    </Link>
                  ))}
                </Grid>
              </Section>
            )}

            {showSection('hashtags') && hashtags.length > 0 && (
              <Section title="Hashtags (ranked by users using them)">
                <div className="flex flex-wrap gap-2">
                  {hashtags.map((h) => (
                    <button
                      key={h.tag}
                      onClick={() => { setQuery(h.tag); setTab('posts') }}
                      className="rounded-full border border-cyan-400/30 bg-cyan-500/10 px-3 py-1.5 text-sm font-semibold text-cyan-200 hover:bg-cyan-500/20"
                    >
                      {h.tag} <span className="ml-1 text-xs text-cyan-400/70">{h.count}</span>
                    </button>
                  ))}
                </div>
              </Section>
            )}

            {showSection('pages') && pages.length > 0 && (
              <Section title="Pages">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  {pages.map((p) => {
                    const Icon = p.icon
                    return (
                      <Link
                        key={p.path}
                        to={p.path}
                        className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-4 transition hover:border-white/20 hover:bg-white/[0.06]"
                      >
                        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/5 ${p.color}`}>
                          <Icon className="h-5 w-5" />
                        </div>
                        <span className="text-sm font-bold text-slate-200">{p.title}</span>
                      </Link>
                    )
                  })}
                </div>
              </Section>
            )}

            {!loading && posts.length === 0 && users.length === 0 && streams.length === 0 && stores.length === 0 && broadcasters.length === 0 && auctions.length === 0 && articles.length === 0 && hashtags.length === 0 && pages.length === 0 && (
              <div className="py-10 text-center text-sm text-slate-400">No results. Try a different search.</div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="mb-3 text-lg font-black text-white">{title}</h2>
      {children}
    </div>
  )
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
}
