# MaiTroll Trust & Safety Transparency

This document is the technical backing for the public-facing Trust & Safety FAQ. Every claim below is grounded in the live Supabase schema and application code in this repository.

---

## 1. Password Security — Supabase Auth + pgcrypto bcrypt

### How passwords are protected

MaiTroll does **not** store passwords in plain text, and no staff member can read a user's plain-text password.

| Layer | What happens | Proof in code |
|-------|-------------|---------------|
| Authentication provider | Supabase Auth manages user credentials | `supabaseClient.ts`, `src/lib/supabase.ts` |
| Password hashing | Passwords are hashed with bcrypt before storage | `fix_all_search_paths.sql:403` — `crypt(p_password, gen_salt('bf'))` |
| Hash algorithm | bcrypt (Blowfish-based) with per-password salt | `pgcrypto` extension, `gen_salt('bf')` |
| Custom password manager | **Removed** | `drop_password_manager_edge_function.sql` drops `reset_password_via_pin`, `set_user_reset_pin`, `reset_pin_hash` column, and the `password-manager` edge function |
| Password reset | Handled by Supabase's built-in `resetPasswordForEmail` / `updateUser` flow | `drop_password_manager_edge_function.sql` comments |

### Exact bcrypt architecture proof

The database function `public.crypt_password` (defined in `fix_all_search_paths.sql`) demonstrates the bcrypt approach:

```sql
CREATE OR REPLACE FUNCTION public.crypt_password(p_password TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN crypt(p_password, gen_salt('bf'));
END;
$$ LANGUAGE plpgsql;
```

- `gen_salt('bf')` generates a unique bcrypt salt for every password.
- `crypt()` hashes the password with that salt.
- The resulting hash is stored in Supabase Auth's `auth.users` table (managed by Supabase, not MaiTroll application code).

### What this means for users

- Plain-text passwords are never written to any MaiTroll database table.
- MaiTroll staff do not have access to decrypt or view bcrypt hashes in a way that reveals passwords.
- Password resets go through Supabase's standard secure email-based flow, not a custom MaiTroll function.

**Publishable guarantee:** "Your password is hashed with bcrypt via Supabase Auth and pgcrypto. MaiTroll staff cannot read your plain-text password. The legacy custom password-manager function has been removed."

---

## 2. Payment Safety — Tokenization via Stripe and Square

### What we store vs. what we don't

MaiTroll does **not** store full credit or debit card numbers. Card processing is handled by payment processors (Square, Stripe). MaiTroll only stores non-sensitive reference tokens.

#### `user_payment_methods` table schema (`supabase/schema.sql:1`)

```sql
create table if not exists public.user_payment_methods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  provider text not null,                            -- 'card', 'cashapp', etc.
  token_id text not null,                            -- vault token from processor
  display_name text,                                 -- e.g. "Visa ••••1234"
  brand text,                                        -- Visa, Mastercard
  last4 text,                                        -- Last 4 digits only
  exp_month int,
  exp_year int,
  square_customer_id text,
  square_card_id text,
  is_default boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

#### `stripe_customers` table (`frontend_schema.sql:327`)

```sql
stripe_customer_id text not null,
```

### Schema mapping — sensitive vs. non-sensitive fields

| Field | Stored? | Sensitive? | Source |
|-------|---------|------------|--------|
| Full card number (PAN) | **No** | Yes (never) | — |
| Card CVV/CVC | **No** | Yes (never) | — |
| Full card expiration | No — only month/year | Low | `exp_month`, `exp_year` |
| Last 4 digits | Yes | No | `last4` |
| Card brand | Yes | No | `brand` |
| Display name (masked) | Yes | No | `display_name` ("Visa ••••1234") |
| Processor vault token | Yes | Low | `token_id` (Square/Stripe token) |
| Square customer ID | Yes | Low | `square_customer_id` |
| Square card-on-file ID | Yes | Low | `square_card_id` (starts with `ccof:`) |
| Stripe customer ID | Yes | Low | `stripe_customer_id` |

### Row Level Security on payment tables

From `fix_rls_errors.sql` and `supabase/schema.sql`, payment tables have RLS enabled:

- `user_payment_methods` — RLS enabled; users can only select/insert/delete their own rows (`auth.uid() = user_id`).
- `payment_methods`, `payment_transactions`, `payment_fees`, `payment_holds`, `payment_logs` — RLS enabled globally (`fix_rls_errors.sql:232-236`).
- `stripe_customers` — RLS enabled (`fix_rls_errors.sql:319`).

### Publishable guarantee

"MaiTroll does not store full credit card numbers. Card details are tokenized by Square and Stripe. We store only non-sensitive reference fields such as last-4 digits, card brand, expiry month/year, and processor vault tokens. Your full PAN and CVV never touch our database."

---

## 3. AI vs. Human Moderation — Troll Court is roleplay; moderation is human

### AI usage in the codebase

AI is used for **entertainment and roleplay only**, never for enforcement.

| Feature | File | AI model | Purpose |
|---------|------|----------|---------|
| Troll Court (Prosecutor/Defense roleplay) | `src/lib/courtAi.ts` | OpenAI `gpt-4o-mini` | In-game courtroom roleplay |
| Troll Court edge function | `supabase/functions/trollcourt-ai/index.ts` | Gemini `gemini-2.0-flash` | Court summaries/questions/recommendations |
| Stream AI host announcements | `trollcity-stream-engine/src/server.ts` | OpenAI `gpt-4o-mini` | Fun stream announcer reactions |
| Message translation | `src/lib/translation.ts` | OpenAI API | Translating messages |

### Troll Court — roleplay, not moderation

From `src/lib/courtAi.ts:26-30`:
```
You are an AI Agent in Troll Court, a roleplay courtroom in Mai Troll.
Your goal is to roleplay your role (Prosecutor or Defense) strictly.
IN-GAME ROLEPLAY ONLY. NOT LEGAL ADVICE.
```

The `safety_note` field in every AI response explicitly states: `IN-GAME ROLEPLAY — NOT LEGAL ADVICE`.

The Gemini edge function (`trollcourt-ai/index.ts`) redacts PII (emails, phone numbers) before sending any transcript to the model — see `redactPII()` at lines 19-24.

### Human moderation — the enforcement path

Moderation is **entirely human-driven**:

1. **User reports** — `user_reports` table (`add_user_reports_table.sql`): any authenticated user can file a report; officers review them.
2. **Moderation tables with RLS** — `moderation_actions`, `moderation_actions_log`, `moderation_events`, `moderation_reports`, `moderation_notes` (all RLS-enabled per `fix_rls_errors.sql:189-194`).
3. **Staff action audit log** — `staff_action_audit_log` (`20260629000002_staff_audit_system.sql:13-30`): logs every staff action with `staff_user_id`, `staff_role`, `staff_email`, `action_type`, `action_category`, `target_type`, `target_id`, `details`, `route_path`, `ip_address`, `result`, `created_at`.

### Audit trail guarantees

- Every staff action is written to `staff_action_audit_log` with a timestamp and immutable record.
- RLS restricts audit log access: staff see their own entries; admins/superadmins/CEO see all (`20260629000002_staff_audit_system.sql:45-57`).
- AI has **no write access** to ban, mute, or judge users. AI cannot modify `user_profiles.is_banned`, `banned_until`, or any enforcement state.

### Publishable guarantee

"MaiTroll AI (OpenAI and Gemini) is used strictly for courtroom roleplay and entertainment features such as Troll Court. AI never automatically bans, mutes, or judges users. All moderation actions are performed by human Troll Officers and administrators, and every action is recorded in an auditable staff action log."

---

## 4. Public FAQ — Trust & Safety

### Data isolation (RLS)

Row Level Security is enabled globally across user data tables (`enable_rls_globally.sql`, `fix_rls_errors.sql`). Users can only access their own profile, payment methods, and private data. Other users cannot read your private fields.

### Not a data-harvesting operation

- We store what is necessary for platform function (username, email, coin balances, payout details for creators).
- Full SSNs were removed — only `tax_id_last4` remains (`supabase/migrations_backup3/20250424000000_remove_ssn_column.sql`).
- Full card numbers are never stored (see Payment Safety above).

### Not an unsustainable economic loop / not a ponzi scheme

- Coins are earned through platform activity or purchased; they are platform currency, not an investment.
- The "founder rewards" system grants badges and fee waivers — not investment returns.
- Payouts go from the platform **to** creators for content/activity, not from new users to earlier users.
- No investment product exists in the codebase.

### Human moderation queues

Reports flow through `user_reports` → reviewed by Troll Officers/admins → action recorded in `staff_action_audit_log`. AI does not participate in enforcement.

---

**Bottom line for new users:** MaiTroll is a live broadcasting and social platform with bcrypt-hashed passwords, tokenized (never full) card data, RLS data isolation, human moderation with an audit trail, AI limited to entertainment roleplay, and no investment or ponzi mechanics.
