/**
 * TCNNMainPage
 *
 * Official public Mai Troll News Network page.
 * Public users can view published news, breaking headlines, live TCNN broadcasts,
 * trending stories, latest articles, and journalist stats.
 *
 * Staff creation/review tools should live on separate protected routes:
 * /tcnn/studio
 * /tcnn/write
 * /tcnn/review
 * /tcnn/admin
 */

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Award,
  BadgeCheck,
  Newspaper,
  Play,
  Radio,
  TrendingUp,
  Users,
} from 'lucide-react'

import { supabase } from '@/lib/supabase'
import { TCNNArticle, JournalistStats } from '@/types/tcnn'

import BreakingBanner from '@/components/tcnn/BreakingBanner'
import ArticleCard from '@/components/tcnn/ArticleCard'
import JournalistLeaderboard from '@/components/tcnn/JournalistLeaderboard'

interface TCNNStream {
  id: string
  title: string
  streamerName: string
  streamerAvatar: string | null
  viewerCount: number
  isLive: boolean
  streamChannel: string
}

export default function TCNNMainPage() {
  const navigate = useNavigate()

  const [activeStream, setActiveStream] = useState<TCNNStream | null>(null)
  const [trendingArticles, setTrendingArticles] = useState<TCNNArticle[]>([])
  const [recentArticles, setRecentArticles] = useState<TCNNArticle[]>([])
  const [journalists, setJournalists] = useState<JournalistStats[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true

    const fetchTCNNData = async () => {
      try {
        setLoading(true)
        setError(null)

        const { data: streamData, error: streamError } = await supabase
          .from('streams')
          .select(`
            id,
            title,
            user_id,
            is_live,
            viewer_count,
            current_viewers,
            agora_channel,
            broadcaster:user_profiles!streams_broadcaster_id_fkey(username, avatar_url)
          `)
          .eq('category', 'tcnn')
          .eq('is_live', true)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (streamError) {
          console.error('TCNN stream fetch error:', streamError)
        }

        if (mounted) {
          if (streamData) {
            const broadcaster = Array.isArray(streamData.broadcaster)
              ? streamData.broadcaster[0]
              : streamData.broadcaster

            setActiveStream({
              id: streamData.id,
              title: streamData.title || 'TCNN Live Broadcast',
              streamerName: broadcaster?.username || 'TCNN News Caster',
              streamerAvatar: broadcaster?.avatar_url || null,
              viewerCount: streamData.current_viewers || streamData.viewer_count || 0,
              isLive: streamData.is_live,
              streamChannel: streamData.agora_channel,
            })
          } else {
            setActiveStream(null)
          }
        }

        const { data: trendingData, error: trendingError } = await supabase
          .from('tcnn_articles')
          .select(`
            *,
            author:author_id(username, avatar_url)
          `)
          .eq('status', 'published')
          .order('view_count', { ascending: false })
          .limit(4)

        if (trendingError) {
          console.error('TCNN trending articles fetch error:', trendingError)
        }

        if (mounted) {
          setTrendingArticles((trendingData || []).map(formatArticle))
        }

        const { data: recentData, error: recentError } = await supabase
          .from('tcnn_articles')
          .select(`
            *,
            author:author_id(username, avatar_url)
          `)
          .eq('status', 'published')
          .order('published_at', { ascending: false })
          .limit(8)

        if (recentError) {
          console.error('TCNN recent articles fetch error:', recentError)
        }

        if (mounted) {
          setRecentArticles((recentData || []).map(formatArticle))
        }

        const { data: journalistData, error: journalistError } = await supabase
          .from('user_profiles')
          .select('id, username, avatar_url')
          .or('is_journalist.eq.true,is_news_caster.eq.true,is_chief_news_caster.eq.true')
          .limit(8)

        if (journalistError) {
          console.error('TCNN journalist fetch error:', journalistError)
        }

        if (mounted) {
          setJournalists(
            (journalistData || []).map((journalist: any) => ({
              userId: journalist.id,
              username: journalist.username,
              avatarUrl: journalist.avatar_url,
              articlesCount: 0,
              totalViews: 0,
              totalTips: 0,
              totalTipAmount: 0,
            }))
          )
        }
      } catch (err: any) {
        console.error('Error fetching TCNN data:', err)

        if (mounted) {
          setError(err.message || 'Failed to load TCNN')
        }
      } finally {
        if (mounted) {
          setLoading(false)
        }
      }
    }

    fetchTCNNData()

    const interval = window.setInterval(fetchTCNNData, 30000)

    return () => {
      mounted = false
      window.clearInterval(interval)
    }
  }, [])

  const handleWatchStream = () => {
    if (!activeStream) return
    navigate(`/tcnn/viewer/${activeStream.id}`)
  }

  const handleArticleClick = (articleId: string) => {
    navigate(`/tcnn/article/${articleId}`)
  }

  if (loading) {
    return (
      <main className="min-h-screen overflow-y-auto overflow-x-hidden md:overflow-hidden bg-[#020617] text-white">
        <BackgroundFX />

        <section className="relative z-10 mx-auto max-w-7xl space-y-6 px-4 py-6 md:px-8">
          <div className="rounded-[2rem] border border-cyan-400/10 bg-slate-950/75 p-6">
            <div className="h-8 w-64 animate-pulse rounded bg-cyan-400/10" />
            <div className="mt-4 h-20 w-full animate-pulse rounded-2xl bg-cyan-400/10" />
          </div>

          <div className="h-[420px] animate-pulse rounded-[2rem] border border-cyan-400/10 bg-cyan-400/10" />

          <div className="grid gap-5 md:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div
                key={index}
                className="h-52 animate-pulse rounded-[2rem] border border-cyan-400/10 bg-cyan-400/10"
              />
            ))}
          </div>
        </section>
      </main>
    )
  }

  if (error) {
    return (
      <main className="min-h-screen overflow-y-auto overflow-x-hidden md:overflow-hidden bg-[#020617] text-white">
        <BackgroundFX />

        <section className="relative z-10 mx-auto flex min-h-screen max-w-7xl items-center justify-center px-4 py-8 text-center">
          <div className="rounded-[2rem] border border-red-400/20 bg-slate-950/80 p-8 shadow-[0_0_60px_rgba(239,68,68,0.12)]">
            <Radio className="mx-auto mb-4 h-14 w-14 text-red-300" />
            <h1 className="text-2xl font-black text-white">Error Loading TCNN</h1>
            <p className="mt-2 text-sm text-slate-400">{error}</p>
          </div>
        </section>
      </main>
    )
  }

  return (
    <main className="min-h-screen overflow-y-auto overflow-x-hidden md:overflow-hidden bg-[#020617] text-white">
      <BackgroundFX />

      <header className="sticky top-0 z-40 border-b border-cyan-400/10 bg-slate-950/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 md:px-8">
          <button
            type="button"
            onClick={() => navigate('/tcnn')}
            className="flex items-center gap-3 text-left"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-400/25 bg-cyan-500/10 text-cyan-300 shadow-[0_0_24px_rgba(34,211,238,0.18)]">
              <Radio className="h-6 w-6" />
            </div>

            <div>
              <h1 className="text-lg font-black text-white md:text-xl">
                TCNN
              </h1>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-300">
                Official Mai Troll News
              </p>
            </div>
          </button>

          {activeStream?.isLive && (
            <button
              type="button"
              onClick={handleWatchStream}
              className="inline-flex items-center gap-2 rounded-full border border-red-400/25 bg-red-500/10 px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-red-200 transition hover:bg-red-500/20"
            >
              <span className="h-2 w-2 animate-pulse rounded-full bg-red-400" />
              On Air
            </button>
          )}
        </div>
      </header>

      <section className="relative z-10 mx-auto max-w-7xl space-y-8 px-4 py-8 md:px-8">
        <section className="rounded-[2rem] border border-cyan-400/20 bg-slate-950/75 p-6 shadow-[0_0_70px_rgba(34,211,238,0.12)] backdrop-blur-xl md:p-8">
          <div className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
            <div>
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-4 py-2 text-xs font-black uppercase tracking-[0.22em] text-cyan-200">
                <BadgeCheck className="h-4 w-4" />
                Official City News Page
              </div>

              <h2 className="text-4xl font-black tracking-tight md:text-7xl">
                Mai Troll
                <span className="block bg-gradient-to-r from-cyan-300 via-fuchsia-300 to-red-300 bg-clip-text text-transparent">
                  News Network
                </span>
              </h2>

              <p className="mt-5 max-w-2xl text-sm leading-6 text-slate-400 md:text-base">
                TCNN is the official public news hub for Mai Troll: breaking stories,
                city updates, journalist articles, live broadcasts, and official coverage.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <StatCard icon={Newspaper} label="Latest" value={recentArticles.length} />
              <StatCard icon={TrendingUp} label="Trending" value={trendingArticles.length} />
              <StatCard icon={Users} label="Journalists" value={journalists.length} />
            </div>
          </div>
        </section>

        <BreakingBanner />

        {activeStream?.isLive ? (
          <section className="overflow-hidden rounded-[2rem] border border-red-400/25 bg-slate-950/75 shadow-[0_0_70px_rgba(239,68,68,0.14)] backdrop-blur-xl">
            <div className="border-b border-red-400/10 bg-red-500/10 p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-red-400/25 bg-red-500/10 text-red-300">
                    <Play className="h-5 w-5 fill-current" />
                  </div>

                  <div>
                    <h2 className="text-xl font-black text-white">Live Official Broadcast</h2>
                    <p className="text-sm text-red-200/80">TCNN is currently on air.</p>
                  </div>
                </div>

                <div className="inline-flex items-center gap-2 rounded-full border border-red-400/25 bg-black/30 px-4 py-2 text-sm font-black text-red-200">
                  <Users className="h-4 w-4" />
                  {activeStream.viewerCount.toLocaleString()} watching
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={handleWatchStream}
              className="group relative block w-full overflow-hidden text-left"
            >
              <div className="absolute left-0 right-0 top-0 z-10 flex items-center justify-between bg-gradient-to-r from-red-950/95 via-red-900/95 to-red-950/95 px-5 py-3">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-red-300" />
                  <span className="text-xs font-black uppercase tracking-[0.2em] text-red-100">
                    Official Broadcast
                  </span>
                </div>
                <span className="text-xs font-bold text-red-100/70">TCNN Channel</span>
              </div>

              <div className="flex aspect-video items-center justify-center bg-[radial-gradient(circle_at_center,rgba(34,211,238,0.12),transparent_35%),linear-gradient(135deg,#020617,#111827,#020617)]">
                <div className="text-center">
                  <div className="mx-auto mb-5 flex h-24 w-24 items-center justify-center rounded-full border border-red-300/25 bg-red-500 text-white shadow-[0_0_45px_rgba(239,68,68,0.35)] transition group-hover:scale-110">
                    <Play className="ml-1 h-12 w-12 fill-current" />
                  </div>

                  <p className="text-2xl font-black text-white">{activeStream.title}</p>
                  <p className="mt-2 text-sm font-bold text-slate-400">
                    with {activeStream.streamerName}
                  </p>
                </div>
              </div>
            </button>
          </section>
        ) : (
          <section className="rounded-[2rem] border border-cyan-400/15 bg-slate-950/75 p-6 text-center shadow-[0_0_45px_rgba(34,211,238,0.08)] backdrop-blur-xl">
            <Radio className="mx-auto mb-4 h-12 w-12 text-slate-600" />
            <h2 className="text-xl font-black text-white">TCNN Is Not Live Right Now</h2>
            <p className="mt-2 text-sm text-slate-400">
              Official broadcasts will appear here when a TCNN news caster goes live.
            </p>
          </section>
        )}

        {trendingArticles.length > 0 && (
          <section>
            <SectionTitle icon={TrendingUp} title="Trending Stories" />
            <div className="mt-4 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
              {trendingArticles.map((article) => (
                <ArticleCard
                  key={article.id}
                  article={article}
                  onClick={() => handleArticleClick(article.id)}
                  variant="compact"
                />
              ))}
            </div>
          </section>
        )}

        <section className="grid gap-8 lg:grid-cols-[1.5fr_0.75fr]">
          <div>
            <SectionTitle icon={Newspaper} title="Latest News" />

            {recentArticles.length === 0 ? (
              <div className="mt-4 rounded-[2rem] border border-cyan-400/10 bg-slate-950/60 p-12 text-center">
                <Newspaper className="mx-auto mb-4 h-12 w-12 text-slate-600" />
                <p className="text-sm text-slate-400">No articles published yet.</p>
              </div>
            ) : (
              <div className="mt-4 space-y-4">
                {recentArticles.map((article) => (
                  <ArticleCard
                    key={article.id}
                    article={article}
                    onClick={() => handleArticleClick(article.id)}
                    variant="full"
                  />
                ))}
              </div>
            )}
          </div>

          <aside className="space-y-6">
            <JournalistLeaderboard journalists={journalists} />

            <section className="rounded-[2rem] border border-cyan-400/15 bg-slate-950/75 p-6 shadow-[0_0_45px_rgba(34,211,238,0.08)] backdrop-blur-xl">
              <div className="mb-5 flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-yellow-400/20 bg-yellow-500/10 text-yellow-300">
                  <Award className="h-5 w-5" />
                </div>
                <h3 className="text-xl font-black text-white">TCNN Stats</h3>
              </div>

              <div className="space-y-3">
                <StatsRow label="Active Journalists" value={journalists.length} />
                <StatsRow label="Published Articles" value={recentArticles.length} />
                <StatsRow label="Trending Stories" value={trendingArticles.length} />
                <StatsRow label="Currently Live" value={activeStream?.isLive ? 'Yes' : 'No'} />
              </div>
            </section>
          </aside>
        </section>
      </section>
    </main>
  )
}

function formatArticle(item: any): TCNNArticle {
  return {
    id: item.id,
    title: item.title,
    slug: item.slug,
    excerpt: item.excerpt,
    content: item.content,
    featuredImageUrl: item.featured_image_url,
    authorId: item.author_id,
    authorName: item.author?.username || item.author_name || 'Unknown',
    authorAvatar: item.author?.avatar_url || null,
    status: item.status,
    submittedAt: item.submitted_at,
    reviewedAt: item.reviewed_at,
    publishedAt: item.published_at,
    reviewedBy: item.reviewed_by,
    category: item.category,
    tags: item.tags || [],
    isBreaking: item.is_breaking,
    viewCount: item.view_count,
    tipCount: item.tip_count,
    tipTotalCoins: item.tip_total_coins,
    metaDescription: item.meta_description,
    createdAt: item.created_at,
    updatedAt: item.updated_at,
  }
}

function BackgroundFX() {
  return (
    <div className="pointer-events-none fixed inset-0">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(34,211,238,0.16),transparent_32%),radial-gradient(circle_at_85%_10%,rgba(239,68,68,0.12),transparent_30%),radial-gradient(circle_at_50%_100%,rgba(168,85,247,0.1),transparent_36%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(rgba(34,211,238,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(34,211,238,0.035)_1px,transparent_1px)] bg-[size:52px_52px]" />
    </div>
  )
}

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType
  label: string
  value: string | number
}) {
  return (
    <div className="rounded-3xl border border-cyan-400/20 bg-cyan-500/5 p-4">
      <Icon className="mb-3 h-5 w-5 text-cyan-300" />
      <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
        {label}
      </p>
      <p className="mt-1 text-xl font-black text-white">{value}</p>
    </div>
  )
}

function SectionTitle({
  icon: Icon,
  title,
}: {
  icon: React.ElementType
  title: string
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-cyan-400/20 bg-cyan-500/10 text-cyan-300">
        <Icon className="h-5 w-5" />
      </div>
      <h2 className="text-2xl font-black text-white">{title}</h2>
    </div>
  )
}

function StatsRow({
  label,
  value,
}: {
  label: string
  value: string | number
}) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm">
      <span className="text-slate-400">{label}</span>
      <span className="font-black text-white">{value}</span>
    </div>
  )
}