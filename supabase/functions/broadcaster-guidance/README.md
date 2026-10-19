# Broadcaster guidance service

Apply `20261018000004_broadcaster_guidance.sql` and deploy the `broadcaster-guidance` Edge Function.

The service selects only enabled rows already present in `automated_audience_accounts` and loads sender names and avatars from their `user_profiles`. It never provisions or modifies accounts. Each stream has one database-backed guidance sequence; message insertion, moderation checks, and delivery status updates are atomic. Realtime delivery uses the existing `stream-chat:<streamId>` channel after the `stream_messages` row is persisted.

The browser requests a sequence only for the broadcaster's live stream. If no sequence exists, the stream must have gone live within the preceding 120 seconds; existing sequences can be resumed after a refresh or reconnect. The Edge Function owns the message count and timing bounds in its `SCHEDULING` constant.
