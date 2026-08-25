import React, { useRef, useState, useCallback } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useIsMobile } from '@/hooks/useIsMobile'

interface HorizontalScrollRowProps {
  title: string
  subtitle?: string
  icon?: React.ReactNode
  children: React.ReactNode
  onViewAll?: () => void
  className?: string
  right?: React.ReactNode
  theme?: string
}

export default function HorizontalScrollRow({
  title,
  subtitle,
  icon,
  children,
  onViewAll,
  right,
  className = '',
  theme = 'dark',
}: HorizontalScrollRowProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const { isMobileWidth } = useIsMobile()
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(true)

  const checkScroll = useCallback(() => {
    if (!scrollRef.current) return
    const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current
    setCanScrollLeft(scrollLeft > 5)
    setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 5)
  }, [])

  const scroll = (dir: 'left' | 'right') => {
    if (!scrollRef.current) return
    const amount = dir === 'left' ? -320 : 320
    scrollRef.current.scrollBy({ left: amount, behavior: 'smooth' })
    setTimeout(checkScroll, 400)
  }

  return (
    <section className={`relative group/row ${className}`}>
      {/* Header */}
      <div className="mb-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {icon && <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/[0.06]">{icon}</div>}
          <div>
             <h3 className={`text-sm font-black ${theme === 'light' ? 'text-gray-900' : 'text-white'}`}>{title}</h3>
             {subtitle && <p className={`text-[10px] font-bold ${theme === 'light' ? 'text-gray-500' : 'text-white/30'}`}>{subtitle}</p>}
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {right}
          {onViewAll && (
            <button
              onClick={onViewAll}
              className="flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-bold text-cyan-400/70 transition hover:text-cyan-300"
            >
              View All
              <ChevronRight className="h-3 w-3" />
            </button>
          )}
          {/* Scroll arrows */}
          <button
            onClick={() => scroll('left')}
            className={`flex h-6 w-6 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-white/50 transition hover:bg-white/[0.08] hover:text-white ${
              !canScrollLeft ? 'opacity-30 pointer-events-none' : 'opacity-100'
            }`}
          >
            <ChevronLeft className="h-3 w-3" />
          </button>
          <button
            onClick={() => scroll('right')}
            className={`flex h-6 w-6 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-white/50 transition hover:bg-white/[0.08] hover:text-white ${
              !canScrollRight ? 'opacity-30 pointer-events-none' : 'opacity-100'
            }`}
          >
            <ChevronRight className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* Scrollable content */}
      <div
        ref={scrollRef}
        onScroll={checkScroll}
        className={`flex gap-3 pb-1 select-none ${isMobileWidth ? 'w-full flex-wrap overflow-x-visible' : 'overflow-x-auto'}`}
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', WebkitOverflowScrolling: 'touch' }}
      >
        {children}
      </div>
    </section>
  )
}
