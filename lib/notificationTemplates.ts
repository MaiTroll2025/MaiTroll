export const USER_OFFLINE_NOTIFICATIONS = {
  payday: {
    title: '💰 Payday Reminder',
    body: 'Cashout requests are reviewed for Friday payouts. Check your coin progress.',
    type: 'payday',
  },
  hype_coin_reward: {
  title: '⚡ Hype Coin Earned',
  body: 'You earned a Hype Coin from watching a live broadcast.',
  type: 'hype_coin_reward',
},

hype_coin_convert: {
  title: '⚡ Hype Coins Converted',
  body: 'Your Hype Coins were converted into Troll Coins.',
  type: 'hype_coin_convert',
},

stage_pass_requested: {
  title: '🎟️ Stage Pass Requested',
  body: 'Your Stage Pass request was sent to the broadcaster.',
  type: 'stage_pass_requested',
},

stage_pass_approved: {
  title: '🎟️ Stage Pass Approved',
  body: 'Your Stage Pass was approved. You can join the live stage.',
  type: 'stage_pass_approved',
},

stage_pass_denied: {
  title: '🎟️ Stage Pass Update',
  body: 'Your Stage Pass request was not approved for this broadcast.',
  type: 'stage_pass_denied',
},
  battle_day: {
    title: '⚔️ Friday Battle Day',
    body: 'Battle Day is live. Join battles, send gifts, and earn bonus rewards.',
    type: 'battle_day',
  },

  battle_invite: {
    title: '⚔️ Battle Invite',
    body: 'Someone invited you to battle on Mai Troll.',
    type: 'battle_invite',
  },

  gift_received: {
    title: '🎁 You Got Gifted',
    body: 'Someone sent you a gift while you were offline.',
    type: 'gift_received',
  },

  stream_live: {
    title: '🔴 Creator Is Live',
    body: 'A creator you follow just went live.',
    type: 'stream_live',
  },

  auction_update: {
    title: '🏛️ Auction Update',
    body: 'An auction you are watching has new activity.',
    type: 'auction_update',
  },

  court_notice: {
    title: '⚖️ Court Notice',
    body: 'You have a Troll Court update. Check your case status.',
    type: 'court_notice',
  },

  jail_update: {
    title: '🚔 Jail Update',
    body: 'Your jail status has changed. Open Mai Troll to review it.',
    type: 'jail_update',
  },

  new_law: {
    title: '📜 New City Law',
    body: 'A new Mai Troll law or rule update has been posted.',
    type: 'new_law',
  },

  church_notice: {
    title: '⛪ Church Notice',
    body: 'A new church event or message is available in Mai Troll.',
    type: 'church_notice',
  },
} as const

export const STAFF_OFFLINE_NOTIFICATIONS = {
  staff_assignment: {
    title: '📋 New Staff Assignment',
    body: 'You have a new staff task waiting in Mai Troll.',
    type: 'staff_assignment',
  },

  report_received: {
    title: '🚨 New Report',
    body: 'A user report needs staff review.',
    type: 'report_received',
  },

  court_staff_update: {
    title: '⚖️ Court Staff Update',
    body: 'A Troll Court case needs staff attention.',
    type: 'court_staff_update',
  },

  jail_action_needed: {
    title: '🚔 Jail Action Needed',
    body: 'A jail action or appeal needs review.',
    type: 'jail_action_needed',
  },

  officer_call: {
    title: '🚓 Officer Call',
    body: 'An officer action is needed in a live area.',
    type: 'officer_call',
  },

  broadcast_issue: {
    title: '🔴 Broadcast Issue',
    body: 'A broadcast may need staff attention.',
    type: 'broadcast_issue',
  },

  application_review: {
    title: '📝 Application Review',
    body: 'A new role or platform application needs review.',
    type: 'application_review',
  },

  payout_review: {
    title: '💰 Payout Review',
    body: 'A creator cashout request needs staff review.',
    type: 'payout_review',
  },

  rtc_monitor_alert: {
    title: '🧿 RTC Monitor Alert',
    body: 'A system event needs review in the RTC monitor.',
    type: 'rtc_monitor_alert',
  },

  team_meeting_started: {
    title: '👥 Team Meeting Started',
    body: 'A staff meeting has started. Click to join.',
    type: 'team_meeting_started',
  },
} as const

export const ADMIN_OFFLINE_NOTIFICATIONS = {
  new_signup: {
    title: '👤 New User Joined',
    body: 'A new user signed up for Mai Troll.',
    type: 'new_signup',
  },

  payment_alert: {
    title: '💳 Payment Alert',
    body: 'A coin purchase or payment event needs review.',
    type: 'payment_alert',
  },

  payout_alert: {
    title: '💰 Payout Alert',
    body: 'A creator cashout request is waiting for admin review.',
    type: 'payout_alert',
  },

  system_error: {
    title: '⚠️ System Error',
    body: 'A backend or frontend system issue was detected.',
    type: 'system_error',
  },

  webhook_error: {
    title: '🔌 Webhook Error',
    body: 'A webhook failed or needs admin review.',
    type: 'webhook_error',
  },

  security_alert: {
    title: '🛡️ Security Alert',
    body: 'A suspicious account or permission event needs review.',
    type: 'security_alert',
  },

  realtime_alert: {
    title: '📡 Realtime Alert',
    body: 'Realtime activity or subscription behavior needs review.',
    type: 'realtime_alert',
  },

  app_health_alert: {
    title: '🧠 App Health Alert',
    body: 'Mai Troll health monitoring detected something important.',
    type: 'app_health_alert',
  },

  ceo_priority: {
    title: '👑 CEO Priority Alert',
    body: 'A high-priority Mai Troll event needs your attention.',
    type: 'ceo_priority',
  },

  launch_activity: {
    title: '🚀 Launch Activity',
    body: 'Important launch activity is happening right now.',
    type: 'launch_activity',
  },
} as const