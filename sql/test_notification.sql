-- Test VAPID push notification via the push-notifications edge function
-- Go to: Supabase Dashboard → Edge Functions → push-notifications → Test

-- Or via SQL (replace USER_ID with actual UUID):
SELECT supabase.functions.invoke('push-notifications', {
  body: JSONB_BUILD_OBJECT(
    'user_id', 'USER_ID_HERE',
    'notification', JSONB_BUILD_OBJECT(
      'type', 'TEST',
      'title', 'Test Notification',
      'body', 'Hello from Mai Troll!',
      'url', '/'
    )
  )
});

-- To find a user ID, run:
-- SELECT id, username FROM user_profiles WHERE username = 'your_username';

-- Alternative: Use the admin panel at /admin/send-notifications