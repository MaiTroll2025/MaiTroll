// Streamer AR Settings Panel
// Allows streamers to control which AR gift categories they accept

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Settings, X, Eye, EyeOff, Glasses, Crown, Shirt, Sparkles, Shield, ChevronDown } from 'lucide-react';
import { useARGiftStore } from '../../stores/arGiftStore';
import { cn } from '../../lib/utils';

interface StreamerARSettingsProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function StreamerARSettings({
  isOpen,
  onClose,
}: StreamerARSettingsProps) {
  const { settings, updateSettings } = useARGiftStore();
  const [expanded, setExpanded] = useState(true);

  const toggleSettings = [
    {
      key: 'faceGiftsEnabled' as const,
      label: 'Face Gifts',
      description: 'Crowns, sunglasses, masks, halos, clown nose',
      icon: <Crown size={18} />,
      color: 'text-yellow-400',
      bgColor: 'bg-yellow-500/10',
      borderColor: 'border-yellow-500/30',
    },
    {
      key: 'bodyGiftsEnabled' as const,
      label: 'Body Gifts',
      description: 'Capes, suits, robes, angel wings',
      icon: <Shirt size={18} />,
      color: 'text-blue-400',
      bgColor: 'bg-blue-500/10',
      borderColor: 'border-blue-500/30',
    },
    {
      key: 'shoulderGiftsEnabled' as const,
      label: 'Shoulder Pets',
      description: 'Falcons, dragons, tiger cubs',
      icon: <Sparkles size={18} />,
      color: 'text-green-400',
      bgColor: 'bg-green-500/10',
      borderColor: 'border-green-500/30',
    },
    {
      key: 'legendaryGiftsEnabled' as const,
      label: 'Legendary Gifts',
      description: 'Presidential, Mai Troll, and Legendary AR gifts',
      icon: <Shield size={18} />,
      color: 'text-fuchsia-400',
      bgColor: 'bg-fuchsia-500/10',
      borderColor: 'border-fuchsia-500/30',
    },
  ];

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[130] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          className="bg-zinc-900 border border-white/10 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-white/10 bg-gradient-to-r from-fuchsia-950/50 via-purple-950/50 to-indigo-950/50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-fuchsia-500/20 border border-fuchsia-500/30 flex items-center justify-center">
                <Glasses className="text-fuchsia-300" size={20} />
              </div>
              <div>
                <h2 className="text-white font-bold">AR Gift Settings</h2>
                <p className="text-xs text-zinc-400">Control which AR gifts you receive</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/10 rounded-full transition-colors"
            >
              <X size={20} className="text-zinc-400" />
            </button>
          </div>

          {/* Settings List */}
          <div className="p-4 space-y-3">
            {toggleSettings.map((item) => (
              <div
                key={item.key}
                className={cn(
                  'rounded-xl border p-3 transition-all',
                  settings[item.key]
                    ? `${item.bgColor} ${item.borderColor}`
                    : 'bg-zinc-800/50 border-white/5'
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      'w-9 h-9 rounded-lg flex items-center justify-center',
                      settings[item.key] ? item.bgColor : 'bg-zinc-700'
                    )}>
                      <span className={settings[item.key] ? item.color : 'text-zinc-500'}>
                        {item.icon}
                      </span>
                    </div>
                    <div>
                      <div className={cn(
                        'font-semibold text-sm',
                        settings[item.key] ? 'text-white' : 'text-zinc-400'
                      )}>
                        {item.label}
                      </div>
                      <div className="text-xs text-zinc-500">
                        {item.description}
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => updateSettings({ [item.key]: !settings[item.key] })}
                    className={cn(
                      'relative w-12 h-6 rounded-full transition-colors',
                      settings[item.key] ? 'bg-fuchsia-500' : 'bg-zinc-700'
                    )}
                  >
                    <div
                      className={cn(
                        'absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform',
                        settings[item.key] ? 'translate-x-6' : 'translate-x-0.5'
                      )}
                    />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Quality Settings */}
          <div className="px-4 pb-4">
            <button
              onClick={() => setExpanded(!expanded)}
              className="w-full flex items-center justify-between p-3 rounded-xl bg-zinc-800/50 border border-white/5 hover:bg-zinc-800 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Settings size={16} className="text-zinc-400" />
                <span className="text-sm text-zinc-300">Performance Settings</span>
              </div>
              <ChevronDown
                size={16}
                className={cn(
                  'text-zinc-400 transition-transform',
                  expanded && 'rotate-180'
                )}
              />
            </button>

            <AnimatePresence>
              {expanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="pt-3 space-y-3">
                    <div>
                      <label className="text-xs text-zinc-400 mb-1 block">Detection Quality</label>
                      <select
                        value={settings.quality}
                        onChange={(e) =>
                          updateSettings({ quality: e.target.value as any })
                        }
                        className="w-full bg-zinc-800 border border-white/10 rounded-lg px-3 py-2 text-white text-sm"
                      >
                        <option value="low">Low (faster, less accurate)</option>
                        <option value="medium">Medium (balanced)</option>
                        <option value="high">High (slower, more accurate)</option>
                        <option value="ultra">Ultra (best quality)</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-xs text-zinc-400 mb-1 block">
                        Motion Smoothing: {settings.smoothing.toFixed(2)}
                      </label>
                      <input
                        type="range"
                        min="0"
                        max="0.95"
                        step="0.05"
                        value={settings.smoothing}
                        onChange={(e) =>
                          updateSettings({ smoothing: parseFloat(e.target.value) })
                        }
                        className="w-full accent-fuchsia-500"
                      />
                      <div className="flex justify-between text-[10px] text-zinc-500">
                        <span>Responsive</span>
                        <span>Smooth</span>
                      </div>
                    </div>

                    <div>
                      <label className="text-xs text-zinc-400 mb-1 block">
                        Max Active Gifts: {settings.maxActiveGifts}
                      </label>
                      <input
                        type="range"
                        min="5"
                        max="50"
                        step="5"
                        value={settings.maxActiveGifts}
                        onChange={(e) =>
                          updateSettings({
                            maxActiveGifts: parseInt(e.target.value),
                          })
                        }
                        className="w-full accent-fuchsia-500"
                      />
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-white/10 bg-zinc-900/50">
            <p className="text-[10px] text-zinc-500 text-center">
              AR gifts use face & body tracking to attach 3D effects to your stream.
              <br />
              Each gift lasts 15 seconds per send. Multiple gifts can stack.
            </p>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// Compact AR settings button for broadcast controls
export function ARSettingsButton({
  onClick,
  activeGiftCount = 0,
}: {
  onClick: () => void;
  activeGiftCount?: number;
}) {
  return (
    <button
      onClick={onClick}
      className="relative flex items-center gap-1.5 px-3 py-2 rounded-xl bg-fuchsia-500/10 border border-fuchsia-500/20 hover:bg-fuchsia-500/20 transition-colors"
    >
      <Glasses size={16} className="text-fuchsia-300" />
      <span className="text-xs font-medium text-fuchsia-300">AR</span>
      {activeGiftCount > 0 && (
        <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-fuchsia-500 text-white text-[9px] font-bold flex items-center justify-center">
          {activeGiftCount > 9 ? '9+' : activeGiftCount}
        </span>
      )}
    </button>
  );
}
