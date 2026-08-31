/**
 * MAI PIKS — FULL SCREEN STORY VIEWER
 *
 *  - photos advance automatically after 5s, videos advance when they finish
 *  - tap / swipe left and right to scroll through a story
 *  - reaching the end of one user's story rolls straight into the next user
 *    they follow, and running off the last story closes the viewer
 *  - owners can hard delete any piece of their own story
 *  - viewers can tip troll coins (80% owner / 20% platform fee pool)
 */

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Coins, ShieldCheck, Sparkles, Trash2, X } from 'lucide-react'

import { supabase } from '../../lib/supabase'
import {
  ExpiryCountdown,
  MaiPiksAvatar,
  PHOTO_STORY_DURATION_MS,
  TIP_PLATFORM_FEE_PERCENT,
  TIP_PRESETS,
  type MaiPiksUser,
  type PiksStory,
  type PiksStoryItem,
} from './maiPiksShared'

/* ========================================================================= */
/* STORY VIEWER                                                              */
/* ========================================================================= */

interface StoryViewerProps {
  stories: PiksStory[]
  startIndex: number
  currentUser: MaiPiksUser | null
  onClose: () => void
  onDeleteItem: (item: PiksStoryItem) => Promise<boolean>
  onTip: (story: PiksStory, item: PiksStoryItem | null, amount: number) => Promise<boolean>
  onScreenshot: (payload: {
    contentType: 'story' | 'feed' | 'profile' | 'chat' | 'broadcast'
    contentId?: string
    ownerUserId?: string
  }) => void
}

/**
 * Full screen MAI Piks story viewer.
 */
export default function StoryViewer({
  stories,
  startIndex,
  currentUser,
  onClose,
  onDeleteItem,
  onTip,
  onScreenshot,
}: StoryViewerProps) {
  const [storyIndex, setStoryIndex] = useState(startIndex)
  const [itemIndex, setItemIndex] = useState(0)
  const [progress, setProgress] = useState(0)
  const [paused, setPaused] = useState(false)
  const [showTipModal, setShowTipModal] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const videoRef = useRef<HTMLVideoElement | null>(null)
  const rafRef = useRef<number | null>(null)
  const startedAtRef = useRef<number>(0)
  const elapsedRef = useRef<number>(0)
  const pointerStartRef = useRef<{ x: number; y: number; time: number; type: string } | null>(null)
  const viewedRef = useRef<Set<string>>(new Set())

  const story = stories[storyIndex]
  const item = story?.items[itemIndex]

  const isOwn = Boolean(story?.isOwn)
  const canTip = Boolean(currentUser && story && !isOwn)

  /* ------------------------------------------------------------------ */
  /* Navigation                                                        */
  /* ------------------------------------------------------------------ */

  const resetTimer = useCallback(() => {
    elapsedRef.current = 0
    startedAtRef.current = performance.now()
    setProgress(0)
  }, [])

  /** Next piece of media, rolling into the next user's story at the end. */
  const goNext = useCallback(() => {
    if (!story) return

    if (itemIndex < story.items.length - 1) {
      setItemIndex((value) => value + 1)
      resetTimer()
      return
    }

    if (storyIndex < stories.length - 1) {
      setStoryIndex((value) => value + 1)
      setItemIndex(0)
      resetTimer()
      return
    }

    onClose()
  }, [story, itemIndex, storyIndex, stories.length, resetTimer, onClose])

  /** Previous piece of media, rolling back into the previous user's story. */
  const goPrev = useCallback(() => {
    if (itemIndex > 0) {
      setItemIndex((value) => value - 1)
      resetTimer()
      return
    }

    if (storyIndex > 0) {
      const prevIndex = storyIndex - 1
      setStoryIndex(prevIndex)
      setItemIndex(Math.max((stories[prevIndex]?.items.length ?? 1) - 1, 0))
      resetTimer()
      return
    }

    resetTimer()
  }, [itemIndex, storyIndex, stories, resetTimer])

  /* Keep indexes valid if media is deleted underneath us. */
  useEffect(() => {
    if (!stories.length) {
      onClose()
      return
    }

    if (storyIndex > stories.length - 1) {
      setStoryIndex(stories.length - 1)
      setItemIndex(0)
      return
    }

    const activeStory = stories[storyIndex]
    if (activeStory && itemIndex > activeStory.items.length - 1) {
      setItemIndex(Math.max(activeStory.items.length - 1, 0))
    }
  }, [stories, storyIndex, itemIndex, onClose])

  /* ------------------------------------------------------------------ */
  /* Auto advance                                                      */
  /* ------------------------------------------------------------------ */

  useEffect(() => {
    resetTimer()
  }, [item?.id, resetTimer])

  useEffect(() => {
    if (!item) return

    /* The tip sheet freezes the story so nobody loses their place. */
    const frozen = paused || showTipModal || deleting

    const cancelRaf = () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
    }

    /*
     * Videos drive their own progress from `timeupdate` and advance on `ended`,
     * so only photos need the 5 second timer.
     */
    if (item.mediaType === 'video') {
      cancelRaf()
      if (frozen) videoRef.current?.pause()
      else void videoRef.current?.play().catch(() => undefined)
      return
    }

    if (frozen) {
      cancelRaf()
      return
    }

    startedAtRef.current = performance.now() - elapsedRef.current

    const step = () => {
      const elapsed = performance.now() - startedAtRef.current
      elapsedRef.current = elapsed

      const ratio = Math.min(elapsed / PHOTO_STORY_DURATION_MS, 1)
      setProgress(ratio)

      if (ratio >= 1) {
        rafRef.current = null
        goNext()
        return
      }

      rafRef.current = requestAnimationFrame(step)
    }

    rafRef.current = requestAnimationFrame(step)

    return cancelRaf
  }, [item, paused, showTipModal, deleting, goNext])

  /* ------------------------------------------------------------------ */
  /* View tracking + screenshot notice                                 */
  /* ------------------------------------------------------------------ */

  useEffect(() => {
    if (!item || !currentUser || isOwn) return
    if (viewedRef.current.has(item.id)) return

    viewedRef.current.add(item.id)

    void (async () => {
      try {
        await supabase.rpc('maipiks_record_story_view', { p_item_id: item.id })
      } catch {
        /* View tracking is best effort. */
      }
    })()

    if (!currentUser.screenshotsAllowed) {
      onScreenshot({ contentType: 'story', contentId: item.id, ownerUserId: story?.userId })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item?.id, currentUser?.id, isOwn])

  /* ------------------------------------------------------------------ */
  /* Keyboard                                                          */
  /* ------------------------------------------------------------------ */

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'ArrowRight') goNext()
      else if (event.key === 'ArrowLeft') goPrev()
      else if (event.key === 'Escape') onClose()
    }

    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [goNext, goPrev, onClose])

  /* ------------------------------------------------------------------ */
  /* Pointer: tap zones, swipe and press-to-pause                      */
  /* ------------------------------------------------------------------ */

  /*
   * Pointer events cover mouse, touch and pen with one code path, which avoids
   * the classic double-advance from a touchend plus a synthesised click.
   */
  const handlePointerDown = (event: React.PointerEvent) => {
    pointerStartRef.current = {
      x: event.clientX,
      y: event.clientY,
      time: Date.now(),
      type: event.pointerType,
    }
    setPaused(true)
  }

  const handlePointerUp = (event: React.PointerEvent) => {
    setPaused(false)

    const start = pointerStartRef.current
    pointerStartRef.current = null
    if (!start) return

    const dx = event.clientX - start.x
    const dy = event.clientY - start.y
    const heldFor = Date.now() - start.time

    /* Swipe down closes, like every other story viewer. */
    if (start.type !== 'mouse' && dy > 90 && Math.abs(dy) > Math.abs(dx)) {
      onClose()
      return
    }

    /* Horizontal swipe scrolls between story media and between users. */
    if (Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy)) {
      if (dx < 0) goNext()
      else goPrev()
      return
    }

    /* A long press was a deliberate pause, not a tap. */
    if (heldFor > 350) return

    /* Tap: right third forward, left third back. */
    const width = window.innerWidth || 1
    if (event.clientX > width * 0.66) goNext()
    else if (event.clientX < width * 0.34) goPrev()
  }

  const handleDelete = async () => {
    if (!item || !isOwn) return
    if (!window.confirm('Delete this from your story?')) return

    setDeleting(true)
    const removed = await onDeleteItem(item)
    setDeleting(false)

    if (!removed) return

    /* If that was the last piece of media, move on. */
    if ((story?.items.length ?? 0) <= 1) {
      if (stories.length <= 1) onClose()
      else goNext()
      return
    }

    setItemIndex((value) => Math.max(Math.min(value, (story?.items.length ?? 1) - 2), 0))
    resetTimer()
  }

  if (!story || !item) return null

  return (
    <div className="fixed inset-0 z-[200] select-none bg-black">
      {/* MEDIA */}
      <div className="absolute inset-0 flex items-center justify-center">
        {item.mediaType === 'video' ? (
          <video
            ref={videoRef}
            key={item.id}
            src={item.mediaUrl}
            className="max-h-full max-w-full object-contain"
            autoPlay
            playsInline
            onEnded={goNext}
            onLoadedMetadata={() => {
              startedAtRef.current = performance.now()
              elapsedRef.current = 0
            }}
            onTimeUpdate={(event) => {
              const el = event.currentTarget
              if (Number.isFinite(el.duration) && el.duration > 0) {
                setProgress(Math.min(el.currentTime / el.duration, 1))
              }
            }}
          />
        ) : (
          <img src={item.mediaUrl} alt="" className="max-h-full max-w-full object-contain" />
        )}
      </div>

      {/*
        Single transparent gesture layer: tap the left/right third to scroll,
        swipe horizontally to move between stories, swipe down to close and
        press and hold to pause. Header and footer controls sit above it.
      */}
      <div
        className="absolute bottom-20 left-0 right-0 top-16 z-10"
        style={{ touchAction: 'none' }}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerCancel={() => {
          pointerStartRef.current = null
          setPaused(false)
        }}
      />

      {/* TOP GRADIENT */}
      <div className="pointer-events-none absolute left-0 right-0 top-0 z-20 h-36 bg-gradient-to-b from-black/85 to-transparent" />
      <div className="pointer-events-none absolute bottom-0 left-0 right-0 z-20 h-40 bg-gradient-to-t from-black/85 to-transparent" />

      {/* PROGRESS BARS — one segment per piece of media in the story */}
      <div className="absolute left-3 right-3 top-3 z-30 flex gap-1">
        {story.items.map((storyItem, index) => (
          <div key={storyItem.id} className="h-[2.5px] flex-1 overflow-hidden rounded-full bg-white/25">
            <div
              className="h-full rounded-full bg-white transition-[width] duration-100 ease-linear"
              style={{
                width:
                  index < itemIndex
                    ? '100%'
                    : index === itemIndex
                      ? `${Math.round(progress * 100)}%`
                      : '0%',
              }}
            />
          </div>
        ))}
      </div>

      {/* HEADER */}
      <div className="absolute left-4 right-4 top-8 z-30 flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <MaiPiksAvatar src={story.avatarUrl} purple />
          <div className="min-w-0">
            <p className="truncate text-xs font-black">
              {isOwn ? 'Your Story' : `@${story.username}`}
            </p>
            <div className="mt-0.5 flex items-center gap-1.5">
              <span className="text-[8px] font-black uppercase tracking-wider text-zinc-500">
                {itemIndex + 1}/{story.items.length}
              </span>
              <span className="text-zinc-700">•</span>
              <ExpiryCountdown expiresAt={item.expiresAt} compact />
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {/* Owners can delete any piece of their own story */}
          {isOwn && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              aria-label="Delete this story media"
              className="grid h-10 w-10 place-items-center rounded-full border border-red-500/30 bg-red-500/15 text-red-300 backdrop-blur-xl transition active:scale-90 disabled:opacity-50"
            >
              {deleting ? (
                <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-red-300 border-t-transparent" />
              ) : (
                <Trash2 size={16} />
              )}
            </button>
          )}

          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-black/50 backdrop-blur-xl transition active:scale-90"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* SIDE ARROWS */}
      {(storyIndex > 0 || itemIndex > 0) && (
        <div className="pointer-events-none absolute left-2 top-1/2 z-30 -translate-y-1/2">
          <ChevronLeft size={22} className="text-white/25" />
        </div>
      )}
      {(storyIndex < stories.length - 1 || itemIndex < story.items.length - 1) && (
        <div className="pointer-events-none absolute right-2 top-1/2 z-30 -translate-y-1/2">
          <ChevronRight size={22} className="text-white/25" />
        </div>
      )}

      {/* CAPTION */}
      {item.caption && (
        <div className="absolute bottom-[104px] left-4 right-4 z-30">
          <p className="rounded-2xl border border-white/10 bg-black/55 px-4 py-2.5 text-xs leading-relaxed text-zinc-100 backdrop-blur-xl">
            {item.caption}
          </p>
        </div>
      )}

      {/* BOTTOM BAR */}
      <div className="absolute bottom-6 left-4 right-4 z-30 flex items-center gap-2">
        <div className="flex items-center gap-2 rounded-full border border-[#00BFFF]/20 bg-black/65 px-3 py-2 backdrop-blur-xl">
          {currentUser && currentUser.screenshotsAllowed ? (
            <>
              <Sparkles size={12} className="text-[#BF00FF]" />
              <span className="text-[8px] font-black uppercase tracking-wider text-zinc-400">MAI Piks</span>
            </>
          ) : (
            <>
              <ShieldCheck size={12} className="text-[#00BFFF]" />
              <span className="text-[8px] font-black uppercase tracking-wider text-[#00BFFF]">Protected</span>
            </>
          )}
        </div>

        {(story.tipsReceived ?? 0) > 0 && (
          <div className="flex items-center gap-1.5 rounded-full border border-amber-500/25 bg-black/65 px-3 py-2 backdrop-blur-xl">
            <Coins size={12} className="text-amber-300" />
            <span className="text-[9px] font-black text-amber-200">
              {(story.tipsReceived ?? 0).toLocaleString()}
            </span>
          </div>
        )}

        {/* Tip the story owner in troll coins */}
        {canTip && (
          <button
            type="button"
            onClick={() => setShowTipModal(true)}
            className="ml-auto flex items-center gap-2 rounded-full border border-amber-400/40 bg-gradient-to-r from-amber-500/25 to-[#BF00FF]/25 px-4 py-2.5 text-[10px] font-black text-amber-100 shadow-[0_0_22px_rgba(251,191,36,0.2)] backdrop-blur-xl transition active:scale-95"
          >
            <Coins size={14} />
            Send Tip
          </button>
        )}
      </div>

      {/* TIP MODAL */}
      {showTipModal && (
        <StoryTipModal
          story={story}
          item={item}
          balance={currentUser?.trollCoins ?? 0}
          onClose={() => setShowTipModal(false)}
          onSubmit={async (amount) => {
            const ok = await onTip(story, item, amount)
            if (ok) setShowTipModal(false)
            return ok
          }}
        />
      )}
    </div>
  )
}

/* ========================================================================= */
/* STORY TIP MODAL                                                           */
/* ========================================================================= */

/**
 * Troll coin tip sheet. The 80/20 split shown here is enforced server side by
 * `tip_maipiks_story`, which also routes the platform 20% to the Fee Pool.
 */
function StoryTipModal({
  story,
  item,
  balance,
  onClose,
  onSubmit,
}: {
  story: PiksStory
  item: PiksStoryItem | null
  balance: number
  onClose: () => void
  onSubmit: (amount: number) => Promise<boolean>
}) {
  const [amount, setAmount] = useState<number>(TIP_PRESETS[0])
  const [custom, setCustom] = useState('')
  const [sending, setSending] = useState(false)

  const effectiveAmount = custom.trim() ? Math.floor(Number(custom)) : amount
  const valid = Number.isFinite(effectiveAmount) && effectiveAmount >= 1 && effectiveAmount <= balance

  const ownerCoins = valid ? Math.floor(effectiveAmount * (1 - TIP_PLATFORM_FEE_PERCENT / 100)) : 0
  const platformCoins = valid ? effectiveAmount - ownerCoins : 0

  const handleSend = async () => {
    if (!valid || sending) return
    setSending(true)
    await onSubmit(effectiveAmount)
    setSending(false)
  }

  return (
    <div className="absolute inset-0 z-[210] flex items-end bg-black/75 backdrop-blur-sm">
      <button type="button" aria-label="Close tip" onClick={onClose} className="absolute inset-0" />

      <div className="relative w-full rounded-t-3xl border-t border-amber-500/25 bg-[#08080f] px-5 pb-8 pt-5 shadow-[0_-10px_50px_rgba(0,0,0,0.6)]">
        <div className="mb-5 flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Coins size={15} className="text-amber-300" />
              <p className="text-[8px] font-black uppercase tracking-[0.22em] text-amber-300">Troll Coins</p>
            </div>
            <h3 className="mt-1.5 text-lg font-black">
              Tip {story.isOwn ? 'your story' : `@${story.username}`}
            </h3>
            <p className="mt-1 text-[10px] text-zinc-500">
              Balance: <span className="font-black text-amber-200">{balance.toLocaleString()}</span> coins
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="grid h-9 w-9 place-items-center rounded-xl border border-white/10 bg-white/[0.04]"
          >
            <X size={16} />
          </button>
        </div>

        {/* Presets */}
        <div className="mb-4 grid grid-cols-4 gap-2">
          {TIP_PRESETS.map((preset) => {
            const active = !custom.trim() && amount === preset
            return (
              <button
                key={preset}
                type="button"
                onClick={() => {
                  setAmount(preset)
                  setCustom('')
                }}
                disabled={preset > balance}
                className={`rounded-2xl border py-3 text-xs font-black transition active:scale-95 disabled:opacity-30 ${
                  active
                    ? 'border-amber-400/60 bg-amber-500/20 text-amber-100'
                    : 'border-white/10 bg-white/[0.035] text-zinc-400'
                }`}
              >
                {preset}
              </button>
            )
          })}
        </div>

        {/* Custom amount */}
        <div className="mb-4">
          <label className="mb-1.5 block text-[9px] font-black uppercase tracking-wider text-zinc-500">
            Custom amount
          </label>
          <input
            type="number"
            min={1}
            max={Math.max(balance, 1)}
            inputMode="numeric"
            value={custom}
            onChange={(event) => setCustom(event.target.value)}
            placeholder="Enter coins"
            className="w-full rounded-2xl border border-white/10 bg-white/[0.035] px-4 py-3 text-sm font-bold text-white outline-none placeholder:text-zinc-600 focus:border-amber-400/50"
          />
        </div>

        {/* Split preview */}
        <div className="mb-5 space-y-2 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-zinc-500">@{story.username} receives (80%)</span>
            <span className="font-black text-emerald-300">{ownerCoins.toLocaleString()} coins</span>
          </div>
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-zinc-500">Platform fee ({TIP_PLATFORM_FEE_PERCENT}%)</span>
            <span className="font-black text-zinc-400">{platformCoins.toLocaleString()} coins</span>
          </div>
          <div className="flex items-center justify-between border-t border-white/5 pt-2 text-xs">
            <span className="font-black text-zinc-300">You pay</span>
            <span className="font-black text-amber-200">
              {(valid ? effectiveAmount : 0).toLocaleString()} coins
            </span>
          </div>
        </div>

        {!valid && (custom.trim() || amount > balance) && (
          <p className="mb-3 text-center text-[10px] font-bold text-red-400">
            {effectiveAmount > balance ? 'Not enough troll coins' : 'Enter at least 1 coin'}
          </p>
        )}

        <button
          type="button"
          onClick={handleSend}
          disabled={!valid || sending}
          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-amber-400/40 bg-gradient-to-r from-amber-500/30 to-[#BF00FF]/30 py-4 text-sm font-black text-amber-50 transition active:scale-[0.98] disabled:opacity-40"
        >
          {sending ? (
            <>
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-amber-100 border-t-transparent" />
              Sending...
            </>
          ) : (
            <>
              <Coins size={16} />
              Send {valid ? effectiveAmount.toLocaleString() : ''} Coins
            </>
          )}
        </button>

        <p className="mt-3 text-center text-[9px] text-zinc-600">
          Tips are final. {item?.mediaType === 'video' ? 'Video' : 'Photo'} tips go straight to the creator's wallet.
        </p>
      </div>
    </div>
  )
}
