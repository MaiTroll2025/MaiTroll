import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuthStore } from '@/lib/store';
import { supabase } from '@/lib/supabase';
import { Coins, XCircle, CheckCircle, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

type _AuctionShowStatus = 'draft' | 'scheduled' | 'live' | 'ended' | 'cancelled';
type AuctionLotStatus = 'upcoming' | 'live' | 'sold' | 'unsold' | 'cancelled';

interface AuctionShow {
  id: string;
  title: string;
  description?: string | null;
  category?: string | null;
  thumbnail_url?: string | null;
  status?: string | null;
  scheduled_for?: string | null;
  live_started_at?: string | null;
  ended_at?: string | null;
  livekit_room_name?: string | null;
  auctioneer_id: string;
  current_lot_id?: string | null;
  hls_url?: string | null;
  egress_id?: string | null;
}

interface AuctionLot {
  id: string;
  auction_show_id: string;
  title: string;
  description?: string | null;
  image_url?: string | null;
  starting_bid: number;
  bid_increment: number;
  current_highest_bid?: number | null;
  current_highest_bidder_id?: string | null;
  status: AuctionLotStatus;
  countdown_end_at?: string | null;
  order_index?: number | null;
  reserve_price?: number | null;
  buy_now_price?: number | null;
  condition?: string | null;
  quantity?: number | null;
}

interface AuctionBid {
  id: string;
  lot_id?: string | null;
  bidder_id: string;
  bid_amount: number;
  created_at: string;
  bidder?: {
    username?: string | null;
    display_name?: string | null;
    avatar_url?: string | null;
  } | null;
}

interface UserProfile {
  id: string;
  username?: string | null;
  display_name?: string | null;
  avatar_url?: string | null;
  troll_coins: number;
  role?: string | null;
  is_admin?: boolean | null;
  is_superadmin?: boolean | null;
}

interface LiveAuctionStateRpc {
  current_lot?: AuctionLot | null;
  recent_bids?: AuctionBid[];
  viewer_count?: number;
}

interface PlaceBidResult {
  accepted?: boolean;
  reason?: string;
  bid_id?: string;
  new_highest_bid?: number;
}

const MIN_COINS_TO_BID = 100;

function formatCoins(value?: number | null) {
  return Number(value || 0).toLocaleString();
}

function _getDisplayName(profile?: UserProfile | null) {
  return profile?.username || profile?.display_name || 'Troll Citizen';
}

interface LiveAuctionMiniWindowProps {
  auction: AuctionShow;
  onRequireAuth: (intent?: string) => boolean;
}

export default function LiveAuctionMiniWindow({ auction, onRequireAuth: _onRequireAuth }: LiveAuctionMiniWindowProps) {
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const [_lots, setLots] = useState<AuctionLot[]>([]);
  const [currentLot, setCurrentLot] = useState<AuctionLot | null>(null);
  const [_bids, setBids] = useState<AuctionBid[]>([]);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);

  const [loading, setLoading] = useState(true);
  const [viewerCount, setViewerCount] = useState(0);

  const [bidAmount, setBidAmount] = useState('');
  const [bidStatus, setBidStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [bidError, setBidError] = useState('');

  const [_isMuted, _setIsMuted] = useState(false);

  const isAuctioneer = useMemo(() => {
    if (!user?.id || !auction) return false;
    return auction.auctioneer_id === user.id;
  }, [auction, user?.id]);

  const minimumBid = useMemo(() => {
    if (!currentLot) return 0;
    const current = Number(currentLot.current_highest_bid || 0);
    return current > 0
      ? current + Number(currentLot.bid_increment || 100)
      : Number(currentLot.starting_bid || 0);
  }, [currentLot]);

  const canBid = !!user && !!currentLot && currentLot.status === 'live' && Number(userProfile?.troll_coins || 0) >= MIN_COINS_TO_BID;

  const fetchUserProfile = useCallback(async () => {
    if (!user?.id) return;

    const { data, error } = await supabase
      .from('user_profiles')
      .select('id, username, display_name, avatar_url, troll_coins, role, is_admin, is_superadmin')
      .eq('id', user.id)
      .maybeSingle();

    if (error) {
      console.warn('[LiveAuctionMiniWindow] Failed to fetch user profile:', error);
      return;
    }

    if (data) {
      setUserProfile({
        ...data,
        troll_coins: Number(data.troll_coins || 0),
      });
    }
  }, [user?.id]);

  const fetchLots = useCallback(async (auctionShowId: string) => {
    const { data, error } = await supabase
      .from('auction_lots')
      .select(`
        id,
        auction_show_id,
        title,
        description,
        image_url,
        starting_bid,
        bid_increment,
        current_highest_bid,
        current_highest_bidder_id,
        status,
        countdown_end_at,
        order_index,
        reserve_price,
        buy_now_price,
        condition,
        quantity
      `)
      .eq('auction_show_id', auctionShowId)
      .order('order_index', { ascending: true });

    if (error) {
      console.error('[LiveAuctionMiniWindow] Failed to fetch lots:', error);
      return;
    }

    setLots((data || []) as AuctionLot[]);
  }, []);

  const fetchLiveState = useCallback(async () => {
    if (!auction.id) return;

    try {
      const { data, error } = await supabase.rpc('get_live_auction_state', {
        p_show_id: auction.id,
      });

      if (error) throw error;

      const state = data as LiveAuctionStateRpc | null;

      if (state?.current_lot) setCurrentLot(state.current_lot);
      if (Array.isArray(state?.recent_bids)) setBids(state.recent_bids);
      if (typeof state?.viewer_count === 'number') setViewerCount(state.viewer_count);
    } catch (error) {
      console.warn('[LiveAuctionMiniWindow] get_live_auction_state failed:', error);
    }
  }, [auction.id]);

  const placeBid = useCallback(async () => {
    if (!auction.id || !currentLot || !user?.id) {
      toast.error('You must be logged in to bid');
      return;
    }

    const bidValue = Number.parseInt(bidAmount, 10);

    if (!Number.isFinite(bidValue) || bidValue <= 0) {
      setBidStatus('error');
      setBidError('Enter a valid bid amount');
      window.setTimeout(() => setBidStatus('idle'), 3000);
      return;
    }

    if (currentLot.status !== 'live') {
      setBidStatus('error');
      setBidError('This lot is not accepting bids');
      window.setTimeout(() => setBidStatus('idle'), 3000);
      return;
    }

    if (bidValue < minimumBid) {
      setBidStatus('error');
      setBidError(`Minimum bid is ${formatCoins(minimumBid)} coins`);
      window.setTimeout(() => setBidStatus('idle'), 3000);
      return;
    }

    if (Number(userProfile?.troll_coins || 0) < MIN_COINS_TO_BID) {
      setBidStatus('error');
      setBidError(`Minimum ${formatCoins(MIN_COINS_TO_BID)} coins required to bid`);
      window.setTimeout(() => setBidStatus('idle'), 3000);
      return;
    }

    try {
      const { data, error } = await supabase.rpc('place_bid', {
        p_show_id: auction.id,
        p_lot_id: currentLot.id,
        p_bid_amount: bidValue,
      });

      if (error) throw error;

      const result = data as PlaceBidResult;

      if (result && result.accepted === false) {
        setBidStatus('error');
        setBidError(result.reason || 'Bid failed');
        window.setTimeout(() => setBidStatus('idle'), 3000);
        return;
      }

      setBidStatus('success');
      setBidAmount('');
      await Promise.all([fetchLiveState(), fetchUserProfile()]);
      window.setTimeout(() => setBidStatus('idle'), 2000);
    } catch (error: any) {
      console.error('[LiveAuctionMiniWindow] Bid failed:', error);
      setBidStatus('error');
      setBidError(error?.message || 'Failed to place bid');
      window.setTimeout(() => setBidStatus('idle'), 3000);
    }
  }, [auction.id, bidAmount, currentLot, fetchLiveState, fetchUserProfile, minimumBid, user?.id, userProfile?.troll_coins]);

  const _quickBid = useCallback((extra: number) => {
    setBidAmount(String(minimumBid + extra));
  }, [minimumBid]);

  useEffect(() => {
    if (!auction.id) return;

    const fetchInitialData = async () => {
      setLoading(true);
      try {
        await Promise.all([
          fetchLots(auction.id),
          fetchLiveState(),
          fetchUserProfile(),
        ]);
      } finally {
        setLoading(false);
      }
    };

    fetchInitialData();

    // Poll every 30 seconds for updates
    const interval = setInterval(() => {
      fetchLiveState();
      fetchUserProfile();
    }, 30000);

    return () => clearInterval(interval);
  }, [auction.id, fetchLots, fetchLiveState, fetchUserProfile]);

  if (loading) {
    return (
      <div className="rounded-2xl border border-cyan-300/20 bg-slate-950/65 p-4">
        <div className="flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-cyan-300 rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (!auction) {
    return null;
  }

  return (
    <div
      className={cn(
        'rounded-2xl border border-cyan-300/20 bg-slate-950/65 p-4 cursor-pointer hover:bg-slate-950/75 transition-colors',
        'group'
      )}
      onClick={() => navigate(`/auctions/${auction.id}`)}
    >
      {/* Auction Title */}
      <div className="mb-3">
        <h3 className="font-black text-white text-sm truncate">
          {auction.title}
        </h3>
        <p className="text-xs text-slate-400 mt-1">
          {auction.status === 'live' ? 'LIVE' : auction.status}
        </p>
      </div>

      {/* Current Lot */}
      {currentLot ? (
        <div className="space-y-3">
          {currentLot.image_url && (
            <img
              src={currentLot.image_url}
              alt={currentLot.title}
              className="w-full h-24 object-cover rounded-xl border border-white/10"
            />
          )}
          <h4 className="font-black text-white text-sm truncate">
            {currentLot.title}
          </h4>
          <div className="flex items-center gap-2 text-xs">
            <Coins className="w-4 h-4" />
            <span className="font-black text-cyan-200">
              {formatCoins(currentLot.current_highest_bid || currentLot.starting_bid)}
            </span>
          </div>
        </div>
      ) : (
        <div className="text-xs text-slate-400 text-center py-4">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-cyan-500/20 mb-2">
            <AlertCircle className="w-5 h-5 text-cyan-300" />
          </div>
          <p className="font-medium text-cyan-200">Auction in Progress</p>
          <p className="mt-1 text-[10px] text-slate-500">Waiting for first lot...</p>
        </div>
      )}

      {/* Bidding Section */}
      {currentLot?.status === 'live' && !isAuctioneer && (
        <div className="mt-4 space-y-2">
          <div className="flex items-center gap-2 text-xs">
            <Coins className="w-4 h-4" />
            <span className="font-black">
              Your Balance: {formatCoins(userProfile?.troll_coins)} coins
            </span>
          </div>

          {canBid ? (
            <>
              <span className="flex items-center gap-1 text-cyan-300 text-xs font-bold">
                <CheckCircle className="w-3 h-3" /> Eligible to bid
              </span>

              <div className="mt-2 flex gap-2">
                <input
                  type="number"
                  value={bidAmount}
                  onChange={(e) => setBidAmount(e.target.value)}
                  placeholder={`Min: ${formatCoins(minimumBid)}`}
                  className="flex-1 py-2 px-3 rounded-xl bg-slate-950/80 border border-cyan-300/20 text-white outline-none focus:border-cyan-300"
                  onClick={(e) => e.stopPropagation()} // Prevent triggering the container's onClick
                />
                <button
                  onClick={placeBid}
                  disabled={!bidAmount || !canBid}
                  className="px-3 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-400 hover:to-purple-400 text-white font-black"
                >
                  Bid
                </button>
              </div>

              {bidStatus === 'success' && (
                <div className="mt-2 p-2 rounded-xl bg-cyan-400/10 border border-cyan-300/30 flex items-center gap-2 text-cyan-200">
                  <CheckCircle className="w-4 h-4" />
                  Bid accepted!
                </div>
              )}

              {bidStatus === 'error' && (
                <div className="mt-2 p-2 rounded-xl bg-red-500/10 border border-red-400/30 flex items-center gap-2 text-red-200">
                  <AlertCircle className="w-4 h-4" />
                  {bidError}
                </div>
              )}
            </>
          ) : (
            <span className="flex items-center gap-1 text-red-300 text-xs font-bold">
              <XCircle className="w-3 h-3" /> Need {formatCoins(MIN_COINS_TO_BID)}+ coins
            </span>
          )}
        </div>
      )}

      {/* Video Indicator */}
      {!isAuctioneer && (
        <div className="mt-3 flex items-center gap-2 text-xs">
          <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
          <span className="font-black">
            {viewerCount} watching
          </span>
        </div>
      )}

      {/* Overlay for click effect */}
      <div className="absolute inset-0" />
    </div>
  );
}