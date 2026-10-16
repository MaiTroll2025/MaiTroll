import React, { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { CalendarDays, Newspaper } from 'lucide-react'
import SEOLayout, { Breadcrumb } from './seo/SEOLayout'
import { readJsonResponse } from '../lib/readJsonResponse'

type SitePostType = 'update' | 'blog'

interface SitePost {
  id: string
  title: string
  slug: string
  summary: string
  content: string
  post_type: SitePostType
  published_at: string | null
  created_at: string
}

interface SiteUpdatesPageProps {
  postType: SitePostType
}

export default function SiteUpdatesPage({ postType }: SiteUpdatesPageProps) {
  const { slug } = useParams<{ slug: string }>()
  const [posts, setPosts] = useState<SitePost[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const collectionPath = postType === 'blog' ? '/blog' : '/updates'
  const collectionLabel = postType === 'blog' ? 'Blog' : 'Updates'
  const article = slug ? posts[0] : null
  const pageTitle = article?.title || (postType === 'blog' ? 'MaiTroll Blog | Creator Broadcasting and Community' : 'MaiTroll Updates | News and Feature Releases')
  const description = article?.summary || (postType === 'blog'
    ? 'Read MaiTroll articles about live broadcasting, creator tools, social media, and virtual communities.'
    : 'Read public MaiTroll product updates, feature announcements, and platform news from the CEO of Mai Corp.')

  const keywords = useMemo(() => postType === 'blog'
    ? ['MaiTroll blog', 'broadcasting app', 'creator tools', 'social media']
    : ['MaiTroll updates', 'MaiTroll news', 'feature updates', 'CEO of Mai Corp'], [postType])

  useEffect(() => {
    const controller = new AbortController()
    const query = new URLSearchParams({ type: postType })
    if (slug) query.set('slug', slug)

    setLoading(true)
    setError('')
    fetch(`/api/site-updates?${query.toString()}`, { signal: controller.signal })
      .then(async (response) => {
        const payload = await readJsonResponse<{ posts?: SitePost[]; error?: string }>(response)
        if (!response.ok) throw new Error(payload.error || 'Unable to load posts')
        setPosts(payload.posts || [])
      })
      .catch((fetchError: unknown) => {
        if (fetchError instanceof DOMException && fetchError.name === 'AbortError') return
        console.error('[SiteUpdatesPage] Failed to load public content:', fetchError)
        setError(fetchError instanceof Error ? fetchError.message : 'Unable to load posts')
      })
      .finally(() => setLoading(false))

    return () => controller.abort()
  }, [postType, slug])

  const dateText = (post: SitePost) => new Date(post.published_at || post.created_at).toLocaleDateString()
  const paragraphs = article?.content.split(/\r?\n+/).filter(Boolean) || []

  return (
    <SEOLayout
      title={pageTitle}
      description={description}
      keywords={keywords}
      robots="index, follow"
      author={article && postType === 'update' ? 'CEO of Mai Corp' : undefined}
      publishedTime={article?.published_at || undefined}
      section={postType === 'blog' ? 'Blog' : 'Product updates'}
    >
      <main className="mx-auto min-h-[65vh] max-w-5xl px-4 py-12">
        <Breadcrumb items={slug ? [{ label: collectionLabel, path: collectionPath }, { label: article?.title || 'Article' }] : [{ label: collectionLabel }]} />
        <header className="mb-10">
          <Newspaper className="mb-4 h-9 w-9 text-purple-300" />
          <h1 className="mb-3 text-4xl font-black text-white">{article?.title || (postType === 'blog' ? 'MaiTroll Blog' : 'MaiTroll Updates')}</h1>
          <p className="max-w-3xl text-lg text-slate-300">{article?.summary || description}</p>
          {article && (
            <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-slate-400">
              <span className="inline-flex items-center gap-2"><CalendarDays className="h-4 w-4" />{dateText(article)}</span>
              {postType === 'update' && <span>Posted by CEO of Mai Corp</span>}
            </div>
          )}
        </header>

        {loading ? (
          <p className="text-slate-300" role="status">Loading {collectionLabel.toLowerCase()}…</p>
        ) : error ? (
          <p className="rounded-xl border border-red-500/30 bg-red-950/30 p-4 text-red-200" role="alert">{error}</p>
        ) : article ? (
          <article className="space-y-5 text-lg leading-relaxed text-slate-200">
            {paragraphs.map((paragraph, index) => <p key={`${index}-${paragraph.slice(0, 30)}`}>{paragraph}</p>)}
          </article>
        ) : slug ? (
          <p className="text-slate-300">This {postType === 'blog' ? 'article' : 'update'} was not found or is not public.</p>
        ) : posts.length === 0 ? (
          <p className="text-slate-300">New {collectionLabel.toLowerCase()} will appear here as they are published.</p>
        ) : (
          <div className="grid gap-5 md:grid-cols-2">
            {posts.map((post) => (
              <article key={post.id} className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
                <p className="mb-3 text-sm text-slate-400">{dateText(post)}{postType === 'update' ? ' · CEO of Mai Corp' : ''}</p>
                <h2 className="mb-3 text-2xl font-bold text-white">
                  <Link to={`${collectionPath}/${encodeURIComponent(post.slug)}`} className="hover:text-purple-300">{post.title}</Link>
                </h2>
                <p className="mb-5 leading-relaxed text-slate-300">{post.summary}</p>
                <Link to={`${collectionPath}/${encodeURIComponent(post.slug)}`} className="font-semibold text-purple-300 hover:text-purple-200">
                  Read {postType === 'blog' ? 'article' : 'update'} <span aria-hidden="true">→</span>
                </Link>
              </article>
            ))}
          </div>
        )}
      </main>
    </SEOLayout>
  )
}
