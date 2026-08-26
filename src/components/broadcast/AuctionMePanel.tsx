// src/components/broadcast/AuctionMePanel.tsx
// Auction Me UI component for broadcast and viewer

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Crown, X, Play, AlertCircle, UserCheck } from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '@/lib/store';
import { useAuctionMe } from '@/hooks/useAuctionMe';
import type { AuctionMeTitleType } from '@/lib/auctionMe';

interface AuctionMePanelProps {
  streamId: string;
  onClose?: () => void;
}

export default function AuctionMePanel({ streamId, onClose }: AuctionMePanelProps) {
  const [selectedTitle, setSelectedTitle] = useState<AuctionMeTitleType>('husband');
  const [startingBid, setStartingBid] = useState(10);
  const { state, timeRemaining, timeRemainingFormatted, loading, error, start, bid, end, cancel, refreshState, isBroadcaster, isHighestBidder } = useAuctionMe(streamId);
  const user = useAuthStore((s) => s.profile);
  const [bidInput, setBidInput] = useState('');

  const handleStart = async () => {
    if (!startingBid || startingBid <= 0) {
      toast.error('Starting bid must be greater than 0');
      return;
    }
    const result = await start(selectedTitle, startingBid);
    if (result.success) {
      toast.success(`Auction Me started! Bid for ${selectedTitle === 'husband' ? 'Husband' : 'Wife'}`);
    } else {
      toast.error(result.error || 'Failed to start auction');
    }
  };

  const handleBid = async () => {
    if (!state?.session_id) return;
    const amount = parseInt(bidInput, 10);
    if (!amount || amount <= (state.current_bid || 0)) {
      toast.error(`Bid must be higher than ${state.current_bid || 0}`);
      return;
    }
    const result = await bid(state.session_id, amount);
    if (result.success) {
      toast.success(`Bid placed: ${amount} Troll Coins!`);
      setBidInput('');
    } else {
      toast.error(result.error || 'Failed to place bid');
    }
  };

  const handleEnd = async () => {
    const result = await end();
    if (result.success) {
      toast.success('Auction ended!');
    }
  };

  const handleCancel = async () => {
    const result = await cancel();
    if (result.success) {
      toast.info('Auction cancelled');
    }
  };

  const getWinnerTitle = () => {
    if (!state?.title_type || !state?.broadcaster_name) return '';
    return `${state.broadcaster_name}'s ${state.title_type === 'husband' ? 'Husband' : 'Wife'}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="w-full max-w-md bg-zinc-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
      >
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <div className="flex items-center gap-2">
            <Crown className="w-5 h-5 text-yellow-400" />
            <h2 className="text-lg font-bold text-white">AUCTION ME</h2>
          </div>
          {onClose && (
            <button onClick={onClose} className="text-zinc-400 hover:text-white transition-colors">
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        <div className="p-4 space-y-4">
          {!state?.active ? (
            <>
              {isBroadcaster && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-zinc-300 mb-2">
                      Choose your title
                    </label>
                    <div className="flex gap-2">
                      {(['husband', 'wife'] as AuctionMeTitleType[]).map((title) => (
                        <button
                          key={title}
                          onClick={() => setSelectedTitle(title)}
                          className={`flex-1 py-3 px-4 rounded-xl border-2 font-bold transition-all ${
                            selectedTitle === title
                              ? 'border-neon-blue bg-neon-blue/20 text-neon-blue'
                              : 'border-white/10 bg-white/5 text-zinc-400 hover:border-white/20'
                          }`}
                        >
                          {title === 'husband' ? 'Husband' : 'Wife'}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-zinc-300 mb-2">
                      Starting Bid (Troll Coins)
                    </label>
                    <input
                      type="number"
                      value={startingBid}
                      onChange={(e) => setStartingBid(parseInt(e.target.value, 10) || 0)}
                      min={1}
                      className="w-full px-4 py-3 bg-black/50 border border-white/10 rounded-xl text-white font-mono focus:border-neon-blue focus:outline-none"
                    />
                  </div>

                  <button
                    onClick={handleStart}
                    disabled={loading}
                    className="w-full py-3 bg-gradient-to-r from-neon-blue to-neon-purple rounded-xl font-bold text-white hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    <Play className="w-5 h-5" />
                    {loading ? 'Starting...' : 'Start Auction Me'}
                  </button>
                </div>
              )}

              {!isBroadcaster && (
                <div className="text-center py-8 text-zinc-400">
                  <Crown className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No active auction in this broadcast</p>
                </div>
              )}

              {isHighestBidder && state && (
                <div className="text-center py-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl">
                  <UserCheck className="w-8 h-8 mx-auto mb-2 text-yellow-400" />
                  <p className="text-yellow-300 font-bold">You are the current highest bidder!</p>
                  <p className="text-yellow-200/70 text-sm mt-1">
                    Bid: {state.current_bid} Troll Coins
                  </p>
                </div>
              )}
            </>
          ) : (
            <>
              <div className="text-center space-y-2">
                <div className="text-sm text-zinc-400 uppercase tracking-wider">
                  {state.title_type === 'husband' ? 'Husband' : 'Wife'} Auction
                </div>
                <div className="text-3xl font-black text-white font-mono">
                  {timeRemainingFormatted}
                </div>
                <div className="text-sm text-zinc-400">
                  Current bid: <span className="text-neon-blue font-bold">{state.current_bid}</span> Troll Coins
                </div>
                {state.current_bidder_name && (
                  <div className="text-sm text-zinc-300">
                    Highest bidder: <span className="text-yellow-400 font-bold">{state.current_bidder_name}</span>
                  </div>
                )}
              </div>

              {isBroadcaster ? (
                <div className="flex gap-2">
                  <button
                    onClick={handleEnd}
                    disabled={loading}
                    className="flex-1 py-2 bg-green-500/20 border border-green-500/30 rounded-xl text-green-400 font-bold hover:bg-green-500/30 transition-colors disabled:opacity-50"
                  >
                    End Auction
                  </button>
                  <button
                    onClick={handleCancel}
                    disabled={loading}
                    className="flex-1 py-2 bg-red-500/20 border border-red-500/30 rounded-xl text-red-400 font-bold hover:bg-red-500/30 transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <input
                      type="number"
                      value={bidInput}
                      onChange={(e) => setBidInput(e.target.value)}
                      placeholder={`Min bid: ${(state.current_bid || 0) + 1}`}
                      min={(state.current_bid || 0) + 1}
                      className="flex-1 px-4 py-2 bg-black/50 border border-white/10 rounded-xl text-white font-mono focus:border-neon-blue focus:outline-none"
                    />
                    <button
                      onClick={handleBid}
                      disabled={loading || !bidInput}
                      className="px-6 py-2 bg-gradient-to-r from-neon-blue to-neon-purple rounded-xl font-bold text-white hover:opacity-90 transition-opacity disabled:opacity-50"
                    >
                      {loading ? 'Bidding...' : 'Bid'}
                    </button>
                  </div>
                  {isHighestBidder && (
                    <div className="text-center text-yellow-400 text-sm font-medium">
                      You are the highest bidder!
                    </div>
                  )}
                </div>
              )}

              {error && (
                <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 p-2 rounded-lg">
                  <AlertCircle className="w-4 h-4" />
                  {error}
                </div>
              )}
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}
