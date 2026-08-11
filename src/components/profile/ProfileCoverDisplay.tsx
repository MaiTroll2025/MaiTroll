import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '../../lib/utils';

interface ProfileCoverDisplayProps {
  coverPhotoUrl?: string | null;
  positionX?: number;
  positionY?: number;
  zoom?: number;
  className?: string;
  showPlaceholder?: boolean;
}

export default function ProfileCoverDisplay({
  coverPhotoUrl,
  positionX = 50,
  positionY = 50,
  zoom = 1,
  className,
  showPlaceholder = true
}: ProfileCoverDisplayProps) {
  const [expanded, setExpanded] = useState(false);
  const placeholderGradient = "bg-gradient-to-r from-purple-900 via-pink-900 to-purple-900";

  if (!coverPhotoUrl && !showPlaceholder) {
    return null;
  }

  return (
    <>
      <div
        className={cn(
          "relative w-full overflow-hidden",
          "h-[200px] md:h-[250px] lg:h-[300px]",
          !coverPhotoUrl && placeholderGradient,
          coverPhotoUrl && "cursor-pointer",
          className
        )}
        onClick={() => coverPhotoUrl && setExpanded(true)}
      >
        {coverPhotoUrl ? (
          <>
            {/* Cover Photo Image */}
            <img
              src={coverPhotoUrl}
              alt="Cover Photo"
              className="absolute inset-0 w-full h-full"
              style={{
                objectFit: 'cover',
                objectPosition: 'center center'
              }}
              onLoad={() => console.log('[Cover Photo Debug] Image loaded successfully:', coverPhotoUrl)}
              onError={(e) => console.error('[Cover Photo Debug] Image failed to load:', coverPhotoUrl, e)}
            />

            {/* Gradient Overlay for better text readability */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent pointer-events-none" />
          </>
        ) : (
          /* Placeholder when no cover photo */
          <div className={cn(
            "absolute inset-0",
            placeholderGradient
          )}>
            {/* Decorative pattern */}
            <div className="absolute inset-0 opacity-20">
              <div className="absolute top-0 left-0 w-32 h-32 bg-purple-500 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
              <div className="absolute bottom-0 right-0 w-40 h-40 bg-pink-500 rounded-full blur-3xl translate-x-1/2 translate-y-1/2" />
            </div>
          </div>
        )}
      </div>

      {expanded && coverPhotoUrl && createPortal(
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/90 p-4"
          onClick={() => setExpanded(false)}
        >
          <div
            className="relative max-w-[95vw] max-h-[95vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="absolute top-2 right-2 z-20 rounded-full bg-slate-800/90 p-2 text-white hover:bg-slate-700 transition-colors"
              onClick={() => setExpanded(false)}
              aria-label="Close cover preview"
            >
              ✕
            </button>
            <img
              src={coverPhotoUrl}
              alt="Cover expanded"
              className="max-h-[90vh] w-auto object-contain"
            />
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
