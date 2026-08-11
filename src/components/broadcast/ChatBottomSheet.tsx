import React, { useEffect, useRef, useState } from "react";
import { Send, Smile } from "lucide-react";
import { cn } from "../../lib/utils";
import { ChatMessage } from "../../types/broadcast";
import ProfileFrame from "../live/ProfileFrame";
import AvatarWithFrame from "../profile/AvatarWithFrame";
import { getDiamondForLevel } from "../../types/liveStreaming";
import { resolveUsername as resolveUsernameUtil, DEFAULT_USERNAME } from "../../lib/chatUtils";

interface ChatBottomSheetProps {
  messages: ChatMessage[];
  onSendMessage: (text: string) => void;
  className?: string;
  compact?: boolean;
  overlay?: boolean; // broadcast floating mode
}

type AnyChatMessage = ChatMessage & {
  username?: string | null;
  user_name?: string | null;
  display_name?: string | null;
  message?: string | null;
  content?: string | null;
  avatar_url?: string | null;
  user_avatar?: string | null;
  level?: number | null;
  user?: {
    username?: string | null;
    display_name?: string | null;
    avatar_url?: string | null;
    level?: number | null;
  } | null;
  user_profiles?: {
    username?: string | null;
    display_name?: string | null;
    avatar_url?: string | null;
    level?: number | null;
  } | null;
};

function resolveChatUsername(msg: ChatMessage, fallback = DEFAULT_USERNAME) {
  const chatMsg = msg as AnyChatMessage;

  return resolveUsernameUtil(
    chatMsg.user_profiles?.username ||
    chatMsg.user_profiles?.display_name ||
    chatMsg.user?.username ||
    chatMsg.user?.display_name ||
    chatMsg.username ||
    chatMsg.user_name ||
    chatMsg.display_name,
    fallback
  );
}

function resolveChatAvatar(msg: ChatMessage) {
  const chatMsg = msg as AnyChatMessage;

  return (
    chatMsg.user_profiles?.avatar_url ||
    chatMsg.user?.avatar_url ||
    chatMsg.avatar_url ||
    chatMsg.user_avatar ||
    ""
  );
}

function resolveChatLevel(msg: ChatMessage) {
  const chatMsg = msg as AnyChatMessage;

  return (
    chatMsg.user_profiles?.level ??
    chatMsg.user?.level ??
    chatMsg.level ??
    0
  );
}

function resolveChatText(msg: ChatMessage) {
  const chatMsg = msg as AnyChatMessage;

  return chatMsg.content || chatMsg.message || "";
}

export default function ChatBottomSheet({
  messages,
  onSendMessage,
  className,
  compact = false,
  overlay = false,
}: ChatBottomSheetProps) {
  const [inputValue, setInputValue] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = (smooth = true) => {
    const container = containerRef.current;
    if (!container) return;

    const distanceFromBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight;

    if (distanceFromBottom < 120) {
      endRef.current?.scrollIntoView({
        behavior: smooth ? "smooth" : "auto",
      });
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const cleanText = inputValue.trim();
    if (!cleanText) return;

    onSendMessage(cleanText);
    setInputValue("");

    setTimeout(() => scrollToBottom(false), 50);
  };

  return (
    <div
      className={cn(
        "flex flex-col w-full pointer-events-auto",
        overlay && "absolute bottom-0 left-0 right-0",
        className
      )}
    >
      <div
        ref={containerRef}
        className={cn(
          "flex-1 overflow-y-auto px-4 space-y-2",
          overlay ? "max-h-[40vh] pb-2" : "h-full",
          compact && "px-2 space-y-1"
        )}
      >
        {messages.map((msg) => {
          if (msg.type === "system") {
            return <SystemMessage key={msg.id} msg={msg} />;
          }

          return <UserMessage key={msg.id} msg={msg} compact={compact} />;
        })}

        <div ref={endRef} />
      </div>

      <div
        className={cn(
          "p-3 border-t border-white/10",
          overlay ? "bg-black/40 backdrop-blur-md" : "bg-zinc-900/60"
        )}
        style={{
          paddingBottom: "calc(env(safe-area-inset-bottom) + 12px)",
        }}
      >
        <form onSubmit={handleSubmit} className="flex gap-2 items-center">
          <div className="relative flex-1">
            <input
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Say something..."
              className="w-full bg-black/40 backdrop-blur-md border border-white/10 rounded-full py-2.5 pl-4 pr-10 text-white placeholder-white/50 text-sm focus:outline-none focus:border-pink-500/50 transition-colors"
            />

            <button
              type="button"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-white/60 hover:text-white transition-colors"
              aria-label="Open emoji picker"
            >
              <Smile size={18} />
            </button>
          </div>

          <button
            type="submit"
            disabled={!inputValue.trim()}
            className="w-10 h-10 rounded-full bg-pink-600 flex items-center justify-center text-white shadow-lg disabled:opacity-50 active:scale-95 transition"
            aria-label="Send message"
          >
            <Send size={18} />
          </button>
        </form>
      </div>
    </div>
  );
}

function SystemMessage({ msg }: { msg: ChatMessage }) {
  const username = resolveChatUsername(msg, "Guest");

  return (
    <div className="flex justify-center my-1 animate-fade-in-up">
      <div className="bg-black/30 backdrop-blur-sm rounded-full px-3 py-1 border border-white/5">
        <span className="text-[10px] text-white/70 italic">
          <span className="font-bold text-pink-400/80">{username}</span>{" "}
          joined the broadcast
        </span>
      </div>
    </div>
  );
}

function ChatDiamondAvatar({
  avatarUrl,
  username,
  level,
}: {
  avatarUrl: string;
  username: string;
  level: number;
}) {
  const tier = getDiamondForLevel(level);
  const showFrame = level >= 1;

  const glowStyle =
    tier.glow_color && tier.glow_intensity > 0
      ? { boxShadow: `0 0 ${tier.glow_intensity * 10}px ${tier.glow_color}` }
      : {};

  const diamondContent = (
    <div
      style={{
        width: 32,
        height: 32,
        clipPath: "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)",
        border: `2px solid ${tier.border_color}`,
        overflow: "hidden",
        position: "relative",
        zIndex: 2,
        ...glowStyle,
      }}
    >
      <img
        src={avatarUrl}
        alt={username}
        className="w-full h-full object-cover"
        style={{
          transform: "rotate(45deg) scale(1.42)",
          width: "100%",
          height: "100%",
        }}
        draggable={false}
      />
    </div>
  );

  // Use AvatarWithFrame for premium profile frames, fallback to level-based
  if (showFrame) {
    return (
      <div className="relative" style={{ width: 32, height: 32 }}>
        <AvatarWithFrame
          avatarUrl={avatarUrl}
          username={username}
          size="xs"
          className="absolute inset-0"
        />
        {diamondContent}
      </div>
    );
  }

  return diamondContent;
}

function UserMessage({
  msg,
  compact = false,
}: {
  msg: ChatMessage;
  compact?: boolean;
}) {
  const level = resolveChatLevel(msg);
  const avatarUrl = resolveChatAvatar(msg);
  const username = resolveChatUsername(msg);
  const chatText = resolveChatText(msg);

  return (
    <div className="flex items-start gap-2 animate-fade-in-up">
      {avatarUrl && (
        <div className="flex-shrink-0 mt-0.5">
          <ChatDiamondAvatar
            avatarUrl={avatarUrl}
            username={username}
            level={level}
          />
        </div>
      )}

      <div
        className={cn(
          "bg-black/30 backdrop-blur-sm rounded-2xl rounded-tl-sm px-3 py-1.5 max-w-[85%] border border-white/5",
          compact && "px-2 py-1 max-w-[92%]"
        )}
      >
        <span className="text-[11px] font-bold text-pink-400 block mb-0.5">
          {username}
        </span>

        <p className="text-sm text-white leading-snug break-words">
          {chatText}
        </p>
      </div>
    </div>
  );
}