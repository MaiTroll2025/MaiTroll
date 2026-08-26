// src/lib/auctionMe.ts
// Frontend utilities for MaiTroll Auction Me

import { supabase } from './supabase';

export type AuctionMeTitleType = 'husband' | 'wife';
export type AuctionMeStatus = 'active' | 'ended' | 'cancelled';

export interface AuctionMeSession {
  auction_me_session_id: string;
  auction_me_stream_id: string;
  auction_me_broadcaster_id: string;
  auction_me_title_type: AuctionMeTitleType;
  auction_me_starting_bid: number;
  auction_me_current_bid: number;
  auction_me_current_bidder_id: string | null;
  auction_me_current_bidder_name: string | null;
  auction_me_status: AuctionMeStatus;
  auction_me_started_at: string;
  auction_me_ends_at: string;
  auction_me_ended_at: string | null;
}

export interface AuctionMeBid {
  auction_me_bid_id: string;
  auction_me_session_id: string;
  auction_me_bidder_id: string;
  auction_me_bid_amount: number;
  auction_me_created_at: string;
}

export interface AuctionMeWinner {
  auction_me_winner_id: string;
  auction_me_session_id: string;
  auction_me_winner_user_id: string;
  auction_me_winner_name: string;
  auction_me_final_bid: number;
  auction_me_title: string;
  created_at: string;
}

export interface AuctionMeState {
  success: boolean;
  active: boolean;
  error?: string;
  session_id?: string;
  broadcaster_id?: string;
  broadcaster_name?: string;
  title_type?: AuctionMeTitleType;
  starting_bid?: number;
  current_bid?: number;
  current_bidder_id?: string | null;
  current_bidder_name?: string | null;
  ends_at?: string;
  top_bids?: Array<{
    bidder_id: string;
    bidder_name: string;
    amount: number;
    created_at: string;
  }>;
}

export async function startAuctionMe(
  streamId: string,
  broadcasterId: string,
  titleType: AuctionMeTitleType,
  startingBid: number
): Promise<{ success: boolean; data?: AuctionMeState; error?: string }> {
  const { data, error } = await supabase.rpc('start_auction_me', {
    p_stream_id: streamId,
    p_broadcaster_id: broadcasterId,
    p_title_type: titleType,
    p_starting_bid: startingBid,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, data: data as AuctionMeState };
}

export async function placeAuctionMeBid(
  sessionId: string,
  bidAmount: number
): Promise<{ success: boolean; data?: AuctionMeState; error?: string }> {
  const { data, error } = await supabase.rpc('place_auction_me_bid', {
    p_session_id: sessionId,
    p_bid_amount: bidAmount,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, data: data as AuctionMeState };
}

export async function endAuctionMe(
  sessionId: string
): Promise<{ success: boolean; data?: any; error?: string }> {
  const { data, error } = await supabase.rpc('end_auction_me', {
    p_session_id: sessionId,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, data };
}

export async function cancelAuctionMe(
  sessionId: string
): Promise<{ success: boolean; data?: any; error?: string }> {
  const { data, error } = await supabase.rpc('cancel_auction_me', {
    p_session_id: sessionId,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, data };
}

export async function getAuctionMeState(
  streamId: string
): Promise<AuctionMeState> {
  const { data, error } = await supabase.rpc('get_auction_me_state', {
    p_stream_id: streamId,
  });

  if (error || !data) {
    return { success: false, active: false, error: error?.message };
  }

  return data as AuctionMeState;
}

export function getTimeRemaining(endsAt: string): number {
  const now = new Date();
  const end = new Date(endsAt);
  return Math.max(0, Math.floor((end.getTime() - now.getTime()) / 1000));
}

export function formatTimeRemaining(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}
