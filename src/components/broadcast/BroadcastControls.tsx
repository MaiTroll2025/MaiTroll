import React, { useState, useEffect, useRef, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Stream } from '../../types/broadcast';
import { supabase } from '../../lib/supabase';
import { Plus, Minus, LayoutGrid, Settings2, Coins, Lock, Unlock, Mic, MicOff, Video, VideoOff, MessageSquare, MessageSquareOff, Heart, Eye, Power, Sparkles, Palette, Gift, UserX, ImageIcon, LogOut, ChevronDown, ChevronUp, Share2, Package, Swords, Star, GripVertical, X, MoreHorizontal, Sliders, Shield, Gamepad2, PlusCircle, Users, Bell } from 'lucide-react';
import { cn } from '../../lib/utils';
import { toast } from 'sonner';
import { getCategoryConfig } from '../../config/broadcastCategories';
import BannedUsersList from './BannedUsersList';
import ThemeSelector from './ThemeSelector';
import BattleThemeSelector from './BattleThemeSelector';
import BroadcastOfficerModal from './BroadcastOfficerModal';
import { useAuthStore } from '../../lib/store';
import { PreflightStore } from '../../lib/preflightStore';
import { useParticipantAttributes } from '../../hooks/useParticipantAttributes';
import { useBroadcastViewerCap } from '../../hooks/useBroadcastViewerCap';
import { AnimatePresence, motion } from 'framer-motion';
import { LocalVideoTrack, LocalAudioTrack } from 'livekit-client';
import { MaiTrollTheme } from '../../styles/trollCityTheme';

interface BroadcastControlsProps {
  stream: Stream;
  isHost: boolean;
  isModerator?: boolean;
  isOnStage: boolean;
  chatOpen: boolean;
  toggleChat: () => void;
  onGiftHost: () => void;
  onLeave?: () => void;
  onShare?: () => void;
  requiredBoxes?: number;
  onBoxCountUpdate?: (count: number) => void;
  onStreamEnd?: () => void;
  handleLike: () => void;
  toggleBattleMode: () => void;
  liveViewerCount?: number;
  localTracks: [LocalAudioTrack | null, LocalAudioTrack | null] | null;
  toggleCamera: () => void;
  toggleMicrophone: () => void;
  onPinProduct?: () => void;
  onRgbToggle?: (enabled: boolean) => void;
  isMicOn?: boolean;
  isCamOn?: boolean;
  boxCount?: number;
  setBoxCount?: (count: number) => void;
  onRefreshStream?: () => void;
  onStartBattle?: () => void;
  isBattleActive?: boolean;
  isLive?: boolean;
  onTrollToeController?: () => void;
  trollToeActive?: boolean;
  onGameSelect?: (game: 'troll_toe' | 'troll_us') => void;
  activeGame?: string | null;
  activeViewers?: Array<{
    user_id: string;
    username: string;
    avatar_url: string | null;
    role?: string;
    troll_role?: string;
    is_admin?: boolean;
    is_troll_officer?: boolean;
    is_lead_officer?: boolean;
    created_at: string;
    joined_at: string;
  }>;
  selectedBattleTheme?: string;
  onBattleThemeChange?: (themeId: string) => void;
  onOpenStagePass?: () => void;
  onInviteFollowers?: () => void;
}

function BroadcastControls({
  stream,
  isHost,
  isModerator = false,
  isOnStage,
  chatOpen,
  toggleChat,
  onGiftHost,
  onLeave,
  onShare,
  requiredBoxes = 1,
  onBoxCountUpdate,
  onStreamEnd,
  handleLike,
  toggleBattleMode,
  liveViewerCount,
  localTracks,
  toggleCamera,
  toggleMicrophone,
  onPinProduct,
  onRgbToggle,
  isMicOn: propMicOn,
  isCamOn: propCamOn,
  boxCount: parentBoxCount,
  setBoxCount: parentSetBoxCount,
  onRefreshStream,
  onStartBattle,
  isBattleActive = false,
  isLive = false,
  onTrollToeController,
  trollToeActive = false,
  onGameSelect,
  activeGame,
  activeViewers,
  selectedBattleTheme,
  onBattleThemeChange,
  onOpenStagePass,
  onInviteFollowers,
}: BroadcastControlsProps) {
  const navigate = useNavigate();
  const renderCountRef = useRef(0);
  renderCountRef.current += 1;
  if (renderCountRef.current % 10 === 1 && import.meta.env.DEV) {
    console.debug(`[BroadcastControls] Render #${renderCountRef.current}`);
  }

  const [audioTrack, videoTrack] = localTracks || [];

  const hasAudioTrack = !!audioTrack;
  const hasVideoTrack = !!videoTrack;
  const tracksReady = hasAudioTrack || hasVideoTrack;
  const isMicOn = hasAudioTrack
    ? Boolean((audioTrack as any)?.isEnabled ?? (audioTrack as any)?.enabled ?? audioTrack?.mediaStreamTrack?.enabled)
    : false;
  const isCamOn = hasVideoTrack
    ? Boolean((videoTrack as any)?.isEnabled ?? (videoTrack as any)?.enabled ?? videoTrack?.mediaStreamTrack?.enabled)
    : false;

  const previousTrackDebugRef = useRef<string | null>(null);
  useEffect(() => {
    if (!import.meta.env.DEV) return;

    const debugKey = [
      propMicOn,
      propCamOn,
      isMicOn,
      isCamOn,
      hasAudioTrack,
      hasVideoTrack,
      (audioTrack as any)?.sid || (audioTrack as any)?.trackSid || (audioTrack as any)?.getTrackId?.(),
      (videoTrack as any)?.sid || (videoTrack as any)?.trackSid || (videoTrack as any)?.getTrackId?.(),
      (audioTrack as any)?.enabled ?? audioTrack?.mediaStreamTrack?.enabled,
      (videoTrack as any)?.enabled ?? videoTrack?.mediaStreamTrack?.enabled,
      isOnStage,
    ].join('|');

    if (previousTrackDebugRef.current === debugKey) return;
    previousTrackDebugRef.current = debugKey;

    console.debug('[BroadcastControls] Track states changed:', {
      propMicOn,
      propCamOn,
      isMicOn,
      isCamOn,
      hasAudioTrack,
      hasVideoTrack,
      tracksReady,
      isOnStage,
      audioEnabled: (audioTrack as any)?.enabled ?? audioTrack?.mediaStreamTrack?.enabled,
      videoEnabled: (videoTrack as any)?.enabled ?? videoTrack?.mediaStreamTrack?.enabled
    });
  }, [
    propMicOn,
    propCamOn,
    isMicOn,
    isCamOn,
    hasAudioTrack,
    hasVideoTrack,
    tracksReady,
    isOnStage,
    audioTrack,
    videoTrack,
  ]);

  const { user, isAdmin, profile } = useAuthStore();
  const isCEO = profile?.username === 'ceo' || (profile as any)?.role === 'ceo';
  const [seatPrice, setSeatPrice] = useState(stream.seat_price || 0);
  const [seatPrices, setSeatPrices] = useState<number[]>(stream.seat_prices || [0, seatPrice, seatPrice, seatPrice, seatPrice, seatPrice]);

  const [debouncedPrice, setDebouncedPrice] = useState(seatPrice);
  const [debouncedSeatPrices, setDebouncedSeatPrices] = useState(seatPrices);

  const [showBannedList, setShowBannedList] = useState(false);
  const [showThemeSelector, setShowThemeSelector] = useState(false);
  const [showBroadcastOfficer, setShowBroadcastOfficer] = useState(false);
  const [showPaidChatSettings, setShowPaidChatSettings] = useState(false);
  const [likes, setLikes] = useState(0);
  const [isLiking, setIsLiking] = useState(false);
  const [isFeatureLoading, setIsFeatureLoading] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [isClosed, setIsClosed] = useState(false);

  // Paid chat settings
  const [paidChatEnabled, setPaidChatEnabled] = useState(false);
  const [paidChatType, setPaidChatType] = useState<'per_user' | 'per_chat'>('per_user');
  const [paidChatPrice, setPaidChatPrice] = useState(100);

  const categoryConfig = getCategoryConfig(stream.category || 'general');
  const canModifyBoxes = categoryConfig.allowAddBox || categoryConfig.allowDeductBox;

  const isElectionCategory = stream.category === 'election';
  const isOfficerOrAdmin =
    profile?.role === 'admin' ||
    profile?.role === 'secretary' ||
    profile?.role === 'lead_troll_officer' ||
    profile?.role === 'troll_officer' ||
    profile?.role === 'ceo' ||
    profile?.is_admin === true ||
    profile?.is_troll_officer === true ||
    profile?.is_lead_officer === true ||
    profile?.troll_role === 'admin' ||
    profile?.troll_role === 'lead_officer' ||
    profile?.troll_role === 'secretary' ||
    profile?.troll_role === 'pastor' ||
    profile?.troll_role === 'ceo' ||
    false;
  const canEditElectionBoxes = !isElectionCategory || isOfficerOrAdmin;

  // Check if user can use paid chat features
  const canUsePaidChat = profile?.level && profile.level >= 420;
  const canUsePaidChatPerUser = isOfficerOrAdmin || canUsePaidChat;
  const canUsePaidChatPerChat = isOfficerOrAdmin || canUsePaidChat;

  const [localBoxCount, setLocalBoxCount] = useState(stream.box_count || 1);
  const boxCount = parentBoxCount !== undefined ? parentBoxCount : localBoxCount;
  const setBoxCount = parentSetBoxCount !== undefined ? parentSetBoxCount : setLocalBoxCount;

  useEffect(() => {
    if (parentBoxCount === undefined && stream.box_count !== undefined && stream.box_count !== localBoxCount) {
      setLocalBoxCount(stream.box_count);
    }
  }, [stream.box_count, parentBoxCount, localBoxCount]);

  useEffect(() => {
    if (typeof stream.total_likes === 'number') {
      setLikes(stream.total_likes);
    }
  }, [stream.total_likes]);

  useEffect(() => {
    if (stream.seat_prices && Array.isArray(stream.seat_prices)) {
      const currentPrices = stream.seat_prices;
      setSeatPrices(currentPrices);
      setDebouncedSeatPrices(currentPrices);
    }
  }, [stream.seat_prices]);

  useEffect(() => {
    if (stream.seat_price !== undefined) {
      setSeatPrice(stream.seat_price);
      setDebouncedPrice(stream.seat_price);
    }
  }, [stream.seat_price]);

  const attributes = useParticipantAttributes(user ? [user.id] : [], stream.id);
  const myAttributes = user ? attributes[user.id] : null;
  const activePerks = myAttributes?.activePerks || [];
  const { seatCap } = useBroadcastViewerCap();

  const isTrueAdmin = isAdmin || profile?.troll_role === 'admin';
  const canManageStream = isHost || isTrueAdmin;
  const canEditStream = isHost || isTrueAdmin;

  const toggleFeature = async () => {
    if (!isOfficerOrAdmin || !user) return;
    setIsFeatureLoading(true);
    try {
      const newFeatured = !stream.is_featured;
      const { error } = await supabase
        .from('streams')
        .update({
          is_featured: newFeatured,
          featured_at: newFeatured ? new Date().toISOString() : null,
          featured_by: newFeatured ? user.id : null
        })
        .eq('id', stream.id);
      if (error) throw error;
      toast.success(newFeatured ? 'Stream featured successfully!' : 'Stream unfeatured');
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || 'Failed to update featured status');
    } finally {
      setIsFeatureLoading(false);
    }
  };

  // Load paid chat settings on mount
  useEffect(() => {
    async function loadPaidChatSettings() {
      if (!stream?.id) return;
      
      const { data, error } = await supabase
        .from('stream_settings')
        .select('paid_chat_enabled, paid_chat_type, paid_chat_price')
        .eq('stream_id', stream.id)
        .maybeSingle();
      
      if (!error && data) {
        setPaidChatEnabled(data.paid_chat_enabled || false);
        setPaidChatType(data.paid_chat_type || 'per_user');
        setPaidChatPrice(data.paid_chat_price || 100);
      }
    }
    
    loadPaidChatSettings();
  }, [stream?.id]);

  const savePaidChatSettings = async () => {
    if (!stream?.id) return;
    
    const { error } = await supabase
      .from('stream_settings')
      .upsert({
        stream_id: stream.id,
        paid_chat_enabled: paidChatEnabled,
        paid_chat_type: paidChatType,
        paid_chat_price: paidChatPrice,
        updated_at: new Date().toISOString()
      }, { onConflict: 'stream_id' });
    
    if (error) {
      toast.error('Failed to save paid chat settings');
    } else {
      toast.success('Paid chat settings saved');
      setShowPaidChatSettings(false);
    }
  };

  const togglePerk = async (perkId: string) => {
    if (!user) return;
    const isActive = activePerks.includes(perkId as any);
    try {
      if (isActive) {
        const { error } = await supabase.from('user_perks').update({ is_active: false }).eq('user_id', user.id).eq('perk_id', perkId);
        if (error) throw error;
      } else {
        const { data, error: fetchError } = await supabase
          .from('user_perks')
          .select('id')
          .eq('user_id', user.id)
          .eq('perk_id', perkId)
          .maybeSingle();
        if (fetchError && fetchError.code !== 'PGRST116') throw fetchError;
        if (data) {
          const { error } = await supabase.from('user_perks').update({ is_active: true }).eq('id', data.id);
          if (error) throw error;
        } else {
          const { error } = await supabase.from('user_perks').insert({
            user_id: user.id,
            perk_id: perkId,
            is_active: true,
            expires_at: new Date(Date.now() + 86400000).toISOString()
          });
          if (error) {
            if (error.code === '42501') {
              toast.error("You don't own this effect yet.");
            } else {
              throw error;
            }
          } else {
            toast.success("Effect activated!");
          }
        }
      }
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "Failed to toggle effect");
    }
  };

  const updateStreamConfig = React.useCallback(async (price: number, showToast: boolean = true, perBoxPrices?: number[]) => {
    if (!canEditStream) return;
    try {
      const updates: { seat_price: number; seat_prices?: number[] } = { seat_price: price };
      if (perBoxPrices) {
        updates.seat_prices = perBoxPrices;
      }
      await supabase.from('streams').update(updates).eq('id', stream.id);
      if (showToast) {
        toast.success("Stream settings updated");
      }
    } catch (e) {
      console.error(e);
    }
  }, [canEditStream, stream.id]);

  useEffect(() => {
    if (debouncedPrice == stream.seat_price) return;
    const timer = setTimeout(() => {
      updateStreamConfig(debouncedPrice, false);
    }, 1000);
    return () => clearTimeout(timer);
  }, [debouncedPrice, stream.seat_price, updateStreamConfig]);

  useEffect(() => {
    const currentPrices = stream.seat_prices || [0, stream.seat_price || 0, stream.seat_price || 0, stream.seat_price || 0, stream.seat_price || 0, stream.seat_price || 0];
    const hasChanged = debouncedSeatPrices.some((price, idx) => price !== currentPrices[idx]);
    if (!hasChanged) return;
    const timer = setTimeout(() => {
      updateStreamConfig(seatPrice, false, debouncedSeatPrices);
    }, 1000);
    return () => clearTimeout(timer);
  }, [debouncedSeatPrices, stream.seat_prices, seatPrice, updateStreamConfig]);

  const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isHost) return;
    if (e.target.value === '') {
      setSeatPrice(0);
      setDebouncedPrice(0);
      return;
    }
    let val = parseInt(e.target.value, 10) || 0;
    if (val > 5000) val = 5000;
    setSeatPrice(val);
    setDebouncedPrice(val);
  };

  const handleBoxPriceChange = (boxIndex: number, value: string) => {
    if (!isHost) return;
    const newPrices = [...seatPrices];
    let val = parseInt(value, 10) || 0;
    if (val > 5000) val = 5000;
    if (val < 0) val = 0;
    newPrices[boxIndex] = val;
    setSeatPrices(newPrices);
    setDebouncedSeatPrices(newPrices);
  };

  const [enablePerBoxPricing, setEnablePerBoxPricing] = useState(false);

  const updateBoxCount = async (newCount: number) => {
    if (!canEditStream) return;
    const effectiveMaxBoxes = seatCap.enabled ? Math.min(6, seatCap.max) : 6;
    if (newCount > effectiveMaxBoxes) {
      toast.error(seatCap.enabled ? `Maximum ${effectiveMaxBoxes} boxes allowed during capped period` : "Maximum 6 boxes allowed");
      return;
    }
    const minLimit = Math.max(1, requiredBoxes);
    if (newCount < minLimit) {
      toast.error("Cannot reduce boxes below occupied seats");
      return;
    }
    setBoxCount(newCount);
    if (onBoxCountUpdate) {
      onBoxCountUpdate(newCount);
    }
    try {
      console.log('[BroadcastControls] Updating database with box_count:', newCount);
      const { error } = await supabase
        .from('streams')
        .update({ box_count: newCount })
        .eq('id', stream.id);
      if (error) {
        console.error('[BroadcastControls] Error updating box count:', error);
        toast.error("Failed to update box count");
        setBoxCount(stream.box_count || 1);
        return;
      }
      console.log('[BroadcastControls] Box count updated in database to:', newCount);
    } catch (e) {
      console.error('[BroadcastControls] Exception updating box count:', e);
      toast.error("Failed to update box count");
      setBoxCount(stream.box_count || 1);
    }
  };

  const toggleStreamRgb = async () => {
    if (!isHost) return;
    const enabling = !stream.has_rgb_effect;
    try {
      const { data, error } = await supabase.rpc('purchase_rgb_broadcast', {
        p_stream_id: stream.id,
        p_enable: enabling
      });
      if (error) throw error;
      const result = Array.isArray(data) ? data[0] : data;
      if (!result || !result.success) throw new Error(result?.error || "Failed to update RGB");
      if (onRgbToggle) {
        onRgbToggle(enabling);
      }
      if (result.message === 'Purchased and Enabled') {
        toast.success("RGB Unlocked! (-10 Coins)");
      } else {
        toast.success(enabling ? "RGB Effect Enabled" : "RGB Effect Disabled");
      }
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "Failed to update RGB setting");
    }
  };

  const handleEndStream = () => {
    if (onStreamEnd) {
      onStreamEnd();
    } else if (isHost && onLeave) {
      // Fallback to leaving if no dedicated end handler
      onLeave();
    }
  };

  if (isClosed) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <button
          onClick={() => setIsClosed(false)}
          className="bg-slate-900/95 border border-white/10 rounded-full p-3 shadow-lg hover:bg-slate-800 transition-colors"
          title="Show Controls"
        >
          <Settings2 size={20} className="text-white/60" />
        </button>
      </div>
    );
  }

  return (
    <>
      {showBannedList && (
        <BannedUsersList streamId={stream.id} activeViewersOverride={activeViewers} onClose={() => setShowBannedList(false)} />
      )}
      {showThemeSelector && !isCEO && stream.category === 'General Chat' && (
        <ThemeSelector
          streamId={stream.id}
          currentThemeUrl={stream.active_theme_url}
          onClose={() => setShowThemeSelector(false)}
        />
      )}
      {showBroadcastOfficer && (
        <BroadcastOfficerModal
          streamId={stream.id}
          broadcasterId={stream.broadcaster_id || stream.user_id || ''}
          isOpen={showBroadcastOfficer}
          onClose={() => setShowBroadcastOfficer(false)}
        />
      )}
      
      {showPaidChatSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 border border-white/10 rounded-2xl p-6 w-[400px] max-w-[90vw]">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-white">Paid Chat Settings</h3>
              <button onClick={() => setShowPaidChatSettings(false)} className="text-slate-400 hover:text-white">
                <X size={20} />
              </button>
            </div>
            
            <div className="space-y-4">
              {/* Enable toggle */}
              <div className="flex items-center justify-between">
                <span className="text-slate-300">Enable Paid Chat</span>
                <button
                  onClick={() => setPaidChatEnabled(!paidChatEnabled)}
                  className={cn(
                    "w-12 h-6 rounded-full transition-colors",
                    paidChatEnabled ? "bg-purple-500" : "bg-slate-700"
                  )}
                >
                  <div className={cn(
                    "w-5 h-5 bg-white rounded-full transition-transform",
                    paidChatEnabled ? "translate-x-6" : "translate-x-0.5"
                  )} />
                </button>
              </div>
              
              {paidChatEnabled && (
                <>
                  {/* Chat type selection */}
                  <div>
                    <label className="block text-sm text-slate-400 mb-2">Charge Type</label>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setPaidChatType('per_user')}
                        disabled={!isHost}
                        className={cn(
                          "flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors",
                          paidChatType === 'per_user' 
                            ? "bg-purple-500/20 text-purple-400 border border-purple-500/30" 
                            : "bg-slate-800 text-slate-400 border border-slate-700",
                          !isHost && "opacity-50 cursor-not-allowed"
                        )}
                      >
                        Per User
                      </button>
                      <button
                        onClick={() => setPaidChatType('per_chat')}
                        disabled={!canUsePaidChatPerChat}
                        className={cn(
                          "flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors",
                          paidChatType === 'per_chat' 
                            ? "bg-purple-500/20 text-purple-400 border border-purple-500/30" 
                            : "bg-slate-800 text-slate-400 border border-slate-700",
                          !canUsePaidChatPerChat && "opacity-50 cursor-not-allowed"
                        )}
                      >
                        Per Chat
                        {!canUsePaidChatPerChat && <span className="block text-xs">Lvl 420+</span>}
                      </button>
                    </div>
                  </div>
                  
                  {/* Price input */}
                  <div>
                    <label className="block text-sm text-slate-400 mb-2">
                      Price (coins per {paidChatType === 'per_user' ? 'user' : 'message'})
                    </label>
                    <input
                      type="number"
                      value={paidChatPrice}
                      onChange={(e) => setPaidChatPrice(Math.max(0, parseInt(e.target.value) || 0))}
                      min={0}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white"
                    />
                  </div>
                  
                  {/* Info text */}
                  <p className="text-xs text-slate-500">
                    {paidChatType === 'per_user' 
                      ? 'Users pay once to access chat for this stream' 
                      : 'Users pay for each message they send'}
                  </p>
                </>
              )}
            </div>
            
            <button
              onClick={savePaidChatSettings}
              className="w-full mt-6 bg-purple-500 hover:bg-purple-600 text-white font-medium py-2.5 rounded-lg transition-colors"
            >
              Save Settings
            </button>
          </div>
        </div>
      )}

      {/* Main action orbs - bottom center */}
      <div className="flex items-center gap-3">
        {/* Mic (stage only) */}
        {isOnStage && tracksReady && (
          <OrbBtn
            active={isMicOn}
            onClick={toggleMicrophone}
            icon={isMicOn ? Mic : MicOff}
            label="Mic"
            glow={!isMicOn ? "red" : undefined}
            size="sm"
            disabled={!hasAudioTrack}
          />
        )}

        {/* Cam (stage only) */}
        {isOnStage && tracksReady && (
          <OrbBtn
            active={isCamOn}
            onClick={toggleCamera}
            icon={isCamOn ? Video : VideoOff}
            label="Cam"
            glow={!isCamOn ? "red" : undefined}
            size="sm"
            disabled={!hasVideoTrack}
          />
        )}

        {/* Loading indicator */}
        {isOnStage && !tracksReady && (
          <div className="flex items-center gap-2 px-3 py-2 bg-yellow-500/10 rounded-full border border-yellow-500/20">
            <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse" />
            <span className="text-[10px] text-yellow-500 font-bold">Init...</span>
          </div>
        )}

        {/* Chat */}
        <OrbBtn
          active={chatOpen}
          onClick={toggleChat}
          icon={chatOpen ? MessageSquare : MessageSquareOff}
          label="Chat"
          size="sm"
        />

        {/* Share */}
        {onShare && (
          <OrbBtn
            active={false}
            onClick={onShare}
            icon={Share2}
            label="Share"
            size="sm"
          />
        )}

        {/* Invite Followers */}
        {isHost && onInviteFollowers && (
          <OrbBtn
            active={false}
            onClick={onInviteFollowers}
            icon={Bell}
            label="Invite"
            size="sm"
          />
        )}

        {/* Like (viewers only) */}
        {!isHost && (
          <OrbBtn
            active={false}
            onClick={handleLike}
            icon={Heart}
            label="Like"
            glow={isLiking ? "pink" : undefined}
            size="sm"
          />
        )}

        {/* Leave (viewers - not on stage) */}
        {!isHost && onLeave && !isOnStage && (
          <OrbBtn
            active={false}
            onClick={onLeave}
            icon={LogOut}
            label="Leave"
            glow="red"
            size="sm"
          />
        )}

        {/* Battle start control (Battle category only, when live) */}
        {onStartBattle && isHost && isLive && !isBattleActive && categoryConfig.id === 'battle' && (
          <OrbBtn
            active={false}
            onClick={async (event) => {
              // Add loading state temporarily
              const btn = event.currentTarget as HTMLButtonElement;
              btn.disabled = true;
              try {
                await onStartBattle();
              } finally {
                btn.disabled = false;
              }
            }}
            icon={Swords}
            label="Start Battle"
            glow="red"
            size="sm"
          />
        )}

        {/* Battle Active Indicator */}
        {isBattleActive && (
          <OrbBtn
            active={true}
            onClick={() => {}}
            icon={Swords}
            label="In Battle"
            glow="red"
            size="sm"
          />
        )}

        {/* Games Controller - Troll Toe */}
        {onTrollToeController && (
          <OrbBtn
            active={trollToeActive}
            onClick={onTrollToeController}
            icon={Gamepad2}
            label="Games"
            glow={undefined}
            size="sm"
            disabled={false}
            tooltip="Open Game Controller"
          />
        )}

        {/* End Stream (host) - center large orb */}
        {isHost && (
          <OrbBtn
            active={false}
            onClick={handleEndStream}
            icon={Power}
            label="End"
            glow="red"
            size="lg"
          />
        )}

        {/* Leave Seat (guest) */}
        {onLeave && isOnStage && !isHost && (
          <OrbBtn
            active={false}
            onClick={onLeave}
            icon={LogOut}
            label="Leave"
            glow="red"
            size="sm"
          />
        )}

        {/* Open Stage Pass (host or staff/CEO/admin) */}
        {(isHost || isOfficerOrAdmin) && onOpenStagePass && (
          <OrbBtn
            active={false}
            onClick={onOpenStagePass}
            icon={PlusCircle}
            label="Stage Pass"
            glow="violet"
            size="sm"
          />
        )}

        {/* More menu toggle */}
        {(canManageStream || isHost || isOfficerOrAdmin) && (
          <OrbBtn
            active={menuOpen}
            onClick={() => setMenuOpen(!menuOpen)}
            icon={Sliders}
            label="More"
            size="sm"
          />
        )}
      </div>

      {/* Expandable menu */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="absolute bottom-16 left-1/2 -translate-x-1/2 z-50 bg-zinc-900/95 backdrop-blur-xl border border-white/10 rounded-2xl p-4 shadow-2xl w-80 max-h-[60vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">Stream Settings</span>
              <button onClick={() => setMenuOpen(false)} className="text-slate-500 hover:text-white">
                <X size={14} />
              </button>
            </div>

            {/* Quick actions grid */}
            <div className="grid grid-cols-4 gap-2 mb-4">
              {isHost && onPinProduct && (
                <MenuOrb icon={Package} label="Product" onClick={() => { onPinProduct(); setMenuOpen(false); }} />
              )}
              {canManageStream && !isCEO && stream.category === 'General Chat' && (
                <MenuOrb icon={ImageIcon} label="Theme" onClick={() => { setShowThemeSelector(!showThemeSelector); setMenuOpen(false); }} />
              )}
              {canManageStream && (
                <MenuOrb icon={UserX} label="Banned" onClick={() => { setShowBannedList(!showBannedList); setMenuOpen(false); }} />
              )}
              {isHost && (
                <MenuOrb 
                  icon={Shield} 
                  label="Officers" 
                  onClick={() => { setShowBroadcastOfficer(true); setMenuOpen(false); }} 
                />
              )}
              {isHost && (
                <MenuOrb
                  icon={MessageSquare}
                  label="Paid Chat"
                  onClick={() => { setShowPaidChatSettings(true); setMenuOpen(false); }}
                  active={paidChatEnabled}
                />
              )}
              {isOfficerOrAdmin && (
                <MenuOrb
                  icon={Star}
                  label={stream.is_featured ? "Unfeature" : "Feature"}
                  onClick={() => { toggleFeature(); setMenuOpen(false); }}
                  active={stream.is_featured}
                />
              )}
              {isHost && (
                <MenuOrb
                  icon={Palette}
                  label={stream.has_rgb_effect ? "RGB ON" : "RGB OFF"}
                  onClick={() => { toggleStreamRgb(); }}
                  active={stream.has_rgb_effect}
                />
              )}
            </div>

            {/* Seat Price */}
            {canManageStream && (
              <div className="bg-white/5 rounded-xl p-3 mb-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Coins size={14} className="text-amber-400" />
                    <span className="text-xs font-bold text-white">
                      {enablePerBoxPricing ? 'Per-Box Pricing' : 'Seat Price'}
                    </span>
                  </div>
                  <button
                    onClick={() => setEnablePerBoxPricing(!enablePerBoxPricing)}
                    className="text-[9px] font-bold uppercase tracking-wider px-2 py-1 rounded-full bg-white/10 text-slate-400 hover:text-white transition-colors"
                  >
                    {enablePerBoxPricing ? 'Simple' : 'Advanced'}
                  </button>
                </div>

                {!enablePerBoxPricing ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="0"
                      max="5000"
                      value={seatPrice === 0 ? '' : seatPrice}
                      onChange={handlePriceChange}
                      disabled={!isHost}
                      className={cn(
                        "flex-1 bg-black/40 border border-amber-500/20 rounded-lg px-3 py-2 text-sm font-bold text-white placeholder:text-zinc-700 focus:outline-none focus:border-amber-500/50 transition-all",
                        !isHost && "opacity-50 cursor-not-allowed"
                      )}
                      placeholder="0"
                    />
                    <span className="text-[10px] text-zinc-500 font-medium">coins</span>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-2">
                    {Array.from({ length: 6 }, (_, i) => (
                      <div key={i} className="flex flex-col items-center gap-1">
                        <label className={cn(
                          "text-[9px] font-bold uppercase tracking-wider",
                          i === 0 ? "text-purple-400" : "text-zinc-500"
                        )}>
                          {i === 0 ? 'Host' : `Seat ${i}`}
                        </label>
                        <input
                          type="number"
                          min="0"
                          max="5000"
                          value={seatPrices[i] || 0}
                          onChange={(e) => handleBoxPriceChange(i, e.target.value)}
                          disabled={!isHost || i === 0}
                          className={cn(
                            "w-full bg-black/40 border rounded-lg px-2 py-1.5 text-xs font-bold text-white text-center focus:outline-none transition-all",
                            i === 0
                              ? "border-purple-500/20 text-purple-300 opacity-60 cursor-not-allowed"
                              : "border-amber-500/20"
                          )}
                          placeholder="0"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {isHost && categoryConfig.supportsBattles && onBattleThemeChange && (
              <BattleThemeSelector
                selectedTheme={selectedBattleTheme}
                onSelectTheme={onBattleThemeChange}
                disabled={!isLive}
              />
            )}

            {/* Viewer stats */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 bg-blue-500/10 border border-blue-500/20 rounded-full px-2.5 py-1">
                <Eye size={11} className="text-blue-400" />
                <span className="text-[10px] font-bold text-blue-300">
                  {liveViewerCount !== undefined ? liveViewerCount : ((stream as any).current_viewers || stream.viewer_count || 0)}
                </span>
              </div>
              <div className="flex items-center gap-1.5 bg-pink-500/10 border border-pink-500/20 rounded-full px-2.5 py-1">
                <Heart size={11} className="text-pink-400" />
                <span className="text-[10px] font-bold text-pink-300">{likes}</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

// ─── ORB COMPONENTS ───

function OrbBtn({ active, onClick, icon: Icon, label, glow, size, disabled, tooltip }: any) {
  const isLg = size === 'lg';
  const handleClick = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled && onClick) {
      onClick();
    }
  };
  return (
    <div className="flex flex-col items-center gap-1" title={tooltip}>
      <button
        onClick={handleClick}
        onTouchEnd={handleClick}
        disabled={disabled}
        className={cn(
          "rounded-full flex items-center justify-center transition-all backdrop-blur-xl border",
          isLg ? "w-14 h-14" : "w-11 h-11",
          glow === "red"
            ? "bg-red-500/20 border-red-500/40 text-red-400 shadow-[0_0_15px_rgba(239,68,68,0.3)]"
            : glow === "pink"
              ? "bg-pink-500/20 border-pink-500/40 text-pink-400 shadow-[0_0_15px_rgba(236,72,153,0.3)]"
              : glow === "violet"
                ? "bg-violet-500/20 border-violet-500/40 text-violet-400 shadow-[0_0_15px_rgba(139,92,246,0.35)]"
                : glow === "yellow"
                  ? "bg-yellow-500/20 border-yellow-500/40 text-yellow-400 shadow-[0_0_15px_rgba(234,179,8,0.3)] animate-pulse"
                  : active
                    ? "bg-white/15 border-white/25 text-white shadow-lg"
                    : "bg-white/10 border-white/20 text-white hover:bg-white/20",
          disabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer active:scale-90"
        )}
      >
        <Icon size={isLg ? 20 : 16} />
      </button>
      <span className="text-[8px] text-slate-400 font-medium">{label}</span>
    </div>
  );
}

function SideOrb({ onClick, icon: Icon, color, active, disabled, label }: any) {
  const handleClick = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled && onClick) {
      onClick();
    }
  };
  return (
    <div className="flex flex-col items-center gap-0.5">
      <button
        onClick={handleClick}
        onTouchEnd={handleClick}
        disabled={disabled}
        className={cn(
          "w-8 h-8 rounded-full flex items-center justify-center backdrop-blur-xl border transition-all bg-white/10 border-white/20 text-white hover:bg-white/20",
          disabled && "opacity-30 cursor-not-allowed"
        )}
      >
        <Icon size={14} />
      </button>
      {label && <span className="text-[7px] text-slate-500 font-medium leading-none">{label}</span>}
    </div>
  );
}

function MenuOrb({ icon: Icon, label, onClick, active }: any) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex flex-col items-center gap-1 p-2 rounded-xl transition-all",
        active ? "bg-purple-500/15 text-purple-400" : "hover:bg-white/10 text-white/70"
      )}
    >
      <div className={cn(
        "w-10 h-10 rounded-full border flex items-center justify-center",
        active ? "bg-purple-500/20 border-purple-500/30" : "bg-white/10 border-white/10"
      )}>
        <Icon size={16} />
      </div>
      <span className="text-[8px] text-slate-400">{label}</span>
    </button>
  );
}

function areBroadcastControlsPropsEqual(prev: BroadcastControlsProps, next: BroadcastControlsProps) {
  const prevAudioTrack = prev.localTracks?.[0] || null;
  const prevVideoTrack = prev.localTracks?.[1] || null;
  const nextAudioTrack = next.localTracks?.[0] || null;
  const nextVideoTrack = next.localTracks?.[1] || null;

  return (
    prev.stream.id === next.stream.id &&
    prev.stream.status === next.stream.status &&
    prev.stream.category === next.stream.category &&
    prev.stream.box_count === next.stream.box_count &&
    prev.stream.seat_price === next.stream.seat_price &&
    prev.stream.is_battle === next.stream.is_battle &&
    prev.stream.broadcast_mode === next.stream.broadcast_mode &&
    prev.isHost === next.isHost &&
    prev.isModerator === next.isModerator &&
    prev.isOnStage === next.isOnStage &&
    prev.chatOpen === next.chatOpen &&
    prev.requiredBoxes === next.requiredBoxes &&
    prev.isMicOn === next.isMicOn &&
    prev.isCamOn === next.isCamOn &&
    prev.boxCount === next.boxCount &&
    prev.isBattleActive === next.isBattleActive &&
    prev.isLive === next.isLive &&
    prev.trollToeActive === next.trollToeActive &&
    prev.activeGame === next.activeGame &&
    prev.selectedBattleTheme === next.selectedBattleTheme &&
    prevAudioTrack === nextAudioTrack &&
    prevVideoTrack === nextVideoTrack &&
    prev.toggleChat === next.toggleChat &&
    prev.onGiftHost === next.onGiftHost &&
    prev.onLeave === next.onLeave &&
    prev.onShare === next.onShare &&
    prev.onStreamEnd === next.onStreamEnd &&
    prev.handleLike === next.handleLike &&
    prev.toggleBattleMode === next.toggleBattleMode &&
    prev.toggleCamera === next.toggleCamera &&
    prev.toggleMicrophone === next.toggleMicrophone &&
    prev.onPinProduct === next.onPinProduct &&
    prev.onRefreshStream === next.onRefreshStream &&
    prev.onStartBattle === next.onStartBattle &&
    prev.onTrollToeController === next.onTrollToeController &&
    prev.onGameSelect === next.onGameSelect &&
    prev.onBattleThemeChange === next.onBattleThemeChange &&
    prev.onOpenStagePass === next.onOpenStagePass &&
    prev.onInviteFollowers === next.onInviteFollowers
  );
}

export default memo(BroadcastControls, areBroadcastControlsPropsEqual);
