// ============================================================
// UTROMAIL - THREAD / MESSAGE DETAIL VIEW
// ============================================================

import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/lib/store';
import {
  ChevronLeft,
  Reply,
  Forward,
  Trash2,
  Archive,
  Star,
  MoreHorizontal,
  Flag,
  Paperclip,
  Send,
  Loader2,
  Crown,
  Heart,
  Gem,
  Star as StarIcon,
  Lock,
} from 'lucide-react';
import { getThreadMessages, sendMessage, markAsRead, markThreadAsRead, starMessage, deleteThread } from '@/services/utromailService';
import type { UtromailMessage } from '@/types/mail';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';

interface Props {
  threadId: string;
  onBack: () => void;
  onRefresh: () => void;
}

export default function UtromailThreadView({ threadId, onBack, onRefresh }: Props) {
  const navigate = useNavigate();
  const { user, profile } = useAuthStore();
  const [messages, setMessages] = useState<UtromailMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [replyBody, setReplyBody] = useState('');
  const [sendingReply, setSendingReply] = useState(false);
  const [subscriberBadge, setSubscriberBadge] = useState<{ tierName: string; tierColor: string } | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchMessages();
    fetchSubscriberBadge();
  }, [threadId]);

  const fetchSubscriberBadge = async () => {
    if (!user) return;
    try {
      // Get the other participant in this thread
      const { data: thread } = await supabase
        .from('utromail_threads')
        .select('other_user_id, other_username')
        .eq('id', threadId)
        .maybeSingle();

      if (!thread?.other_user_id || thread.other_user_id === user.id) return;

      // Check if the other user is a broadcaster and current user is subscribed
      const { data: sub } = await supabase
        .from('user_subscriptions')
        .select('tier:subscription_tiers (name, color_hex)')
        .eq('subscriber_id', user.id)
        .eq('broadcaster_id', thread.other_user_id)
        .eq('is_active', true)
        .maybeSingle();

      if (sub?.tier) {
        setSubscriberBadge({
          tierName: (sub.tier as any).name,
          tierColor: (sub.tier as any).color_hex,
        });
      }
    } catch (err) {
      console.error('[UtromailThreadView] Error fetching subscriber badge:', err);
    }
  };

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const fetchMessages = async () => {
    try {
      const msgs = await getThreadMessages(threadId);
      setMessages(msgs);
      // Mark all as read
      await markThreadAsRead(threadId, user!.id);
      // Mark individual messages as read
      for (const msg of msgs) {
        if (msg.recipient_id === user!.id) {
          await markAsRead(msg.id, user!.id);
        }
      }
    } catch (err) {
      console.error('Error fetching messages:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleReply = async () => {
    if (!replyBody.trim()) return;
    const lastMsg = messages[messages.length - 1];
    setSendingReply(true);
    try {
      await sendMessage({
        senderId: user!.id,
        senderMail: `${profile?.username || 'user'}@utromail`,
        recipientId: lastMsg.sender_id === user!.id ? lastMsg.recipient_id! : lastMsg.sender_id,
        recipientMail: lastMsg.sender_id === user!.id ? lastMsg.recipient_mail_address! : lastMsg.sender_mail_address,
        subject: lastMsg.subject || '(No subject)',
        body: replyBody.trim(),
        parentMessageId: lastMsg.id,
      });
      setReplyBody('');
      await fetchMessages();
      onRefresh();
      toast.success('Reply sent!');
    } catch (err: any) {
      toast.error(err.message || 'Failed to send reply');
    } finally {
      setSendingReply(false);
    }
  };

  const handleDelete = async () => {
    try {
      await deleteThread(threadId, user!.id);
      toast.success('Thread moved to trash');
      onBack();
    } catch {
      toast.error('Failed to delete');
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-300 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl p-4">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <button onClick={onBack} className="flex items-center gap-1 text-xs font-bold text-slate-400 hover:text-white">
          <ChevronLeft className="h-4 w-4" /> Back
        </button>
        <div className="flex items-center gap-1">
          <button onClick={handleDelete} className="rounded-lg p-2 text-slate-400 hover:text-red-400"><Trash2 className="h-4 w-4" /></button>
          <button className="rounded-lg p-2 text-slate-400 hover:text-white"><Archive className="h-4 w-4" /></button>
          <button className="rounded-lg p-2 text-slate-400 hover:text-amber-400"><Flag className="h-4 w-4" /></button>
        </div>
      </div>

      {/* Subject */}
      {messages[0]?.subject && (
        <h1 className="mb-4 text-lg font-black text-white">{messages[0].subject}</h1>
      )}

      {/* Messages */}
      <div className="space-y-3">
        {messages.map(msg => {
          const isOwn = msg.sender_id === user?.id;
          return (
            <div key={msg.id} className={`rounded-2xl border p-4 ${isOwn ? 'border-emerald-400/20 bg-emerald-500/[0.05]' : 'border-white/10 bg-white/[0.03]'}`}>
              {/* Message Header */}
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-black ${isOwn ? 'bg-emerald-500/20 text-emerald-300' : 'bg-white/10 text-slate-400'}`}>
                    {(msg.sender_name || '?')[0].toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          const senderUsername = msg.sender_username;
                          if (senderUsername) {
                            navigate(`/profile/${encodeURIComponent(senderUsername)}`);
                          }
                        }}
                        className="text-left text-xs font-bold text-white transition hover:text-fuchsia-300"
                      >
                        {msg.sender_name || msg.sender_mail_address}
                      </button>
                      {msg.sender_is_jailed && (
                        <Lock className="h-3.5 w-3.5 text-red-400" title="In custody" />
                      )}
                      {!isOwn && subscriberBadge && (
                        <span
                          className="inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-black"
                          style={{ backgroundColor: subscriberBadge.tierColor + '30', color: subscriberBadge.tierColor }}
                          title={`${subscriberBadge.tierName} subscriber`}
                        >
                          {subscriberBadge.tierName === 'VIP' ? (
                            <Crown className="h-2.5 w-2.5" />
                          ) : subscriberBadge.tierName === 'Elite' ? (
                            <Gem className="h-2.5 w-2.5" />
                          ) : subscriberBadge.tierName === 'Mythic' ? (
                            <StarIcon className="h-2.5 w-2.5" />
                          ) : (
                            <Heart className="h-2.5 w-2.5" />
                          )}
                          {subscriberBadge.tierName}
                        </span>
                      )}
                    </div>
                    <p className="text-[9px] text-slate-500">{msg.sender_mail_address}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[9px] text-slate-500">{new Date(msg.sent_at).toLocaleString()}</span>
                  <button onClick={async () => { await starMessage(msg.id, !msg.is_starred); await fetchMessages(); }}>
                    <Star className={`h-3.5 w-3.5 ${msg.is_starred ? 'text-amber-400 fill-amber-400' : 'text-slate-500'}`} />
                  </button>
                </div>
              </div>

              {/* Message Body */}
              <div className="text-sm leading-relaxed text-slate-300 whitespace-pre-wrap">{msg.body}</div>

              {/* Attachments */}
              {msg.attachments && msg.attachments.length > 0 && (
                <div className="mt-3 space-y-1">
                  {msg.attachments.map(att => (
                    <a key={att.id} href={att.file_url} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] p-2 text-xs text-emerald-400 hover:bg-white/[0.08]">
                      <Paperclip className="h-3 w-3" />
                      <span className="truncate">{att.file_name}</span>
                      <span className="text-[9px] text-slate-500">{att.mime_type}</span>
                    </a>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div ref={bottomRef} />

      {/* Reply Box */}
      <div className="mt-4 rounded-2xl border border-white/10 bg-[#070b19]/70 p-4">
        <div className="mb-2 flex items-center gap-2 text-xs font-bold text-slate-400">
          <Reply className="h-3.5 w-3.5" /> Reply
        </div>
        <textarea
          value={replyBody}
          onChange={e => setReplyBody(e.target.value)}
          placeholder="Write your reply..."
          rows={4}
          className="w-full resize-none rounded-xl border border-white/10 bg-white/[0.05] p-3 text-sm text-white outline-none placeholder-slate-500 focus:border-emerald-400/50"
        />
        <div className="mt-2 flex justify-end">
          <button
            onClick={handleReply}
            disabled={sendingReply || !replyBody.trim()}
            className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-600 px-5 py-2 text-xs font-black text-white transition hover:scale-[1.02] disabled:opacity-50"
          >
            {sendingReply ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            Send Reply
          </button>
        </div>
      </div>
    </div>
  );
}
