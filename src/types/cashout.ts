// Types for Enhanced Cashout System
import { UserProfile } from '../lib/supabase';

export type PayoutMethod = 'cash_app' | 'paypal' | 'venmo' | 'ach' | 'check';

export type CashoutStatus = 'pending' | 'processing' | 'approved' | 'completed' | 'denied' | 'submitted';

export interface CashoutRequest {
  id: string;
  user_id: string;
  coins_reserved: number;
  eligible_gift_coins_used: number;
  fee_percentage: number;
  fee_coins: number;
  net_coins: number;
  usd_amount: number;
  status: CashoutStatus;
  payout_method: PayoutMethod | null;
  payout_details: string | null;
  id_verification_url: string | null;
  id_verification_uploaded_at: string | null;
  receipt_url: string | null;
  receipt_uploaded_at: string | null;
  admin_notes: string | null;
  rejection_reason: string | null;
  opened_by_admin_id: string | null;
  opened_at: string | null;
  prior_status: string | null;
  cashout_type: 'gift' | 'admin_override';
  created_at: string;
  updated_at: string;
  processed_at: string | null;
  processed_by: string | null;
}

export interface CashoutDocument {
  id: string;
  cashout_request_id: string;
  document_type: 'id_verification' | 'payment_receipt' | 'admin_notes';
  file_url: string;
  file_name: string | null;
  mime_type: string | null;
  file_size: number | null;
  uploaded_by: string;
  uploaded_at: string;
  is_active: boolean;
  metadata: Record<string, any>;
}

export interface GiftBreakdown {
  sender_id: string;
  sender_username: string;
  total_coins: number;
  gift_count: number;
  coin_type: 'paid' | 'free';
  is_eligible: boolean;
  is_manually_verified: boolean;
  verified_by: string | null;
  verified_at: string | null;
  notes: string | null;
}

export interface CashoutDetails {
  success: boolean;
  cashout: {
    id: string;
    user_id: string;
    username: string;
    coins_redeemed: number;
    eligible_gift_coins_used: number;
    fee_coins: number;
    net_coins: number;
    usd_amount: number;
    status: CashoutStatus;
    payout_method: PayoutMethod | null;
    payout_provider_username: string | null;
    id_verification_url: string | null;
    id_verification_uploaded_at: string | null;
    receipt_url: string | null;
    receipt_uploaded_at: string | null;
    admin_notes: string | null;
    opened_by_admin_id: string | null;
    opened_at: string | null;
    rejection_reason: string | null;
    requested_at: string;
    processed_at: string | null;
    processed_by: string | null;
  };
  user: {
    id: string;
    username: string;
    email?: string;
    troll_coins: number;
    reserved_troll_coins: number;
    available_coins: number;
  };
  gift_breakdown: GiftBreakdown[];
  summary: {
    total_gift_coins: number;
    distinct_senders: number;
    eligible_gift_coins: number;
    eligible_for_cashout: boolean;
  };
}

export interface EligibleCoinsResult {
  total_eligible_coins: number;
  gift_summary: JSON;
  breakdown: GiftBreakdown[];
}

export interface RequestCashoutResponse {
  success: boolean;
  cashout_id?: string;
  coins_reserved?: number;
  fee_coins?: number;
  net_coins?: number;
  usd_amount?: number;
  eligible_coins?: number;
  error?: string;
}

export interface ProcessCashoutResponse {
  success: boolean;
  status?: CashoutStatus;
  action?: string;
  error?: string;
}

// Extended CashoutTier with fee info
export interface CashoutTier {
  id: string;
  coin_amount: number;
  cash_amount: number;
  currency: string;
  processing_fee_percentage: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export const FAST_PAY_FEE_PERCENT = 5;

export const FAST_PAY_MIN_LEVEL = 500;
export const INSTANT_PAY_MIN_LEVEL = 1000;
export const FAST_PAY_MIN_ACCOUNT_AGE_DAYS = 30;

export const FAST_PAY_REQUIREMENTS = [
  {
    key: 'verified_identity',
    label: 'Verified identity',
    description: 'You must verify your identity to use Fast Pay/Instant Pay.',
  },
  {
    key: 'no_violations',
    label: 'No active violations',
    description: 'Your account must not have active violations.',
  },
  {
    key: 'account_age',
    label: 'Account aged',
    description: 'Your account must be at least 30 days old.',
  },
  {
    key: 'good_standing',
    label: 'Good standing',
    description: 'Maintain good community standing.',
  },
  {
    key: 'no_fraud',
    label: 'No fraud/chargeback',
    description: 'Resolve any fraud/chargeback issues.',
  },
] as const;

export type FastPayTier = 'standard' | 'fast_pay' | 'instant';

export function getFastPayTier(userLevel: number): FastPayTier {
  if (userLevel >= INSTANT_PAY_MIN_LEVEL) return 'instant';
  if (userLevel >= FAST_PAY_MIN_LEVEL) return 'fast_pay';
  return 'standard';
}

export function getFastPayTierLabel(tier: FastPayTier): string {
  switch (tier) {
    case 'instant':
      return 'Instant Pay';
    case 'fast_pay':
      return 'Fast Pay';
    default:
      return 'Standard';
  }
}

export function getFastPayTierDescription(tier: FastPayTier): string {
  switch (tier) {
    case 'instant':
      return 'Instant • Every 60 Minutes • Priority';
    case 'fast_pay':
      return 'Fast Pay • Every 24 Hrs • Within 24h';
    default:
      return 'Standard • Paid on request';
  }
}

export function getFastPayProcessingTime(tier: FastPayTier): string {
  switch (tier) {
    case 'instant':
      return 'Instant';
    case 'fast_pay':
      return 'Within 24h';
    default:
      return 'On request';
  }
}

export function getFastPayMaxCashouts(tier: FastPayTier): number {
  switch (tier) {
    case 'instant':
      return 6;
    case 'fast_pay':
      return 3;
    default:
      return 1;
  }
}

export function getFastPayTierInfo(_userLevel: number): {
  tier: FastPayTier;
} {
  return { tier: getFastPayTier(_userLevel) };
}

