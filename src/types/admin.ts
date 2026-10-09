export interface SecretaryAssignment {
  id: string
  secretary_id: string
  assigned_by: string
  created_at: string
}

export interface ExecutiveIntake {
  id: string
  created_at: string
  category: string
  severity: 'low' | 'normal' | 'high' | 'critical'
  status: 'open' | 'in_review' | 'resolved' | 'escalated'
  assigned_secretary: string | null
  secretary_notes: string | null
  escalated_to_admin: boolean
  description: string
  submitted_by?: string
  title: string
}

export interface ExecutiveReport {
  id: string
  title: string
  summary: string
  report_date: string
  created_by: string
  reviewed_by_admin: boolean
  created_at: string
}

export interface CashoutRequest {
  id: string
  user_id: string
  coin_amount: number
  tier: string
  status: 'pending' | 'approved' | 'processing' | 'fulfilled' | 'failed' | 'denied'
  requested_at: string
  approved_by: string | null
  approved_at: string | null
  notes?: string
}

export interface GiftCardFulfillment {
  id: string
  cashout_request_id: string
  provider: string
  amount_usd: number
  purchase_reference: string | null
  giftcard_code: string | null
  giftcard_link: string | null
  delivered_to_user: string | null
  delivered_at: string | null
  fulfillment_status: 'pending' | 'completed' | 'failed'
  failure_reason: string | null
  created_at: string
}

export interface CriticalAlert {
  id: string
  user_id?: string | null
  data?: Record<string, unknown> | null
  created_at: string
  message: string
  severity: 'critical' | 'high' | 'warning' | 'info' | string
  resolved: boolean
  resolved_by: string | null
  resolved_at: string | null
  source: string | null
}

export interface RoleChangeLog {
  id: string
  target_user: string
  changed_by: string
  old_role: string
  new_role: string
  reason: string
  created_at: string
}

export interface OfficerBadge {
  user_id: string
  badge_type: string
  awarded_at: string
  awarded_by: string
}
