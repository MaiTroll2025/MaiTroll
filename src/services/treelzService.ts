import { supabase } from '@/lib/supabase'
import { moderation } from '@/services/maitrollModeration'
import type {
  TreelzPost,
  TreelzComment,
  TreelzFeedCursor,
  TreelzSettings,
  TreelzAnalytics,
  TreelzModerationAction,
} from '@/types/treelz'

const FEED_PAGE_SIZE = 10
const DOWNLOAD_COST = 10

// ─── Feed Algorithm (Mai Troll-style) ───
function calculateFeedScore(post: TreelzPost): number {
  const likes = post.likes_count || 0
  const comments = post.comments_count || 0
  const shares = post.shares_count || 0
  const saves = post.saves_count || 0
  const gifts = post.gifts_received || 0
  const score = likes * 1 + comments * 3 + shares * 5 + saves * 2 + gifts * 4
  const hoursSince = Math.max(
    (Date.now() - new Date(post.created_at).getTime()) / 3600000,
    0.1,
  )
  return score / Math.pow(hoursSince + 2, 1.5)
}

// ─── Fetch Feed ───
export async function fetchTreelzFeed(
  userId: string | null,
  cursor?: TreelzFeedCursor | null,
): Promise<{ posts: TreelzPost[]; nextCursor: TreelzFeedCursor | null }> {
  let query = supabase
    .from('treelz_posts')
    .select(
      '*, author:user_profiles(id, username, display_name, avatar_url, role, treelz_uploads_enabled)',
    )
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(FEED_PAGE_SIZE)

  if (cursor) {
    query = query.lt('created_at', cursor.created_at)
  }

  const { data: posts, error } = await query

  if (error) throw error

  const mapped: TreelzPost[] = (posts || []).map((p: any) => ({
    ...p,
    author: p.author
      ? {
          id: p.author.id,
          username: p.author.username,
          display_name: p.author.display_name,
          avatar_url: p.author.avatar_url,
          role: p.author.role,
        }
      : undefined,
    user_interaction: { liked: false, saved: false },
  }))

  // If logged in, fetch user interactions
  if (userId && mapped.length > 0) {
    const postIds = mapped.map((p) => p.id)
    const [likesRes, savesRes] = await Promise.all([
      supabase.from('treelz_likes').select('post_id').eq('user_id', userId).in('post_id', postIds),
      supabase.from('treelz_saves').select('post_id').eq('user_id', userId).in('post_id', postIds),
    ])
    const likedIds = new Set((likesRes.data || []).map((l) => l.post_id))
    const savedIds = new Set((savesRes.data || []).map((s) => s.post_id))
    mapped.forEach((p) => {
      p.user_interaction = { liked: likedIds.has(p.id), saved: savedIds.has(p.id) }
    })
  }

  const nextCursor =
    mapped.length === FEED_PAGE_SIZE
      ? { created_at: mapped[mapped.length - 1].created_at, id: mapped[mapped.length - 1].id }
      : null

  return { posts: mapped, nextCursor }
}

// ─── Fetch Trending (for homepage row) ───
export async function fetchTrendingTreelz(limit = 8): Promise<TreelzPost[]> {
  const { data, error } = await supabase
    .from('treelz_posts')
    .select('*, author:user_profiles(id, username, display_name, avatar_url)')
    .eq('status', 'active')
    .order('likes_count', { ascending: false })
    .order('views_count', { ascending: false })
    .limit(limit)

  if (error) throw error
  return (data || []).map((p: any) => ({
    ...p,
    author: p.author ? { id: p.author.id, username: p.author.username, display_name: p.author.display_name, avatar_url: p.author.avatar_url } : undefined,
  }))
}

// ─── Fetch Profile Posts ───
export async function fetchTreelzProfile(
  viewerId: string | null,
  profileUserId: string,
): Promise<TreelzPost[]> {
  const { data, error } = await supabase
    .from('treelz_posts')
    .select('*, author:user_profiles(id, username, display_name, avatar_url)')
    .eq('user_id', profileUserId)
    .eq('status', 'active')
    .order('created_at', { ascending: false })

  if (error) throw error
  const mapped: TreelzPost[] = (data || []).map((p: any) => ({
    ...p,
    author: p.author ? { id: p.author.id, username: p.author.username, display_name: p.author.display_name, avatar_url: p.author.avatar_url } : undefined,
    user_interaction: { liked: false, saved: false },
  }))

  if (viewerId && mapped.length > 0) {
    const postIds = mapped.map((p) => p.id)
    const [likesRes, savesRes] = await Promise.all([
      supabase.from('treelz_likes').select('post_id').eq('user_id', viewerId).in('post_id', postIds),
      supabase.from('treelz_saves').select('post_id').eq('user_id', viewerId).in('post_id', postIds),
    ])
    const likedIds = new Set((likesRes.data || []).map((l) => l.post_id))
    const savedIds = new Set((savesRes.data || []).map((s) => s.post_id))
    mapped.forEach((p) => {
      p.user_interaction = { liked: likedIds.has(p.id), saved: savedIds.has(p.id) }
    })
  }

  return mapped
}

// ─── Toggle Troll (frontend name for like) ───
export async function toggleTreelzTroll(userId: string, postId: string): Promise<boolean> {
  const { data: existing } = await supabase
    .from('treelz_likes')
    .select('id')
    .eq('user_id', userId)
    .eq('post_id', postId)
    .maybeSingle()

  if (existing) {
    await supabase.from('treelz_likes').delete().eq('id', existing.id)
    await supabase.rpc('decrement_treelz_likes', { p_post_id: postId })
    return false
  }

  await supabase.from('treelz_likes').insert({ user_id: userId, post_id: postId })
  await supabase.rpc('increment_treelz_likes', { p_post_id: postId })
  return true
}

// ─── Comments ───
export async function fetchTreelzComments(postId: string): Promise<TreelzComment[]> {
  const { data, error } = await supabase
    .from('treelz_comments')
    .select('*, author:user_profiles(id, username, display_name, avatar_url)')
    .eq('post_id', postId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data || []).map((c: any) => ({
    ...c,
    author: c.author ? { id: c.author.id, username: c.author.username, display_name: c.author.display_name, avatar_url: c.author.avatar_url } : undefined,
  }))
}

export async function addTreelzComment(userId: string, postId: string, content: string) {
  const { error } = await supabase.from('treelz_comments').insert({
    user_id: userId,
    post_id: postId,
    content: content.trim(),
  })
  if (error) throw error
  await supabase.rpc('increment_treelz_comments', { p_post_id: postId })
}

// ─── Tips ───
export async function sendTreelzTip(
  fromUserId: string,
  toUserId: string,
  postId: string,
  amount: number,
) {
  const { error } = await supabase.rpc('send_treelz_tip', {
    p_from_user_id: fromUserId,
    p_to_user_id: toUserId,
    p_post_id: postId,
    p_amount: amount,
  })
  if (error) throw error
}

// ─── Saves ───
export async function toggleTreelzSave(userId: string, postId: string): Promise<boolean> {
  const { data: existing } = await supabase
    .from('treelz_saves')
    .select('id')
    .eq('user_id', userId)
    .eq('post_id', postId)
    .maybeSingle()

  if (existing) {
    await supabase.from('treelz_saves').delete().eq('id', existing.id)
    await supabase.rpc('decrement_treelz_saves', { p_post_id: postId })
    return false
  }

  await supabase.from('treelz_saves').insert({ user_id: userId, post_id: postId })
  await supabase.rpc('increment_treelz_saves', { p_post_id: postId })
  return true
}

// ─── Shares ───
export async function recordTreelzShare(userId: string, postId: string, platform: string) {
  await supabase.from('treelz_shares').insert({
    user_id: userId,
    post_id: postId,
    platform,
  })
  await supabase.rpc('increment_treelz_shares', { p_post_id: postId })
}

// ─── Views ───
export async function recordTreelzView(postId: string, watchSeconds: number, completed: boolean) {
  await supabase.rpc('record_treelz_view', {
    p_post_id: postId,
    p_watch_seconds: watchSeconds,
    p_completed: completed,
  })
}

// ─── Upload ───
export async function uploadTreelzVideo(
  file: File,
  thumbnailUrl: string,
  caption: string,
  userId: string,
  onProgress?: (pct: number) => void,
): Promise<TreelzPost> {
  const ext = file.name.split('.').pop() || 'mp4'
  const path = `${userId}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`

  const { error: uploadError } = await supabase.storage
    .from('treelz-videos')
    .upload(path, file, {
      cacheControl: '3600',
      upsert: false,
      onUploadProgress: (progress) => {
        onProgress?.(Math.round((progress.loaded / progress.total) * 100))
      },
    })

  if (uploadError) throw uploadError

  const {
    data: { publicUrl },
  } = supabase.storage.from('treelz-videos').getPublicUrl(path)

  // Canonical moderation check for caption
  if (caption.trim()) {
    const modResult = await moderation.checkContent(userId, caption.trim(), 'treelz_caption');
    if (!modResult.allowed) {
      throw new Error(modResult.message || 'That caption violates Mai Troll\'s chat rules and was not sent.');
    }
  }

  const { data: post, error } = await supabase
    .from('treelz_posts')
    .insert({
      user_id: userId,
      video_url: publicUrl,
      thumbnail_url: thumbnailUrl || null,
      caption: caption.trim(),
      video_size_bytes: file.size,
      status: 'active',
    })
    .select('*, author:user_profiles(id, username, display_name, avatar_url)')
    .single()

  if (error) throw error

  return {
    ...post,
    author: post.author
      ? { id: post.author.id, username: post.author.username, display_name: post.author.display_name, avatar_url: post.author.avatar_url }
      : undefined,
  }
}

// ─── Live Stream Promotion ───
export async function promoteLiveStreamToTreelz(
  userId: string,
  streamId: string,
  videoUrl: string,
  thumbnailUrl: string,
): Promise<TreelzPost> {
  const { data, error } = await supabase
    .from('treelz_posts')
    .insert({
      user_id: userId,
      video_url: videoUrl,
      thumbnail_url: thumbnailUrl,
      caption: '🔴 Live Now!',
      is_live_promotion: true,
      live_stream_id: streamId,
      video_duration_seconds: 15,
      status: 'active',
    })
    .select('*, author:user_profiles(id, username, display_name, avatar_url)')
    .single()

  if (error) throw error
  return data
}

// ─── AI Detection (stub — edge function will call this) ───
export async function flagAiContent(postId: string, score: number) {
  await supabase.from('treelz_ai_flags').insert({
    post_id: postId,
    confidence: score,
    action_taken: score > 70 ? 'pending' : 'cleared',
  })

  if (score > 70) {
    await supabase
      .from('treelz_posts')
      .update({ is_ai_flagged: true, ai_detection_score: score })
      .eq('id', postId)
  }
}

// ─── Upload Ban ───
export async function checkUploadBan(userId: string): Promise<{
  banned: boolean
  bannedUntil: string | null
  strikes: number
}> {
  const { data } = await supabase
    .from('treelz_upload_bans')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!data) return { banned: false, bannedUntil: null, strikes: 0 }
  if (!data.banned_until) return { banned: false, bannedUntil: null, strikes: data.strike_count }

  const bannedUntil = new Date(data.banned_until)
  if (bannedUntil < new Date()) return { banned: false, bannedUntil: null, strikes: data.strike_count }

  return { banned: true, bannedUntil: data.banned_until, strikes: data.strike_count }
}

export async function strikeUserTreelzUpload(userId: string, reason: string) {
  const existing = await checkUploadBan(userId)
  const newStrikes = existing.strikes + 1

  let bannedUntil: string | null = null
  if (newStrikes === 2) {
    const d = new Date()
    d.setHours(d.getHours() + 24)
    bannedUntil = d.toISOString()
  } else if (newStrikes >= 3) {
    const d = new Date()
    d.setDate(d.getDate() + 7)
    bannedUntil = d.toISOString()
  }

  await supabase.from('treelz_upload_bans').insert({
    user_id: userId,
    reason,
    banned_until: bannedUntil,
    strike_count: newStrikes,
  })

  if (newStrikes >= 2) {
    await supabase
      .from('user_profiles')
      .update({ treelz_uploads_enabled: false })
      .eq('id', userId)
  }
}

// ─── Moderation ───
export async function takeTreelzModAction(
  moderatorId: string,
  postId: string,
  action: TreelzModerationAction,
) {
  switch (action) {
    case 'feature':
      await supabase.from('treelz_posts').update({ is_featured: true }).eq('id', postId)
      break
    case 'pin':
      await supabase.from('treelz_posts').update({ is_pinned: true }).eq('id', postId)
      break
    case 'boost': {
      const expiry = new Date()
      expiry.setDate(expiry.getDate() + 7)
      await supabase
        .from('treelz_posts')
        .update({ is_boosted: true, boost_expires_at: expiry.toISOString() })
        .eq('id', postId)
      break
    }
    case 'hide':
      await supabase.from('treelz_posts').update({ status: 'hidden' }).eq('id', postId)
      break
    case 'remove':
      await supabase.from('treelz_posts').update({ status: 'removed' }).eq('id', postId)
      break
    case 'age_restrict':
      await supabase.from('treelz_posts').update({ status: 'age_restricted' }).eq('id', postId)
      break
  }

  await supabase.from('moderation_actions').insert({
    actor_id: moderatorId,
    target_post_id: postId,
    action_type: `treelz_${action}`,
    target_type: 'treelz',
  })
}

export async function disableTreelzUploads(moderatorId: string, userId: string, reason: string) {
  await supabase
    .from('user_profiles')
    .update({ treelz_uploads_enabled: false })
    .eq('id', userId)
  await supabase.from('moderation_actions').insert({
    actor_id: moderatorId,
    target_user_id: userId,
    action_type: 'treelz_disable_uploads',
    target_type: 'user',
    reason,
  })
}

export async function enableTreelzUploads(moderatorId: string, userId: string) {
  await supabase
    .from('user_profiles')
    .update({ treelz_uploads_enabled: true })
    .eq('id', userId)
  await supabase.from('moderation_actions').insert({
    actor_id: moderatorId,
    target_user_id: userId,
    action_type: 'treelz_enable_uploads',
    target_type: 'user',
  })
}

// ─── Analytics ───
export async function getTreelzAnalytics(postId: string): Promise<TreelzAnalytics> {
  const { data, error } = await supabase
    .from('treelz_posts')
    .select('post_id, views_count, watch_time_seconds, completion_rate, shares_count, gifts_received, coins_received')
    .eq('id', postId)
    .single()

  if (error) throw error
  const d = data as any
  return {
    id: d.id,
    post_id: d.id,
    views: data.views_count || 0,
    watch_time_seconds: data.watch_time_seconds || 0,
    completion_rate: data.completion_rate || 0,
    shares: data.shares_count || 0,
    gifts_received: data.gifts_received || 0,
    coins_received: data.coins_received || 0,
  }
}

export async function getUserTreelzAnalytics(userId: string) {
  const { data, error } = await supabase
    .from('treelz_posts')
    .select('views_count, watch_time_seconds, completion_rate, shares_count, gifts_received, coins_received')
    .eq('user_id', userId)
    .eq('status', 'active')

  if (error) throw error

  return data.reduce(
    (acc, p) => ({
      views: acc.views + (p.views_count || 0),
      watch_time: acc.watch_time + (p.watch_time_seconds || 0),
      completion_rate: acc.completion_rate + (p.completion_rate || 0),
      shares: acc.shares + (p.shares_count || 0),
      gifts: acc.gifts + (p.gifts_received || 0),
      coins: acc.coins + Number(p.coins_received || 0),
    }),
    { views: 0, watch_time: 0, completion_rate: 0, shares: 0, gifts: 0, coins: 0 },
  )
}

// ─── Report ───
export async function reportTreelzPost(userId: string, postId: string, reason: string) {
  await supabase.from('moderation_reports').insert({
    reporter_id: userId,
    target_post_id: postId,
    target_type: 'treelz',
    reason,
  })
}

export async function fetchTreelzReports(postId: string) {
  const { data, error } = await supabase
    .from('moderation_reports')
    .select('id, reason, created_at, reporter:reporter_id(username)')
    .eq('target_post_id', postId)
    .eq('target_type', 'treelz')
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data || []).map((r: any) => ({
    id: r.id,
    reason: r.reason,
    created_at: r.created_at,
    reporter_username: r.reporter?.username || 'unknown',
  }))
}

// ─── Saved Posts ───
export async function fetchSavedTreelz(userId: string): Promise<TreelzPost[]> {
  const { data, error } = await supabase
    .from('treelz_saves')
    .select('post:treelz_posts(*, author:user_profiles(id, username, display_name, avatar_url))')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data || []).map((row: any) => ({
    ...row.post,
    author: row.post?.author
      ? { id: row.post.author.id, username: row.post.author.username, display_name: row.post.author.display_name, avatar_url: row.post.author.avatar_url }
      : undefined,
    user_interaction: { liked: false, saved: true },
  }))
}

// ─── Settings (stored in user_profiles or localStorage) ───
export const DEFAULT_TREELZ_SETTINGS: TreelzSettings = {
  autoPlayNext: true,
  autoPlayEnabled: true,
  soundOnByDefault: false,
  uploadQuality: 'medium',
}

export function loadTreelzSettings(): TreelzSettings {
  try {
    const raw = localStorage.getItem('treelz_settings')
    if (raw) return { ...DEFAULT_TREELZ_SETTINGS, ...JSON.parse(raw) }
  } catch {
    // ignore
  }
  return DEFAULT_TREELZ_SETTINGS
}

export function saveTreelzSettings(settings: TreelzSettings) {
  localStorage.setItem('treelz_settings', JSON.stringify(settings))
}

// ─── Download (costs 10 troll coins) ───
export async function downloadTreelzVideo(userId: string, postId: string, videoUrl: string) {
  const { data: balance } = await supabase
    .from('user_profiles')
    .select('troll_coins')
    .eq('id', userId)
    .single()

  if (!balance || balance.troll_coins < DOWNLOAD_COST) {
    throw new Error(`Need ${DOWNLOAD_COST} troll coins to download`)
  }

  const { error } = await supabase.rpc('spend_coins', {
    p_sender_id: userId,
    p_receiver_id: userId,
    p_coin_amount: DOWNLOAD_COST,
    p_source: 'treelz_download',
    p_item: `treelz_${postId}`,
  })

  if (error) throw error

  const link = document.createElement('a')
  link.href = videoUrl
  link.download = `treelz-${postId}.mp4`
  link.target = '_blank'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}
