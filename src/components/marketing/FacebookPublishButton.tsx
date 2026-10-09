import { useEffect, useState } from 'react'
import { Check, Facebook, Loader2, Send } from 'lucide-react'
import { toast } from 'sonner'
import { isMarketingAgent, supabase, type UserProfile } from '@/lib/supabase'
import { useAuthStore } from '@/lib/store'
import { facebookFunctionErrorMessage } from '@/lib/facebookPublishing'

type FacebookSourceType =
  | 'wall_post'
  | 'troll_post'
  | 'stream'
  | 'gaming_stream'
  | 'podcast'
  | 'court_session'
  | 'treelz_post'

interface FacebookPublishButtonProps {
  sourceId: string
  sourceType: FacebookSourceType
  featured?: boolean
  className?: string
  compact?: boolean
}

const contextualPublisherRoles = new Set([
  'ceo',
  'secretary',
  'ceo_assistant',
  'noah_assistant',
  'marketing_agent',
])

function isFacebookAdmin(profile: UserProfile | null): boolean {
  if (!profile) return false
  const adminRoles = new Set(['admin', 'superadmin', 'owner', 'ceo'])
  return profile.is_admin === true ||
    adminRoles.has(String(profile.role || '').toLowerCase()) ||
    adminRoles.has(String(profile.troll_role || '').toLowerCase())
}

function canPublishContextually(profile: UserProfile | null, isAdmin: boolean): boolean {
  if (isAdmin || isFacebookAdmin(profile) || isMarketingAgent(profile)) return true
  return [profile?.role, profile?.troll_role]
    .some((role) => contextualPublisherRoles.has(String(role || '').toLowerCase()))
}

export default function FacebookPublishButton({
  sourceId,
  sourceType,
  featured = true,
  className = '',
  compact = false,
}: FacebookPublishButtonProps) {
  const { profile, isAdmin } = useAuthStore()
  const [publishing, setPublishing] = useState(false)
  const [featuredForFacebook, setFeaturedForFacebook] = useState(featured)
  const [featuring, setFeaturing] = useState(false)
  const admin = isAdmin || isFacebookAdmin(profile)

  useEffect(() => {
    setFeaturedForFacebook(featured)
  }, [featured, sourceId])

  if (!canPublishContextually(profile, isAdmin) || !sourceId) return null

  const featurePost = async () => {
    setFeaturing(true)
    try {
      const { error } = await supabase.rpc('set_wall_post_facebook_featured', {
        p_post_id: sourceId,
        p_featured: true,
      })
      if (error) throw error
      setFeaturedForFacebook(true)
      toast.success('Post approved for Facebook publishing.')
    } catch (error) {
      console.error('[FacebookPublishButton] Could not feature wall post', error)
      toast.error('Unable to approve this post for Facebook.')
    } finally {
      setFeaturing(false)
    }
  }

  const publish = async () => {
    setPublishing(true)
    try {
      const { data, error } = await supabase.functions.invoke('facebook-publish', {
        body: { sourceType, sourceId },
      })
      if (error) throw error
      if (!data?.success) {
        throw new Error(data?.error || 'Facebook publishing failed.')
      }
      toast.success(data.alreadyPublished ? 'This post is already on Facebook.' : 'Published to Facebook.')
    } catch (error) {
      console.error('[FacebookPublishButton] Publish failed', error)
      toast.error(await facebookFunctionErrorMessage(error, 'Facebook publishing failed.'))
    } finally {
      setPublishing(false)
    }
  }

  return (
    <div
      className={`flex flex-wrap items-center gap-2 ${className}`}
      onClick={(event) => event.stopPropagation()}
    >
      {sourceType === 'wall_post' && !featuredForFacebook && admin && (
        <button
          type="button"
          onClick={featurePost}
          disabled={featuring}
          className="inline-flex items-center gap-1.5 rounded-lg border border-blue-400/30 bg-blue-500/10 px-3 py-2 text-xs font-semibold text-blue-200 hover:bg-blue-500/20 disabled:opacity-60"
        >
          {featuring ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
          Approve for Facebook
        </button>
      )}
      <button
        type="button"
        onClick={publish}
        disabled={publishing || (sourceType === 'wall_post' && !featuredForFacebook)}
        title={sourceType === 'wall_post' && !featuredForFacebook ? 'An administrator must approve this wall post first.' : 'Publish to Facebook'}
        aria-label={publishing ? 'Publishing to Facebook' : 'Publish to Facebook'}
        className={compact
          ? 'inline-flex h-10 w-10 items-center justify-center rounded-full border border-blue-400/30 bg-blue-500/10 text-blue-200 hover:bg-blue-500/20 disabled:cursor-not-allowed disabled:opacity-50'
          : 'inline-flex items-center gap-1.5 rounded-lg border border-blue-400/30 bg-blue-500/10 px-3 py-2 text-xs font-semibold text-blue-200 hover:bg-blue-500/20 disabled:cursor-not-allowed disabled:opacity-50'}
      >
        {publishing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : compact ? <Facebook className="h-4 w-4" /> : <Send className="h-3.5 w-3.5" />}
        {!compact && (publishing ? 'Publishing…' : 'Publish to Facebook')}
      </button>
    </div>
  )
}
