// TypeScript types for Trollifications (Notifications System)

// ACCOUNT / SECURITY
export type NotificationType =
  // ACCOUNT / SECURITY
  | 'new_login_detected'
  | 'password_changed'
  | 'email_changed'
  | 'profile_updated'
  | 'profile_picture_updated'
  | 'cover_photo_updated'
  | 'account_warning'
  | 'account_restriction_started'
  | 'account_restriction_expired'

  // JAIL / RESTRICTIONS
  | 'jail_sentence_started'
  | 'jail_release_reminder'
  | 'jail_release_completed'
  | 'jail_status_changed'
  | 'jail_insurance_purchased'
  | 'jail_insurance_expiring_soon'
  | 'jail_insurance_expired'
  | 'get_out_of_jail_coin_won'
  | 'get_out_of_jail_coin_used'
  | 'get_out_of_jail_coin_denied'
  | 'inmate_message_received'

  // BROADCAST / LIVE
  | 'someone_you_follow_went_live'
  | 'your_stream_started'
  | 'your_stream_ended'
  | 'stream_disconnected'
  | 'invited_to_cohost'
  | 'cohost_invite_accepted'
  | 'cohost_invite_declined'
  | 'removed_from_cohost'
  | 'broadofficer_assigned'
  | 'broadofficer_removed'
  | 'chat_disabled'
  | 'kicked_from_live'
  | 'restricted_from_live'
  | 'live_received_report'
  | 'live_ended_by_staff'

  // STAGE PASS / LIVE GUEST SYSTEM
  | 'stage_pass_opened'
  | 'stage_pass_requested'
  | 'stage_pass_approved'
  | 'stage_pass_denied'
  | 'stage_pass_removed'
  | 'stage_pass_live_started'
  | 'stage_pass_live_ended'

  // CHAT / SOCIAL
  | 'new_private_message'
  | 'message_request_received'
  | 'someone_replied'
  | 'someone_mentioned'
  | 'someone_followed'
  | 'friend_request_received'
  | 'request_accepted'
  | 'utromail_received'
  | 'utromail_request'
  | 'academy_mail'
  | 'government_mail'

  // MAI PIKS
  | 'maipiks_new_post'
  | 'maipiks_new_story'
  | 'maipiks_screenshot'

  // GIFTS / COINS / WALLET
  | 'gift_received'
  | 'gift_sent'
  | 'large_gift_received'
  | 'coin_purchase_success'
  | 'mkey_invite'
  | 'mkey_boost_complete'
  | 'coin_purchase_failed'
  | 'bonus_coins_added'
  | 'daily_reward_available'
  | 'daily_reward_claimed'
  | 'cashout_submitted'
  | 'cashout_approved'
  | 'cashout_rejected'
  | 'cashout_paid'
  | 'cashout_hold_placed'
  | 'cashout_hold_removed'
  | 'wallet_adjustment'
  | 'refund_issued'

   // HYPE COINS
   | 'hype_coin_earned'
   | 'hype_coin_daily_cap_reached'
   | 'hype_coin_weekly_cap_reached'
   | 'hype_coins_converted'
   | 'hype_coin_adjustment'

   // KEYS TO THE CITY
   | 'key_received'
   | 'key_trade_request'
   | 'key_trade_accepted'
   | 'key_trade_declined'
   | 'key_sale_listed'
   | 'key_sale_completed'
   | 'key_cashout_available'
   | 'key_cashed_out'
   | 'maitroll_set_completed'

  // COURT / CITY GOVERNANCE
  | 'court_case_opened'
  | 'added_to_case'
  | 'court_hearing_scheduled'
  | 'hearing_starting_soon'
  | 'judge_assigned'
  | 'attorney_assigned'
  | 'evidence_submitted'
  | 'verdict_issued'
  | 'sentence_issued'
  | 'fine_assigned'
  | 'fine_paid'
  | 'license_suspension_started'
  | 'license_suspension_ended'
  | 'appeal_submitted'
| 'appeal_decision'

  // TRMAIL NOTIFICATIONS
    | 'tromail_received'
    | 'tromail_important'
    | 'team_meeting_scheduled'
    | 'team_meeting_rescheduled'
    | 'team_meeting_cancelled'
    | 'team_meeting_started'

  // SURVEY
  | 'survey'

   // AUCTIONS / MARKETPLACE
   | 'auction_starting_soon'
  | 'seller_you_follow_auction'
  | 'you_placed_bid'
  | 'you_were_outbid'
  | 'you_won_auction'
  | 'you_lost_auction'
  | 'payment_required'
  | 'payment_confirmed'
  | 'seller_shipped'
  | 'tracking_added'
  | 'order_delivered'
  | 'mystery_box_assigned'
  | 'mystery_box_opened_live'
  | 'dispute_opened'
  | 'dispute_resolved'
  | 'seller_rating_received'
  | 'buyer_rating_received'

  // FAMILIES / NEIGHBORHOODS
  | 'family_invite_received'
  | 'family_invite_accepted'
  | 'family_role_changed'
  | 'family_xp_milestone'
  | 'neighborhood_event_started'
  | 'family_challenge_started'
  | 'family_challenge_completed'

  // STORE / INVENTORY
  | 'purchase_successful'
  | 'purchase_failed'
  | 'item_unlocked'
  | 'entrance_effect_activated'
  | 'theme_purchased'
  | 'theme_equipped'
  | 'vip_perk_unlocked'
  | 'subscription_renewed'
  | 'subscription_expired'

   // CROWN REDEMPTIONS
   | 'crown_redemption_submitted'
   | 'crown_redemption_approved'
   | 'crown_redemption_fulfilled'
   | 'crown_redemption_rejected'
   | 'crown_redemption_cancelled'

   // CAREER / JOB APPLICATIONS
   | 'career_application_submitted'
   | 'application_submitted'

  // INTERVIEWS
  | 'interview_scheduled'
  | 'interview_scheduled_staff'
  | 'interview_started'

  // NEW USER SIGNUP (admin alerts)
  | 'new_user_signup'

  // ADDITIONAL TYPES USED ACROSS APP
  | 'message'
  | 'stream_live'
  | 'coin_gifted'
  | 'coin_received'
  | 'system_announcement'
  | 'support_ticket'
  | 'contract_signed'
  | 'contract_rejected'
  | 'moderation_action'
  | 'officer_update'
  | 'seller_tier_upgrade'
  | 'seller_tier_downgrade'
  | 'paid_message_received'
  | 'join_approved'
  | 'moderation_alert'
  | 'new_follower'
  | 'support_reply'
  | 'payout_update'
  | 'role_update'
  | 'role_invite_received'
  | 'role_invite_accepted'
  | 'role_invite_declined'
  | 'application_result'
  | 'troll_drop'
  | 'purchase'
  | 'gift'
  | 'chat'
  | 'broadcast'
  | 'create'
  | 'delete'
  | 'payment'
  | 'withdraw'
  | 'edit'
  | 'any'
  | 'report_filed'
  | 'user_kicked'
  | 'user_arrested'
  | 'court_started'
  | 'coin_purchase_admin_alert';

export interface Notification {
  id: string
  user_id: string
  type: NotificationType
  title: string
  message: string
  metadata: NotificationMetadata
  is_read: boolean
  is_dismissed?: boolean
  created_at: string
  username?: string
  avatar_url?: string
}

export interface NotificationMetadata {
  action_url?: string

  // User / actor
  actor_id?: string
  actor_username?: string
  actor_avatar_url?: string

  // Follow / live notification
  followed_user_id?: string
  followed_username?: string
  followed_avatar_url?: string

  // Gift related
  gift_id?: string
  gift_name?: string
  sender_id?: string
  sender_username?: string
  sender_glowing_color?: string
  coins_spent?: number

  // Stream related
  stream_id?: string
  stream_title?: string
  broadcaster_id?: string
  broadcaster_username?: string
  broadcaster_avatar_url?: string

  // Stage Pass
  stage_pass_id?: string
  stage_index?: number
  stage_pass_status?: 'open' | 'requested' | 'approved' | 'denied' | 'removed' | 'live' | 'expired'
  price_coins?: number
  paid_amount?: number

  // Badge related
  badge_id?: string
  earned_at?: string

  // Payout related
  payout_id?: string
  status?: string
  amount?: number
  cash_amount?: number

  // Hype Coins
  hype_coin_amount?: number
  hype_coins_balance?: number
  daily_earned?: number
  daily_cap?: number
  weekly_earned?: number
  weekly_cap?: number
  conversion_rate?: number
  converted_troll_coins?: number

  // Moderation
  action_id?: string
  action_type?: string
  reason?: string

  // Battle
  battle_id?: string
  winner_id?: string
  coins_earned?: number

  // Court/Jail
  case_id?: string
  docket_id?: string
  fine_amount?: number
  evidence_id?: string
  appeal_id?: string
  decision?: string
  jail_sentence_id?: string
  jail_release_id?: string

  // Jail Insurance / Jail Inventory
  jail_insurance_id?: string
  jail_insurance_expires_at?: string
  get_out_of_jail_coin_id?: string
  get_out_of_jail_coin_balance?: number

   // Auction/Marketplace
   order_id?: string
   listing_id?: string
   bid_amount?: number
   tracking_number?: string
   dispute_id?: string
   rating?: number

   // Keys to the City
   key_instance_id?: string
   key_letter?: string
   key_rarity?: string
   key_value?: number
   is_key_to_city?: boolean
   trade_request_id?: string
   from_username?: string
   to_username?: string

   // Family
  family_id?: string
  role?: string
  xp_milestone?: number

  // Store
  item_id?: string
  order_number?: string

  // Referral
  referred_user_id?: string

   application_id?: string
   position_id?: string
   position_title?: string

   [key: string]: any
 }
