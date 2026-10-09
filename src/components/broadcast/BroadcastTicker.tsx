import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useTickerStore } from '../../stores/tickerStore';
import { cn } from '../../lib/utils';
import {
  TickerMessage,
  TickerTheme,
  CATEGORY_COLORS,
  SPEED_MAP,
} from '../../types/ticker';
import PriorityTickerMessage from './PriorityTickerMessage';
import { GripVertical, X, Minimize2, Edit3 } from 'lucide-react';

interface BroadcastTickerProps {
  className?: string;
}

const THEME_STYLES: Record<
  TickerTheme,
  { bg: string; border: string; text: string; glow?: string }
> = {
  neon: {
    bg: 'bg-transparent',
    border: 'border-cyan-500/30',
    text: 'text-cyan-100',
    glow: 'shadow-[0_0_10px_rgba(0,255,255,0.15)]',
  },
  minimal: {
    bg: 'bg-transparent',
    border: 'border-white/10',
    text: 'text-white/80',
  },
  luxury: {
    bg: 'bg-transparent',
    border: 'border-amber-500/20',
    text: 'text-amber-100',
    glow: 'shadow-[0_0_12px_rgba(245,158,11,0.15)]',
  },
  glitch: {
    bg: 'bg-transparent',
    border: 'border-purple-500/30',
    text: 'text-purple-100',
    glow: 'shadow-[0_0_8px_rgba(168,85,247,0.2)]',
  },
};

export default function BroadcastTicker({ className: _className }: BroadcastTickerProps) {
  const { messages, settings, priorityMessage, isPaused, screenshareActive } = useTickerStore();
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [isDragging, setIsDragging] = useState(false);
  const [_dragOffset, _setDragOffset] = useState({ x: 0, y: 0 });
  const [position, setPosition] = useState({ x: 0, y: 80 });
  const [height, setHeight] = useState(32);
  const [isResizing, setIsResizing] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [tempHeight, setTempHeight] = useState(32);
  const dragStartPos = useRef({ x: 0, y: 0 });
  const resizeStartHeight = useRef(32);

  // Throttle messages during screenshare to reduce re-renders
  const throttledMessages = useMemo(() => {
    if (screenshareActive) {
      // During screenshare: cap at 5 messages, no duplication
      return messages.slice(0, 5);
    }
    return messages;
  }, [messages, screenshareActive]);

  const themeStyle = THEME_STYLES[settings.theme] || THEME_STYLES.neon;
  const _speedPxPerSec = SPEED_MAP[settings.speed] || SPEED_MAP.medium;

  // During screenshare: no animation duplication, just show messages statically
  const scrollingMessages = useMemo(() => {
    if (throttledMessages.length === 0) return [];
    if (screenshareActive) {
      // No duplication — just single pass, no animation
      return throttledMessages;
    }
    return [...throttledMessages, ...throttledMessages];
  }, [throttledMessages, screenshareActive]);

  const scrollDuration = useMemo(() => {
    if (throttledMessages.length === 0) return 30;
    return SPEED_MAP[settings.speed] || SPEED_MAP.medium;
  }, [throttledMessages.length, settings.speed]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (isEditing) return;
    e.preventDefault();
    setIsDragging(true);
    dragStartPos.current = { x: e.clientX - position.x, y: e.clientY - position.y };
  }, [position, isEditing]);

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    resizeStartHeight.current = height;
  }, [height]);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      setPosition({
        x: Math.max(0, e.clientX - dragStartPos.current.x),
        y: Math.max(0, e.clientY - dragStartPos.current.y),
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaY = e.clientY - dragStartPos.current.y;
      const newHeight = Math.max(24, Math.min(80, resizeStartHeight.current + deltaY));
      setHeight(newHeight);
      setTempHeight(newHeight);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  const handleEditConfirm = () => {
    setHeight(tempHeight);
    setIsEditing(false);
  };

  const fontSize = Math.max(10, Math.min(16, height - 8));

  return (
    <>
      {/* Drag handle and controls */}
      <div
        className={cn(
          'fixed z-[70] flex items-center gap-2 cursor-move',
          isDragging && 'opacity-80'
        )}
        style={{
          left: position.x,
          top: position.y,
        }}
        onMouseDown={handleMouseDown}
      >
        {/* Ticker content */}
        <div
          ref={containerRef}
          className={cn(
            'relative backdrop-blur-md border-b pointer-events-auto',
            themeStyle.bg,
            themeStyle.border,
            themeStyle.glow,
            settings.position === 'floating' && 'rounded-xl border shadow-xl',
            settings.position === 'bottom' && 'border-b-0 border-t',
            settings.theme === 'glitch' && 'animate-ticker-glitch'
          )}
          style={{
            transform: 'translateZ(0)',
            willChange: 'transform',
            height: `${height}px`,
            minWidth: '200px',
            maxWidth: '500px',
          }}
        >
          {/* Drag handle */}
          <div className="absolute left-1 top-1/2 -translate-y-1/2 cursor-grab active:cursor-grabbing z-10">
            <GripVertical size={12} className="text-white/30 hover:text-white/60" />
          </div>

          {/* Resize handle at bottom */}
          <div
            className="absolute bottom-0 left-0 right-0 h-2 cursor-s-resize opacity-0 hover:opacity-100 transition-opacity"
            onMouseDown={handleResizeStart}
          >
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2">
              <Minimize2 size={10} className="text-white/40" />
            </div>
          </div>

          {/* Height edit button */}
          <button
            onClick={() => {
              setTempHeight(height);
              setIsEditing(true);
            }}
            className="absolute right-1 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity z-10"
          >
            <Edit3 size={10} className="text-white/50 hover:text-white" />
          </button>

          {/* Gradient masks */}
          <div className="absolute left-6 top-0 bottom-0 w-8 bg-gradient-to-r from-black/80 to-transparent z-10 pointer-events-none" />
          <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-black/80 to-transparent z-10 pointer-events-none" />

          {/* Scrolling ticker content */}
          {throttledMessages.length > 0 && !priorityMessage && (
            <div
              className={cn(
                'ticker-scroll-container flex items-center h-full whitespace-nowrap pl-6 pr-8',
                (isPaused || screenshareActive) && 'ticker-paused'
              )}
              style={{
                animation: (isPaused || screenshareActive)
                  ? 'none'
                  : `ticker-scroll ${scrollDuration}s linear infinite`,
              }}
            >
              {scrollingMessages.map((msg, idx) => (
                <TickerItem
                  key={`${msg.id}-${idx}`}
                  message={msg}
                  theme={settings.theme}
                  fontSize={fontSize}
                />
              ))}
            </div>
          )}

          {/* Empty state */}
          {throttledMessages.length === 0 && !priorityMessage && (
            <div className="flex items-center justify-center h-full text-white/30 text-xs pl-6 pr-8">
              Ticker messages will appear here
            </div>
          )}
        </div>

        {/* Close button */}
        {messages.length > 0 && (
          <button
            onClick={() => {
              // Could add functionality to hide ticker
            }}
            className="w-6 h-6 rounded-full bg-black/60 flex items-center justify-center text-white/60 hover:text-white transition-colors"
          >
            <X size={12} />
          </button>
        )}
      </div>

      {/* Height edit popup */}
      {isEditing && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60" onClick={() => setIsEditing(false)}>
          <div className="bg-zinc-900 border border-white/10 rounded-xl p-4 w-64" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-bold text-white mb-3">Adjust Ticker Size</h3>
            <input
              type="range"
              min="24"
              max="80"
              value={tempHeight}
              onChange={(e) => setTempHeight(Number(e.target.value))}
              className="w-full mb-2"
            />
            <div className="flex justify-between text-xs text-white/50 mb-4">
              <span>Small</span>
              <span>Height: {tempHeight}px</span>
              <span>Large</span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setIsEditing(false)}
                className="flex-1 py-2 bg-zinc-700 text-white text-sm rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleEditConfirm}
                className="flex-1 py-2 bg-pink-600 text-white text-sm rounded-lg"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Priority message overlay */}
      <AnimatePresence>
        {priorityMessage && (
          <PriorityTickerMessage
            message={priorityMessage}
            theme={settings.theme}
            onComplete={() => {}}
          />
        )}
      </AnimatePresence>
    </>
  );
}

function TickerItem({
  message,
  theme,
  fontSize,
}: {
  message: TickerMessage;
  theme: TickerTheme;
  fontSize: number;
}) {
  const categoryColor = CATEGORY_COLORS[message.category] || '#00d4ff';

  return (
    <div className="flex items-center gap-3 px-4 shrink-0">
      <div
        className="w-1.5 h-1.5 rounded-full shrink-0"
        style={{
          backgroundColor: categoryColor,
          boxShadow: `0 0 6px ${categoryColor}`,
        }}
      />

      {message.tags.length > 0 && (
        <span className="text-xs shrink-0" style={{ fontSize: fontSize - 4 }}>
          {message.tags.join(' ')}
        </span>
      )}

      <span
        className={cn(
          'font-semibold tracking-wide',
          theme === 'neon' && 'text-cyan-200',
          theme === 'minimal' && 'text-white/80',
          theme === 'luxury' && 'text-amber-200',
          theme === 'glitch' && 'text-purple-200'
        )}
        style={{ fontSize }}
      >
        {message.content}
      </span>

      <span className="text-white/20 text-[10px] shrink-0 mx-2">●</span>
    </div>
  );
}
