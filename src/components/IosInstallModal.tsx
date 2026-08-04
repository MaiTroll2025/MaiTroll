import React from 'react';
import { X, Share, Plus, Monitor } from 'lucide-react';
import { dismissIosInstructions, isIos } from '../pwa/install';

interface IosInstallModalProps {
  isOpen: boolean;
  onClose: () => void;
  enableDontShowAgain?: boolean;
}

export default function IosInstallModal({ 
  isOpen, 
  onClose,
  enableDontShowAgain = true 
}: IosInstallModalProps) {
  const [dontShowAgain, setDontShowAgain] = React.useState(false);
  const isIosDevice = isIos();

  const handleClose = () => {
    if (dontShowAgain && enableDontShowAgain) {
      dismissIosInstructions(7); // Don't show for 7 days
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-end justify-center pointer-events-none animate-fade-in">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm pointer-events-auto transition-opacity" 
        onClick={handleClose}
        aria-label="Close modal"
      />
      
      {/* Bottom Sheet */}
      <div className="relative w-full max-w-md pointer-events-auto animate-slide-up-smooth safe-bottom">
        <div className="bg-gradient-to-b from-slate-900 to-slate-950 border-t border-purple-500/20 rounded-t-3xl shadow-2xl shadow-purple-900/50">
          {/* Header */}
          <div className="flex items-center justify-between p-6 pb-4">
            <h3 className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-cyan-400 bg-clip-text text-transparent">
              Install Mai Troll
            </h3>
            <button
              onClick={handleClose}
              className="p-2 bg-white/5 hover:bg-white/10 rounded-full text-white/70 hover:text-white transition-all"
              aria-label="Close"
            >
              <X size={20} />
            </button>
          </div>

          {/* Content */}
          <div className="px-6 pb-6">
            <p className="text-slate-400 mb-6 text-sm">
              {isIosDevice 
                ? 'Install our app for the best experience. Get instant access from your home screen!'
                : 'Install Mai Troll for the best experience. Use your browser\'s install menu.'
              }
            </p>

            {/* Desktop Instructions */}
            {!isIosDevice && (
              <div className="mb-4 p-3 bg-slate-800/50 rounded-xl border border-cyan-500/20">
                <p className="text-cyan-300 text-xs font-medium mb-1">Desktop Instructions:</p>
                <p className="text-slate-400 text-xs">
                  Click the <Monitor size={12} className="inline mr-1" /> menu icon in Chrome/Edge, then look for the <span className="text-white font-bold">⊡</span> or <span className="text-white font-bold">Install</span> button.
                </p>
              </div>
            )}

            {/* Steps for mobile */}
            {isIosDevice && (
              <div className="flex flex-col gap-4 mb-6">
                {/* Step 1 */}
                <div className="flex items-start gap-4 p-3 bg-slate-800/50 rounded-xl border border-purple-500/10">
                  <div className="flex-shrink-0 p-3 bg-gradient-to-br from-blue-500/20 to-cyan-500/20 rounded-lg border border-blue-400/20">
                    <Share size={24} className="text-blue-400" />
                  </div>
                  <div className="flex-1 pt-1">
                    <p className="text-white font-medium mb-1">
                      1. Tap the Share button
                    </p>
                    <p className="text-slate-400 text-xs">
                      Look for <Share size={12} className="inline" /> in your Safari toolbar
                    </p>
                  </div>
                </div>

                {/* Step 2 */}
                <div className="flex items-start gap-4 p-3 bg-slate-800/50 rounded-xl border border-purple-500/10">
                  <div className="flex-shrink-0 p-3 bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-lg border border-purple-400/20">
                    <Plus size={24} className="text-purple-400" />
                  </div>
                  <div className="flex-1 pt-1">
                    <p className="text-white font-medium mb-1">
                      2. Select &quot;Add to Home Screen&quot;
                    </p>
                    <p className="text-slate-400 text-xs">
                      Scroll down if you don&apos;t see it immediately
                    </p>
                  </div>
                </div>

                {/* Step 3 */}
                <div className="flex items-start gap-4 p-3 bg-slate-800/50 rounded-xl border border-purple-500/10">
                  <div className="flex-shrink-0 p-3 bg-gradient-to-br from-cyan-500/20 to-teal-500/20 rounded-lg border border-cyan-400/20">
                    <div className="text-2xl">✓</div>
                  </div>
                  <div className="flex-1 pt-1">
                    <p className="text-white font-medium mb-1">
                      3. Tap &quot;Add&quot;
                    </p>
                    <p className="text-slate-400 text-xs">
                      The app will appear on your home screen
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Don't Show Again Option */}
            {enableDontShowAgain && (
              <label className="flex items-center gap-3 mb-4 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={dontShowAgain}
                  onChange={(e) => setDontShowAgain(e.target.checked)}
                  className="w-5 h-5 rounded border-2 border-purple-500/30 bg-slate-800 checked:bg-purple-600 checked:border-purple-600 cursor-pointer transition-all"
                />
                <span className="text-sm text-slate-400 group-hover:text-slate-300 transition-colors">
                  Don&apos;t show this again for 7 days
                </span>
              </label>
            )}

            {/* Got It Button */}
            <button
              onClick={handleClose}
              className="w-full py-4 bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-500 hover:to-cyan-500 text-white font-semibold rounded-xl shadow-lg shadow-purple-500/30 hover:shadow-cyan-500/30 transition-all active:scale-[0.98]"
            >
              Got it!
            </button>
          </div>

          {/* Visual indicator arrow pointing to Safari toolbar */}
          {isIosDevice && (
            <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 text-cyan-400/50 animate-bounce pointer-events-none">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8z" transform="rotate(90 12 12)" />
              </svg>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        
        @keyframes slide-up-smooth {
          from { 
            opacity: 0;
            transform: translateY(100%); 
          }
          to { 
            opacity: 1;
            transform: translateY(0); 
          }
        }
        
        .animate-fade-in {
          animation: fade-in 0.2s ease-out;
        }
        
        .animate-slide-up-smooth {
          animation: slide-up-smooth 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }
      `}</style>
    </div>
  );
}