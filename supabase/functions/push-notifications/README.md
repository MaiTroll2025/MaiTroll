# Push notification setup

The function is the shared push-delivery gateway: it supports browser Web Push through VAPID and native Android push through Firebase Cloud Messaging HTTP v1. The `notifications` insert trigger queues in-app notification rows through the `notification-push-dispatch` Edge Function, which then calls this gateway. The global ticker is excluded from the trigger because it already batches through this gateway directly. Client and admin-event handlers should otherwise create notification rows only; they must not send a second push for the same row.

## Configure Android FCM

1. In the Firebase/Google Cloud project matching the app's Android `google-services.json`, enable the Firebase Cloud Messaging API.
2. Create a dedicated service account with the **Firebase Cloud Messaging API Admin** role and obtain its project ID, client email, and private key. Keep the key outside the repository and never put it in the Android app.
3. Set these Supabase Edge Function secrets: `FCM_PROJECT_ID`, `FCM_CLIENT_EMAIL`, and `FCM_PRIVATE_KEY`. Alternatively, the function also accepts a complete service account in `FCM_SERVICE_ACCOUNT_JSON`.

4. Configure the internal database-to-Edge-Function dispatcher. Set `NOTIFICATION_PUSH_DISPATCH_TOKEN` as an Edge Function secret and store the same random value in Vault as `notification_push_dispatch_token`. Store the project anon/publishable key in Vault as `notification_push_dispatch_apikey` and the dispatcher URL as `notification_push_dispatch_url` (for example, `https://<project-ref>.supabase.co/functions/v1/notification-push-dispatch`). Do not commit or log the dispatch token.

5. Deploy the push gateway with JWT verification enabled and the dispatcher with JWT verification disabled (it authenticates using the private dispatch token):

   ```powershell
   supabase functions deploy push-notifications --project-ref gejtbllazzighxwxudyu
   supabase functions deploy notification-push-dispatch --project-ref gejtbllazzighxwxudyu
   supabase functions deploy notify-admin-event --project-ref gejtbllazzighxwxudyu
   supabase functions deploy notify-stream-live --project-ref gejtbllazzighxwxudyu
   supabase functions deploy signup --project-ref gejtbllazzighxwxudyu
   ```

6. Apply only `supabase/migrations/20261005000015_universal_notification_push.sql` for this feature. It enables `pg_net` and adds an `AFTER INSERT` trigger on `public.notifications`; do not use a command that applies every pending migration.

7. Send a normal notification to an account with an active Android row in `native_push_tokens`. The dispatcher response/logs report Android token counts and delivery failures; logs never print device tokens, dispatch tokens, or service-account values.

The Firebase service account project ID must match the Firebase project that issued the device tokens. Missing FCM credentials leave Web Push working and cause Android sends to be skipped with a server-side warning. This integration currently sends to Android tokens; iOS APNs delivery needs separate Apple push credentials and configuration.

## Request authorization

The function is configured for JWT verification. Authenticated client calls are further limited to recipients with a matching notification row created in the previous ten minutes; trusted server-side callers using the Supabase service-role key can send to their requested recipients. Never expose the service-role key or Firebase service-account JSON in client code.
