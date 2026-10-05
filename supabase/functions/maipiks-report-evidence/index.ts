import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const allowedCategories = new Set([
  'minor_harmful',
  'harmful_dangerous',
  'weapons',
  'other_safety_violation',
]);

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? Deno.env.get('SUPABASE_PUBLISHABLE_KEY');
  const authorization = req.headers.get('Authorization');
  if (!supabaseUrl || !serviceKey || !anonKey || !authorization) {
    return jsonResponse({ error: 'Server configuration or authorization is missing' }, 500);
  }

  try {
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const adminClient = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const bearerToken = authorization.replace(/^Bearer\s+/i, '');
    const { data: authData, error: authError } = await userClient.auth.getUser(bearerToken);
    const reporter = authData.user;
    if (authError || !reporter) return jsonResponse({ error: 'Sign in to report Mai Piks content' }, 401);

    const body = await req.json().catch(() => ({}));
    const storyItemId = typeof body.storyItemId === 'string' ? body.storyItemId : '';
    const category = typeof body.category === 'string' ? body.category : '';
    const description = typeof body.description === 'string' ? body.description.trim() : '';
    if (!storyItemId || !allowedCategories.has(category)) {
      return jsonResponse({ error: 'A story item and valid safety category are required' }, 400);
    }
    if (description.length > 2000) return jsonResponse({ error: 'Description is too long' }, 400);

    const { data: item, error: itemError } = await adminClient
      .from('maipiks_story_items')
      .select('id, story_id, storage_path, media_url, media_type, expires_at, deleted_at')
      .eq('id', storyItemId)
      .is('deleted_at', null)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();
    if (itemError || !item) return jsonResponse({ error: 'Story media is no longer available' }, 404);

    const { data: story, error: storyError } = await adminClient
      .from('maipiks_stories')
      .select('id, user_id, expires_at, deleted_at')
      .eq('id', item.story_id)
      .is('deleted_at', null)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();
    if (storyError || !story) return jsonResponse({ error: 'Story is no longer available' }, 404);
    if (story.user_id === reporter.id) return jsonResponse({ error: 'You cannot report your own story' }, 400);

    const { data: access, error: accessError } = await userClient.rpc('maipiks_story_pricing', {
      p_story_id: story.id,
    });
    if (accessError || !access?.has_access) {
      return jsonResponse({ error: 'You do not have access to report this content' }, 403);
    }

    let sourcePath = item.storage_path as string | null;
    if (!sourcePath && typeof item.media_url === 'string' && item.media_url.includes('/maipiks/')) {
      const encodedPath = item.media_url.split('/maipiks/').pop()?.split('?')[0];
      try {
        sourcePath = encodedPath ? decodeURIComponent(encodedPath) : null;
      } catch {
        sourcePath = null;
      }
    }
    if (!sourcePath || !sourcePath.startsWith(`${story.user_id}/`)) {
      return jsonResponse({ error: 'Original media reference is invalid' }, 409);
    }

    const extension = sourcePath.split('.').pop()?.replace(/[^a-z0-9]/gi, '').slice(0, 8) || 'bin';
    const evidencePath = `moderation-evidence/${reporter.id}/${crypto.randomUUID()}.${extension}`;
    const { error: copyError } = await adminClient.storage
      .from('maipiks')
      .copy(sourcePath, evidencePath);
    if (copyError) {
      console.error('[MAIPiks report] Evidence copy failed:', copyError);
      return jsonResponse({ error: 'Could not preserve the reported media' }, 500);
    }

    const { data: report, error: reportError } = await userClient.rpc('submit_maipiks_report', {
      p_story_item_id: storyItemId,
      p_category: category,
      p_description: description || null,
      p_evidence_path: evidencePath,
    });
    if (reportError || !report?.success) {
      await adminClient.storage.from('maipiks').remove([evidencePath]);
      return jsonResponse({ error: reportError?.message || 'Could not submit the report' }, 400);
    }

    return jsonResponse({ success: true, report_id: report.report_id });
  } catch (error) {
    console.error('[MAIPiks report] Request failed:', error);
    return jsonResponse({ error: 'Could not submit the report' }, 500);
  }
});