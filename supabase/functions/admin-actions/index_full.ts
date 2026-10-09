import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders(req.headers.get("origin")) });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase environment variables");
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing Authorization header" }), {
        status: 401,
        headers: { ...corsHeaders(req.headers.get("origin")), "Content-Type": "application/json" },
      });
    }

    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders(req.headers.get("origin")), "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("user_profiles")
      .select("role, is_admin, is_lead_officer")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      return new Response(JSON.stringify({ error: "Profile not found" }), {
        status: 403,
        headers: { ...corsHeaders(req.headers.get("origin")), "Content-Type": "application/json" },
      });
    }

    const isAdmin = profile.role === "admin" || profile.role === "lead_troll_officer" || profile.is_lead_officer === true || profile.is_admin === true;
    const isSecretary = profile.role === "secretary";

    if (!isAdmin && !isSecretary) {
      return new Response(JSON.stringify({ error: "Forbidden: Insufficient permissions" }), {
        status: 403,
        headers: { ...corsHeaders(req.headers.get("origin")), "Content-Type": "application/json" },
      });
    }

    const { action, ...params } = await req.json();
    let result;

    switch (action) {
      // ============ Payout Requests ============
      case "approve_payout": {
        if (!isAdmin) throw new Error("Unauthorized");
        const { requestId } = params;
        if (!requestId) throw new Error("Missing requestId");
        const { data, error } = await supabaseAdmin.from("payout_requests").update({ status: "approved", reviewed_by: user.id, updated_at: new Date().toISOString() }).eq("id", requestId).select().single();
        if (error) throw error;
        await supabaseAdmin.rpc("log_admin_action", { p_action_type: "approve_payout_request", p_target_id: requestId, p_details: { status: "approved" } });
        result = data;
        break;
      }

      case "reject_payout": {
        if (!isAdmin) throw new Error("Unauthorized");
        const { requestId, reason } = params;
        if (!requestId) throw new Error("Missing requestId");
        const { data, error } = await supabaseAdmin.from("payout_requests").update({ status: "rejected", rejected_reason: reason, reviewed_by: user.id, updated_at: new Date().toISOString() }).eq("id", requestId).select().single();
        if (error) throw error;
        result = data;
        break;
      }

      case "update_payout_status": {
        if (!isAdmin) throw new Error("Unauthorized");
        const { payoutId, newStatus, reason, paymentReference, notes } = params;
        if (!payoutId || !newStatus) throw new Error("Missing required fields");
        const updates: any = { status: newStatus, updated_at: new Date().toISOString() };
        if (newStatus === 'rejected') { updates.rejection_reason = reason; updates.processed_by = user.id; updates.processed_at = new Date().toISOString(); }
        else if (newStatus === 'paid') { updates.paid_at = new Date().toISOString(); updates.processed_by = user.id; }
        else if (newStatus === 'approved') { updates.approved_at = new Date().toISOString(); updates.processed_by = user.id; }
        if (paymentReference) updates.payment_reference = paymentReference;
        if (notes) updates.notes = notes;
        const { data, error } = await supabaseAdmin.from('payout_requests').update(updates).eq('id', payoutId).select().single();
        if (error) throw error;
        result = { success: true, data };
        break;
      }

      case "get_payout_requests": {
        if (!isAdmin && !isSecretary) throw new Error("Unauthorized");
        let query = supabaseAdmin.from('payout_requests').select(`*, requester:user_profiles!payout_requests_user_id_fkey(username, email), admin:user_profiles!payout_requests_admin_id_fkey(username), processor:user_profiles!payout_requests_processed_by_fkey(username)`).order('created_at', { ascending: false });
        if (params.statusFilter && params.statusFilter !== 'all') query = query.eq('status', params.statusFilter);
        const { data: payouts, error } = await query;
        if (error) throw error;
        result = { payouts: payouts?.map((p: any) => ({ ...p, username: p.requester?.username || 'Unknown', email: p.requester?.email || 'Unknown', processed_by_username: p.processor?.username || null })) };
        break;
      }

      // ============ Cashout Requests (Fast Pay / MAI Pay unified) ============
      case "approve_cashout": {
        const { requestId } = params;
        if (!requestId) throw new Error("Missing requestId");
        const { data, error } = await supabaseAdmin.rpc('admin_process_payout', { p_payout_id: requestId, p_admin_id: user.id, p_action: 'approve' });
        if (error) throw error;
        if (!data?.success) throw new Error(data?.error || 'Failed to approve');
        result = data;
        break;
      }

      case "reject_cashout": {
        const { requestId, reason } = params;
        if (!requestId) throw new Error("Missing requestId");
        const { data, error } = await supabaseAdmin.rpc('admin_process_payout', { p_payout_id: requestId, p_admin_id: user.id, p_action: 'reject', p_rejection_reason: reason || 'Request denied via Admin Panel' });
        if (error) throw error;
        if (!data?.success) throw new Error(data?.error || 'Failed to reject');
        result = data;
        break;
      }

      case "update_cashout_status": {
        const { requestId, status } = params;
        if (!requestId || !status) throw new Error("Missing required fields");
        const action = status === 'approved' ? 'approve' : status === 'rejected' ? 'reject' : null;
        if (!action) throw new Error("Invalid status");
        const { data, error } = await supabaseAdmin.rpc('admin_process_payout', { p_payout_id: requestId, p_admin_id: user.id, p_action: action });
        if (error) throw error;
        if (!data?.success) throw new Error(data?.error || 'Failed to update');
        result = data;
        break;
      }

      // ============ Executive Intake ============
      case "assign_intake": {
        const { requestId, assigneeId } = params;
        if (!requestId) throw new Error("Missing requestId");
        const { data, error } = await supabaseAdmin.from('executive_intake').update({ assigned_secretary: assigneeId || user.id }).eq('id', requestId).select().single();
        if (error) throw error;
        result = data;
        break;
      }

      case "update_intake_status": {
        const { requestId, status } = params;
        if (!requestId || !status) throw new Error("Missing required fields");
        const { data, error } = await supabaseAdmin.from('executive_intake').update({ status }).eq('id', requestId).select().single();
        if (error) throw error;
        result = data;
        break;
      }

      case "escalate_intake": {
        const { requestId } = params;
        if (!requestId) throw new Error("Missing requestId");
        const { data, error } = await supabaseAdmin.from('executive_intake').update({ status: 'escalated', escalated_to_admin: true }).eq('id', requestId).select().single();
        if (error) throw error;
        result = data;
        break;
      }

      case "update_intake_notes": {
        const { requestId, notes } = params;
        if (!requestId) throw new Error("Missing requestId");
        const { data, error } = await supabaseAdmin.from('executive_intake').update({ notes }).eq('id', requestId).select().single();
        if (error) throw error;
        result = data;
        break;
      }

      // ============ Manual Orders ============
      case "approve_manual_order": {
        const { orderId, externalTxId } = params;
        if (!orderId) throw new Error("Missing orderId");
        const { data, error } = await supabaseAdmin.rpc('approve_manual_order', { p_order_id: orderId, p_admin_id: user.id, p_external_tx_id: externalTxId || `MANUAL-${Date.now()}` });
        if (error) throw error;
        result = data;
        break;
      }

      case "reject_manual_order": {
        const { orderId, reason } = params;
        if (!orderId) throw new Error("Missing orderId");
        const { data, error } = await supabaseAdmin.from('manual_coin_orders').update({ status: 'rejected', rejection_reason: reason, processed_by: user.id, processed_at: new Date().toISOString() }).eq('id', orderId).select().single();
        if (error) throw error;
        result = data;
        break;
      }

      case "delete_manual_order": {
        const { orderId } = params;
        if (!orderId) throw new Error("Missing orderId");
        const { data, error } = await supabaseAdmin.from('manual_coin_orders').update({ deleted_at: new Date().toISOString() }).eq('id', orderId).select().single();
        if (error) throw error;
        result = data;
        break;
      }

      case "get_manual_orders_dashboard": {
        if (!isAdmin && !isSecretary) throw new Error("Unauthorized");
        const { data: orders, error: ordersError } = await supabaseAdmin.from('manual_coin_orders').select('*').is('deleted_at', null).order('created_at', { ascending: false }).limit(200);
        if (ordersError) throw ordersError;
        result = { orders: orders || [], profiles: {}, packages: {} };
        break;
      }

      case "get_user_ip": {
        if (!isAdmin) throw new Error("Unauthorized: Admin only");
        const { userId } = params;
        if (!userId) throw new Error("Missing userId");
        const { data, error } = await supabaseAdmin.from('user_profiles').select('last_known_ip').eq('id', userId).single();
        if (error) throw error;
        result = { ip: data?.last_known_ip };
        break;
      }

      // ============ User Management ============
      case "get_users": {
        if (!isAdmin && !isSecretary) throw new Error("Unauthorized");
        const { page = 1, limit = 100, search } = params;
        const from = (page - 1) * limit;
        const canViewEmails = profile.role === 'admin' || profile.is_admin === true;
        const selectFields = canViewEmails ? 'id, username, email, role, troll_coins, free_coin_balance, level, is_troll_officer, is_lead_officer, is_admin, is_troller, created_at, full_name' : 'id, username, role, troll_coins, free_coin_balance, level, is_troll_officer, is_lead_officer, is_admin, is_troller, created_at, full_name';
        let query = supabaseAdmin.from('user_profiles').select(selectFields, { count: 'exact' });
        if (search) query = canViewEmails ? query.or(`username.ilike.%${search}%,email.ilike.%${search}%,full_name.ilike.%${search}%`) : query.or(`username.ilike.%${search}%,full_name.ilike.%${search}%`);
        query = query.order('created_at', { ascending: false }).range(from, from + limit - 1);
        const { data, error, count } = await query;
        if (error) throw error;
        result = { data, count };
        break;
      }

      case "update_user_profile": {
        if (!isAdmin) throw new Error("Unauthorized: Admin only");
        const { userId, updates, coinAdjustment, roleUpdate: _roleUpdate } = params;
        if (!userId) throw new Error("Missing userId");
        if (updates && Object.keys(updates).length > 0) {
          const { error } = await supabaseAdmin.rpc('admin_update_any_profile_field', { p_user_id: userId, p_updates: updates, p_admin_id: user.id, p_reason: 'Admin Panel Update' });
          if (error) throw error;
        }
        if (coinAdjustment) {
          const { amount, reason } = coinAdjustment;
          if (amount > 0) {
            const { error: creditError } = await supabaseAdmin.rpc('troll_bank_credit_coins', { p_user_id: userId, p_coins: amount, p_bucket: 'paid', p_source: 'admin_grant', p_ref_id: null, p_metadata: { admin_id: user.id, reason: reason || 'Manual Adjustment' } });
            if (creditError) throw creditError;
          } else if (amount < 0) {
            const { error: spendError } = await supabaseAdmin.rpc('troll_bank_spend_coins_secure', { p_user_id: userId, p_amount: Math.abs(amount), p_bucket: 'paid', p_source: 'admin_deduct', p_ref_id: null, p_metadata: { admin_id: user.id, reason: reason || 'Manual Adjustment' } });
            if (spendError) throw spendError;
          }
        }
        result = { success: true };
        break;
      }

      case "update_user_bypass": {
        if (!isAdmin) throw new Error("Unauthorized: Admin only");
        const { userId, bypass } = params;
        if (!userId) throw new Error("Missing userId");
        const { data, error } = await supabaseAdmin.rpc('admin_update_any_profile_field', { p_user_id: userId, p_updates: { bypass_broadcast_restriction: bypass }, p_admin_id: user.id, p_reason: 'Admin Panel Bypass Update' });
        if (error) throw error;
        result = { success: true, data };
        break;
      }

      case "ban_user_action": {
        if (!isAdmin) throw new Error("Unauthorized: Admin only");
        const { userId, until, reason } = params;
        if (!userId) throw new Error("Missing userId");
        let minutes = 525600;
        if (until) { const diff = new Date(until).getTime() - Date.now(); if (diff > 0) minutes = Math.floor(diff / 60000); }
        const { data: rpcResult, error } = await supabaseAdmin.rpc('ban_user', { target: userId, minutes, reason: reason || 'Banned by admin', acting_admin_id: user.id });
        if (error) throw error;
        if (rpcResult && rpcResult.status === 'error') throw new Error(rpcResult.message || rpcResult.error || 'Ban failed');
        result = { success: true };
        break;
      }

      case "unban_user_action": {
        if (!isAdmin) throw new Error("Unauthorized: Admin only");
        const { userId } = params;
        if (!userId) throw new Error("Missing userId");
        const { error } = await supabaseAdmin.rpc('admin_update_any_profile_field', { p_user_id: userId, p_updates: { is_banned: false }, p_admin_id: user.id, p_reason: 'Unbanned by admin' });
        if (error) throw error;
        result = { success: true };
        break;
      }

      case "soft_delete_user": {
        if (!isAdmin) throw new Error("Unauthorized: Admin only");
        const { userId, reason } = params;
        if (!userId) throw new Error("Missing userId");
        const { error } = await supabaseAdmin.rpc('admin_soft_delete_user', { p_user_id: userId, p_reason: reason || 'Admin deleted via dashboard' });
        if (error) throw error;
        result = { success: true };
        break;
      }

      case "set_user_level": {
        if (!isAdmin) throw new Error("Unauthorized: Admin only");
        const { userId, level } = params;
        if (!userId || level === undefined) throw new Error("Missing params");
        const numLevel = Number(level);
        if (isNaN(numLevel) || numLevel < 1 || numLevel > 100) throw new Error("Invalid level");
        const { error } = await supabaseAdmin.rpc('admin_update_any_profile_field', { p_user_id: userId, p_updates: { tier: numLevel.toString(), level: numLevel }, p_admin_id: user.id, p_reason: 'Admin set level' });
        if (error) throw error;
        result = { success: true };
        break;
      }

      case "notify_user": {
        if (!isAdmin && !isSecretary) throw new Error("Unauthorized");
        const { targetUserId, title, message } = params;
        if (!targetUserId || !message) throw new Error("Missing required fields");
        const { error } = await supabaseAdmin.rpc('notify_user_rpc', { p_target_user_id: targetUserId, p_type: 'system_alert', p_title: title || 'System Notification', p_message: message });
        if (error) throw error;
        result = { success: true };
        break;
      }

      // ============ MARKETING READ-ONLY USER MANAGEMENT ============
      case "create_marketing_user": {
        if (!isAdmin) throw new Error("Unauthorized: Admin only");
        const { email, username, fullName } = params;
        if (!email || !username) throw new Error("Missing email or username");
        if (!email.includes('@')) throw new Error("Invalid email format");

        // Check if user with this email already exists
        const { data: existingUser } = await supabaseAdmin.auth.admin.listUsers();
        const userExists = existingUser?.users.some(u => u.email?.toLowerCase() === email.toLowerCase());
        if (userExists) {
          throw new Error("User with this email already exists");
        }

        // Check if profile with this username already exists
        const { data: existingProfile } = await supabaseAdmin.from("user_profiles").select("id").eq("username", username).single();
        if (existingProfile) {
          throw new Error("Username already taken");
        }

        const password = params.password || (() => { const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%&*"; let pwd = ""; for (let i = 0; i < 16; i++) { pwd += chars[Math.floor(Math.random() * chars.length)]; } return pwd; })();
        const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({ email: email, password: password, email_confirm: true, user_metadata: { username: username, full_name: fullName || username } });
        if (createError) throw createError;
        if (!newUser.user) throw new Error("Failed to create user");
        const newUserId = newUser.user.id;
        const { error: profileError } = await supabaseAdmin.from("user_profiles").insert({ id: newUserId, username: username, email: email, role: "marketing_readonly", bio: "Marketing Agency Read-Only Account", created_at: new Date().toISOString(), is_broadcaster: true, is_creator_onboarded: false, troll_coins: 0, total_earned_coins: 0, total_spent_coins: 0, tier: 'Bronze' });
        if (profileError) { await supabaseAdmin.auth.admin.deleteUser(newUserId); throw profileError; }
        await supabaseAdmin.rpc("log_admin_action", { p_action_type: "create_marketing_user", p_target_id: newUserId, p_details: { email, username, created_by: user.id } });
        result = { success: true, userId: newUserId, email, password };
        break;
      }

      case "delete_marketing_user": {
        if (!isAdmin) throw new Error("Unauthorized: Admin only");
        const { userId } = params;
        if (!userId) throw new Error("Missing userId");
        const { data: targetProfile, error: fetchError } = await supabaseAdmin.from("user_profiles").select("role, username").eq("id", userId).single();
        if (fetchError) throw fetchError;
        if (targetProfile.role !== "marketing_readonly") throw new Error("User is not a marketing_readonly account");
        const { error: roleError } = await supabaseAdmin.rpc('set_user_role', { target_user: userId, new_role: 'user', reason: `Removed by admin ${user.id}`, acting_admin_id: user.id });
        if (roleError) throw roleError;
        const { error: disableError } = await supabaseAdmin.auth.admin.updateUserById(userId, { ban_duration: "forever" });
        if (disableError) console.error("Warning: Failed to ban user:", disableError);
        await supabaseAdmin.rpc("log_admin_action", { p_action_type: "delete_marketing_user", p_target_id: userId, p_details: { username: targetProfile.username, deleted_by: user.id } });
        result = { success: true };
        break;
      }

      case "get_marketing_users": {
        if (!isAdmin) throw new Error("Unauthorized: Admin only");
        const { data, error } = await supabaseAdmin.from("user_profiles").select("id, username, email, created_at, last_active").eq("role", "marketing_readonly").order("created_at", { ascending: false });
        if (error) throw error;
        result = { users: data || [] };
        break;
      }

      // ============ Applications ============
      case "get_applications": {
        if (!isAdmin && !isSecretary) throw new Error("Unauthorized");
        const { data: filled } = await supabaseAdmin.rpc('is_lead_officer_position_filled');
        const { data: applications, error } = await supabaseAdmin.from('applications').select(`*, user_profiles!user_id(username, email, created_at, rgb_username_expires_at)`).neq('status', 'deleted').order('created_at', { ascending: false });
        if (error) throw error;
        result = { applications, positionFilled: filled };
        break;
      }

      case "get_seller_appeals": {
        if (!isAdmin && !isSecretary) throw new Error("Unauthorized");
        const { data, error } = await supabaseAdmin.from('applications').select(`*, user_profiles!user_id(username, email)`).eq('type', 'seller').eq('appeal_requested', true).eq('appeal_status', 'pending').order('appeal_requested_at', { ascending: false });
        if (error) throw error;
        result = { appeals: data };
        break;
      }

      case "approve_application": {
        if (!isAdmin && !isSecretary) throw new Error("Unauthorized");
        const { applicationId, type, userId, interviewDate, interviewTime } = params;
        if (!applicationId) throw new Error("Missing applicationId");
        let appType = type, appUserId = userId;
        if (!appType || !appUserId) { const { data: app, error: fetchError } = await supabaseAdmin.from('applications').select('type, user_id').eq('id', applicationId).single(); if (fetchError) throw fetchError; appType = app.type; appUserId = app.user_id; }
        if (interviewDate && interviewTime) {
          const scheduledAt = new Date(`${interviewDate}T${interviewTime}`).toISOString();
          const { error: interviewError } = await supabaseAdmin.from('interview_sessions').insert({ application_id: applicationId, user_id: appUserId, interviewer_id: user.id, scheduled_at: scheduledAt, status: 'active' });
          if (interviewError) throw interviewError;
          const { error: updateError } = await supabaseAdmin.from('applications').update({ status: 'interview_scheduled', reviewed_by: user.id, reviewed_at: new Date().toISOString() }).eq('id', applicationId);
          if (updateError) throw updateError;
          result = { success: true, message: "Interview scheduled" };
        } else {
          const { error: updateError } = await supabaseAdmin.from('applications').update({ status: 'approved', reviewed_by: user.id, reviewed_at: new Date().toISOString() }).eq('id', applicationId);
          if (updateError) throw updateError;
          // Career positions that should set job_title instead of role
          const careerPositionTypes = ['auctioneer', 'secretary', 'journalist', 'tcnn_news_caster', 'tcnn_chief_news_caster', 'prosecutor', 'attorney', 'agency_hr', 'agency_hr_manager', 'agency_leader', 'ceo_assistant', 'noah_assistant'];
          if (appType === "seller") await supabaseAdmin.rpc('set_user_role', { target_user: appUserId, new_role: 'seller', reason: 'Application Approved', acting_admin_id: user.id });
          else if (appType === "troll_officer") await supabaseAdmin.from('user_profiles').update({ is_troll_officer: true, is_officer_active: true }).eq('id', appUserId);
          else if (appType === "lead_officer") await supabaseAdmin.from('user_profiles').update({ is_lead_officer: true, is_officer_active: true }).eq('id', appUserId);
          else if (careerPositionTypes.includes(appType)) await supabaseAdmin.from('user_profiles').update({ job_title: appType }).eq('id', appUserId);
          // Send Tromail notification
          const roleLabelMap: Record<string, string> = { seller: 'Seller', troll_officer: 'Troll Officer', lead_officer: 'Lead Troll Officer', auctioneer: 'Auctioneer', secretary: 'Secretary', journalist: 'Journalist', tcnn_news_caster: 'TCNN News Caster', tcnn_chief_news_caster: 'TCNN Chief News Caster', prosecutor: 'Prosecutor', attorney: 'Attorney', agency_hr: 'Agency HR', agency_hr_manager: 'Agency HR Manager', agency_leader: 'Agency Leader', ceo_assistant: 'CEO Assistant', noah_assistant: 'Noah Assistant' };
          const roleLabel = roleLabelMap[appType] || appType;
          try { await supabaseAdmin.rpc('send_tromail_message', { p_sender_user_id: user.id, p_sender_role: profile.role, p_sender_tromail_address: '', p_subject: `Application Approved: ${roleLabel}`, p_body: `Your application for the ${roleLabel} position has been approved! You now have access to the RTC Admin Monitor dashboard at /rtcadminmonitor.`, p_is_admin_email: true, p_is_important: true, p_recipient_user_ids: [appUserId], p_recipient_roles: [''] }); } catch (e) { console.warn('Tromail error:', e); }
          result = { success: true };
        }
        break;
      }

      case "deny_application": {
        if (!isAdmin) throw new Error("Unauthorized");
        const { applicationId, reason } = params;
        if (!applicationId) throw new Error("Missing applicationId");
        const { error } = await supabaseAdmin.rpc('deny_application', { p_app_id: applicationId, p_reviewer_id: user.id, p_reason: reason || null });
        if (error) throw error;
        result = { success: true };
        break;
      }

      case "delete_application": {
        if (!isAdmin) throw new Error("Unauthorized");
        const { applicationId } = params;
        if (!applicationId) throw new Error("Missing applicationId");
        const { error } = await supabaseAdmin.from('applications').update({ status: 'deleted', reviewed_by: user.id, reviewed_at: new Date().toISOString() }).eq('id', applicationId);
        if (error) throw error;
        result = { success: true };
        break;
      }

      // ============ Reports & Streams ============
      case "get_stream_reports": {
        if (!isAdmin && !isSecretary) throw new Error("Unauthorized");
        const { data, error } = await supabaseAdmin.from("stream_reports").select("*").order("created_at", { ascending: false }).limit(params.limit || 50);
        if (error) throw error;
        result = { reports: data };
        break;
      }

      case "get_recent_chat_logs": {
        if (!isAdmin && !isSecretary) throw new Error("Unauthorized");
        const { data, error } = await supabaseAdmin.from("messages").select("*").order("created_at", { ascending: false }).limit(params.limit || 100);
        if (error) throw error;
        result = { logs: data };
        break;
      }

      case "get_banned_users": {
        if (!isAdmin && !isSecretary) throw new Error("Unauthorized");
        const { data, error } = await supabaseAdmin.from("user_profiles").select("id, username, email, is_banned").eq("is_banned", true).order("created_at", { ascending: false });
        if (error) throw error;
        result = { bans: data };
        break;
      }

      case "get_active_streams_admin": {
        if (!isAdmin && !isSecretary) throw new Error("Unauthorized");
        const { data, error } = await supabaseAdmin.from("streams").select("id, title, broadcaster_id, status, current_viewers, created_at").eq("is_live", true);
        if (error) throw error;
        result = { streams: data };
        break;
      }

      case "admin_force_end_stream": {
        if (!isAdmin) throw new Error("Unauthorized");
        const { streamId, reason: _reason } = params;
        if (!streamId) throw new Error("Missing streamId");
        const { error } = await supabaseAdmin.from("streams").update({ is_live: false, status: "ended", end_time: new Date().toISOString() }).eq("id", streamId);
        if (error) throw error;
        result = { success: true };
        break;
      }

      // ============ Support Tickets ============
      case "get_support_tickets": {
        if (!isAdmin && !isSecretary) throw new Error("Unauthorized");
        const { data, error } = await supabaseAdmin.from("support_tickets").select("*").order("created_at", { ascending: false });
        if (error) throw error;
        result = { tickets: data };
        break;
      }

      case "resolve_support_ticket": {
        if (!isAdmin && !isSecretary) throw new Error("Unauthorized");
        const { ticketId, response } = params;
        if (!ticketId || !response) throw new Error("Missing params");
        const { error } = await supabaseAdmin.rpc('resolve_support_ticket', { p_ticket_id: ticketId, p_response: response });
        if (error) throw error;
        result = { success: true };
        break;
      }

      case "close_support_ticket": {
        if (!isAdmin && !isSecretary) throw new Error("Unauthorized");
        const { ticketId } = params;
        if (!ticketId) throw new Error("Missing ticketId");
        const { error } = await supabaseAdmin.from("support_tickets").update({ status: "closed", response_at: new Date().toISOString() }).eq("id", ticketId);
        if (error) throw error;
        result = { success: true };
        break;
      }

      case "delete_support_ticket": {
        if (!isAdmin) throw new Error("Unauthorized");
        const { ticketId } = params;
        if (!ticketId) throw new Error("Missing ticketId");
        const { error } = await supabaseAdmin.rpc('delete_support_ticket', { p_ticket_id: ticketId });
        if (error) throw error;
        result = { success: true };
        break;
      }

      // ============ Executive Intake ============
      case "get_executive_intake": {
        if (!isAdmin && !isSecretary) throw new Error("Unauthorized");
        const { limit = 100 } = params;
        const { data, error } = await supabaseAdmin
          .from('executive_intake')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(limit);
        if (error) throw error;
        result = { intake: data };
        break;
      }

      // ============ Default ============
      default:
        throw new Error(`Unknown action: ${action}`);
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders(req.headers.get("origin")), "Content-Type": "application/json" },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders(req.headers.get("origin")), "Content-Type": "application/json" },
    });
  }
});