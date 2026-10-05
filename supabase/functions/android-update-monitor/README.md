# Android production update notifications

The monitor checks the Google Play **production** track every 15 minutes and
sends one Android-only FCM notification when it finds a new `completed`
production release. It does not notify for internal testing or staged/in-progress
rollouts. The notification opens:

`https://play.google.com/store/apps/details?id=com.maitroll.app`

## Required secrets and setup

1. Grant a Google Play Developer API service account permission to view the
   production release for `com.maitroll.app`. Store its JSON key as the Supabase
   Edge Function secret `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON`.
2. Generate a separate high-entropy monitor secret. Set it as
   `ANDROID_UPDATE_MONITOR_SECRET` in Supabase Edge Function secrets and as a
   GitHub Actions repository secret with the same name. Do not commit either
   credential or put them in the mobile app.
3. Add this GitHub Actions repository variable:
   `ANDROID_UPDATE_MONITOR_URL=https://gejtbllazzighxwxudyu.supabase.co/functions/v1/android-update-monitor`
4. Apply `20261005000013_android_update_push_tracking.sql`, then deploy both
   `android-update-monitor` and the updated `push-notifications` Edge Function
   with the project configuration in `supabase/config.toml`.
5. Run the workflow once with **Actions → Android production update monitor →
   Run workflow**. It will only announce production releases with a version
   code above the seeded baseline (33 / 1.2.13).

The workflow also runs every 15 minutes. GitHub scheduled workflows can be
delayed during high load; use `workflow_dispatch` to trigger an immediate check
after a release if needed. The tracking table ensures already-announced release
version codes are not announced again.

The function requires the existing FCM service-account secret configuration for
`push-notifications`. Push preferences are honored by that sender, and only
users with an active Android push token are targeted.
