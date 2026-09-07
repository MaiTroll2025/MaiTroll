import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { toast } from 'sonner'
import { 
  MessageSquare, Heart, Video, Sword, Users, Trophy, 
  Zap, ExternalLink, Share2, ArrowLeft, PlayCircle
} from 'lucide-react'
import { WallPost, WallPostType } from '../types/trollWall'
import ClickableUsername from '../components/ClickableUsername'
import { useAuthStore } from '../lib/store'
import { parseTextWithLinks } from '../lib/utils'
import WallShareModal from '../components/trollWall/WallShareModal'
import useSEO from '../hooks/useSEO'

export default function WallPostPage() {
  const { postId } = useParams<{ postId: string }>()
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [post, setPost] = useState<WallPost | null>(null)
  const [loading, setLoading] = useState(true)
  const [showShareModal, setShowShareModal] = useState(false)
  const [streamStatus, setStreamStatus] = useState<'live' | 'ended' | 'unknown' | null>(null)
  const streamId = post?.metadata?.stream_id

  const postAuthor = post?.username || 'MaiTroll community member'
  const postSnippet = post?.content?.replace(/\s+/g, ' ').trim() || 'A public community post on MaiTroll.'
  const postDescription = postSnippet.length > 155 ? `${postSnippet.slice(0, 152)}...` : postSnippet
  const postCanonical = postId ? `https://www.maitroll.com/post/${encodeURIComponent(postId)}` : 'https://www.maitroll.com/wall'

  useSEO({
    title: post ? `${postAuthor} on MaiTroll | ${postDescription.slice(0, 60)}` : 'Community Post | MaiTroll',
    description: postDescription,
    canonical: postCanonical,
    robots: post ? 'index, follow' : 'noindex, nofollow',
    ogType: 'article',
    author: postAuthor,
    publishedTime: post?.created_at,
    structuredData: post ? {
      '@context': 'https://schema.org',
      '@type': 'SocialMediaPosting',
      headline: postDescription,
      description: postDescription,
      url: postCanonical,
      datePublished: post.created_at,
      text: postSnippet,
      author: {
        '@type': 'Person',
        name: postAuthor,
        url: post.username ? `https://www.maitroll.com/profile/${encodeURIComponent(post.username)}` : 'https://www.maitroll.com/',
      },
    } : undefined,
  })

  useEffect(() => {
    const loadPost = async () => {
      if (!postId) return

      try {
        const { data, error } = await supabase
          .from('troll_wall_posts')
          .select('*, user_profiles(username, avatar_url, is_admin, is_troll_officer, is_og_user)')
          .eq('id', postId)
          .maybeSingle()

        if (error) throw error

        if (data) {
          const profile = data.user_profiles || {}
          
          // Check if user liked it
          let userLiked = false
          if (user?.id) {
            const { data: likeData } = await supabase
              .from('troll_wall_likes')
              .select('id')
              .eq('post_id', postId)
              .eq('user_id', user.id)
              .maybeSingle()
            userLiked = !!likeData
          }

          setPost({
            ...data,
            username: profile.username,
            avatar_url: profile.avatar_url,
            is_admin: profile.is_admin,
            is_troll_officer: profile.is_troll_officer,
            is_og_user: profile.is_og_user,
            user_liked: userLiked
          } as WallPost)
        }
      } catch (err) {
        console.error('Error loading post:', err)
        toast.error('Post not found')
        navigate('/wall')
      } finally {
        setLoading(false)
      }
    }

    loadPost()
  }, [postId, user?.id, navigate])

  // Check stream status when post has a stream_id
  useEffect(() => {
    if (!streamId) {
      setStreamStatus(null)
      return
    }
    const checkStreamStatus = async () => {
      try {
        const { data } = await supabase
          .from('streams')
          .select('status, ended_at')
          .eq('id', streamId)
          .maybeSingle()
        if (data) {
          setStreamStatus(data.status === 'ended' ? 'ended' : 'live')
        } else {
          setStreamStatus('unknown')
        }
      } catch {
        setStreamStatus('unknown')
      }
    }
    checkStreamStatus()
  }, [streamId])

  const getPostIcon = (type: WallPostType) => {
    switch (type) {
      case 'video':
        return <Video className="w-4 h-4 text-pink-400" />
      case 'stream_announce':
        return <Video className="w-4 h-4 text-red-400" />
      case 'battle_result':
        return <Sword className="w-4 h-4 text-purple-400" />
      case 'family_announce':
        return <Users className="w-4 h-4 text-blue-400" />
      case 'badge_earned':
        return <Trophy className="w-4 h-4 text-yellow-400" />
      case 'system':
        return <Zap className="w-4 h-4 text-cyan-400" />
      default:
        return <MessageSquare className="w-4 h-4 text-gray-400" />
    }
  }

  const handleShare = () => {
    setShowShareModal(true)
  }

  const handleShareAction = () => {
    if (!post) return
    if (user?.id) {
      supabase
        .from('troll_wall_post_shares')
        .insert({ post_id: post.id, user_id: user.id })
        .then(({ error }) => {
          if (error) console.warn('Failed to record share:', error)
        })
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0814] text-white flex items-center justify-center">
        <div className="animate-pulse">Loading post...</div>
      </div>
    )
  }

  if (!post) return null

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        <button 
          onClick={() => navigate('/wall')}
          className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Wall
        </button>

        <div className="bg-zinc-900 rounded-xl p-6 border border-[#2C2C2C] shadow-2xl">
          {/* Post Header */}
          <div className="flex items-start gap-4 mb-4">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center overflow-hidden flex-shrink-0">
              {post.avatar_url ? (
                <img
                  src={post.avatar_url}
                  alt={post.username}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-white font-bold text-lg">
                  {post.username?.[0]?.toUpperCase() || 'U'}
                </span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                {post.username ? (
                  <ClickableUsername
                    username={post.username}
                    userId={post.user_id}
                    className="font-semibold text-white hover:text-purple-400"
                  />
                ) : (
                  <span className="font-semibold text-gray-500">
                    Deleted User
                  </span>
                )}
                {post.is_admin && (
                  <span className="px-2 py-0.5 bg-red-600 text-white text-xs font-bold rounded">
                    ADMIN
                  </span>
                )}
                {post.is_troll_officer && (
                  <span className="px-2 py-0.5 bg-blue-600 text-white text-xs font-bold rounded">
                    OFFICER
                  </span>
                )}
                {post.is_og_user && (
                  <span className="px-2 py-0.5 bg-yellow-600 text-white text-xs font-bold rounded">
                    OG
                  </span>
                )}
                <span className="flex items-center gap-1 text-gray-400 text-xs">
                  {getPostIcon(post.post_type)}
                  {post.post_type.replace('_', ' ')}
                </span>
              </div>
              <p className="text-xs text-gray-500">
                {new Date(post.created_at).toLocaleString()}
              </p>
            </div>
          </div>

          {/* Post Content */}
          <div className="mb-4">
            <p className="text-white whitespace-pre-wrap break-words text-lg">{parseTextWithLinks(post.content)}</p>
            
            {/* Stream Link — supports both live and ended streams */}
            {post.metadata?.stream_id && streamStatus && streamStatus !== 'unknown' && (
              <div 
                className="mt-3 flex items-center gap-2 text-purple-400 text-sm cursor-pointer hover:underline"
                  onClick={() => {
                  if (streamStatus === 'ended') {
                    navigate(`/replay/id/${post.metadata.stream_id}`)
                  } else {
                    navigate(`/stream/${post.metadata.stream_id}`)
                  }
                }}
              >
                {streamStatus === 'ended' ? (
                  <>
                    <PlayCircle className="w-4 h-4" />
                    <span>Watch Replay</span>
                  </>
                ) : (
                  <>
                    <ExternalLink className="w-4 h-4" />
                    <span>Watch Stream</span>
                  </>
                )}
              </div>
            )}

            {/* Battle Link */}
            {post.metadata?.battle_id && (
              <div 
                className="mt-3 flex items-center gap-2 text-purple-400 text-sm cursor-pointer hover:underline"
                onClick={() => navigate('/battles')}
              >
                <Sword className="w-4 h-4" />
                <span>View Battle</span>
              </div>
            )}
          </div>

          {/* Post Actions */}
          <div className="flex items-center gap-4 pt-4 border-t border-[#2C2C2C]">
            <div className="flex items-center gap-2 text-gray-400">
              <Heart className={`w-5 h-5 ${post.user_liked ? 'fill-pink-500 text-pink-500' : ''}`} />
              <span>{post.likes || 0}</span>
            </div>
            <button
              type="button"
              onClick={handleShare}
              className="flex items-center gap-2 px-4 py-2 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-blue-400 transition-colors"
            >
              <Share2 className="w-5 h-5" />
              <span>Share</span>
            </button>
          </div>
        </div>

        {showShareModal && post && (
          <WallShareModal
            isOpen={showShareModal}
            onClose={() => setShowShareModal(false)}
            post={post}
            postUrl={`${window.location.origin}/wall/${post.id}`}
            onShare={handleShareAction}
          />
        )}
      </div>
    </div>
  )
}
