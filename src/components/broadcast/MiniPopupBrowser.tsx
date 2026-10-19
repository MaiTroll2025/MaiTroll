// Mai Troll Mini Popup Browser for Broadcasts
// Movable, minimizable browser overlay that lets viewers interact with a
// broadcaster's wishlist without leaving the broadcast.
// Works for all viewers, including users sitting in broadcast seats.
// Preserves the viewer's current broadcast session, seat assignment, audio,
// video, and chat state while the mini browser is open.

import React, { useEffect, useRef, useState, useCallback } from 'react'
import { X, Minus, Plus, ExternalLink, Move, GripVertical } from 'lucide-react'
import { cn } from '../../lib/utils'
import { copyToClipboard } from '../../lib/broadcastClipboard'

interface MiniPopupBrowserProps {
  isOpen: boolean
  onClose: () => void
  onMinimize?: () => void
  url: string
  title?: string
  width?: number
  height?: number
  className?: string
  /**
   * When true, the browser is rendered as a child of the broadcast container
   * and must not interrupt the underlying stream.
   */
  embedInBroadcast?: boolean
}

const DEFAULT_WIDTH = 420
const DEFAULT_HEIGHT = 560

export function MiniPopupBrowser({
  isOpen,
  onClose,
  onMinimize,
  url,
  title = 'Wishlist',
  width = DEFAULT_WIDTH,
  height = DEFAULT_HEIGHT,
  className = '',
}: MiniPopupBrowserProps) {
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [isMinimized, setIsMinimized] = useState(false)
  const [currentUrl, setCurrentUrl] = useState(url)
  const dragOffset = useRef({ x: 0, y: 0 })

  // Reset position when opened
  useEffect(() => {
    if (isOpen) {
      const x = Math.max(0, (window.innerWidth - width) / 2)
      const y = Math.max(0, (window.innerHeight - height) / 2)
      setPosition({ x, y })
      setIsMinimized(false)
      setCurrentUrl(url)
    }
  }, [isOpen, url, width, height])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsDragging(true)
    dragOffset.current = { x: e.clientX - position.x, y: e.clientY - position.y }
  }, [position])

  useEffect(() => {
    if (!isDragging) return
    const handleMouseMove = (e: MouseEvent) => {
      const newX = Math.max(0, Math.min(window.innerWidth - width, e.clientX - dragOffset.current.x))
      const newY = Math.max(0, Math.min(window.innerHeight - height, e.clientY - dragOffset.current.y))
      setPosition({ x: newX, y: newY })
    }
    const handleMouseUp = () => setIsDragging(false)
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging, width, height])

  const handleToggleMinimize = () => {
    const next = !isMinimized
    setIsMinimized(next)
    onMinimize?.()
  }

  const handleCopyLink = async () => {
    await copyToClipboard(currentUrl)
  }

  if (!isOpen) return null

  return (
    <div
      className={cn(
        'fixed z-[90] flex flex-col overflow-hidden',
        'bg-slate-950/98 backdrop-blur-xl border border-cyan-400/25 shadow-[0_0_40px_rgba(34,211,238,0.25)]',
        isDragging && 'opacity-95',
        className
      )}
      style={{
        left: position.x,
        top: position.y,
        width,
        height: isMinimized ? 40 : height,
        transform: 'translateZ(0)',
      }}
    >
      {/* Drag handle header */}
      <div
        className="flex items-center gap-2 cursor-move bg-gradient-to-r from-cyan-500/15 to-purple-500/10 px-3 py-2 border-b border-white/10"
        onMouseDown={handleMouseDown}
      >
        <GripVertical size={14} className="text-white/40" />
        <Move size={12} className="text-white/30" />
        <span className="flex-1 text-[11px] font-black uppercase tracking-wider text-cyan-200 truncate">
          {title}
        </span>
        <button
          type="button"
          onClick={handleToggleMinimize}
          className="p-1 rounded hover:bg-white/10 transition"
          title={isMinimized ? 'Expand' : 'Minimize'}
        >
          {isMinimized ? <Plus size={12} className="text-white/60" /> : <Minus size={12} className="text-white/60" />}
        </button>
        <button
          type="button"
          onClick={handleCopyLink}
          className="p-1 rounded hover:bg-white/10 transition"
          title="Copy link"
        >
          <ExternalLink size={12} className="text-white/60" />
        </button>
        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded hover:bg-red-500/20 transition"
          title="Close"
        >
          <X size={14} className="text-white/60 hover:text-red-300" />
        </button>
      </div>

      {/* Browser content - iframe with sandbox for security */}
      {!isMinimized && (
        <iframe
          src={currentUrl}
          title={title}
          className="flex-1 w-full border-0 bg-white"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-navigation"
          referrerPolicy="strict-origin-when-cross-origin"
        />
      )}
    </div>
  )
}

export default MiniPopupBrowser