import React from 'react';
import { useAuthStore } from '../../lib/store';
import { supabase } from '../../lib/supabase';
import { Heart, Users, Crown, Gem, Coins, X, User } from 'lucide-react';
import { Stream } from '../../types/broadcast';
import { cn } from '../../lib/utils';
import { useIsMobile } from '../../hooks/useIsMobile';
import BroadcastLevelBar from './BroadcastLevelBar';

interface BroadcastHeaderProps {
    stream: Stream;
    isHost: boolean;
    liveViewerCount?: number;
    handleLike: () => void;
    hasPendingChallenge?: boolean;
    onAddBox?: () => void;
    onRemoveBox?: () => void;
    boxCount?: number;
    onClose?: () => void;
}

export default function BroadcastHeader({
    stream,
    isHost: _isHost,
    liveViewerCount,
    handleLike,
    hasPendingChallenge: _hasPendingChallenge,
    onAddBox: _onAddBox,
    onRemoveBox: _onRemoveBox,
    boxCount: _boxCount,
    onClose
}: BroadcastHeaderProps) {
    const { profile, setProfile } = useAuthStore();
    const { isMobileWidth: isMobile } = useIsMobile();
    const [isLiking, _setIsLiking] = React.useState(false);
    const profileRef = React.useRef(profile);

    // Keep profileRef up to date
    React.useEffect(() => {
        profileRef.current = profile;
    }, [profile]);

    // Poll balance updates without adding another realtime channel per viewer.
    React.useEffect(() => {
        if (!profile?.id) return;

        const refreshProfileBalance = async () => {
            const { data } = await supabase
                .from('user_profiles')
                .select('troll_coins,trollmonds,total_xp,xp,level,battle_crowns,updated_at')
                .eq('id', profile.id)
                .maybeSingle();

            const currentProfile = profileRef.current;
            if (!data || !currentProfile) return;

            const currentUpdatedAt = currentProfile.updated_at ? new Date(currentProfile.updated_at).getTime() : 0;
            const newUpdatedAt = data.updated_at ? new Date(data.updated_at).getTime() : 0;
            if (currentUpdatedAt > 0 && newUpdatedAt > 0 && newUpdatedAt <= currentUpdatedAt) return;

            const newProfile = { ...currentProfile, ...data } as any;
            if (
                newProfile.troll_coins !== currentProfile.troll_coins ||
                newProfile.trollmonds !== (currentProfile as any).trollmonds ||
                newProfile.total_xp !== (currentProfile as any).total_xp ||
                newProfile.xp !== (currentProfile as any).xp ||
                newProfile.level !== (currentProfile as any).level ||
                newProfile.battle_crowns !== (currentProfile as any).battle_crowns
            ) {
                setProfile(newProfile);
            }
        };

        // OPTIMIZED: 60s interval with visibility check
        const balanceTimer = window.setInterval(() => {
            if (document.visibilityState === 'visible') refreshProfileBalance();
        }, 60000);

        return () => {
            window.clearInterval(balanceTimer);
        }
    }, [profile?.id, setProfile]);

// Prefer live count from presence, fallback to DB count
    const displayViewerCount = liveViewerCount !== undefined 
        ? liveViewerCount 
        : (stream.current_viewers || stream.viewer_count || 0);

    // Get likes directly from stream - no local state needed
    const displayLikes = stream.total_likes || 0;

    return (
        <div className="absolute top-16 left-4 right-4 z-50 flex items-center justify-between gap-2 pointer-events-none">
            {/* Left: User info and balances */}
            <div className="flex items-center gap-2">
                {profile && !isMobile && (
                    <div className="flex items-center gap-1.5 bg-black/40 backdrop-blur-md rounded-full px-3 py-1 border border-white/10">
                        <User size={10} className="text-blue-400" />
                        <span className="text-[10px] font-bold text-white truncate max-w-[80px]">{profile.username || 'User'}</span>
                        <Crown size={10} className="text-amber-400" />
                        <span className="text-[10px] font-bold text-white">{(profile as any).battle_crowns || 0}</span>
                        <Gem size={10} className="text-purple-400" />
                        <span className="text-[10px] font-bold text-white">{(profile as any).trollmonds || 0}</span>
                        <Coins size={10} className="text-yellow-400" />
                        <span className="text-[10px] font-bold text-white">{(profile.troll_coins || 0).toLocaleString()}</span>
                    </div>
                )}
            </div>

            {/* Right: Stream Stats */}
            <div className="flex items-center gap-2">
                <BroadcastLevelBar broadcasterId={stream.user_id} streamId={stream.id} className="pointer-events-auto" />

                {onClose && (
                    <button 
                        onClick={onClose}
                        className="w-8 h-8 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center text-white/80 hover:bg-white/20 transition-colors"
                    >
                        <X size={16} />
                    </button>
                )}
                <div className="flex items-center gap-1.5 bg-black/40 backdrop-blur-md rounded-full px-2 py-1.5 border border-white/10">
                    <Users size={12} className="text-zinc-400" />
                    <span className="text-[10px] font-bold text-white">{displayViewerCount}</span>
                </div>

                <button 
                    onClick={handleLike}
                    disabled={isLiking}
                    className={cn(
                        "flex items-center gap-1.5 bg-pink-500/20 hover:bg-pink-500/30 backdrop-blur-md rounded-full px-2 py-1.5 border border-pink-500/30 transition-all pointer-events-auto",
                        isLiking && "scale-110"
                    )}
                >
                    <Heart size={12} className={cn("text-pink-500", isLiking && "fill-pink-500")} />
                    <span className="text-[10px] font-bold text-pink-500">{displayLikes.toLocaleString()}</span>
                </button>

            </div>
        </div>
    );
}
