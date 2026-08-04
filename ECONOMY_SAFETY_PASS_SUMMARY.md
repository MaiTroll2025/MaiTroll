# Mai Troll ECONOMY SAFETY PASS — IMPLEMENTATION SUMMARY

**Migration File:** `supabase/migrations/20290606000000_economy_safety_pass.sql`

---

## NEW DATABASE TABLES

### 1. `platform_economy_settings`
Central admin control panel for all economy caps and toggles.

| Setting | Default | Description |
|---------|---------|-------------|
| `signup_bonus_enabled` | `false` | Enable/disable signup bonus |
| `signup_bonus_coins` | `100` | Max 100 coins on signup |
| `new_user_cashout_bonus_enabled` | `false` | Enable first-10 promo |
| `new_user_cashout_bonus_percent` | `15.00%` | Cashout bonus % |
| `new_user_cashout_bonus_max_users` | `10` | Max promo users |
| `new_user_cashout_bonus_used_count` | `0` | Current promo users used |
| `new_user_cashout_bonus_max_per_user_coins` | `100000` | Per-user cap |
| `friday_battle_bonus_cap_coins` | `1000` | Per-gifter per-battle cap |
| `league_reward_cap_coins` | `1000` | Total league reward cap |
| `level_reward_cap_coins` | `500` | Level reward cap |
| `giveaway_reward_budget_percent` | `10.00%` | % of revenue for rewards |
| `global_reward_system_enabled` | `true` | Master on/off switch |
| `require_revenue_pool_check` | `true` | Enforce budget checks |

### 2. `cashout_bonus_grants`
Tracks all manual and promo cashout bonuses.

| Column | Description |
|--------|-------------|
| `bonus_type` | `manual_flat`, `manual_percent`, `new_user_promo` |
| `status` | `pending`, `applied`, `voided` |
| `base_cashout_balance_coins` | User's cashout balance at time of grant |
| `bonus_coins` | Calculated bonus amount |
| `reason` | Admin note |

**Unique constraint** prevents duplicate pending bonuses per user+type.

### 3. `platform_reward_pool`
Tracks revenue sources and reward budget consumption per period.

| Column | Description |
|--------|-------------|
| `revenue_source` | `coin_purchase_fee`, `auction_service_fee`, `agency_creation_fee`, `agency_monthly_fee`, `bail_bill`, `featured_broadcast`, `featured_post`, `featured_podcast`, `featured_auction`, `marketplace_fee`, `other_sink` |
| `revenue_coins` | Revenue collected |
| `used_reward_budget_coins` | Rewards consumed |
| `period_start/end` | Monthly period |

---

## NEW RPC FUNCTIONS

### Admin Functions (require admin/CEO role)

| Function | Purpose |
|----------|---------|
| `admin_get_economy_settings(admin_id)` | Get all economy settings |
| `admin_update_economy_settings(admin_id, settings_jsonb)` | Update economy settings |
| `admin_grant_cashout_bonus(admin_id, user_id, type, value, reason)` | Manual cashout bonus |
| `admin_void_cashout_bonus(admin_id, grant_id)` | Void a pending bonus |
| `admin_get_cashout_bonus_list(admin_id, status)` | List pending/applied bonuses |
| `admin_get_reward_pool_status(admin_id)` | View current reward pool |
| `admin_add_revenue_to_pool(admin_id, source, coins)` | Add revenue to pool |

### User-Facing Functions

| Function | Purpose |
|----------|---------|
| `get_user_cashout_bonus_info(user_id)` | Get cashout balance + bonuses |
| `apply_new_user_cashout_bonus(user_id, cashout_coins)` | Apply first-10 promo |
| `apply_pending_cashout_bonus(grant_id, user_id)` | Apply a pending bonus |
| `check_reward_budget(coins)` | Check if reward is within budget |
| `get_friday_battle_bonus_cap()` | Get per-gifter cap |
| `award_friday_battle_gifter_bonus(gifter_id, battle_id, gift_coins)` | Award 5% with dedup |
| `calculate_league_reward_share(member_count)` | Get per-member share |
| `distribute_league_rewards_capped(event_id, member_ids)` | Distribute capped rewards |
| `calculate_friday_battle_gifter_bonus(gifter_id, battle_id, gift_coins)` | Calculate 5% with cap |

---

## POLICY RULES IMPLEMENTED

### Rule 1: New User Cashout Bonus (NOT Signup Bonus)
- First 10 approved promo users only
- Bonus applies ONLY when they cash out (not at signup)
- 15% of eligible cashout amount (configurable)
- Tracked via `cashout_bonus_grants` table with `bonus_type = 'new_user_promo'`
- Admin can enable/disable, set %, set max users, set per-user cap

### Rule 2: Admin Economy Cap Settings
- All caps in `platform_economy_settings` table
- Accessible via `admin_get_economy_settings` and `admin_update_economy_settings`
- All values have sensible defaults and CHECK constraints

### Rule 3: Manual Admin Cashout Bonus Tool
- `admin_grant_cashout_bonus` supports flat amount or percentage
- Shows user's current cashout-eligible balance
- Requires reason/note
- Duplicate prevention (5-minute window for same user+type)
- Written to `cashout_bonus_grants` with `status = 'pending'`

### Rule 4: Thursday Cashout Bonus Flow
- `admin_get_cashout_bonus_list` shows all pending bonuses
- Admin reviews each user's cashout balance and bonus coins
- Apply via `apply_pending_cashout_bonus`
- Void via `admin_void_cashout_bonus`
- Ledger records written with `type = 'cashout_bonus'`

### Rule 5: Friday Battle Bonus — 5% Per Gifter Per Battle
- `award_friday_battle_gifter_bonus` calculates 5% of gift value per gifter
- Per-gifter per-battle cap enforced (default 1000 coins)
- Idempotency key prevents duplicate awards from refreshes/RPC repeats
- Deducts from `coin_transactions` with `type = 'friday_battle_bonus'`

### Rule 6: League Rewards Capped at 1000 Coins
- `calculate_league_reward_share(member_count)` splits 1000 coins evenly
- 1 member = 1000, 2 = 500 each, 5 = 200 each, 10 = 100 each
- No rounding coins created
- `distribute_league_rewards_capped` handles distribution and budget check

### Rule 7: Revenue-Based Giveaway Protection
- `check_reward_budget(coins)` must be called before any reward grant
- Compares against `platform_reward_pool` for current month
- Default budget = 10% of total platform revenue
- Blocks rewards if budget exhausted
- `consume_reward_budget` tracks usage after successful grant

### Rule 8: Signup Bonus Max 100 Coins
- `handle_new_user_signup` function respects `platform_economy_settings`
- Default: disabled (`signup_bonus_enabled = false`)
- Max 100 coins if enabled
- Existing triggers already grant 0 coins (from migration `20290602000001`)

---

## NEW BONUS/REWARD AMOUNTS

| Type | Old Amount | New Amount |
|------|-----------|------------|
| Signup Bonus | 100 coins (or 250 in older triggers) | 0 (disabled by default) or max 100 if enabled |
| New User Cashout Bonus | N/A (new) | 15% of cashout amount, first 10 users only |
| Friday Battle Gifter Bonus | 2% of coins earned (uncapped) | 5% of gift value per battle, capped at 1000 coins per gifter per battle |
| League Reward | Uncapped | 1000 coins total, split evenly between members |
| Level Reward | 50-500+ coins per level | Capped at 500 coins per reward event (configurable) |
| Giveaway Budget | Uncapped | 10% of platform revenue (configurable) |

---

## WHAT WAS NOT CHANGED (Preserved)

- XP and level progression system
- Gift system (send_gift_in_stream)
- Battle system (end_battle_guarded, finish_random_battle, distribute_battle_winnings)
- Wallet/cashout system (request_cashout_v3, admin_process_cashout_request)
- Auction system
- Agency system
- Daily rewards system (broadcaster/viewer daily rewards)
- Troll Wheel system
- Family achievement system
- Level reward engine (grant_level_rewards_for_user)

---

## ACCEPTANCE CHECKS

- [ ] New users do NOT receive 10,000 signup coins
- [ ] Signup bonus is 0 (disabled) or max 100 coins if admin enables it
- [ ] First-10 promo is applied ONLY as cashout bonus, not signup
- [ ] Admin can set cashout bonus percent
- [ ] Admin can cap how many users receive the promo
- [ ] Admin can manually choose a user and add cashout bonus coins
- [ ] Admin can calculate bonus from user's current cashout coin balance
- [ ] Admin can add a note/reason
- [ ] Manual bonus writes a ledger record
- [ ] Manual bonus cannot duplicate on double click (5-min window)
- [ ] Friday battle coin rewards cannot exceed 1000 coins per gifter per battle
- [ ] League rewards cannot exceed 1000 total coins and split between members
- [ ] Giveaways and bonuses check platform reward budget before issuing coins
- [ ] Existing wallet, cashout, battle, auction, agency, and gift systems still work

---

## HOW TO DEPLOY

1. Run the migration: `supabase migration up` or paste into SQL Editor
2. Admin configures settings via `admin_update_economy_settings`
3. Admin adds revenue to pool via `admin_add_revenue_to_pool`
4. Enable `signup_bonus_enabled` if desired (max 100 coins)
5. Enable `new_user_cashout_bonus_enabled` for first-10 promo
6. Adjust caps as needed for your economy
