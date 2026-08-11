// TypeScript types for Earnings System

export interface EarningsView {
  id: string
  username: string
  total_earned_coins: number
  troll_coins: number
  current_month_earnings: number
  current_month_transactions: number
  current_month_paid_out: number
  current_month_pending: number
  current_month_approved: number
  current_month_paid_count: number
  current_month_pending_count: number
  yearly_paid_usd: number
  yearly_payout_count: number
  tax_year: number
  irs_threshold_status: 'over_threshold' | 'nearing_threshold' | 'below_threshold'
  last_payout_at: string | null
  pending_requests_count: number
  lifetime_paid_usd: number
}

export interface MonthlyEarnings {
  month: string
  coins_earned_from_gifts: number
  gift_count: number
  unique_gifters: number
  troll_coins_earned: number
}

export interface PayoutRequest {
  id: string
  user_id: string
  cash_amount: number
  coins_redeemed: number
  status: 'pending' | 'approved' | 'paid' | 'rejected'
  created_at: string
  processed_at: string | null
  admin_id: string | null
  notes: string | null
}

export interface RequestPayoutResponse {
  success: boolean
  payout_request_id?: string
  updated_balance?: number
  error?: string
}

// Universal Earning Event Types
export interface UserEarningEvent {
  id: string
  user_id: string
  role_key: string
  role_label: string
  source_type: string
  source_id: string | null
  amount_coins: number
  percent_rate: number
  status: 'pending' | 'approved' | 'paid' | 'skipped' | 'failed' | 'cancelled'
  paid_at: string | null
  payout_run_id: string | null
  details: Record<string, any>
  created_at: string
}

// Role Earning Rules
export interface RoleEarningRule {
  id: string
  role_key: string
  role_label: string
  earning_type: string
  amount_coins: number
  percent_rate: number
  source_type: string | null
  requirement_text: string | null
  application_route: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

// User Earning Summary
export interface UserEarningSummary {
  user_id: string
  total_earned_coins: number
  pending_coins: number
  week_earned_coins: number
  month_earned_coins: number
  last_paid_at: string | null
  total_events: number
  pending_events: number
  paid_events: number
}

// Agency Earnings
export interface AgencyEarningsData {
  agency_id: string
  agency_name: string
  agency_role: 'owner' | 'manager' | 'creator' | null
  contract_status: string | null
  split_percent: number | null
  applies_to: string | null
  pending_agency_earnings: number
  paid_agency_earnings: number
  application_fee_status: boolean
  monthly_agency_fee_status: boolean
  agency_application_status: string | null
}

// Family Conversion Data
export interface FamilyConversionData {
  family_id: string | null
  family_name: string | null
  member_count: number
  is_leader: boolean
  conversion_eligible: boolean
  conversion_status: string | null
  pending_application: boolean
}

// Treasury Payout Item
export interface TreasuryPayoutItem {
  id: string
  payout_run_id: string
  user_id: string
  role_key: string
  amount_coins: number
  status: 'pending' | 'paid' | 'skipped' | 'failed'
  details: Record<string, any>
  created_at: string
  paid_at: string | null
  run_week_start: string
  run_week_end: string
}

// Role Status Types
export type RoleStatus = 'active' | 'pending' | 'locked' | 'eligible' | 'inactive'

