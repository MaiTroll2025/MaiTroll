export interface PushDeliveryResult {
  android_configured: boolean;
  web_configured: boolean;
  android_sent: number;
  android_failed: number;
  android_tokens_found: number;
  android_tokens_eligible: number;
  web_sent: number;
  web_failed: number;
  sent: number;
  failed: number;
}

export async function dispatchPushNotification(
  supabaseUrl: string,
  serviceRoleKey: string,
  userIds: string[],
  notification: {
    title: string;
    body: string;
    type: string;
    url: string;
    data: Record<string, unknown>;
  },
): Promise<PushDeliveryResult> {
  const response = await fetch(
    `${supabaseUrl.replace(/\/+$/, '')}/functions/v1/push-notifications`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${serviceRoleKey}`,
        apikey: serviceRoleKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        user_ids: userIds,
        notification,
        platforms: ['android', 'web'],
      }),
    },
  );

  const result = await response.json().catch(() => null) as PushDeliveryResult | null;
  if (!response.ok || !result) {
    throw new Error(`Push gateway request failed (${response.status})`);
  }
  return result;
}
