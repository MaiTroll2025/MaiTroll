import React, { useState } from "react";
import BattleChat from "../../../components/broadcast/BattleChat";

/**
 * Battle chat panel for mobile. Reuses the shared BattleChat (same realtime
 * messages, gift events, system events, moderation). Collapsible.
 */
export default function MobileBattleChat({
  battleId,
  challengerStream,
  opponentStream,
  currentStreamId,
  currentUserId,
  participantRole,
}: {
  battleId: string;
  challengerStream: { id: string; title: string; user_id: string };
  opponentStream: { id: string; title: string; user_id: string };
  currentStreamId?: string;
  currentUserId?: string | null;
  participantRole?: string | null;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex min-h-0 flex-1 flex-col rounded-2xl border border-white/10 bg-[#0B1020]">
      <div className="flex items-center justify-between border-b border-white/10 px-3 py-2">
        <span className="text-xs font-black uppercase tracking-wider text-white">Battle Chat</span>
        <button
          onClick={() => setOpen((v) => !v)}
          className="text-[11px] font-bold text-purple-300 active:scale-95"
        >
          {open ? "Hide" : "Show"}
        </button>
      </div>
      {open && (
        <div className="min-h-0 flex-1">
          <BattleChat
            battleId={battleId}
            challengerStream={challengerStream}
            opponentStream={opponentStream}
            currentStreamId={currentStreamId}
            currentUserId={currentUserId}
            participantRole={participantRole}
          />
        </div>
      )}
    </div>
  );
}
