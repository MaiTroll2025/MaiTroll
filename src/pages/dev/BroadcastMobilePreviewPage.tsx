import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Smartphone } from 'lucide-react';
import { Stream } from '../../types/broadcast';

// Mock data for preview
const mockStream: Stream = {
  id: 'preview-stream',
  user_id: 'preview-user',
  title: 'Mobile Layout Preview',
  description: 'Testing mobile broadcast layouts',
  status: 'live',
  broadcast_mode: 'normal',
  is_battle: false,
  box_count: 6,
  total_likes: 1234,
  viewer_count: 567,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  category: 'Gaming',
  stream_type: 'regular',
  seat_count: 6,
  agora_channel: 'test-channel',
  room_name: 'test-room',
  current_viewers: 567,
  layout_mode: 'grid',
  started_at: new Date().toISOString(),
  ended_at: null,
  seat_price: 100,
  are_seats_locked: false,
  has_rgb_effect: false,
};

const mockBroadcasterProfile = {
  username: 'TestBroadcaster',
  display_name: 'Test Broadcaster',
  avatar_url: 'https://ui-avatars.com/api/?name=TestBroadcaster&background=random',
  troll_coins: 50000,
  trollmonds: 100,
  battle_crowns: 25,
};

const mockSeats = {
  0: { user_id: 'broadcaster', user_profile: mockBroadcasterProfile, seat_price: 100 },
  1: { user_id: 'user1', user_profile: { username: 'User1', avatar_url: null }, seat_price: 50 },
  2: { user_id: 'user2', user_profile: { username: 'User2', avatar_url: null }, seat_price: 25 },
  // Empty seats for 3,4,5
};

const layoutVersions = {
  1: {
    name: 'Compact Top-Profile Grid',
    description: 'Profile banner at grid top, orbs on broadcaster, compact chat',
    gridLayout: '2x3',
    gridClasses: 'grid-cols-2 grid-rows-3',
    profilePosition: 'top-banner',
    orbPosition: 'broadcaster',
    chatAvatarSize: 4,
  },
  2: {
    name: 'Overlay Profile Focus',
    description: 'Floating profile overlay, orbs bubble, streamlined chat',
    gridLayout: '2x3',
    gridClasses: 'grid-cols-2 grid-rows-3',
    profilePosition: 'overlay',
    orbPosition: 'broadcaster',
    chatAvatarSize: 4,
  },
  3: {
    name: 'Vertical Stack Efficiency',
    description: 'Vertical layout, profile top, orbs integrated, tiny chat avatars',
    gridLayout: '1x6',
    gridClasses: 'grid-cols-1 grid-rows-6',
    profilePosition: 'top-banner',
    orbPosition: 'broadcaster',
    chatAvatarSize: 3,
  },
  4: {
    name: 'Immersive Grid-First',
    description: 'Grid dominates, profile below broadcaster, minimal chat',
    gridLayout: '2x3',
    gridClasses: 'grid-cols-2 grid-rows-3',
    profilePosition: 'below-broadcaster',
    orbPosition: 'broadcaster',
    chatAvatarSize: 5,
  },
  5: {
    name: 'Sleek Horizontal Balance',
    description: 'Balanced layout, profile top-left, orbs on broadcaster',
    gridLayout: '2x3',
    gridClasses: 'grid-cols-2 grid-rows-3',
    profilePosition: 'top-banner',
    orbPosition: 'broadcaster',
    chatAvatarSize: 4,
  },
  6: {
    name: 'TikTok-Inspired Full Immersion',
    description: 'TikTok-style top banner, orbs on broadcaster, micro chat avatars',
    gridLayout: '1x6',
    gridClasses: 'grid-cols-1 grid-rows-6',
    profilePosition: 'top-banner',
    orbPosition: 'broadcaster',
    chatAvatarSize: 3,
  },
  7: {
    name: 'Orb-Centric Broadcaster',
    description: 'Prominent orbs on broadcaster, profile overlay, clean chat',
    gridLayout: '2x3',
    gridClasses: 'grid-cols-2 grid-rows-3',
    profilePosition: 'overlay',
    orbPosition: 'broadcaster-large',
    chatAvatarSize: 4,
  },
  8: {
    name: 'Chat-Optimized Layout',
    description: 'Chat prioritized, profile grid-top, orbs consolidated',
    gridLayout: '2x3',
    gridClasses: 'grid-cols-2 grid-rows-3',
    profilePosition: 'top-banner',
    orbPosition: 'broadcaster',
    chatAvatarSize: 4,
  },
  9: {
    name: 'Banner-Heavy Profile',
    description: 'Massive profile banner, orbs integrated, condensed chat',
    gridLayout: '1x6',
    gridClasses: 'grid-cols-1 grid-rows-6',
    profilePosition: 'top-banner-large',
    orbPosition: 'broadcaster',
    chatAvatarSize: 4,
  },
  10: {
    name: 'Ultimate Clean Mobile',
    description: 'Ultra-clean 6-box grid, subtle profile, pixel-perfect chat',
    gridLayout: '3x2',
    gridClasses: 'grid-cols-3 grid-rows-2',
    profilePosition: 'top-banner-small',
    orbPosition: 'broadcaster',
    chatAvatarSize: 3,
  },
};

const BroadcastMobilePreviewPage: React.FC = () => {
  const navigate = useNavigate();
  const [selectedVersion, setSelectedVersion] = useState<number>(6);

  const currentLayout = layoutVersions[selectedVersion as keyof typeof layoutVersions];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white">
      <div className="max-w-4xl mx-auto p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-gray-400 hover:text-white"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Smartphone className="w-5 h-5" />
            DEV: Broadcast Mobile Layout Preview
          </h1>
          <div className="w-16" />
        </div>

        {/* Version Selector */}
        <div className="bg-blue-900/30 border border-blue-500/30 rounded-lg p-4 mb-6">
          <h2 className="text-lg font-bold text-blue-400 mb-3">Select Layout Version</h2>
          <div className="grid grid-cols-5 gap-2">
            {Object.entries(layoutVersions).map(([version, config]) => (
              <button
                key={version}
                onClick={() => setSelectedVersion(Number(version))}
                className={`p-2 rounded text-sm font-bold transition-colors ${
                  selectedVersion === Number(version)
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                }`}
              >
                V{version}
              </button>
            ))}
          </div>
          <div className="mt-3 p-3 bg-gray-800/50 rounded">
            <h3 className="font-bold text-white">{currentLayout.name}</h3>
            <p className="text-sm text-gray-300">{currentLayout.description}</p>
          </div>
        </div>

        {/* Mobile Preview Mockup */}
        <div className="bg-gray-900 rounded-lg border border-gray-700 overflow-hidden">
          <div className="p-2 bg-gray-800 border-b border-gray-700">
            <div className="text-xs text-gray-400 text-center">Mobile Preview (375px width)</div>
          </div>

          <div className="p-4">
            {/* Mock Mobile Layout */}
            <div className="max-w-sm mx-auto bg-black rounded-lg overflow-hidden border border-gray-600 relative">
              {/* Mock Header with Viewer Bubbles Overlay */}
              <div className="h-12 bg-gray-800 border-b border-gray-600 flex items-center justify-between px-3 relative">
                <div className="text-xs text-gray-400">Header</div>
                {currentLayout.orbPosition === 'header' && (
                  <div className="text-xs bg-yellow-500 text-black px-2 py-1 rounded">Orbs</div>
                )}
                {/* Viewer Bubbles Overlay */}
                <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 flex gap-1">
                  <div className="w-8 h-8 bg-blue-500 rounded-full border-2 border-white flex items-center justify-center text-xs font-bold text-white">A</div>
                  <div className="w-8 h-8 bg-green-500 rounded-full border-2 border-white flex items-center justify-center text-xs font-bold text-white">B</div>
                  <div className="w-8 h-8 bg-purple-500 rounded-full border-2 border-white flex items-center justify-center text-xs font-bold text-white">C</div>
                </div>
              </div>

              {/* Profile Banner (different sizes based on version) */}
              {currentLayout.profilePosition.startsWith('top-banner') && (
                <div className={`bg-gradient-to-r from-purple-600 to-pink-600 flex items-center gap-3 px-3 border-b border-gray-600 ${
                  currentLayout.profilePosition === 'top-banner-large' ? 'h-20' :
                  currentLayout.profilePosition === 'top-banner-small' ? 'h-12' : 'h-16'
                }`}>
                  <div className={`bg-gray-500 rounded-full ${
                    currentLayout.profilePosition === 'top-banner-large' ? 'w-12 h-12' :
                    currentLayout.profilePosition === 'top-banner-small' ? 'w-8 h-8' : 'w-10 h-10'
                  }`}></div>
                  <div>
                    <div className={`font-bold text-white ${
                      currentLayout.profilePosition === 'top-banner-large' ? 'text-base' :
                      currentLayout.profilePosition === 'top-banner-small' ? 'text-xs' : 'text-sm'
                    }`}>TestBroadcaster</div>
                    <div className="text-xs text-gray-300">567 viewers</div>
                  </div>
                </div>
              )}

              {/* Profile Overlay (for overlay versions) */}
              {currentLayout.profilePosition === 'overlay' && (
                <div className="relative">
                  <div className="absolute top-2 left-2 z-10 bg-black/80 backdrop-blur rounded-lg p-2 flex items-center gap-2">
                    <div className="w-8 h-8 bg-gray-500 rounded-full"></div>
                    <div>
                      <div className="text-sm font-bold text-white">TestBroadcaster</div>
                      <div className="text-xs text-gray-300">567 viewers</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Broadcast Grid - Perfectly Aligned Mobile Battle Layout */}
              <div className="grid grid-cols-2 grid-rows-3 gap-0.5 p-2 h-80 w-full box-border">
                {Array.from({ length: 6 }, (_, i) => (
                  <div
                    key={i}
                    className="w-full h-full bg-gray-700 rounded border border-gray-600 flex flex-col items-center justify-center relative box-border"
                    style={{
                      aspectRatio: '1',
                      minHeight: '0',
                      maxWidth: '100%'
                    }}
                  >
                    {/* Profile below broadcaster (for version 4) */}
                    {i === 0 && currentLayout.profilePosition === 'below-broadcaster' && (
                      <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 bg-gradient-to-r from-purple-600 to-pink-600 rounded-lg p-1 flex items-center gap-1 w-20">
                        <div className="w-6 h-6 bg-gray-500 rounded-full"></div>
                        <div className="text-xs text-white truncate">TB</div>
                      </div>
                    )}

                    {/* Orbs on broadcaster */}
                    {i === 0 && currentLayout.orbPosition.startsWith('broadcaster') && (
                      <div className={`absolute top-1 right-1 text-xs bg-yellow-500 text-black px-1 rounded ${
                        currentLayout.orbPosition === 'broadcaster-large' ? 'text-sm px-2 py-1' : ''
                      }`}>
                        Orbs
                      </div>
                    )}

                    <div className="text-xs text-gray-400">
                      {i === 0 ? 'Broadcaster' : `Seat ${i}`}
                    </div>
                    {mockSeats[i] && (
                      <div className="text-xs text-white mt-1">
                        {mockSeats[i].user_profile.username}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Chat Area */}
              <div className={`bg-gray-800 border-t border-gray-600 p-2 ${
                selectedVersion === 1 ? 'h-36' : currentLayout.chatAvatarSize === 3 ? 'h-24' : currentLayout.chatAvatarSize === 4 ? 'h-28' : 'h-32'
              }`}>
                <div className="text-xs text-gray-400 mb-2">Live Chat</div>
                <div className="space-y-1 flex-1 overflow-hidden">
                  <div className="flex items-center gap-2">
                    <div className={`w-${currentLayout.chatAvatarSize} h-${currentLayout.chatAvatarSize} bg-gray-600 rounded-full`}></div>
                    <div className="text-xs text-gray-300 flex-1">User: Hello world! This is a longer message to show how avatars affect space.</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className={`w-${currentLayout.chatAvatarSize} h-${currentLayout.chatAvatarSize} bg-gray-600 rounded-full`}></div>
                    <div className="text-xs text-gray-300 flex-1">Broadcaster: Welcome to the stream! Thanks for joining.</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className={`w-${currentLayout.chatAvatarSize} h-${currentLayout.chatAvatarSize} bg-gray-600 rounded-full`}></div>
                    <div className="text-xs text-gray-300 flex-1">User2: Great content!</div>
                  </div>
                </div>
                {/* Chat Input Box - Only show for Version 1 */}
                {selectedVersion === 1 && (
                  <div className="mt-2 flex gap-2">
                    <input
                      type="text"
                      placeholder="Type a message..."
                      className="flex-1 bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs text-white"
                    />
                    <button className="bg-purple-600 hover:bg-purple-500 px-3 py-1 rounded text-xs font-bold text-white">
                      Send
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Implementation Notes */}
        <div className="mt-6 bg-gray-900/50 rounded-lg p-4">
          <h3 className="font-bold mb-2">Implementation Notes for Version {selectedVersion}</h3>
          <ul className="text-sm text-gray-300 space-y-1">
            <li>• Broadcast ticker removed on mobile</li>
            <li>• Grid layout: {currentLayout.gridLayout} ({currentLayout.gridClasses})</li>
            <li>• Profile position: {currentLayout.profilePosition.replace('-', ' ')}</li>
            <li>• Orb position: {currentLayout.orbPosition.replace('-', ' ')}</li>
            <li>• Chat avatar size: {currentLayout.chatAvatarSize}px</li>
            <li>• Live chat height unchanged, more horizontal space from smaller avatars</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default BroadcastMobilePreviewPage;