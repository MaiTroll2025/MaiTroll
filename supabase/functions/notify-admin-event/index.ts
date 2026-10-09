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
const STAFF_EVENT_TYPES = new Set([
  'career_application_submitted',
  'report_filed',
  'support_ticket',
  'user_kicked',
  'user_arrested',
  'court_started',
  'stream_live',
]);

interface AdminEventPayload {
  type: string;
  title: string;
  message: string;
  metadata?: Record<string, unknown>;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      status: 200,
      headers: { ...corsHeaders, 'Cache-Control': 'max-age=0, s-maxage=0, no-cache, no-store, must-revalidate' }
    });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(JSON.stringify({ error: 'Server not configured: missing Supabase credentials' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    const { type, title, message, metadata = {} }: AdminEventPayload = await req.json();

    if (!type || !title || !message) {
      return new Response(JSON.stringify({ error: 'Missing required fields: type, title, message' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const bearerToken = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim();
    const isServiceRole = bearerToken === supabaseServiceKey;
    if (!isServiceRole && !bearerToken) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    let actorIsAdmin = false;
    let actorIsStaff = false;
    let actorUserId: string | null = null;
    if (!isServiceRole) {
      const { data: actorData, error: actorError } = await supabaseAdmin.auth.getUser(bearerToken);
      if (actorError || !actorData.user) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      actorUserId = actorData.user.id;

      const { data: actorProfile, error: profileError } = await supabaseAdmin
        .from('user_profiles')
        .select('id, role, is_admin, is_super_admin, is_ceo, is_staff, is_troll_officer, is_lead_officer, is_secretary, is_attorney, is_prosecutor')
        .eq('id', actorData.user.id)
        .maybeSingle();
      if (profileError) throw new Error(`Failed to validate notification sender: ${profileError.message}`);

      if (actorProfile) {
        const actorRole = String(actorProfile.role || '').toLowerCase();
        actorIsAdmin = actorProfile.is_admin === true
          || actorProfile.is_super_admin === true
          || actorProfile.is_ceo === true
          || ADMIN_ROLES.has(actorRole);
        actorIsStaff = actorIsAdmin
          || actorProfile.is_staff === true
          || actorProfile.is_troll_officer === true
          || actorProfile.is_lead_officer === true
          || actorProfile.is_secretary === true
          || actorProfile.is_attorney === true
          || actorProfile.is_prosecutor === true
          || STAFF_ROLES.has(actorRole);

        if (!actorIsStaff) {
          const { data: employment, error: employmentError } = await supabaseAdmin
            .from('employee_records')
            .select('user_id')
            .eq('user_id', actorProfile.id)
            .eq('employment_status', 'active')
            .maybeSingle();
          if (employmentError) throw new Error(`Failed to validate career role: ${employmentError.message}`);
          actorIsStaff = Boolean(employment);
        }
      }
    }

    if (isServiceRole && type !== 'new_user_signup') {
      return new Response(JSON.stringify({ error: 'Service role may only issue signup alerts' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    if (!isServiceRole && !actorIsAdmin) {
      const isOwnReport = type === 'report_filed'
        && (metadata.reporterId === actorUserId || metadata.reporter_id === actorUserId);
      const isOwnTicket = type === 'support_ticket'
        && metadata.userId === actorUserId;
      const isOwnApplication = type === 'career_application_submitted'
        && metadata.applicant_id === actorUserId;
      const isStaffAdminAlert = actorIsStaff
        && type === 'moderation_action'
        && (metadata.audience === 'admin' || metadata.audience === 'staff' || metadata.audience === undefined);
      const isAuthorizedStaffEvent = actorIsStaff && STAFF_EVENT_TYPES.has(type)
        && type !== 'report_filed'
        && type !== 'support_ticket'
        && type !== 'career_application_submitted';

      if (!isAuthorizedStaffEvent && !isOwnReport && !isOwnTicket && !isOwnApplication && !isStaffAdminAlert) {
        return new Response(JSON.stringify({ error: 'Insufficient role for this notification type' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    const { data: adminUsers, error: adminsError } = await supabaseAdmin
      .from('user_profiles')
      .select('id, role, is_admin, is_super_admin, is_ceo')
      .or('is_admin.eq.true,is_super_admin.eq.true,is_ceo.eq.true,role.in.(admin,superadmin,owner,ceo)');
    if (adminsError) throw new Error(`Failed to load administrators: ${adminsError.message}`);

    const adminIds = (adminUsers || []).map(user => user.id);
    const staffEvent = STAFF_EVENT_TYPES.has(type)
      || (type === 'moderation_action' && metadata.audience !== 'admin');
    const staffQuery = staffEvent
      ? await supabaseAdmin
          .from('user_profiles')
          .select('id, role, is_admin, is_super_admin, is_ceo, is_staff, is_troll_officer, is_lead_officer, is_secretary, is_attorney, is_prosecutor')
      : { data: [], error: null };
    if (staffQuery.error) throw new Error(`Failed to load staff recipients: ${staffQuery.error.message}`);

    const activeEmployees = staffEvent
      ? await supabaseAdmin
          .from('employee_records')
          .select('user_id')
          .eq('employment_status', 'active')
      : { data: [], error: null };
    if (activeEmployees.error) throw new Error(`Failed to load active career staff: ${activeEmployees.error.message}`);

    const activeEmployeeIds = new Set((activeEmployees.data || []).map(employee => employee.user_id));
    const staffIds = (staffQuery.data || [])
      .filter(profile => {
        const role = String(profile.role || '').toLowerCase();
        return profile.is_admin === true
          || profile.is_super_admin === true
          || profile.is_ceo === true
          || ADMIN_ROLES.has(role)
          || profile.is_staff === true
          || profile.is_troll_officer === true
          || profile.is_lead_officer === true
          || profile.is_secretary === true
          || profile.is_attorney === true
          || profile.is_prosecutor === true
          || STAFF_ROLES.has(role)
          || activeEmployeeIds.has(profile.id);
      })
      .map(profile => profile.id);

    const recipientIds = [...new Set([...adminIds, ...(staffEvent ? staffIds : [])])];

    if (recipientIds.length === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'No eligible staff or admin recipients found',
          notificationsCreated: 0
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let userIdsToNotify = recipientIds;

    const signupUserId = type === 'new_user_signup'
      && typeof metadata.signup_user_id === 'string'
      ? metadata.signup_user_id
      : null;
    if (signupUserId) {
      const { data: existingSignupNotifications, error: existingError } = await supabaseAdmin
        .from('notifications')
        .select('user_id')
        .in('user_id', userIdsToNotify)
        .eq('type', type)
        .filter('metadata->>signup_user_id', 'eq', signupUserId);

      if (existingError) {
        throw new Error(`Failed to check duplicate signup notifications: ${existingError.message}`);
      }

      const alreadyNotified = new Set((existingSignupNotifications || []).map(row => row.user_id));
      userIdsToNotify = userIdsToNotify.filter(id => !alreadyNotified.has(id));
    }
    if (userIdsToNotify.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'Signup notification already delivered', notificationsCreated: 0 }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create in-app notifications for the server-selected audience.
    const createResults = await Promise.all(userIdsToNotify.map(adminId =>
      supabaseAdmin.rpc('create_notification', {
        p_user_id: adminId,
        p_type: type,
        p_title: title,
        p_message: message,
        p_metadata: metadata
      })
    ));
    const notificationFailures = createResults.filter(result => result.error);
    if (notificationFailures.length > 0) {
      console.error('[notify-admin-event] In-app notification creation failures:', notificationFailures.length);
    }

    return new Response(JSON.stringify({
      notificationsCreated: createResults.length - notificationFailures.length,
      pushQueued: createResults.length - notificationFailures.length,
      inAppFailures: notificationFailures.length,
      audience: staffEvent ? 'staff_and_admin' : 'admin',
      success: notificationFailures.length === 0,
      message: notificationFailures.length === 0
        ? 'Notifications created and queued for platform push delivery'
        : 'Some staff notifications could not be created',
      error: notificationFailures.length > 0
        ? 'Failed to create one or more staff notifications'
        : undefined
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (err: any) {
    console.error('[notify-admin-event] Error:', err);
    return new Response(JSON.stringify({ error: err.message || 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
