import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-requested-with, accept, origin, content-length',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, PUT, DELETE, PATCH',
  'Vary': 'Origin'
};

const ADMIN_ROLES = new Set(['admin', 'superadmin', 'owner', 'ceo']);
const STAFF_ROLES = new Set([
  'lead_troll_officer', 'troll_officer', 'moderator', 'staff', 'secretary',
  'executive_secretary', 'troll_city_secretary', 'agency_hr', 'agency_hr_manager',
  'agency_leader', 'ceo_assistant', 'noah_assistant', 'hr_admin',
  'marketing_agent', 'academy_director', 'prosecutor', 'attorney',
]);

interface StreamLivePayload {
  streamId: string;
  userId: string;
  category?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      status: 200,
      headers: { ...corsHeaders, 'Cache-Control': 'max-age=0, s-maxage=0, no-cache, no-store, must-revalidate' }
    });
  }
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const body = await req.json() as StreamLivePayload;
    const { streamId, userId, category = 'general' } = body;

    if (!streamId || !userId) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: streamId, userId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase environment variables');
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const bearerToken = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim();
    const { data: actorData, error: actorError } = await supabaseAdmin.auth.getUser(bearerToken);
    if (actorError || !actorData.user || actorData.user.id !== userId) {
      return new Response(
        JSON.stringify({ error: 'Only the authenticated broadcaster may announce this stream' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: streamerProfile, error: streamerProfileError } = await supabaseAdmin
      .from('user_profiles')
      .select('id, username, display_name, avatar_url')
      .eq('id', userId)
      .maybeSingle();
    if (streamerProfileError) throw new Error(`Failed to load streamer profile: ${streamerProfileError.message}`);

    if (!streamerProfile) {
      return new Response(
        JSON.stringify({ error: 'Streamer profile not found' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: stream, error: streamError } = await supabaseAdmin
      .from('streams')
      .select('id, title, category, status, is_live, user_id, broadcaster_id')
      .eq('id', streamId)
      .maybeSingle();
    if (streamError) throw new Error(`Failed to load stream: ${streamError.message}`);

    if (!stream) {
      return new Response(
        JSON.stringify({ error: 'Stream not found' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    const streamOwnerId = stream.user_id || stream.broadcaster_id;
    if (
      streamOwnerId !== userId
      || (stream.status !== 'live' && stream.is_live !== true)
    ) {
      return new Response(
        JSON.stringify({ error: 'The authenticated user does not own an active live stream' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: profiles, error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .select('id, role, is_admin, is_super_admin, is_ceo, is_staff, is_troll_officer, is_lead_officer, is_secretary, is_attorney, is_prosecutor');
    if (profileError) throw new Error(`Failed to load notification recipients: ${profileError.message}`);

    const { data: activeEmployees, error: employeeError } = await supabaseAdmin
      .from('employee_records')
      .select('user_id')
      .eq('employment_status', 'active');
    if (employeeError) throw new Error(`Failed to load active career staff: ${employeeError.message}`);

    const activeEmployeeIds = new Set((activeEmployees || []).map(employee => employee.user_id));
    const adminUserIds = (profiles || [])
      .filter(profile => {
        const role = String(profile.role || '').toLowerCase();
        return profile.is_admin === true
          || profile.is_super_admin === true
          || profile.is_ceo === true
          || ADMIN_ROLES.has(role);
      })
      .map(profile => profile.id);
    const staffUserIds = (profiles || [])
      .filter(profile => {
        const role = String(profile.role || '').toLowerCase();
        return profile.is_staff === true
          || profile.is_troll_officer === true
          || profile.is_lead_officer === true
          || profile.is_secretary === true
          || profile.is_attorney === true
          || profile.is_prosecutor === true
          || STAFF_ROLES.has(role)
          || activeEmployeeIds.has(profile.id);
      })
      .map(profile => profile.id);
    const notifyUserIds = [...new Set([...adminUserIds, ...staffUserIds])];

    if (notifyUserIds.length === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'No staff or admin recipients found',
          notificationsSent: 0
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: existingNotifications, error: existingError } = await supabaseAdmin
      .from('notifications')
      .select('user_id')
      .in('user_id', notifyUserIds)
      .eq('type', 'stream_live')
      .filter('metadata->>stream_id', 'eq', streamId);
    if (existingError) throw new Error(`Failed to check duplicate stream alerts: ${existingError.message}`);

    const alreadyNotified = new Set((existingNotifications || []).map((notification) => notification.user_id));
    const recipientsToNotify = notifyUserIds.filter((id) => !alreadyNotified.has(id));
    if (recipientsToNotify.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Stream alert already created',
          notificationsSent: 0,
          pushQueued: 0,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const streamerName = streamerProfile.display_name || streamerProfile.username || 'A user';
    const streamTitle = stream.title || 'Untitled Stream';

    const createResults = await Promise.all(recipientsToNotify.map(adminId =>
      supabaseAdmin.rpc('create_notification', {
        p_user_id: adminId,
        p_type: 'stream_live',
        p_title: '🔴 Stream Started',
        p_message: `${streamerName} started streaming: "${streamTitle}"`,
        p_metadata: {
          stream_id: streamId,
          streamer_id: userId,
          streamer_name: streamerName,
          stream_title: streamTitle,
          category,
        }
      })
    ));
    const inAppFailures = createResults.filter(result => result.error).length;
    if (inAppFailures > 0) {
      console.error('[notify-stream-live] In-app notification creation failures:', inAppFailures);
    }

    return new Response(
      JSON.stringify({
        success: inAppFailures === 0,
        notificationsSent: createResults.length - inAppFailures,
        inAppNotificationsCreated: createResults.length - inAppFailures,
        inAppFailures,
        pushQueued: createResults.length - inAppFailures,
        message: inAppFailures === 0
          ? 'In-app notification created and queued for platform push delivery'
          : 'One or more staff notifications could not be created',
        error: inAppFailures > 0
          ? 'Failed to create one or more staff notifications'
          : undefined,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('[notify-stream-live] Error:', err);
    return new Response(
      JSON.stringify({ error: err.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
