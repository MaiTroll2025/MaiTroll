import React, { useState, useEffect, useCallback } from "react";
import { Users, Shield, Search, Circle, MapPin, Clock, AlertTriangle, FileText, StickyNote, Save, RefreshCw, HeadphonesIcon } from "lucide-react";
import { useAuthStore } from "../../lib/store";
import { supabase } from "../../lib/supabase";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { useCustomerServiceUsers, CSUser } from "../../hooks/useCustomerServiceUsers";
import UserSupportSelector from "../../components/admin/customer-service/UserSupportSelector";
import UserIssuePanel from "../../components/admin/customer-service/UserIssuePanel";
import PasswordResetPanel from "../../components/admin/customer-service/PasswordResetPanel";
import SupportScreenSharePanel from "../../components/admin/customer-service/SupportScreenSharePanel";

const glassPanel =
  "rounded-[2rem] border border-cyan-400/15 bg-slate-950/75 backdrop-blur-2xl shadow-[0_0_48px_rgba(45,212,191,0.12),inset_0_1px_0_rgba(255,255,255,0.04)]";
const card =
  "rounded-3xl border border-white/10 bg-white/[0.035] backdrop-blur-xl shadow-[0_0_30px_rgba(45,212,191,0.08)]";

function CityBackground() {
  return (
    <>
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_120%_at_20%_20%,rgba(147,51,234,0.22),transparent_42%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(140%_140%_at_80%_0%,rgba(45,212,191,0.16),transparent_46%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(140%_140%_at_95%_88%,rgba(236,72,153,0.13),transparent_44%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(120deg,rgba(109,40,217,0.10)_0%,rgba(14,165,233,0.07)_44%,rgba(236,72,153,0.09)_100%)]" />
    </>
  );
}

export default function CustomerServiceDashboard() {
  const { profile } = useAuthStore();
  const navigate = useNavigate();
  const { users, loading: usersLoading, refetch } = useCustomerServiceUsers();
  const [selectedUser, setSelectedUser] = useState<CSUser | null>(null);
  const [notes, setNotes] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);
  const [recentNotes, setRecentNotes] = useState<any[]>([]);

  const isAdmin = profile?.is_admin === true || profile?.role === "admin";

  // Redirect non-admin
  useEffect(() => {
    if (profile && !isAdmin) {
      toast.error("Access denied: Admin only");
      navigate("/admin");
    }
  }, [profile, navigate, isAdmin]);

  const handleSelectUser = useCallback(
    async (user: CSUser) => {
      setSelectedUser(user);
      setNotes("");

      // Load recent CS notes from audit log
      const { data } = await supabase
        .from("customer_service_audit_logs")
        .select("id, action, details, created_at")
        .eq("target_user_id", user.id)
        .eq("action", "ceo_note")
        .order("created_at", { ascending: false })
        .limit(5);
      setRecentNotes(data || []);
    },
    []
  );

  const handleSaveNote = async () => {
    if (!selectedUser || !notes.trim()) return;

    setSavingNotes(true);
    try {
      await supabase.from("customer_service_audit_logs").insert({
        actor_id: profile!.id,
        target_user_id: selectedUser.id,
        action: "ceo_note",
        details: {
          note: notes.trim(),
          target_username: selectedUser.username,
        },
      });

      toast.success("Note saved");
      setNotes("");
      handleSelectUser(selectedUser);
    } catch (err: any) {
      toast.error(err.message || "Failed to save note");
    } finally {
      setSavingNotes(false);
    }
  };

  if (!isAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <div className="text-center">
          <Shield className="mx-auto mb-3 h-12 w-12 text-red-400" />
          <h2 className="text-xl font-bold text-white">Access Denied</h2>
          <p className="mt-2 text-sm text-slate-400">
            This page is restricted to Admin only.
          </p>
        </div>
      </div>
    );
  }

  const onlineCount = users.filter((u) => u.is_online).length;
  const issuesCount = users.filter(
    (u) => u.bug_report_count > 0 || u.support_ticket_count > 0
  ).length;
  const bannedCount = users.filter((u) => u.account_status === "banned").length;

  return (
    <div className="min-h-screen bg-slate-950 text-white relative overflow-y-auto overflow-x-hidden md:overflow-hidden">
      <CityBackground />

      <div className="relative z-10 mx-auto max-w-[1600px] p-4 md:p-6">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/10 border border-cyan-500/20">
              <HeadphonesIcon className="h-5 w-5 text-cyan-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">
                Customer Service
              </h1>
              <p className="text-xs text-slate-400">
                CEO Support Dashboard — User Management & Screen Share
              </p>
            </div>
          </div>
        </div>

        {/* Stats row */}
        <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
          <div className={card + " p-4"}>
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-cyan-400" />
              <span className="text-[11px] text-slate-400">Total Users</span>
            </div>
            <div className="mt-1 text-2xl font-bold text-white">
              {users.length.toLocaleString()}
            </div>
          </div>
          <div className={card + " p-4"}>
            <div className="flex items-center gap-2">
              <Circle className="h-4 w-4 text-green-400" />
              <span className="text-[11px] text-slate-400">Online</span>
            </div>
            <div className="mt-1 text-2xl font-bold text-green-300">
              {onlineCount}
            </div>
          </div>
          <div className={card + " p-4"}>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-yellow-400" />
              <span className="text-[11px] text-slate-400">With Issues</span>
            </div>
            <div className="mt-1 text-2xl font-bold text-yellow-300">
              {issuesCount}
            </div>
          </div>
          <div className={card + " p-4"}>
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-red-400" />
              <span className="text-[11px] text-slate-400">Banned</span>
            </div>
            <div className="mt-1 text-2xl font-bold text-red-300">
              {bannedCount}
            </div>
          </div>
        </div>

        {/* Main 3-column layout */}
        <div className="grid gap-4 lg:grid-cols-[320px_1fr_340px]">
          {/* Left: User selector */}
          <div className={glassPanel + " p-4 h-[calc(100vh-220px)] flex flex-col"}>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-white">
                <Search className="h-4 w-4 text-cyan-400" />
                Users
              </h3>
              <button
                onClick={refetch}
                disabled={usersLoading}
                className="rounded-lg p-1.5 text-slate-500 hover:bg-white/5 hover:text-white transition-colors"
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 ${usersLoading ? "animate-spin" : ""}`}
                />
              </button>
            </div>
            {usersLoading && users.length === 0 ? (
              <div className="flex flex-1 items-center justify-center">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent" />
              </div>
            ) : (
              <UserSupportSelector
                users={users}
                selectedUserId={selectedUser?.id || null}
                onSelectUser={handleSelectUser}
              />
            )}
          </div>

          {/* Main: User details & issues */}
          <div className={glassPanel + " p-4 h-[calc(100vh-220px)] overflow-y-auto"}>
            {selectedUser ? (
              <div className="space-y-4">
                {/* Profile header */}
                <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-cyan-600 to-purple-600 text-lg font-bold text-white">
                          {(selectedUser.username || "?")[0].toUpperCase()}
                        </div>
                        <Circle
                          className={`absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 ${
                            selectedUser.is_online
                              ? "fill-green-400 text-green-400"
                              : "fill-slate-600 text-slate-600"
                          }`}
                        />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-white">
                          {selectedUser.display_name || selectedUser.username}
                        </h3>
                        <p className="text-xs text-slate-400">
                          @{selectedUser.username}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      {selectedUser.role &&
                        selectedUser.role !== "user" && (
                          <span className="rounded-full bg-purple-500/15 px-2.5 py-0.5 text-[10px] font-bold text-purple-300 border border-purple-500/20">
                            {selectedUser.role}
                          </span>
                        )}
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                          selectedUser.account_status === "active"
                            ? "bg-green-500/15 text-green-300 border border-green-500/20"
                            : selectedUser.account_status === "banned"
                            ? "bg-red-500/15 text-red-300 border border-red-500/20"
                            : "bg-orange-500/15 text-orange-300 border border-orange-500/20"
                        }`}
                      >
                        {selectedUser.account_status}
                      </span>
                    </div>
                  </div>

                  {/* Quick info */}
                  <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-4">
                    <div className="rounded-lg bg-white/[0.03] px-3 py-2">
                      <div className="text-[10px] text-slate-500">Email</div>
                      <div className="text-xs text-slate-300 truncate">
                        {selectedUser.email || "—"}
                      </div>
                    </div>
                    <div className="rounded-lg bg-white/[0.03] px-3 py-2">
                      <div className="text-[10px] text-slate-500">License</div>
                      <div className="text-xs text-slate-300">
                        {selectedUser.license_status || "—"}
                      </div>
                    </div>
                    <div className="rounded-lg bg-white/[0.03] px-3 py-2">
                      <div className="flex items-center gap-1 text-[10px] text-slate-500">
                        <MapPin className="h-2.5 w-2.5" />
                        Current Page
                      </div>
                      <div className="text-xs text-cyan-300 truncate">
                        {selectedUser.current_path || "—"}
                      </div>
                    </div>
                    <div className="rounded-lg bg-white/[0.03] px-3 py-2">
                      <div className="flex items-center gap-1 text-[10px] text-slate-500">
                        <Clock className="h-2.5 w-2.5" />
                        Last Active
                      </div>
                      <div className="text-xs text-slate-300">
                        {selectedUser.last_seen_at
                          ? new Date(selectedUser.last_seen_at).toLocaleString()
                          : "Never"}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Issues */}
                <div>
                  <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold text-white">
                    <AlertTriangle className="h-4 w-4 text-yellow-400" />
                    Account Issues
                  </h4>
                  <UserIssuePanel user={selectedUser} />
                </div>

                {/* CEO Notes */}
                <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
                  <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
                    <StickyNote className="h-4 w-4 text-purple-400" />
                    Support Notes
                  </h4>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Add a note about this user..."
                    rows={3}
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white placeholder-slate-600 outline-none focus:border-cyan-500/50"
                  />
                  <button
                    onClick={handleSaveNote}
                    disabled={savingNotes || !notes.trim()}
                    className="mt-2 flex items-center gap-2 rounded-lg bg-purple-600 px-3 py-2 text-xs font-semibold text-white hover:bg-purple-700 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Save className="h-3.5 w-3.5" />
                    {savingNotes ? "Saving..." : "Save Note"}
                  </button>

                  {recentNotes.length > 0 && (
                    <div className="mt-3 space-y-1.5">
                      <div className="text-[10px] text-slate-500">Recent notes:</div>
                      {recentNotes.map((n) => (
                        <div
                          key={n.id}
                          className="rounded-lg bg-white/[0.03] px-3 py-2 text-[11px]"
                        >
                          <p className="text-slate-300">{n.details?.note}</p>
                          <p className="mt-1 text-[10px] text-slate-600">
                            {new Date(n.created_at).toLocaleString()}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex h-full flex-col items-center justify-center text-slate-500">
                <Users className="mb-3 h-12 w-12 text-slate-700" />
                <p className="text-sm">Select a user to view details</p>
                <p className="mt-1 text-[11px] text-slate-600">
                  Search or filter from the left panel
                </p>
              </div>
            )}
          </div>

          {/* Right: Support actions */}
          <div className={glassPanel + " p-4 h-[calc(100vh-220px)] overflow-y-auto space-y-4"}>
            {selectedUser ? (
              <>
                <h3 className="flex items-center gap-2 text-sm font-semibold text-white">
                  <Shield className="h-4 w-4 text-cyan-400" />
                  Support Actions
                </h3>

                {/* Password Reset */}
                <PasswordResetPanel user={selectedUser} />

                {/* Screen Share */}
                <SupportScreenSharePanel user={selectedUser} />

                {/* Privacy notice */}
                <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3">
                  <p className="text-[10px] text-slate-500 leading-relaxed">
                    <strong className="text-slate-400">Privacy Notice:</strong>{" "}
                    Route/activity telemetry is used for support and security.
                    Screen sharing requires user consent. All actions are logged.
                    Passwords are never exposed or stored.
                  </p>
                </div>
              </>
            ) : (
              <div className="flex h-full flex-col items-center justify-center text-slate-500">
                <FileText className="mb-3 h-10 w-10 text-slate-700" />
                <p className="text-xs">Select a user to see actions</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
