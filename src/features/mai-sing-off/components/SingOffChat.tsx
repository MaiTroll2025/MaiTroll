import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  Gift,
  Hash,
  Send,
  Shield,
} from 'lucide-react';

import { useShallow } from 'zustand/react/shallow';

import { useAuthStore } from '@/lib/store';

import { useSingOffStore } from '../store/useSingOffStore';
import { useSingOffActions } from '../hooks/useSingOffActions';

interface SingOffChatProps {
  sessionId?: string;

  /**
   * Optional callback for clicking a username.
   *
   * Use this to open:
   * - profile actions for normal users
   * - moderation actions for authorized staff
   */
  onUserClick?: (userId: string) => void;
}

export function SingOffChat({
  sessionId,
  onUserClick,
}: SingOffChatProps) {
  const user = useAuthStore((state) => state.user);

  const {
    messages,
    participants,
    authority,
  } = useSingOffStore(
    useShallow((state) => ({
      messages: state.chatMessages,
      participants: state.participants,
      authority: state.authority,
    })),
  );

  const actions = useSingOffActions();

  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);

  const bottomRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  /**
   * Auto-scroll whenever a new chat or gift message arrives.
   */
  useEffect(() => {
    bottomRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'end',
    });
  }, [messages]);

  const currentParticipant = useMemo(() => {
    if (!user?.id) {
      return null;
    }

    return participants.find(
      (participant) => participant.user_id === user.id,
    ) ?? null;
  }, [participants, user?.id]);

  /**
   * Do not give moderation powers merely because someone is
   * a broadcaster or BroadOfficer.
   *
   * Replace these exact fields with whatever your real authority
   * object exposes.
   */
  const canModerate =
    authority?.isCEO === true ||
    authority?.isAdmin === true ||
    authority?.isModerator === true ||
    authority?.canModerate === true;

  const canChat =
    Boolean(user?.id) &&
    currentParticipant?.is_kicked !== true;

  const send = async () => {
    if (!canChat || isSending) {
      return;
    }

    const body = input.trim();

    if (!body) {
      return;
    }

    setIsSending(true);

    try {
      /**
       * If your action currently doesn't take sessionId,
       * remove the second argument.
       *
       * Prefer passing sessionId so messages cannot accidentally
       * be written to the wrong active Sing Off session.
       */
      await actions.sendChat(body, sessionId);

      setInput('');

      requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
    } catch (error) {
      console.error(
        '[SingOffChat] Failed to send message:',
        error,
      );
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (
    event: React.KeyboardEvent<HTMLInputElement>,
  ) => {
    if (event.key !== 'Enter') {
      return;
    }

    if (event.shiftKey) {
      return;
    }

    event.preventDefault();

    void send();
  };

  const handleUserClick = (userId?: string | null) => {
    if (!userId) {
      return;
    }

    onUserClick?.(userId);
  };

  return (
    <section
      className="
        flex
        h-full
        min-h-[520px]
        flex-col
        overflow-hidden
        rounded-2xl
        border
        border-white/10
        bg-zinc-950/90
        shadow-xl
        backdrop-blur-xl
      "
    >
      {/* Header */}
      <header
        className="
          flex
          items-center
          justify-between
          border-b
          border-white/10
          px-4
          py-3
        "
      >
        <div className="flex items-center gap-2">
          <div
            className="
              flex
              h-9
              w-9
              items-center
              justify-center
              rounded-xl
              bg-pink-500/10
            "
          >
            <Hash className="h-4 w-4 text-pink-400" />
          </div>

          <div>
            <h2 className="text-sm font-bold text-white">
              Stage Chat
            </h2>

            <p className="text-xs text-zinc-500">
              {messages.length.toLocaleString()} messages
            </p>
          </div>
        </div>

        {canModerate && (
          <div
            className="
              flex
              items-center
              gap-1.5
              rounded-full
              border
              border-red-400/20
              bg-red-500/10
              px-2.5
              py-1
              text-[11px]
              font-bold
              uppercase
              tracking-wide
              text-red-300
            "
          >
            <Shield className="h-3 w-3" />
            Staff
          </div>
        )}
      </header>

      {/* Messages */}
      <div
        className="
          flex-1
          space-y-2
          overflow-y-auto
          px-3
          py-4
        "
      >
        {messages.length === 0 ? (
          <div
            className="
              flex
              min-h-[240px]
              items-center
              justify-center
              text-center
            "
          >
            <div>
              <Hash className="mx-auto h-7 w-7 text-zinc-700" />

              <p className="mt-3 text-sm font-semibold text-zinc-500">
                No messages yet
              </p>

              <p className="mt-1 text-xs text-zinc-600">
                Be the first to say something.
              </p>
            </div>
          </div>
        ) : (
          messages.map((message) => {
            if (message.is_gift) {
              return (
                <GiftMessage
                  key={message.id}
                  message={message}
                  onUserClick={handleUserClick}
                />
              );
            }

            return (
              <ChatMessage
                key={message.id}
                message={message}
                onUserClick={handleUserClick}
                canModerate={canModerate}
              />
            );
          })
        )}

        <div ref={bottomRef} />
      </div>

      {/* Composer */}
      <footer
        className="
          border-t
          border-white/10
          bg-black/20
          p-3
        "
      >
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            value={input}
            onChange={(event) =>
              setInput(event.target.value)
            }
            onKeyDown={handleKeyDown}
            placeholder={
              canChat
                ? 'Chat on stage…'
                : 'Chat unavailable'
            }
            disabled={!canChat || isSending}
            maxLength={500}
            className="
              min-w-0
              flex-1
              rounded-xl
              border
              border-white/10
              bg-zinc-900
              px-3
              py-2.5
              text-sm
              text-white
              placeholder:text-zinc-600
              outline-none
              transition
              focus:border-pink-500/50
              focus:ring-2
              focus:ring-pink-500/10
              disabled:cursor-not-allowed
              disabled:opacity-50
            "
          />

          <button
            type="button"
            onClick={() => void send()}
            disabled={
              !canChat ||
              !input.trim() ||
              isSending
            }
            className="
              flex
              h-10
              w-10
              shrink-0
              items-center
              justify-center
              rounded-xl
              bg-pink-600
              text-white
              transition
              hover:bg-pink-500
              disabled:cursor-not-allowed
              disabled:opacity-40
            "
            aria-label="Send chat message"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-1.5 text-right text-[10px] text-zinc-600">
          {input.length}/500
        </div>
      </footer>
    </section>
  );
}

interface MessageBase {
  id: string | number | bigint;
  sender_id?: string | null;
  sender_name?: string | null;
  body?: string | null;
}

interface GiftChatMessage extends MessageBase {
  is_gift?: boolean;
  gift_data?: {
    gift_name?: string | null;
    coins?: number | null;
    recipient_name?: string | null;
    recipient_user_id?: string | null;
    quantity?: number | null;
  } | null;
}

interface ChatMessageProps {
  message: MessageBase;
  onUserClick: (userId?: string | null) => void;
  canModerate: boolean;
}

function ChatMessage({
  message,
  onUserClick,
  canModerate,
}: ChatMessageProps) {
  return (
    <div
      className="
        rounded-xl
        px-2.5
        py-2
        text-sm
        text-zinc-300
        transition
        hover:bg-white/[0.03]
      "
    >
      <button
        type="button"
        onClick={() =>
          onUserClick(message.sender_id)
        }
        className="
          font-bold
          text-pink-400
          hover:text-pink-300
          hover:underline
        "
      >
        {message.sender_name || 'User'}
      </button>

      {canModerate && message.sender_id && (
        <span
          className="
            ml-1
            text-[10px]
            font-bold
            uppercase
            tracking-wide
            text-red-400/60
          "
        >
          mod
        </span>
      )}

      <span className="text-zinc-500">: </span>

      <span className="break-words">
        {message.body}
      </span>
    </div>
  );
}

interface GiftMessageProps {
  message: GiftChatMessage;
  onUserClick: (userId?: string | null) => void;
}

function GiftMessage({
  message,
  onUserClick,
}: GiftMessageProps) {
  const giftName =
    message.gift_data?.gift_name || 'Gift';

  const coins =
    message.gift_data?.coins ?? 0;

  const quantity =
    message.gift_data?.quantity ?? 1;

  const recipientName =
    message.gift_data?.recipient_name;

  return (
    <div
      className="
        mx-auto
        w-full
        max-w-md
        rounded-2xl
        border
        border-yellow-400/20
        bg-gradient-to-r
        from-yellow-500/10
        via-amber-500/10
        to-yellow-500/10
        px-3
        py-2.5
      "
    >
      <div className="flex items-start gap-2">
        <div
          className="
            mt-0.5
            flex
            h-8
            w-8
            shrink-0
            items-center
            justify-center
            rounded-full
            bg-yellow-400/15
          "
        >
          <Gift className="h-4 w-4 text-yellow-300" />
        </div>

        <div className="min-w-0">
          <div className="text-xs text-yellow-100">
            <button
              type="button"
              onClick={() =>
                onUserClick(message.sender_id)
              }
              className="
                font-black
                text-yellow-300
                hover:text-yellow-200
                hover:underline
              "
            >
              {message.sender_name || 'User'}
            </button>

            <span> sent </span>

            <span className="font-bold text-white">
              {giftName}
            </span>

            {quantity > 1 && (
              <span className="font-bold text-yellow-300">
                {' '}
                ×{quantity}
              </span>
            )}

            {recipientName && (
              <>
                <span> to </span>

                <button
                  type="button"
                  onClick={() =>
                    onUserClick(
                      message.gift_data
                        ?.recipient_user_id,
                    )
                  }
                  className="
                    font-bold
                    text-pink-300
                    hover:text-pink-200
                    hover:underline
                  "
                >
                  @{recipientName}
                </button>
              </>
            )}
          </div>

          <div
            className="
              mt-1
              text-xs
              font-bold
              text-yellow-300/80
            "
          >
            {coins.toLocaleString()} 🪙
          </div>
        </div>
      </div>
    </div>
  );
}