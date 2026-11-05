# Temporary review accounts

Temporary review accounts are created only through User Management. Creating the account also activates it: database UTC timestamps grant exactly 60 minutes. Existing accounts cannot be converted, and the account cannot change its own review flags or expiry.

## Required Supabase configuration

1. Apply `20291105000001_temporary_review_accounts.sql` to a disposable staging project first. The migration installs a PostgREST pre-request guard and stops if another pre-request hook is configured; compose both checks before applying it in that case.
2. Configure the Supabase Auth **Custom Access Token** hook to call `public.custom_access_token_hook`. The local project uses the URI in `supabase/config.toml`; configure the same hook in the deployed Auth settings. The hook caps every newly issued access token at `temporary_review_expires_at`, and rejects login/refresh after expiration.
3. Generate a random secret and set it as the Edge Function secret `TEMP_REVIEW_CLEANUP_SECRET`. Store the same value in Supabase Vault as `temporary_review_cleanup_secret`, and store the project URL in Vault as `supabase_url`. The migration schedules `cleanup-expired-review-accounts` every minute; the function rejects calls without the bearer secret. Do not put either secret in source control.
4. Deploy the Edge Function only after its secret and Vault values are configured. Do not use a production account to validate permanent deletion.

The PostgREST hook rejects writes for active reviewers and rejects all PostgREST requests at expiry. A Storage trigger blocks reviewer writes. Auth token expiration provides the cross-client expiration boundary, including existing sessions; cleanup timing is not used to enforce the one-hour limit. Storage and account cleanup is limited to the verified temporary account. Presence, subscription, and permission rows are removed only when their single-column foreign key identifies that account; other FK cascades are left to Supabase Auth, and unexpected constraints fail closed for retry.

If enrollment fails, the newly created Auth account is disabled and retained for administrator investigation; it is not permanently deleted as a rollback. For a fresh, marker-verified account only, the provisioning flow recognizes and removes the exact automatic welcome/battle-starter grants, an unused default credit account, and signup-generated follows from verified administrator accounts before activation. Any other coin transaction, financial history, non-default credit activity, or linked record blocks enrollment. Bootstrap balance and summary fields are zeroed only after those checks pass. An activated account is permanently deleted only by the scheduled expiration cleanup.

## Staging verification checklist

Run each case using disposable accounts and record the results before production rollout:

- Create an account through User Management; verify its database `activated_at` and `expires_at` differ by exactly 60 minutes and that an existing account cannot be activated.
- Keep multiple desktop and mobile sessions open; verify each access token expires at the stored timestamp and PostgREST, Auth refresh, Realtime, Storage, and Edge Function requests fail after that time.
- Verify PostgREST writes and Storage writes are denied during the active review window, and the desktop displays the expiration message, clears its session, disconnects realtime channels, and redirects home.
- Expire an account with owned Storage objects; verify those objects are removed before Auth deletion and the Auth user is hard-deleted with `deleteUser(userId, false)`.
- Force a Storage or Auth deletion failure; verify the audit status remains `Deletion Pending`, the next cron run retries, and an administrator is notified at a bounded interval.
- Trigger two cleanup runs concurrently; verify a claim lease prevents duplicate processing and only one permanent Auth deletion is recorded.
- Verify accounts with any nonzero Troll Coins/Trollmonds balance, role/employment flag, or FK-linked account data cannot be enrolled; verify regular accounts and their financial records remain unchanged.
- Force review activation to fail; verify the new Auth account is banned and retained, with no profile/Auth deletion before the 60-minute expiry cleanup.
- Verify automatic welcome/battle-starter signup grants and an unused default credit account are cleared only for the fresh marker-verified review account; verify unrelated coin transactions and used credit accounts block enrollment.
- Verify a successfully deleted account disappears from the active User Management list and only its minimal deletion audit remains.

This repository change does not deploy the migration or run the destructive staging cases. Production rollout must wait until the staging checklist passes.
