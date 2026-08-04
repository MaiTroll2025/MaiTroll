import React, { useState } from 'react'
import { X, Copy, Check, Link2 } from 'lucide-react'
import { toast } from 'sonner'
import { WallPost } from '../../types/trollWall'

interface WallShareModalProps {
  isOpen: boolean
  onClose: () => void
  post: WallPost | null
  postUrl: string
  onShare?: (postId: string) => void
}

const SOCIAL_PLATFORMS = [
  {
    id: 'facebook',
    name: 'Facebook',
    color: '#1877F2',
    buildUrl: (url: string, text: string) =>
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}&quote=${encodeURIComponent(text)}`,
  },
  {
    id: 'twitter',
    name: 'X / Twitter',
    color: '#000000',
    buildUrl: (url: string, text: string) =>
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`,
  },
  {
    id: 'reddit',
    name: 'Reddit',
    color: '#FF4500',
    buildUrl: (url: string, text: string) =>
      `https://reddit.com/submit?title=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`,
  },
  {
    id: 'whatsapp',
    name: 'WhatsApp',
    color: '#25D366',
    buildUrl: (url: string, text: string) =>
      `https://wa.me/?text=${encodeURIComponent(text + ' ' + url)}`,
  },
  {
    id: 'telegram',
    name: 'Telegram',
    color: '#0088CC',
    buildUrl: (url: string, text: string) =>
      `https://t.me/share/url?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`,
  },
  {
    id: 'linkedin',
    name: 'LinkedIn',
    color: '#0A66C2',
    buildUrl: (url: string, _text: string) =>
      `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`,
  },
  {
    id: 'discord',
    name: 'Discord',
    color: '#5865F2',
    buildUrl: null,
  },
  {
    id: 'messenger',
    name: 'Messenger',
    color: '#0084FF',
    buildUrl: null,
  },
  {
    id: 'snapchat',
    name: 'Snapchat',
    color: '#FFFC00',
    buildUrl: null,
  },
  {
    id: 'instagram',
    name: 'Instagram',
    color: '#E4405F',
    buildUrl: null,
  },
  {
    id: 'tiktok',
    name: 'TikTok',
    color: '#000000',
    buildUrl: null,
  },
]

const PLATFORM_EMOJI: Record<string, string> = {
  facebook: '📘',
  twitter: '🐦',
  reddit: '🤖',
  whatsapp: '💚',
  telegram: '✈️',
  linkedin: '💼',
  discord: '🎮',
  messenger: '💬',
  snapchat: '👻',
  instagram: '📷',
  tiktok: '🎵',
}

export default function WallShareModal({ isOpen, onClose, post, postUrl, onShare }: WallShareModalProps) {
  const [copied, setCopied] = useState(false)

  if (!isOpen || !post) return null

  const authorName = post.username || 'Someone'
  const postPreview = post.content.length > 80 ? post.content.slice(0, 80) + '…' : post.content
  const shareText = `${postPreview} — by ${authorName} on MaiMai Troll`

  const handleShare = async (platform: (typeof SOCIAL_PLATFORMS)[0]) => {
    onShare?.(post.id)

    if (platform.id === 'copy') {
      await navigator.clipboard.writeText(postUrl)
      setCopied(true)
      toast.success('Link copied to clipboard!')
      setTimeout(() => setCopied(false), 2000)
      return
    }

    if (!platform.buildUrl) {
      await navigator.clipboard.writeText(postUrl)
      toast.success(`${platform.name} link copied! Open ${platform.name} to share.`)
      return
    }

    const shareUrl = platform.buildUrl(postUrl, shareText)
    window.open(shareUrl, '_blank', 'noopener,noreferrer')
  }

  const handleNativeShare = async () => {
    onShare?.(post.id)
    try {
      await navigator.share({
        title: `Post by ${authorName} on MaiMai Troll`,
        text: shareText,
        url: postUrl,
      })
    } catch {
      // User cancelled
    }
  }

  const handleCopyLink = async () => {
    onShare?.(post.id)
    await navigator.clipboard.writeText(postUrl)
    setCopied(true)
    toast.success('Link copied to clipboard!')
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="absolute bottom-0 left-0 right-0 bg-zinc-900 rounded-t-3xl max-h-[85vh] overflow-hidden">
        <div className="sticky top-0 z-10 bg-zinc-900 border-b border-white/10 px-4 py-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-white">Share Post</h2>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white/70 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <p className="text-sm text-white/60 mt-1 truncate">{postPreview}</p>
        </div>

        <div className="p-4 overflow-y-auto" style={{ maxHeight: 'calc(85vh - 80px)' }}>
          <div className="grid grid-cols-4 gap-3">
            {SOCIAL_PLATFORMS.map((platform) => (
              <button
                key={platform.id}
                onClick={() => handleShare(platform)}
                className="flex flex-col items-center gap-2 p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors"
              >
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: platform.color }}
                >
                  <span className="text-xl">{PLATFORM_EMOJI[platform.id] || '🔗'}</span>
                </div>
                <span className="text-xs text-white/80 text-center">{platform.name}</span>
              </button>
            ))}

            <button
              onClick={handleCopyLink}
              className="flex flex-col items-center gap-2 p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors"
            >
              <div className="w-10 h-10 rounded-full bg-gray-500 flex items-center justify-center">
                {copied ? (
                  <Check className="w-5 h-5 text-white" />
                ) : (
                  <Copy className="w-5 h-5 text-white" />
                )}
              </div>
              <span className="text-xs text-white/80 text-center">Copy Link</span>
            </button>
          </div>

          {'share' in navigator && (
            <button
              onClick={handleNativeShare}
              className="w-full mt-4 py-3 bg-purple-600 hover:bg-purple-500 rounded-xl text-white font-medium flex items-center justify-center gap-2"
            >
              <Link2 className="w-5 h-5" />
              More Options
            </button>
          )}

          <div className="mt-4 pt-4 border-t border-white/10">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={postUrl}
                readOnly
                className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white/80 outline-none"
              />
              <button
                onClick={handleCopyLink}
                className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-white text-sm"
              >
                Copy
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
