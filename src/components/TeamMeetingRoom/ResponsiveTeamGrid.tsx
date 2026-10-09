import React from 'react';
import { motion } from 'framer-motion';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ResponsiveTeamGridProps {
  children: React.ReactNode;
  isMobileView?: boolean;
  maxVisibleOnMobile?: number;
}

/**
 * Responsive wrapper for Team Meeting Grid
 * - Desktop: 3x3 grid displayed fully
 * - Tablet: 2x2 or 2x3 grid
 * - Mobile: Stack vertically with scroll
 */
export const ResponsiveTeamGrid: React.FC<ResponsiveTeamGridProps> = ({
  children,
  isMobileView = false,
  maxVisibleOnMobile: _maxVisibleOnMobile = 4
}) => {
  // Media query hook would go here for real implementation
  const isSmallScreen = typeof window !== 'undefined' && window.innerWidth < 768;

  return (
    <div
      className={cn(
        'w-full h-full',
        isSmallScreen || isMobileView ? 'flex flex-col' : ''
      )}
    >
      {children}
    </div>
  );
};

/**
 * Mobile optimized participant display
 * Shows primary speaker full screen with others in an overlay
 */
export const MobileTeamMeetingView: React.FC<{
  primaryParticipant: any;
  secondaryParticipants: any[];
  onTogglePrimary?: () => void;
}> = ({
  primaryParticipant,
  secondaryParticipants,
  onTogglePrimary: _onTogglePrimary
}) => {
  const [showOverlay, setShowOverlay] = React.useState(true);

  return (
    <div className="w-full h-full flex flex-col bg-gray-950 relative">
      {/* Primary Speaker - Full Screen */}
      <div className="flex-1 bg-black rounded-lg overflow-hidden relative">
        {primaryParticipant && (
          <div className="w-full h-full">
            {/* Video would render here */}
            <div className="w-full h-full flex items-center justify-center text-white">
              {primaryParticipant.username}
            </div>

            {/* Tap to toggle overlay */}
            <motion.button
              onClick={() => setShowOverlay(!showOverlay)}
              className="absolute inset-0 cursor-pointer"
              title="Tap to show/hide participant list"
            />
          </div>
        )}
      </div>

      {/* Secondary Participants Overlay */}
      {showOverlay && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          className="absolute bottom-4 left-4 right-4 bg-gray-900/90 backdrop-blur-sm rounded-lg p-4 max-h-[30vh] overflow-y-auto"
        >
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-white font-semibold text-sm">
              {secondaryParticipants.length} other participant{secondaryParticipants.length !== 1 ? 's' : ''}
            </h3>
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowOverlay(false)}
              className="text-gray-400 hover:text-white"
            >
              <ChevronDown className="w-4 h-4" />
            </motion.button>
          </div>

          <div className="space-y-2">
            {secondaryParticipants.map(participant => (
              <div
                key={participant.uid}
                className="flex items-center gap-3 bg-gray-800 p-3 rounded text-sm hover:bg-gray-700 cursor-pointer transition-colors"
              >
                <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-semibold text-white">
                    {participant.username.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-medium truncate">{participant.username}</p>
                  <p className="text-gray-400 text-xs capitalize">{participant.role}</p>
                </div>
                {participant.isSpeaking && (
                  <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse flex-shrink-0" />
                )}
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Minimized Overlay Indicator */}
      {!showOverlay && (
        <motion.button
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          onClick={() => setShowOverlay(true)}
          className="absolute bottom-4 left-4 right-4 bg-gray-900/90 backdrop-blur-sm rounded-lg p-3 flex items-center justify-between text-white text-sm hover:bg-gray-800 transition-colors"
        >
          <span>{secondaryParticipants.length} participant{secondaryParticipants.length !== 1 ? 's' : ''} waiting</span>
          <ChevronUp className="w-4 h-4" />
        </motion.button>
      )}
    </div>
  );
};

export default ResponsiveTeamGrid;
