# Push notification setup

The function supports browser Web Push through VAPID and native Android push through Firebase Cloud Messaging HTTP v1.

## Configure Android FCM

1. In the Firebase/Google Cloud project matching the app's Android `google-services.json`, enable the Firebase Cloud Messaging API.
2. Create a dedicated service account with the **Firebase Cloud Messaging API Admin** role and obtain its project ID, client email, and private key. Keep the key outside the repository and never put it in the Android app.
3. Set these Supabase Edge Function secrets: `FCM_PROJECT_ID`, `FCM_CLIENT_EMAIL`, and `FCM_PRIVATE_KEY`. Alternatively, the function also accepts a complete service account in `FCM_SERVICE_ACCOUNT_JSON`.

4. Deploy the function with JWT verification enabled:

   ```powershell
   supabase functions deploy push-notifications --project-ref gejtbllazzighxwxudyu
   ```

5. Send a normal notification to an account with an active Android row in `native_push_tokens`. The function response reports `android_sent` and `android_failed`; its logs intentionally never print device tokens or service-account values.

The Firebase service account project ID must match the Firebase project that issued the device tokens. Missing FCM credentials leave Web Push working and cause Android sends to be skipped with a server-side warning. This integration currently sends to Android tokens; iOS APNs delivery needs separate Apple push credentials and configuration.

## Request authorization

The function is configured for JWT verification. Authenticated client calls are further limited to recipients with a matching notification row created in the previous ten minutes; trusted server-side callers using the Supabase service-role key can send to their requested recipients. Never expose the service-role key or Firebase service-account JSON in client code.
