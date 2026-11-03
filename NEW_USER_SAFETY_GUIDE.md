# New User Guide — Safety, Payments, and What We Store

Welcome to Mai Troll. This page explains, in plain language, what happens to your data, your password, and your payments, based on our Supabase database tables.

---

## 1. Your password is safe

- We do **not** store your password in plain text anywhere.
- Authentication is handled by **Supabase Auth**. Passwords are hashed with **bcrypt** (via the `crypt_password` function using PostgreSQL `pgcrypto` with `gen_salt('bf')`) before being stored.
- We previously had a "password-manager" edge function and it has been **removed** (`drop_password_manager_edge_function.sql`) — password resets go through Supabase's standard secure flow.
- Your profile also records login-related data only for security/audit purposes (e.g. `last_known_ip`, `ip_address_history`).

**Bottom line:** nobody — including our staff — can read your password.

---

## 2. Payments — we do not store your full card details

- We do **not** store full credit or debit card numbers.
- Where card data exists, tables such as `user_profiles` and `user_payment_methods` only keep non-sensitive reference fields: provider, brand, `last4`, expiry month/year, and processor customer/card IDs (e.g. Square `square_customer_id`, `square_card_id`, or Stripe customer records in `stripe_customers`).
- Some card-related data is flagged as `encrypted_card_data`; actual card processing is handled by payment processors (Square / Stripe), not by us directly.
- `payment_methods` and `payment_transactions` store JSONB `data` — transaction records, not raw card numbers.
- For payouts to creators, `user_profiles` stores `payout_paypal_email` and a masked payout destination (`payout_destination_masked`) so we know where to send earnings, not so anyone can read your full financial details.

**Bottom line:** your full card number is never stored in our database.

---

## 3. What we actually store about you

From `user_profiles` and related Supabase tables, we store:

- Account basics: `id`, `username`, `email`, `avatar_url`, `bio`, `role`, `tier`, `level`, `xp`
- Coins / currency balances: `total_earned_coins`, `total_spent_coins`, `owc_balance`, `trollmonds`, bonus balances
- Creator / payout info: `payout_method`, `payout_paypal_email`, `lifetime_payout_total`, `total_earned_usd`, `is_creator_onboarded`
- Identity/tax info for creators who request payouts: `legal_full_name`, `tax_id_last4`, `tax_classification`, `w9_status`, address fields
- Safety/moderation flags: `is_banned`, `banned_until`, `ban_reason`, `terms_accepted`, `creator_trust_score`, `is_verified`
- Login/security fields: `last_known_ip`, `ip_address_history`
- Settings and preferences: `message_price`, `profile_theme`, `is_ghost_mode`, etc.

We also maintain:
- `user_reports` — reports filed by users about other users (moderation)
- `moderation_actions` / `moderation_events` / `moderation_reports` — moderation records
- `staff_audit_system` (`staff_actions`) — an audit log of staff/admin actions
- `coin_transactions` — history of coin earnings and spending
- `payment_transactions` — payment records (no full card numbers)

---

## 4. Our plan

- Run the platform on Supabase with Row Level Security (RLS) enabled globally so users can only access their own data.
- Keep payments off our servers: card processing stays with payment processors; we keep only tokens/last4/masked data.
- Maintain human moderation: reports, review queues, troll officers, admins, and an auditable staff action log.
- Keep account security on bcrypt-hashed passwords via Supabase Auth.
- Let users earn coins through platform activity (broadcasting, gifting, events, etc.) and pay out creators to their chosen payout method.

---

## 5. AI and moderation

**AI is used in the app, but NOT for moderating you.**

AI features currently in the codebase:
- **Troll Court** (`src/lib/courtAi.ts`, `supabase/functions/trollcourt-ai`): AI plays Prosecutor / Defense roles in an in-game, roleplay courtroom using OpenAI `gpt-4o-mini` and Gemini `gemini-2.0-flash`. It is explicitly labeled as roleplay — **not legal advice**.
- **Stream AI host** (`trollcity-stream-engine/src/server.ts`): OpenAI `gpt-4o-mini` generates short, fun announcer reactions to live stream events.
- **Translation** (`src/lib/translation.ts`): OpenAI API used for translating messages.

Moderation is **human-run**:
- Users file reports via `user_reports`.
- Staff and troll officers review reports and take moderation actions, recorded in `moderation_actions` and `moderation_reports`.
- Every staff action is written to an audit trail (`staff_actions`) so moderation is accountable and reviewable.
- AI does not ban, mute, or judge users.

---

## 6. Is this a safe platform for a new user?

Based on the code and database design:

- Passwords are hashed; we cannot see them.
- Full payment card numbers are not stored.
- RLS protects your data so other users cannot read your private profile fields.
- There is a working report system and human moderation team with an audit log.
- Banned accounts and ban reasons are tracked (`is_banned`, `ban_reason`, `banned_until`).
- Users must accept terms (`terms_accepted`) before using creator features.

Like any online social platform, you should still follow basic safety practices: use a strong unique password, don't share personal information in public streams, and use the report system if something feels wrong.

---

## 7. Are we running a ponzi scheme or trying to fraud anyone?

**No.** Based on the code and database tables:

- There is **no investment product**. Users do not give us money in exchange for promised returns.
- Coins are earned through platform activity (broadcasting, gifting, events, troll wheel, etc.) or purchased; they are platform currency, not an investment.
- The "founder rewards" system (`founder_rewards`) grants things like badges and fee waivers — not payouts or investment returns.
- Payouts go **from** the platform **to** creators for their content/activity, not from new users to earlier users.
- Payment records exist (`payment_transactions`, `payment_methods`) for actual purchases and payouts, not for an investment scheme.

Nothing in the codebase indicates a ponzi scheme or fraudulent intent. If you ever see something suspicious, report it through the in-app report system or contact support.

---

*This guide is based on the Supabase schema and application code in this repository. It is not legal advice.*
