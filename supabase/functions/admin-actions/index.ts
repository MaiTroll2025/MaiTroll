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

    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser();

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

    const isAdmin = 
      profile.role === "admin" || 
      profile.role === "lead_troll_officer" || 
      profile.is_lead_officer === true ||
      profile.is_admin === true;

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
      // --- Payout Requests ---
      case "approve_payout": {
        if (!isAdmin) throw new Error("Unauthorized");
        const { requestId } = params;
        if (!requestId) throw new Error("Missing requestId");

        const { data, error } = await supabaseAdmin
          .from("payout_requests")
          .update({
            status: "approved",
            reviewed_by: user.id,
            updated_at: new Date().toISOString(),
          })
          .eq("id", requestId)
          .select()
          .single();

        if (error) throw error;

        await supabaseAdmin.rpc("log_admin_action", {
          p_action_type: "approve_payout_request",
          p_target_id: requestId,
          p_details: { status: "approved" },
        });

        result = data;
        break;
      }

      case "reject_payout": {
        if (!isAdmin) throw new Error("Unauthorized");
        const { requestId, reason } = params;
        if (!requestId) throw new Error("Missing requestId");

        const { data, error } = await supabaseAdmin
          .from("payout_requests")
          .select("coin_amount, user_id, status")
          .eq("id", requestId)
          .single();

        if (error) throw error;

        if (data && data.status !== 'rejected' && data.status !== 'denied') {
          const { error: denyError } = await supabaseAdmin.rpc("troll_bank_deny_cashout", {
            p_request_id: requestId,
            p_admin_id: user.id,
            p_reason: reason || null,
          });

          if (denyError) {
            console.error("[reject_payout] troll_bank_deny_cashout error", denyError);
          }
        }

        const { data: updateData, error: updateError } = await supabaseAdmin
          .from("payout_requests")
          .update({
            status: "rejected",
            rejected_reason: reason,
            reviewed_by: user.id,
            updated_at: new Date().toISOString(),
          })
          .eq("id", requestId)
          .select()
          .single();

        if (updateError) throw updateError;

        await supabaseAdmin.rpc("log_admin_action", {
          p_action_type: "reject_payout_request",
          p_target_id: requestId,
          p_details: { status: "rejected", reason: reason },
        });

        result = updateData;
        break;
      }

      case "update_payout_status": {
        if (!isAdmin) throw new Error("Unauthorized");
        const { payoutId, newStatus, reason, paymentReference, notes } = params;
        if (!payoutId || !newStatus) throw new Error("Missing required fields");

        const updates: any = {
            status: newStatus,
            updated_at: new Date().toISOString()
        };

        if (newStatus === 'rejected') {
            updates.rejection_reason = reason;
            updates.processed_by = user.id;
            updates.processed_at = new Date().toISOString();
        } else if (newStatus === 'paid') {
             updates.paid_at = new Date().toISOString();
             updates.processed_by = user.id;
        } else if (newStatus === 'approved') {
             updates.approved_at = new Date().toISOString();
             updates.processed_by = user.id;
        }
        
        if (paymentReference) updates.payment_reference = paymentReference;
        if (notes) updates.notes = notes;

        const { data, error } = await supabaseAdmin
            .from('payout_requests')
            .update(updates)
            .eq('id', payoutId)
            .select()
            .single();

        if (error) throw error;

        await supabaseAdmin.rpc("log_admin_action", {
            p_action_type: "update_payout_status",
            p_target_id: payoutId,
            p_details: { status: newStatus, reason, paymentReference, notes }
        });

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

      // --- ID Verification ---
      case "verify_id": {
        if (!isAdmin) throw new Error("Unauthorized");
        const { targetUserId, action, reason } = params;
        if (!targetUserId || !action) throw new Error("Missing targetUserId or action");

        const { data, error } = await supabaseAdmin.rpc("admin_verify_id", {
          p_target_user_id: targetUserId,
          p_action: action,
          p_reason: reason || null
        });

        if (error) throw error;
        if (data?.error) throw new Error(data.error);

        await supabaseAdmin.rpc("log_admin_action", {
          p_action_type: "verify_id",
          p_target_id: targetUserId,
          p_details: { action, reason }
        });

        result = data;
        break;
      }

      // --- User Management ---
      case "get_users": {
        if (!isAdmin && !isSecretary) throw new Error("Unauthorized");

        const { page = 1, limit = 100, search } = params;
        const from = (page - 1) * limit;
        const to = from + limit - 1;

        const canViewEmails = profile.role === 'admin' || profile.is_admin === true;

        const selectFields = canViewEmails
? 'id, username, email, role, troll_coins, paid_coin_balance, free_coin_balance, level, is_troll_officer, is_lead_officer, is_admin, is_troller, created_at, full_name, phone, onboarding_completed, terms_accepted, id_verification_status, bypass_broadcast_restriction, glowing_username_color, rgb_username_expires_at, is_gold, username_style, badge'
        : 'id, username, role, troll_coins, paid_coin_balance, free_coin_balance, level, is_troll_officer, is_lead_officer, is_admin, is_troller, created_at, full_name, phone, onboarding_completed, terms_accepted, id_verification_status, bypass_broadcast_restriction, glowing_username_color, rgb_username_expires_at, is_gold, username_style, badge';

        let query = supabaseAdmin
          .from('user_profiles')
          .select(selectFields, { count: 'exact' });

        if (search) {
            if (canViewEmails) {
                query = query.or(`username.ilike.%${search}%,email.ilike.%${search}%,full_name.ilike.%${search}%`);
            } else {
                query = query.or(`username.ilike.%${search}%,full_name.ilike.%${search}%`);
            }
        }

        query = query.order('created_at', { ascending: false }).range(from, to);

        const { data, error, count } = await query;

        if (error) throw error;
        result = { data, count };
        break;
      }

      case "update_user_profile": {
        if (!isAdmin) throw new Error("Unauthorized: Admin only");
        const { userId, updates, coinAdjustment, roleUpdate } = params;
        if (!userId) throw new Error("Missing userId");

        if (roleUpdate) {
            const { newRole, reason } = roleUpdate;
            if (newRole) {
                const { data: targetUserRes, error: targetError } = await supabaseAdmin.auth.admin.getUserById(userId);
                if (targetError) throw targetError;
                
                const OWNER_EMAIL = 'Mai Troll2025@gmail.com';
                const isTargetOwner = targetUserRes.user.email?.toLowerCase() === OWNER_EMAIL;
                const isActorOwner = user.email?.toLowerCase() === OWNER_EMAIL;

                if (isTargetOwner && !isActorOwner) {
                     throw new Error("CRITICAL: You cannot change the role of the Owner account.");
                }

                const { error: roleError } = await supabaseAdmin.rpc('set_user_role', {
                    target_user: userId,
                    new_role: newRole,
                    reason: reason || `Admin update by ${user.id}`,
                    acting_admin_id: user.id
                });
                if (roleError) throw roleError;
            }
        }

        if (updates && Object.keys(updates).length > 0) {
          const { error } = await supabaseAdmin.rpc('admin_update_any_profile_field', {
            p_user_id: userId,
            p_updates: updates,
            p_admin_id: user.id,
            p_reason: 'Admin Panel Update'
          });
          
          if (error) throw error;
        }

        if (coinAdjustment) {
            const { amount, reason } = coinAdjustment;
            if (amount !== 0) {
                if (amount > 0) {
                   const { error: creditError } = await supabaseAdmin.rpc('troll_bank_credit_coins', {
                     p_user_id: userId,
                     p_coins: amount,
                     p_bucket: 'paid',
                     p_source: 'admin_grant',
                     p_ref_id: null,
                     p_metadata: { admin_id: user.id, reason: reason || 'Manual Adjustment' }
                   });
                   if (creditError) throw creditError;
                } else {
                   const { error: spendError } = await supabaseAdmin.rpc('troll_bank_spend_coins_secure', {
                     p_user_id: userId,
                     p_amount: Math.abs(amount),
                     p_bucket: 'paid',
                     p_source: 'admin_deduct',
                     p_ref_id: null,
                     p_metadata: { admin_id: user.id, reason: reason || 'Manual Adjustment' }
                   });
                   if (spendError) throw spendError;
                }

                await supabaseAdmin.from('coin_transactions').insert({
                    user_id: userId,
                    type: 'admin_adjustment',
                    amount: amount,
                    description: `Admin adjustment: ${reason || 'Manual update'}`,
                    metadata: { admin_id: user.id }
                });
            }
        }

        result = { success: true };
        break;
      }

      case "update_user_bypass": {
        if (!isAdmin) throw new Error("Unauthorized: Admin only");
        const { userId, bypass } = params;
        if (!userId) throw new Error("Missing userId");

        const { data, error } = await supabaseAdmin.rpc('admin_update_any_profile_field', {
            p_user_id: userId,
            p_updates: { bypass_broadcast_restriction: bypass },
            p_admin_id: user.id,
            p_reason: 'Admin Panel Bypass Update'
        });

        if (error) throw error;
        
        await supabaseAdmin.rpc("log_admin_action", {
          p_action_type: "update_user_bypass",
          p_target_id: userId,
          p_details: { bypass }
        });

        result = { success: true, data };
        break;
      }

      case "ban_user_action": {
        if (!isAdmin) throw new Error("Unauthorized: Admin only");
        const { userId, until, reason } = params;
        if (!userId) throw new Error("Missing userId");

        let minutes = 525600;
        if (until) {
            const diff = new Date(until).getTime() - Date.now();
            if (diff > 0) {
                minutes = Math.floor(diff / 60000);
            }
        }

        const { data: rpcResult, error } = await supabaseAdmin.rpc('ban_user', {
            target: userId,
            minutes: minutes,
            reason: reason || 'Banned by admin',
            acting_admin_id: user.id
        });

        if (error) throw error;
        
        if (rpcResult && rpcResult.status === 'error') {
            throw new Error(rpcResult.message || rpcResult.error || 'Ban failed');
        }

        result = { success: true };
        break;
      }

      case "unban_user_action": {
        if (!isAdmin) throw new Error("Unauthorized: Admin only");
        const { userId } = params;
        if (!userId) throw new Error("Missing userId");

        const { data: rpcResult, error } = await supabaseAdmin.rpc('admin_update_any_profile_field', {
            p_user_id: userId,
            p_updates: { is_banned: false, banned_until: null },
            p_admin_id: user.id,
            p_reason: 'Unbanned by admin'
        });

        if (error) throw error;
        
        if (rpcResult && rpcResult.status === 'error') {
            throw new Error(rpcResult.message || 'Unban failed');
        }

        result = { success: true };
        break;
      }

      case "soft_delete_user": {
        if (!isAdmin) throw new Error("Unauthorized: Admin only");
        const { userId, reason } = params;
        if (!userId) throw new Error("Missing userId");

        const { error } = await supabaseAdmin.rpc('admin_soft_delete_user', {
            p_user_id: userId,
            p_reason: reason || 'Admin deleted via dashboard'
        });

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

        const { error } = await supabaseAdmin.rpc('admin_update_any_profile_field', {
            p_user_id: userId,
            p_updates: { tier: numLevel.toString(), level: numLevel },
            p_admin_id: user.id,
            p_reason: 'Admin set level'
        });
        
        if (error) throw error;
        result = { success: true };
        break;
      }

      case "notify_user": {
        if (!isAdmin && !isSecretary) throw new Error("Unauthorized");
        const { targetUserId, title, message } = params;
        if (!targetUserId || !message) throw new Error("Missing required fields");

        const { error } = await supabaseAdmin.rpc('notify_user_rpc', {
            p_target_user_id: targetUserId,
            p_type: 'system_alert',
            p_title: title || 'System Notification',
            p_message: message
        });

        if (error) {
          console.error(`Failed to send notification to ${targetUserId}:`, error);
          throw error;
        }

        result = { success: true };
        break;
      }

      // --- MARKETING READ-ONLY USER MANAGEMENT ---
      case "create_marketing_user": {
        if (!isAdmin) throw new Error("Unauthorized: Admin only");
        const { email, username, fullName } = params;
        if (!email || !username) throw new Error("Missing email or username");

        if (!email.includes('@')) throw new Error("Invalid email format");

        const password = params.password || (() => {
          const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%&*";
          let pwd = "";
          for (let i = 0; i < 16; i++) {
            pwd += chars[Math.floor(Math.random() * chars.length)];
          }
          return pwd;
        })();

        const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
          email: email,
          password: password,
          email_confirm: true,
          user_metadata: {
            username: username,
            full_name: fullName || username
          }
        });

        if (createError) {
          console.error("Auth creation error:", createError);
          throw new Error("Failed to create auth user: " + createError.message);
        }
        if (!newUser?.user) throw new Error("Failed to create user - no user returned");

        const newUserId = newUser.user.id;

        // Verify auth user was actually created
        const { data: authCheck, error: authCheckError } = await supabaseAdmin.auth.admin.getUserById(newUserId);
        if (authCheckError || !authCheck?.user) {
          console.error("Auth verification failed:", authCheckError);
          throw new Error("Auth user creation verification failed");
        }

        const { error: profileError } = await supabaseAdmin.from("user_profiles").insert({
          id: newUserId,
          username: username,
          email: email,
          role: "marketing_readonly",
          bio: "Marketing Agency Read-Only Account",
          created_at: new Date().toISOString(),
          is_broadcaster: true,
          is_creator_onboarded: false,
          troll_coins: 0,
          total_earned_coins: 0,
          total_spent_coins: 0,
          tier: 'Bronze'
        });

        if (profileError) {
          await supabaseAdmin.auth.admin.deleteUser(newUserId);
          throw profileError;
        }

        await supabaseAdmin.rpc("log_admin_action", {
          p_action_type: "create_marketing_user",
          p_target_id: newUserId,
          p_details: { email, username, created_by: user.id }
        });

        result = { success: true, userId: newUserId, email, password };
        break;
      }

      case "delete_marketing_user": {
        if (!isAdmin) throw new Error("Unauthorized: Admin only");
        const { userId } = params;
        if (!userId) throw new Error("Missing userId");

        const { data: targetProfile, error: fetchError } = await supabaseAdmin
          .from("user_profiles")
          .select("role, username")
          .eq("id", userId)
          .single();

        if (fetchError) throw fetchError;
        if (targetProfile.role !== "marketing_readonly") {
          throw new Error("User is not a marketing_readonly account");
        }

        const { error: roleError } = await supabaseAdmin.rpc('set_user_role', {
          target_user: userId,
          new_role: 'user',
          reason: `Removed by admin ${user.id}`,
          acting_admin_id: user.id
        });

        if (roleError) throw roleError;

        const { error: disableError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
          ban_duration: "forever"
        });

        if (disableError) {
          console.error("Warning: Failed to ban user:", disableError);
        }

        await supabaseAdmin.rpc("log_admin_action", {
          p_action_type: "delete_marketing_user",
          p_target_id: userId,
          p_details: { username: targetProfile.username, deleted_by: user.id }
        });

        result = { success: true };
        break;
      }

      case "get_marketing_users": {
        if (!isAdmin) throw new Error("Unauthorized: Admin only");

        const { data, error } = await supabaseAdmin
          .from("user_profiles")
          .select("id, username, email, created_at, last_active")
          .eq("role", "marketing_readonly")
          .order("created_at", { ascending: false });

        if (error) throw error;

        result = { users: data || [] };
        break;
      }

      // --- Applications ---
      case "get_applications": {
        if (!isAdmin && !isSecretary) throw new Error("Unauthorized");

        const { data: filled } = await supabaseAdmin.rpc('is_lead_officer_position_filled');

        const { data: applications, error } = await supabaseAdmin
          .from('applications')
          .select(`
            *,
            user_profiles!user_id (
              username,
              email,
              created_at,
              rgb_username_expires_at
            )
          `)
          .neq('status', 'deleted')
          .order('created_at', { ascending: false });

        if (error) throw error;
        result = { applications, positionFilled: filled };
        break;
      }

      case "get_seller_appeals": {
        if (!isAdmin && !isSecretary) throw new Error("Unauthorized");

        const { data, error } = await supabaseAdmin
          .from('applications')
          .select(`
            *,
            user_profiles!user_id (
              username,
              email
            )
          `)
          .eq('type', 'seller')
          .eq('appeal_requested', true)
          .eq('appeal_status', 'pending')
          .order('appeal_requested_at', { ascending: false });

        if (error) throw error;
        result = { appeals: data };
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
        const { error } = await supabaseAdmin.from("support_tickets").update({ status: "resolved", admin_response: response, admin_id: user.id, response_at: new Date().toISOString() }).eq("id", ticketId);
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
        const { error } = await supabaseAdmin.from("support_tickets").delete().eq("id", ticketId);
        if (error) throw error;
        result = { success: true };
        break;
      }

      case "approve_application": {
        const isAgencyHR = profile.role === "agency_hr" || profile.role === "agency_hr_manager" || profile.role === "agency_leader";
        if (!isAdmin && !isSecretary && !isAgencyHR) throw new Error("Unauthorized");
        const { applicationId, type, userId, interviewDate, interviewTime } = params;
        if (!applicationId) throw new Error("Missing applicationId");

        let appType = type;
        let appUserId = userId;

        if (!appType || !appUserId) {
          const { data: app, error: fetchError } = await supabaseAdmin
            .from("applications")
            .select("type, user_id")
            .eq("id", applicationId)
            .single();

          if (fetchError) throw fetchError;
          appType = app.type;
          appUserId = app.user_id;
        }

        if (interviewDate && interviewTime) {
          const scheduledAt = new Date(`${interviewDate}T${interviewTime}`).toISOString();
          const { error: interviewError } = await supabaseAdmin.from("interview_sessions").insert({
            application_id: applicationId,
            user_id: appUserId,
            interviewer_id: user.id,
            scheduled_at: scheduledAt,
            status: "active",
          });

          if (interviewError) throw interviewError;

          const { error: updateError } = await supabaseAdmin
            .from("applications")
            .update({ status: "interview_scheduled", reviewed_by: user.id, reviewed_at: new Date().toISOString() })
            .eq("id", applicationId);

          if (updateError) throw updateError;

          result = { success: true, message: "Interview scheduled" };
        } else {
          const { error: updateError } = await supabaseAdmin
            .from("applications")
            .update({ status: "approved", reviewed_by: user.id, reviewed_at: new Date().toISOString() })
            .eq("id", applicationId);

          if (updateError) throw updateError;

          // Career positions that should set job_title instead of role
          const careerPositionTypes = ['auctioneer', 'secretary', 'journalist', 'tcnn_news_caster', 'tcnn_chief_news_caster', 'prosecutor', 'attorney', 'agency_hr', 'agency_hr_manager', 'agency_leader', 'ceo_assistant', 'noah_assistant'];

          if (appType === "seller") {
            const { error: roleError } = await supabaseAdmin.rpc("set_user_role", {
              target_user: appUserId,
              new_role: "seller",
              reason: "Application Approved",
              acting_admin_id: user.id,
            });
            if (roleError) throw roleError;
          } else if (appType === "troll_officer") {
            const { error: profileError } = await supabaseAdmin
              .from("user_profiles")
              .update({ is_troll_officer: true, is_officer_active: true })
              .eq("id", appUserId);
            if (profileError) throw profileError;
          } else if (appType === "lead_officer") {
            const { error: profileError } = await supabaseAdmin
              .from("user_profiles")
              .update({ is_lead_officer: true, is_officer_active: true })
              .eq("id", appUserId);
            if (profileError) throw profileError;
          } else if (careerPositionTypes.includes(appType)) {
            // For career positions, set job_title and appropriate role
            const { error: profileError } = await supabaseAdmin
              .from("user_profiles")
              .update({ job_title: appType })
              .eq("id", appUserId);
            if (profileError) throw profileError;
          }

          // Send Tromail notification for all approvals
          const roleLabelMap: Record<string, string> = {
            seller: 'Seller',
            troll_officer: 'Troll Officer',
            lead_officer: 'Lead Troll Officer',
            auctioneer: 'Auctioneer',
            secretary: 'Secretary',
            journalist: 'Journalist',
            tcnn_news_caster: 'TCNN News Caster',
            tcnn_chief_news_caster: 'TCNN Chief News Caster',
            prosecutor: 'Prosecutor',
            attorney: 'Attorney',
            agency_hr: 'Agency HR',
            agency_hr_manager: 'Agency HR Manager',
            agency_leader: 'Agency Leader',
            ceo_assistant: 'CEO Assistant',
            noah_assistant: 'Noah Assistant',
          };

          const roleLabel = roleLabelMap[appType] || appType;
          try {
            await supabaseAdmin.rpc('send_tromail_message', {
              p_sender_user_id: user.id,
              p_sender_role: profile.role,
              p_sender_tromail_address: '',
              p_subject: `Application Approved: ${roleLabel}`,
              p_body: `Your application for the ${roleLabel} position has been approved! You now have access to the RTC Admin Monitor dashboard at /rtcadminmonitor.`,
              p_is_admin_email: true,
              p_is_important: true,
              p_recipient_user_ids: [appUserId],
              p_recipient_roles: ['']
            });
          } catch (tromailErr) {
            console.warn('Failed to send Tromail notification on approval:', tromailErr);
          }

          result = { success: true };
        }

        break;
      }

      case "get_stream_reports": {
        const { limit } = params;
        const { data: reports, error: reportsError } = await supabaseAdmin
          .from("moderation_reports")
          .select("*, reporter:user_profiles!moderation_reports_reporter_id_fkey(username), target_user:user_profiles!moderation_reports_target_user_id_fkey(username)")
          .order("created_at", { ascending: false })
          .limit(limit || 50);
        if (reportsError) throw reportsError;
        result = { reports: reports || [] };
        break;
      }

      case "get_recent_chat_logs": {
        const { limit } = params;
        const { data: logs, error: logsError } = await supabaseAdmin
          .from("stream_chat")
          .select("*, user:user_profiles(username, avatar_url)")
          .order("created_at", { ascending: false })
          .limit(limit || 100);
        if (logsError) throw logsError;
        result = { logs: logs || [] };
        break;
      }

      case "get_banned_users": {
        const { limit } = params;
        const { data: users, error: usersError } = await supabaseAdmin
          .from("user_profiles")
          .select("id, username, email, is_banned, banned_until")
          .eq("is_banned", true)
          .order("banned_until", { ascending: false })
          .limit(limit || 100);
        if (usersError) throw usersError;
        result = { users: users || [] };
        break;
      }

      // --- Founder Rewards ---
      case "grant_founder_reward": {
        if (!isAdmin && !isSecretary) throw new Error("Unauthorized");
        const { targetUserId, rewardType } = params;
        if (!targetUserId || !rewardType) throw new Error("Missing targetUserId or rewardType");

        const validRewards = ['ceo_fam_badge', 'agency_fee_waived', 'early_supporter', 'founder_status'];
        if (!validRewards.includes(rewardType)) {
          throw new Error(`Invalid reward type. Must be one of: ${validRewards.join(', ')}`);
        }

        // Use the database function to grant the reward
        const { data, error } = await supabaseAdmin.rpc('grant_founder_reward', {
          p_target_user_id: targetUserId,
          p_reward_type: rewardType,
          p_admin_id: user.id,
        });

        if (error) throw error;
        if (data && !data.success) throw new Error(data.error || 'Failed to grant reward');

        // Also update user_profiles metadata for backward compatibility
        const { data: currentProfile } = await supabaseAdmin
          .from('user_profiles')
          .select('metadata')
          .eq('id', targetUserId)
          .single();

        const currentMeta = (currentProfile?.metadata as Record<string, any>) || {};
        const updatedMeta = { ...currentMeta, [rewardType]: true };

        await supabaseAdmin
          .from('user_profiles')
          .update({ metadata: updatedMeta })
          .eq('id', targetUserId);

        // If granting CEO Fam Badge, also equip the founder frame
        if (rewardType === 'ceo_fam_badge') {
          const { data: frameData } = await supabaseAdmin
            .from('profile_frames')
            .select('id')
            .eq('rarity', 'founder')
            .maybeSingle();

          if (frameData?.id) {
            // Insert or update user_profile_frames
            await supabaseAdmin
              .from('user_profile_frames')
              .upsert({
                user_id: targetUserId,
                frame_id: frameData.id,
                is_equipped: true,
              }, { onConflict: 'user_id, frame_id' });
          }
        }

        // If granting agency fee waived, update agency_applications if exists
        if (rewardType === 'agency_fee_waived') {
          await supabaseAdmin
            .from('agency_applications')
            .update({ fee_waived: true })
            .eq('user_id', targetUserId)
            .eq('status', 'pending');
        }

        result = data;
        break;
      }

      case "get_founder_rewards": {
        if (!isAdmin && !isSecretary) throw new Error("Unauthorized");
        const { targetUserId } = params;

        let query = supabaseAdmin
          .from('founder_rewards')
          .select('*');

        if (targetUserId) {
          query = query.eq('user_id', targetUserId);
        }

        const { data: rewards, error } = await query;
        if (error) throw error;

        // Also get grant history
        const { data: grants, error: grantsError } = await supabaseAdmin
          .from('founder_rewards_grants')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(50);

        result = { rewards: rewards || [], grants: grants || [] };
        break;
      }

      // --- Executive Secretary Management ---
      case "get_secretary_assignments": {
        if (!isAdmin) throw new Error("Unauthorized");
        
        const { data: assignments, error } = await supabaseAdmin
          .from('secretary_assignments')
          .select('*');
        
        if (error) throw error;
        
        // Fetch profiles separately since FK points to auth.users, not user_profiles
        const secretaryIds = (assignments || []).map((a: { secretary_id: any; }) => a.secretary_id);
        let profilesMap: Record<string, { username: string; avatar_url: string }> = {};
        
        if (secretaryIds.length > 0) {
          const { data: profiles } = await supabaseAdmin
            .from('user_profiles')
            .select('id, username, avatar_url')
            .in('id', secretaryIds);
          
          if (profiles) {
            profilesMap = Object.fromEntries(profiles.map((p: { id: any; username: any; avatar_url: any; }) => [p.id, { username: p.username, avatar_url: p.avatar_url }]));
          }
        }
        
        result = { 
          assignments: (assignments || []).map((a: { secretary_id: string | number; }) => ({
            ...a,
            secretary: profilesMap[a.secretary_id] || { username: 'Unknown', avatar_url: '' }
          }))
        };
        break;
      }

      case "search_users_for_secretary": {
        if (!isAdmin) throw new Error("Unauthorized");
        const { query } = params;
        if (!query || query.length < 3) throw new Error("Invalid query");

        const { data, error } = await supabaseAdmin
          .from('user_profiles')
          .select('id, username, avatar_url')
          .ilike('username', `%${query}%`)
          .limit(5);

        if (error) throw error;
        result = { users: data };
        break;
      }

      case "assign_secretary": {
        if (!isAdmin) throw new Error("Unauthorized");
        const { secretaryId } = params;
        if (!secretaryId) throw new Error("Missing secretaryId");

        // Check current count
        const { count, error: countError } = await supabaseAdmin
            .from('secretary_assignments')
            .select('*', { count: 'exact', head: true });
        
        if (countError) throw countError;
        if ((count || 0) >= 2) throw new Error("Maximum of 2 executive secretaries allowed");

        const { error } = await supabaseAdmin
            .from('secretary_assignments')
            .insert({
                secretary_id: secretaryId,
                assigned_by: user.id
            });

        if (error) throw error;
        result = { success: true };
        break;
      }

      case "remove_secretary": {
        if (!isAdmin) throw new Error("Unauthorized");
        const { assignmentId } = params;
        if (!assignmentId) throw new Error("Missing assignmentId");

        const { error } = await supabaseAdmin
            .from('secretary_assignments')
            .delete()
            .eq('id', assignmentId);

        if (error) throw error;
        result = { success: true };
        break;
      }

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