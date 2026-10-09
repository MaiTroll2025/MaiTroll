import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { requireAdmin } from '../_shared/facebook/auth.ts';
import {
  facebookScopesParam,
  metaAppId,
  metaAppSecret,
  oauthDialogUrl,
  oauthRedirectUri,
  resolveGraphApiVersion,
} from '../_shared/facebook/config.ts';
import { adminMessageForCategory } from '../_shared/facebook/errors.ts';
import { createOAuthState, hashOAuthNonce } from '../_shared/facebook/state.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const auth = await requireAdmin(req);
  if (!auth.ok || !auth.db || !auth.admin) {
    return json({ error: auth.error, code: auth.code }, auth.status);
  }

  const appId = metaAppId();
  const appSecret = metaAppSecret();
  if (!appId || !appSecret) {
    return json({ error: adminMessageForCategory('config_error'), code: 'config_error' }, 503);
  }

  try {
    const version = resolveGraphApiVersion();
    const redirectUri = oauthRedirectUri();
    const { state, nonce } = await createOAuthState(auth.admin.userId, appSecret);
    const { error } = await auth.db.from('facebook_oauth_states').insert({
      nonce_hash: await hashOAuthNonce(nonce),
      user_id: auth.admin.userId,
      expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    });
    if (error) {
      console.error('[facebook-oauth] Unable to persist one-time state', { message: error.message });
      return json({ error: 'Unable to start Facebook authorization. Try again.' }, 500);
    }

    const url = new URL(oauthDialogUrl(version));
    url.searchParams.set('client_id', appId);
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('scope', facebookScopesParam());
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('state', state);

    return json({ auth_url: url.toString() });
  } catch (error) {
    console.error('[facebook-oauth] Authorization initialization failed', {
      reason: error instanceof Error ? error.message : 'unknown',
    });
    return json({ error: adminMessageForCategory('config_error'), code: 'config_error' }, 500);
  }
});
