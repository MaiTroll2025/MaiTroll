import { useState } from "react";
import {
  Shield,
  ChevronRight,
  ChevronDown,
} from "lucide-react";
import { supabase } from "../lib/supabase";
import api from "../lib/api";
import {
  rpcModoArrest,
  rpcModeratorKickUser,
  rpcModeratorMuteUser,
  rpcTakeAction,
} from "../types/moderationActions";
import IPBanModal from "./officer/IPBanModal";

interface ModerationPanelProps {
  targetUserId: string;
  roomId: string;
}

export default function ModerationPanel({ targetUserId, roomId }: ModerationPanelProps) {
  const [open, setOpen] = useState(false);
  const [showIPBanModal, setShowIPBanModal] = useState(false);
  const [targetIP, setTargetIP] = useState<string | null>(null);

  const handleArrest = async () => {
    if (!targetUserId) {
      alert("No target user selected");
      return;
    }
    const reason = window.prompt("Enter arrest reason:");
    if (!reason) return;

    try {
      const result = await rpcModoArrest(
        roomId || '',
        targetUserId,
        reason,
        'moderate'
      );
      if (!result.success) {
        alert(result.message || "Failed to arrest user");
      }
    } catch (error) {
      console.error("Arrest failed:", error);
      alert("Failed to arrest user");
    }
  };

  const handleShadowBan = async () => {
    const reason = window.prompt("Enter shadow ban reason:");
    if (!reason) return;

    try {
      await api.post(api.endpoints.moderation.shadowBan, { 
        targetUserId,
        streamId: roomId,
        reason,
        durationMinutes: 60
      });
    } catch (error) {
      console.error("Shadow ban failed:", error);
      alert("Failed to shadow ban user");
    }
  };

  const handleKick = async () => {
    if (!targetUserId || !roomId) {
      alert("Missing target user or stream context");
      return;
    }

    const reason = window.prompt("Enter kick reason (optional):") || "Kicked by moderator";

    try {
      const result = await rpcModeratorKickUser(roomId, targetUserId, reason);
      if (!result.success) {
        alert(result.message || "Failed to kick user");
      }
    } catch (error) {
      console.error("Failed to kick user:", error);
      alert("Failed to kick user");
    }
  };

  const handleMute = async () => {
    if (!targetUserId || !roomId) {
      alert("Missing target user or stream context");
      return;
    }

    const durationInput = window.prompt("Enter mute duration in minutes (default 5):", "5");
    const duration = parseInt(durationInput || "5", 10) || 5;

    try {
      const result = await rpcModeratorMuteUser(roomId, targetUserId, duration, `Muted for ${duration} minutes`);
      if (!result.success) {
        alert(result.message || "Failed to mute user");
      }
    } catch (error) {
      console.error("Failed to mute user:", error);
      alert("Failed to mute user");
    }
  };

  const handleGiftFreeze = async () => {
    const reason = window.prompt("Enter gift freeze reason:");
    if (!reason) return;

    alert("Gift freeze requires a dedicated database RPC. Please use the Mod Actions popup for available moderation actions.");
  };

  const handleChatPurge = async () => {
    if (!window.confirm("Are you sure you want to purge chat?")) return;

    alert("Chat purge requires a dedicated database RPC. Please use the Mod Actions popup for available moderation actions.");
  };

  const handleDisableStream = async () => {
    const reason = window.prompt("Enter stream disable reason:");
    if (!reason) return;

    try {
      const result = await rpcTakeAction(
        null,
        'suspend_stream',
        null,
        roomId,
        reason
      );
      if (!result.success) {
        alert(result.message || "Failed to disable stream");
      }
    } catch (error) {
      console.error("Disable stream failed:", error);
      alert("Failed to disable stream");
    }
  };

  const handleCourtSummon = async () => {
    try {
      await api.post("/court/summon", {
        userId: targetUserId,
        fromRoom: roomId
      });
    } catch (error) {
      console.error("Court summon failed:", error);
    }
  };

  const handleEvidenceCapture = async () => {
    try {
      await api.post("/moderation/evidence", {
        roomId,
        targetUserId,
        timestamp: Date.now()
      });
    } catch (error) {
      console.error("Evidence capture failed:", error);
    }
  };

  return (
    <>
    <div onClick={(e) => e.stopPropagation()} className="fixed right-4 bottom-24 z-50 w-56">
      {/* Header */}
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center justify-between w-full px-4 py-3 rounded-lg bg-[#1a0f2e] border border-purple-700 text-white shadow-lg"
      >
        <div className="flex items-center gap-2">
          <Shield size={18} />
          <span className="font-semibold">Moderation</span>
        </div>
        {open ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
      </button>

      {/* Actions */}
      {open && (
        <div className="mt-2 space-y-2 bg-[#0c0818] p-2 rounded-xl border border-purple-800">
          <Action label="Arrest User" color="bg-red-700" onClick={handleArrest} />
          <Action label="Ban IP Address" color="bg-red-900" onClick={async () => {
            // Fetch IP first if possible
             const { data, error } = await supabase
              .from('user_profiles')
              .select('last_known_ip')
              .eq('id', targetUserId)
              .maybeSingle()
            if (error) {
                console.error("Error fetching user IP", error);
            }
            
            if (data?.last_known_ip) {
              setTargetIP(data.last_known_ip)
            }
            setShowIPBanModal(true)
          }} />
          <Action label="Shadow Ban" color="bg-amber-700" onClick={handleShadowBan} />
          <Action label="Kick" color="bg-yellow-600" onClick={handleKick} />
          <Action label="Mute" color="bg-gray-700" onClick={handleMute} />
          <Action label="Gift Freeze" color="bg-fuchsia-700" onClick={handleGiftFreeze} />
          <Action label="Chat Purge" color="bg-blue-700" onClick={handleChatPurge} />
          <Action label="Disable Stream" color="bg-red-900" onClick={handleDisableStream} />
          <Action label="Court Summon" color="bg-purple-700" onClick={handleCourtSummon} />
          <Action label="Evidence Capture" color="bg-emerald-700" onClick={handleEvidenceCapture} />
        </div>
      )}
    </div>

    {showIPBanModal && (
      <IPBanModal 
        isOpen={showIPBanModal}
        onClose={() => {
          setShowIPBanModal(false);
          setTargetIP(null);
        }}
        onSuccess={() => {
          setShowIPBanModal(false);
          // Optional: disconnect user after IP ban
          // room?.disconnectParticipant(targetUserId);
        }}
        targetUserId={targetUserId}
        targetIP={targetIP || undefined}
      />
    )}
    </>
  );
}

function Action({
  label,
  color,
  onClick,
}: {
  label: string;
  color: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full px-3 py-2 rounded-md text-white text-sm font-medium ${color} hover:opacity-90`}
    >
      {label}
    </button>
  );
}