import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function notifyAdmins(userId: string, username: string): Promise<void> {
  // Get admin users
  const { data: admins } = await supabase
    .from("user_profiles")
    .select("user_id")
    .eq("role", "admin")
    .eq("is_online", true);

  if (!admins) return;

  // Create notifications for each admin
  for (const admin of admins) {
    await supabase.from("notifications").insert({
      user_id: admin.user_id,
      type: "account_deleted",
      title: "Account Deleted",
      content: `User ${username} (${userId}) has deleted their account. All coins and data have been removed.`,
      link: "/admin/users",
    });
  }
}

async function hardDeleteUser(userId: string, reason: string, awarenessConfirmed: boolean): Promise<void> {
  // Get username before deletion
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("username")
    .eq("user_id", userId)
    .single();

  const username = profile?.username || "Unknown";

  // Record deletion reason
  await supabase.from("account_deletion_reasons").insert({
    user_id: userId,
    reason,
    awareness_confirmed: awarenessConfirmed,
  });

  // Delete from all related tables (cascade should handle most)
  // But we need to manually handle some due to foreign key constraints

  // Delete coin ledger entries
  await supabase.from("coin_ledger").delete().eq("user_id", userId);

  // Delete stream-related data
  await supabase.from("stream_viewers").delete().eq("user_id");
  await supabase.from("stream_likes").delete().eq("user_id");
  await supabase.from("stream_chat").delete().eq("user_id");
  await supabase.from("stream_gifts").delete().eq("sender_id");
  await supabase.from("stream_gifts").delete().eq("recipient_id");
  await supabase.from("stream_seats").delete().eq("user_id");
  await supabase.from("streams").delete().eq("user_id", userId);

  // Delete family-related data
  await supabase.from("troll_family_members").delete().eq("user_id", userId);
  await supabase.from("troll_families").delete().eq("created_by", userId);

  // Delete social data
  await supabase.from("neighbors").delete().eq("user_id", userId);
  await supabase.from("neighbors").delete().eq("neighbor_id", userId);
  await supabase.from("friend_requests").delete().eq("from_user_id", userId);
  await supabase.from("friend_requests").delete().eq("to_user_id", userId);

  // Delete reports and moderation
  await supabase.from("user_reports").delete().eq("reporter_user_id", userId);
  await supabase.from("moderation_cases").delete().eq("user_id", userId);
  await supabase.from("stream_reports").delete().eq("reporter_user_id", userId);

  // Delete profile and auth
  await supabase.from("user_profiles").delete().eq("user_id", userId);
  await supabase.from("auth.users").delete().eq("id", userId);

  // Notify admins
  await notifyAdmins(userId, username);
}

serve(async (req) => {
  const { action, userId: _userId, reason } = await req.json();

  // Verify authorization
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Not authorized" }), { status: 401 });
  }

  const token = authHeader.replace("Bearer ", "");
  const { data: { user } } = await supabase.auth.getUser(token);

  if (!user) {
    return new Response(JSON.stringify({ error: "Not authorized" }), { status: 401 });
  }

  try {
    switch (action) {
      case "request_deletion":
        // Record the deletion reason
        await supabase.from("account_deletion_reasons").insert({
          user_id: user.id,
          reason,
          awareness_confirmed: false,
        });

        return new Response(JSON.stringify({ success: true, message: "Deletion requested" }), { 
          headers: { "Content-Type": "application/json" } 
        });

      case "confirm_deletion":
        // This is the final step - user confirms they understand it's permanent
        await hardDeleteUser(user.id, reason, true);
        
        return new Response(JSON.stringify({ success: true, message: "Account deleted" }), { 
          headers: { "Content-Type": "application/json" } 
        });

      case "cancel_deletion":
        // Delete the deletion request if user cancels
        await supabase
          .from("account_deletion_reasons")
          .delete()
          .eq("user_id", user.id)
          .is("awareness_confirmed", false);

        return new Response(JSON.stringify({ success: true, message: "Deletion cancelled" }), { 
          headers: { "Content-Type": "application/json" } 
        });

      default:
        return new Response(JSON.stringify({ error: "Unknown action" }), { status: 400 });
    }
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
});