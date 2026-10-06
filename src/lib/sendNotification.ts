import { supabase } from "./supabase";
import { NotificationType } from "../types/notifications";

export type { NotificationType };

export async function sendNotification(
  userId: string | null,
  type: NotificationType,
  title: string,
  message: string,
  metadata: Record<string, any> = {}
) {
  if (!userId) {
    console.warn("sendNotification called with null userId");
    return;
  }

  // Create notification in database via secure RPC
  let actionUrl = metadata?.action_url || metadata?.route;
  if (!actionUrl && type === 'message' && metadata?.sender_id) {
    actionUrl = `/utromail?recipientId=${metadata.sender_id}`;
  }
  if (!actionUrl && metadata?.url) {
    actionUrl = metadata.url;
  }

  const { error } = await supabase.rpc('create_notification', {
    p_user_id: userId,
    p_type: type,
    p_title: title,
    p_message: message,
    p_metadata: actionUrl ? { ...metadata, action_url: actionUrl } : metadata
  });

  if (error) {
    throw new Error(`RPC create_notification failed: ${error.message}`);
  }

  // The notifications INSERT trigger dispatches push to Android and web once.
}
