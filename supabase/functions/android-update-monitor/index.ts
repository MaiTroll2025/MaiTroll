import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const PACKAGE_NAME = 'com.maitroll.app';
const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.maitroll.app';
const ANDROID_PUBLISHER_SCOPE = 'https://www.googleapis.com/auth/androidpublisher';

type PlayRelease = {
  name?: string;
  status?: string;
  versionCodes?: string[];
};

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function base64UrlEncode(value: Uint8Array | string): string {
  const bytes = typeof value === 'string' ? new TextEncoder().encode(value) : value;
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function decodePem(pem: string): Uint8Array {
  const encoded = pem
    .replace(/\\n/g, '\n')
    .replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g, '');
  const binary = atob(encoded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function getPublisherAccessToken(serviceAccount: Record<string, unknown>): Promise<string> {
  const clientEmail = serviceAccount.client_email;
  const privateKey = serviceAccount.private_key;
  if (typeof clientEmail !== 'string' || typeof privateKey !== 'string') {
    throw new Error('Google Play service account must include client_email and private_key');
  }

  const now = Math.floor(Date.now() / 1000);
  const unsignedToken = [
    base64UrlEncode(JSON.stringify({ alg: 'RS256', typ: 'JWT' })),
    base64UrlEncode(JSON.stringify({
      iss: clientEmail,
      scope: ANDROID_PUBLISHER_SCOPE,
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
    })),
  ].join('.');
  const signingKey = await crypto.subtle.importKey(
    'pkcs8',
    decodePem(privateKey),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    signingKey,
    new TextEncoder().encode(unsignedToken),
  );
  const assertion = `${unsignedToken}.${base64UrlEncode(new Uint8Array(signature))}`;

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });
  const result = await response.json();
  if (!response.ok || typeof result.access_token !== 'string') {
    throw new Error(`Google OAuth token request failed (${response.status})`);
  }
  return result.access_token;
}

async function getLatestProductionRelease(accessToken: string): Promise<{ versionCode: number; versionName: string } | null> {
  const apiRoot = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${PACKAGE_NAME}/edits`;
  const editResponse = await fetch(apiRoot, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: '{}',
  });
  const edit = await editResponse.json();
  if (!editResponse.ok || typeof edit.id !== 'string') {
    throw new Error(`Google Play edit creation failed (${editResponse.status})`);
  }

  try {
    const trackResponse = await fetch(`${apiRoot}/${encodeURIComponent(edit.id)}/tracks/production`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const track = await trackResponse.json();
    if (!trackResponse.ok) {
      throw new Error(`Google Play production track lookup failed (${trackResponse.status})`);
    }

    const releases: PlayRelease[] = Array.isArray(track.releases) ? track.releases : [];
    const completedVersions = releases
      .filter((release) => release.status === 'completed')
      .flatMap((release) =>
        (release.versionCodes || []).map((code) => ({
          versionCode: Number(code),
          versionName: release.name || code,
        })),
      )
      .filter((release) => Number.isSafeInteger(release.versionCode) && release.versionCode > 0)
      .sort((left, right) => right.versionCode - left.versionCode);

    return completedVersions[0] || null;
  } finally {
    const deleteResponse = await fetch(`${apiRoot}/${encodeURIComponent(edit.id)}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!deleteResponse.ok) {
      console.warn('Could not discard temporary Google Play edit:', deleteResponse.status);
    }
  }
}

async function getAndroidRecipientIds(supabase: ReturnType<typeof createClient>): Promise<string[]> {
  const userIds = new Set<string>();
  const pageSize = 1000;
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase
      .from('native_push_tokens')
      .select('user_id')
      .eq('platform', 'android')
      .eq('is_active', true)
      .range(offset, offset + pageSize - 1);
    if (error) throw new Error(`Could not load Android push recipients: ${error.message}`);
    for (const row of data || []) {
      if (typeof row.user_id === 'string') userIds.add(row.user_id);
    }
    if (!data || data.length < pageSize) break;
  }
  return [...userIds];
}

serve(async (req) => {
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);

  const monitorSecret = Deno.env.get('ANDROID_UPDATE_MONITOR_SECRET');
  const authorization = req.headers.get('Authorization') || '';
  if (!monitorSecret || authorization !== `Bearer ${monitorSecret}`) {
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const playServiceAccount = Deno.env.get('GOOGLE_PLAY_SERVICE_ACCOUNT_JSON');
  if (!supabaseUrl || !serviceRoleKey || !playServiceAccount) {
    console.error('Android update monitor is missing required server configuration');
    return jsonResponse({ error: 'Android update monitor is not configured' }, 500);
  }

  let announcementVersionCode: number | null = null;
  try {
    let serviceAccount: Record<string, unknown>;
    try {
      serviceAccount = JSON.parse(playServiceAccount);
    } catch {
      throw new Error('GOOGLE_PLAY_SERVICE_ACCOUNT_JSON is not valid JSON');
    }

    const accessToken = await getPublisherAccessToken(serviceAccount);
    const release = await getLatestProductionRelease(accessToken);
    if (!release) {
      return jsonResponse({ success: true, updateFound: false, reason: 'No completed production release found' });
    }
    announcementVersionCode = release.versionCode;

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const { data: existing, error: lookupError } = await supabase
      .from('android_update_push_tracking')
      .select('status')
      .eq('version_code', release.versionCode)
      .maybeSingle();
    if (lookupError) throw new Error(`Could not check update history: ${lookupError.message}`);
    if (existing?.status === 'sent') {
      return jsonResponse({ success: true, updateFound: false, reason: 'This release was already announced' });
    }

    const { error: trackingError } = await supabase
      .from('android_update_push_tracking')
      .upsert({
        version_code: release.versionCode,
        version_name: release.versionName,
        status: 'processing',
        last_error: null,
      });
    if (trackingError) throw new Error(`Could not record update attempt: ${trackingError.message}`);

    const userIds = await getAndroidRecipientIds(supabase);
    let androidSent = 0;
    let androidFailed = 0;
    for (let offset = 0; offset < userIds.length; offset += 1000) {
      const response = await fetch(`${supabaseUrl}/functions/v1/push-notifications`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${serviceRoleKey}`,
          apikey: serviceRoleKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_ids: userIds.slice(offset, offset + 1000),
          platforms: ['android'],
          notification: {
            type: 'app_update',
            title: 'Mai Troll update available',
            body: 'A new Android version is now available. Update to get the latest features and fixes.',
            url: PLAY_STORE_URL,
            data: {
              route: PLAY_STORE_URL,
              version_code: String(release.versionCode),
              version_name: release.versionName,
            },
          },
          options: { ttl: 86400, urgency: 'normal' },
        }),
      });
      const result = await response.json();
      androidSent += Number(result.android_sent || 0);
      androidFailed += Number(result.android_failed || 0);
      if (!response.ok || result.android_failed > 0) {
        throw new Error(`Android push batch failed (${response.status})`);
      }
    }

    const { error: sentError } = await supabase
      .from('android_update_push_tracking')
      .update({ status: 'sent', sent_at: new Date().toISOString(), last_error: null })
      .eq('version_code', release.versionCode);
    if (sentError) throw new Error(`Push sent, but update history could not be finalized: ${sentError.message}`);

    return jsonResponse({
      success: true,
      updateFound: true,
      versionCode: release.versionCode,
      versionName: release.versionName,
      targetedUsers: userIds.length,
      androidSent,
      androidFailed,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown monitor error';
    console.error('Android update monitor failed:', message);
    if (announcementVersionCode !== null) {
      const supabaseUrl = Deno.env.get('SUPABASE_URL');
      const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
      if (supabaseUrl && serviceRoleKey) {
        const supabase = createClient(supabaseUrl, serviceRoleKey);
        const { error: updateError } = await supabase
          .from('android_update_push_tracking')
          .update({ status: 'failed', last_error: message.slice(0, 500) })
          .eq('version_code', announcementVersionCode);
        if (updateError) console.error('Could not record Android update monitor failure:', updateError.message);
      }
    }
    return jsonResponse({ error: message }, 500);
  }
});
