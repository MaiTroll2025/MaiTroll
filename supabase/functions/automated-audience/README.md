# Automated audience service

The service is disabled until its designated administrator enables it in `/admin/automated-audience`.

Before deploying:

1. Apply migrations `20261017000004` through `20261017000007` in order.
2. Set the Supabase auth UUID of the designated administrator as a server-only secret:
   `supabase secrets set MAITROLL_AUDIENCE_ADMIN_ID=<auth-user-uuid>`
3. Deploy the `automated-audience` Edge Function.
4. Confirm the migration registered the `automated-audience-tick` job in `cron.job`; the database must have `pg_cron` enabled.

The function also checks that this exact account currently has an administrator role or `is_admin` permission. It provisions the 30 profiles idempotently on the first eligible activation. Generated email addresses use the reserved `.invalid` domain; credentials are random and never returned.

Each newly activated or resumed live session attempts an immediate labeled chat. Enabling the service also attempts an immediate chat for eligible active sessions. After that, the existing minute-based database scheduler allows at most one automated audience action per minute across all active broadcasts. It rotates between a chat, a like, and a gift. Chats are sent through chat/floating-chat channels; likes broadcast real `like_sent` events; gifts insert real `stream_gifts` rows credited to the broadcaster and broadcast real `gift_sent` events. Virtual reactions also use the separate `virtual_audience_activity` event on the `virtual-audience:${streamId}` channel and appear in a prominent **VIRTUAL AUDIENCE DEMO** overlay.

This is disclosed demo activity, not human participation. The service does not create LiveKit, Agora, or GetStream participants or synthetic viewer presence. Chat text is selected from a small set of stream/app-focused prompts. The scheduler is minute-based and cannot guarantee 5-, 10-, or 20-second intervals.

To activate automatically, enable the service before the designated administrator starts a supported broadcast. If the service is enabled after a broadcast is already live, use the eligible-broadcast activation control on the admin page.
