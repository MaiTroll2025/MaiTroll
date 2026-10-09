// Grants a small troll-coin reward when a user navigates via the bottom nav
// or sidebar. Fire-and-forget so it never blocks navigation. Applies to both
// new and existing (current) authenticated users.

import { supabase } from './supabase'

const COIN_REWARD = 2
const GLOBAL_COOLDOWN_MS = 600 // guards against accidental double-fires
const TARGET_COOLDOWN_MS = 1500 // limits farming by spam-clicking one item

let lastGrantAt = 0
const lastGrantByTarget = new Map<string, number>()

export function grantNavCoins(target?: string) {
  const now = Date.now()
  if (now - lastGrantAt < GLOBAL_COOLDOWN_MS) return
  if (target) {
    const last = lastGrantByTarget.get(target) || 0
    if (now - last < TARGET_COOLDOWN_MS) return
    lastGrantByTarget.set(target, now)
  }
  lastGrantAt = now

  supabase
    .auth.getUser()
    .then(({ data }) => {
      const userId = data.user?.id
      if (!userId) return
      void Promise.resolve(supabase.rpc('add_troll_coins', { p_user_id: userId, p_amount: COIN_REWARD }))
        .then(() => undefined)
    })
    .catch(() => {})
}
