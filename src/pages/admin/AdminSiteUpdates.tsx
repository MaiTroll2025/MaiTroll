import React, { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { supabase } from '../../lib/supabase'
import { readJsonResponse } from '../../lib/readJsonResponse'

type PostType = 'update' | 'blog'

interface SitePost {
  id: string
  title: string
  slug: string
  summary: string
  content: string
  post_type: PostType
  is_published: boolean
  published_at: string | null
  created_at: string
}

interface PostForm {
  title: string
  slug: string
  summary: string
  content: string
  post_type: PostType
  is_published: boolean
}

const EMPTY_FORM: PostForm = {
  title: '',
  slug: '',
  summary: '',
  content: '',
  post_type: 'update',
  is_published: false,
}

function slugify(title: string) {
  return title.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

export default function AdminSiteUpdates() {
  const [posts, setPosts] = useState<SitePost[]>([])
  const [form, setForm] = useState<PostForm>(EMPTY_FORM)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const loadPosts = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
      if (sessionError) throw sessionError
      const token = sessionData.session?.access_token
      if (!token) throw new Error('Sign in as an administrator to manage site updates.')

      const response = await fetch('/api/admin/site-updates', {
        headers: { Authorization: `Bearer ${token}` },
      })
      const payload = await readJsonResponse<{ posts?: SitePost[]; error?: string }>(response)
      if (!response.ok) throw new Error(payload.error || 'Failed to load site updates')
      setPosts(payload.posts || [])
    } catch (loadError) {
      console.error('[AdminSiteUpdates] Failed to load posts:', loadError)
      setError(loadError instanceof Error ? loadError.message : 'Failed to load site updates')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadPosts()
  }, [loadPosts])

  const resetForm = () => {
    setForm(EMPTY_FORM)
    setEditingId(null)
  }

  const editPost = (post: SitePost) => {
    setEditingId(post.id)
    setForm({
      title: post.title,
      slug: post.slug,
      summary: post.summary,
      content: post.content,
      post_type: post.post_type,
      is_published: post.is_published,
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const savePost = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSaving(true)
    setError('')

    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
      if (sessionError) throw sessionError
      const token = sessionData.session?.access_token
      if (!token) throw new Error('Your session has expired. Please sign in again.')

      const response = await fetch(editingId ? `/api/admin/site-updates/${editingId}` : '/api/admin/site-updates', {
        method: editingId ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...form,
          slug: slugify(form.slug),
        }),
      })
      const payload = await readJsonResponse<{ error?: string }>(response)
      if (!response.ok) throw new Error(payload.error || 'Unable to save site update')

      toast.success(form.is_published ? 'Post published' : 'Draft saved')
      resetForm()
      await loadPosts()
    } catch (saveError) {
      console.error('[AdminSiteUpdates] Save failed:', saveError)
      setError(saveError instanceof Error ? saveError.message : 'Unable to save site update')
    } finally {
      setSaving(false)
    }
  }

  const deletePost = async (post: SitePost) => {
    if (!window.confirm(`Delete “${post.title}”? This cannot be undone.`)) return
    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
      if (sessionError) throw sessionError
      const token = sessionData.session?.access_token
      if (!token) throw new Error('Your session has expired. Please sign in again.')

      const response = await fetch(`/api/admin/site-updates/${post.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      const payload = await readJsonResponse<{ error?: string }>(response)
      if (!response.ok) throw new Error(payload.error || 'Unable to delete post')
      toast.success('Post deleted')
      if (editingId === post.id) resetForm()
      await loadPosts()
    } catch (deleteError) {
      console.error('[AdminSiteUpdates] Delete failed:', deleteError)
      setError(deleteError instanceof Error ? deleteError.message : 'Unable to delete post')
    }
  }

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-4 py-10 text-white">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="mb-2 text-sm font-bold uppercase tracking-widest text-purple-300">Public site content</p>
          <h1 className="text-3xl font-black">Site Updates &amp; Blog</h1>
          <p className="mt-2 text-slate-300">Published product updates are attributed publicly to CEO of Mai Corp.</p>
        </div>
        <Link className="rounded-lg border border-slate-700 px-4 py-2 text-sm hover:bg-slate-800" to="/admin">Back to Admin</Link>
      </header>

      {error && <p className="mb-6 rounded-lg border border-red-500/30 bg-red-950/40 p-4 text-red-200" role="alert">{error}</p>}

      <form onSubmit={savePost} className="mb-10 space-y-5 rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
        <h2 className="text-xl font-bold">{editingId ? 'Edit post' : 'Create a post'}</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-2 text-sm font-semibold">
            Post type
            <select
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white"
              value={form.post_type}
              onChange={(event) => setForm({ ...form, post_type: event.target.value as PostType })}
            >
              <option value="update">Product update</option>
              <option value="blog">Blog article</option>
            </select>
          </label>
          <label className="space-y-2 text-sm font-semibold">
            Title
            <input
              required
              maxLength={160}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white"
              value={form.title}
              onChange={(event) => setForm({ ...form, title: event.target.value, slug: editingId ? form.slug : slugify(event.target.value) })}
            />
          </label>
          <label className="space-y-2 text-sm font-semibold">
            URL slug
            <input
              required
              maxLength={120}
              pattern="[a-z0-9]+(-[a-z0-9]+)*"
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white"
              value={form.slug}
              onChange={(event) => setForm({ ...form, slug: event.target.value })}
            />
          </label>
          <label className="space-y-2 text-sm font-semibold">
            Search summary
            <textarea
              required
              maxLength={320}
              rows={2}
              className="w-full resize-y rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white"
              value={form.summary}
              onChange={(event) => setForm({ ...form, summary: event.target.value })}
            />
          </label>
        </div>
        <label className="block space-y-2 text-sm font-semibold">
          Article or update body
          <textarea
            required
            maxLength={50000}
            rows={10}
            className="w-full resize-y rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white"
            placeholder="Write in plain text. Separate paragraphs with a blank line."
            value={form.content}
            onChange={(event) => setForm({ ...form, content: event.target.value })}
          />
        </label>
        <label className="flex items-center gap-3 text-sm font-semibold">
          <input
            type="checkbox"
            checked={form.is_published}
            onChange={(event) => setForm({ ...form, is_published: event.target.checked })}
          />
          Publish publicly and include in the sitemap
        </label>
        <div className="flex flex-wrap gap-3">
          <button disabled={saving} className="rounded-lg bg-purple-600 px-5 py-2.5 font-bold hover:bg-purple-500 disabled:opacity-50" type="submit">
            {saving ? 'Saving…' : form.is_published ? 'Publish post' : 'Save draft'}
          </button>
          {editingId && <button className="rounded-lg border border-slate-700 px-5 py-2.5 font-semibold hover:bg-slate-800" type="button" onClick={resetForm}>Cancel edit</button>}
        </div>
      </form>

      <section aria-labelledby="site-posts-heading">
        <h2 id="site-posts-heading" className="mb-4 text-xl font-bold">Posts</h2>
        {loading ? <p className="text-slate-300">Loading posts…</p> : posts.length === 0 ? (
          <p className="rounded-xl border border-slate-800 p-5 text-slate-300">No posts yet. Create an update or blog article above.</p>
        ) : (
          <div className="space-y-3">
            {posts.map((post) => (
              <article key={post.id} className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-800 bg-slate-900/60 p-4">
                <div>
                  <p className="font-bold">{post.title}</p>
                  <p className="mt-1 text-sm text-slate-400">
                    {post.post_type === 'blog' ? 'Blog' : 'Update'} · {post.is_published ? 'Published' : 'Draft'} · /{post.post_type === 'blog' ? 'blog' : 'updates'}/{post.slug}
                  </p>
                </div>
                <div className="flex gap-2">
                  {post.is_published && (
                    <Link className="rounded-lg border border-slate-700 px-3 py-2 text-sm hover:bg-slate-800" to={`/${post.post_type === 'blog' ? 'blog' : 'updates'}/${encodeURIComponent(post.slug)}`} target="_blank" rel="noopener noreferrer">
                      View
                    </Link>
                  )}
                  <button className="rounded-lg border border-slate-700 px-3 py-2 text-sm hover:bg-slate-800" type="button" onClick={() => editPost(post)}>Edit</button>
                  <button className="rounded-lg border border-red-900 px-3 py-2 text-sm text-red-300 hover:bg-red-950" type="button" onClick={() => void deletePost(post)}>Delete</button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  )
}
