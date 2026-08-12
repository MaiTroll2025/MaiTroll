import React, { useState, useEffect, useRef } from 'react';
import { X, MessageSquare, Users, MessageCircle, Lock, Send } from 'lucide-react';
import { supabase } from '@/supabaseClient';
import { toast } from 'sonner';

interface PaidChatViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  streamId: string;
  hostId: string;
  pricePerUser: number;
  pricePerChat: number;
  isChatEnabled: boolean;
  isChatLocked?: boolean;
}

export default function PaidChatViewerModal({
  isOpen,
  onClose,
  streamId,
  hostId,
  pricePerUser,
  pricePerChat,
  isChatEnabled,
  isChatLocked = false,
}: PaidChatViewerModalProps) {
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const sendingRef = useRef(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [userBalance, setUserBalance] = useState<number>(0);
  const [hasAccess, setHasAccess] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setMessage('');
      return;
    }

    const fetchUser = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user?.id) {
          setUserId(user.id);
          const { data: profile } = await supabase
            .from('user_profiles')
            .select('troll_coins')
            .eq('id', user.id)
            .maybeSingle();
          setUserBalance(profile?.troll_coins ?? 0);

          const { data: access } = await supabase
            .from('paid_chat_access')
            .select('id')
            .eq('stream_id', streamId)
            .eq('user_id', user.id)
            .maybeSingle();
          setHasAccess(!!access);
        } else {
          setUserId(null);
          setUserBalance(0);
          setHasAccess(false);
        }
      } catch {
        setUserId(null);
        setUserBalance(0);
        setHasAccess(false);
      }
    };
    fetchUser();
  }, [isOpen, streamId]);

  if (!isOpen) return null;

  const connectionCost = hasAccess ? 0 : pricePerUser;
  const totalCost = connectionCost + (pricePerChat > 0 ? pricePerChat : 0);

  const handleSend = async () => {
    if (sendingRef.current) return;
    if (!userId) {
      toast.error('You must be logged in to send paid messages.');
      return;
    }
    if (!message.trim()) {
      toast.error('Please enter a message.');
      return;
    }
    if (totalCost > 0 && userBalance < totalCost) {
      toast.error(`Insufficient coins. You need ${totalCost} coins but only have ${userBalance}.`);
      return;
    }

    sendingRef.current = true;
    setSending(true);
    try {
      if (isChatLocked) {
        throw new Error('Chat is locked by broadcaster control.');
      }

      if (!hasAccess && pricePerUser > 0) {
        // Deduct coins via try_pay_coins_secure (same as bottom nav bar)
        const { data: payResult, error: payError } = await supabase.rpc('try_pay_coins_secure', {
          p_amount: pricePerUser,
          p_reason: 'paid_chat_access',
          p_metadata: { stream_id: streamId, type: 'per_user' },
        });
        if (payError) throw payError;
        if (!payResult) throw new Error('Insufficient coins for connection fee.');

        const { error: accessError } = await supabase
          .from('paid_chat_access')
          .insert({
            stream_id: streamId,
            user_id: userId,
          });
        if (accessError) throw accessError;

        // Log payment record
        await supabase.from('paid_chat_payments').insert({
          stream_id: streamId,
          user_id: userId,
          amount: pricePerUser,
          payment_type: 'per_user',
        });

        // Credit broadcaster
        const { error: creditUserError } = await supabase.rpc('credit_coins', {
          p_user_id: hostId,
          p_coins: pricePerUser,
          p_reason: 'paid_chat_access',
        });
        if (creditUserError) console.error('[PaidChat] credit broadcaster failed:', creditUserError);

        setHasAccess(true);
        setUserBalance((prev) => prev - pricePerUser);
      }

      if (pricePerChat > 0) {
        // Deduct coins via try_pay_coins_secure (same as bottom nav bar)
        const { data: chatPayResult, error: chatPayError } = await supabase.rpc('try_pay_coins_secure', {
          p_amount: pricePerChat,
          p_reason: 'paid_chat_message',
          p_metadata: { stream_id: streamId, type: 'per_chat' },
        });
        if (chatPayError) throw chatPayError;
        if (!chatPayResult) throw new Error('Insufficient coins for message fee.');

        const { error: chatPaymentError } = await supabase
          .from('paid_chat_payments')
          .insert({
            stream_id: streamId,
            user_id: userId,
            amount: pricePerChat,
            payment_type: 'per_chat',
          });
        if (chatPaymentError) throw chatPaymentError;

        // Credit broadcaster
        const { error: creditChatError } = await supabase.rpc('credit_coins', {
          p_user_id: hostId,
          p_coins: pricePerChat,
          p_reason: 'paid_chat_message',
        });
        if (creditChatError) console.error('[PaidChat] credit broadcaster failed:', creditChatError);

        setUserBalance((prev) => prev - pricePerChat);
      }

      const { error: msgError } = await supabase
        .from('tcps_messages')
        .insert({
          conversation_id: streamId,
          sender_id: userId,
          content: message.trim(),
        });

      if (msgError) throw msgError;

      toast.success('Message sent!');
      setMessage('');
      onClose();
    } catch (err: any) {
      // Keep the typed message so the user can retry after fixing the issue.
      toast.error(err?.message || 'Failed to send message.');
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-md" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-3xl border border-amber-400/30 bg-slate-950/98 p-6 shadow-[0_0_60px_rgba(251,191,36,0.25)] backdrop-blur-2xl">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-2xl border border-amber-400/30 bg-amber-500/15">
              <MessageSquare className="h-5 w-5 text-amber-300" />
            </div>
            <div>
              <h3 className="text-lg font-black text-white">Paid Message</h3>
              <p className="text-xs text-amber-200/70">Send a private message to the broadcaster</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="grid h-9 w-9 place-items-center rounded-xl border border-white/10 bg-white/5 text-white/80 transition hover:bg-white/10 hover:text-white"
          >
            <X size={18} />
          </button>
        </div>

        {!isChatEnabled || isChatLocked ? (
          <div className="rounded-2xl border border-slate-400/30 bg-slate-900/50 p-4 text-center">
            <Lock className="mx-auto mb-2 h-8 w-8 text-slate-400" />
            <p className="text-sm font-bold text-slate-300">
              {isChatLocked ? 'Chat is Locked' : 'Paid Chat Not Available'}
            </p>
            <p className="mt-1 text-xs text-slate-400">
              {isChatLocked
                ? 'The broadcaster has locked chat for this stream.'
                : 'The broadcaster has not enabled paid chat for this stream.'}
            </p>
          </div>
        ) : (
          <>
            <div className="space-y-3 mb-4">
              {!hasAccess && pricePerUser > 0 && (
                <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-amber-300" />
                    <span className="text-xs text-slate-300">Connection fee</span>
                  </div>
                  <span className="text-xs font-bold text-white">{pricePerUser} coins</span>
                </div>
              )}
              {pricePerChat > 0 && (
                <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2">
                  <div className="flex items-center gap-2">
                    <MessageCircle className="h-4 w-4 text-amber-300" />
                    <span className="text-xs text-slate-300">Per message fee</span>
                  </div>
                  <span className="text-xs font-bold text-white">{pricePerChat} coins</span>
                </div>
              )}
              <div className="flex items-center justify-between rounded-xl border border-amber-400/20 bg-amber-950/20 px-3 py-2">
                <span className="text-xs font-bold text-amber-200">Your balance</span>
                <span className="text-xs font-bold text-white">{userBalance} coins</span>
              </div>
            </div>

            <div className="mb-4">
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Type your message to the broadcaster..."
                rows={3}
                maxLength={500}
                className="w-full rounded-xl border border-white/15 bg-black/40 px-4 py-3 text-white text-sm outline-none focus:border-amber-400/60 focus:ring-2 focus:ring-amber-400/20 resize-none"
              />
              <div className="mt-1 flex justify-between text-[10px] text-slate-500">
                <span>{message.length}/500</span>
                {totalCost > 0 && (
                  <span>Cost: {totalCost} coins</span>
                )}
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 rounded-2xl border border-white/10 bg-white/[0.05] py-3 text-sm font-bold text-white/70 transition hover:bg-white/10"
              >
                Cancel
              </button>
              <button
                onClick={handleSend}
                disabled={sending || !message.trim() || !userId}
                className="flex-1 rounded-2xl bg-gradient-to-r from-amber-500 via-orange-500 to-red-500 py-3 text-sm font-bold text-white shadow-[0_0_22px_rgba(251,191,36,0.30)] transition hover:scale-[1.02] disabled:opacity-50"
              >
                {sending ? 'Sending...' : (
                  <span className="flex items-center justify-center gap-2">
                    <Send size={14} />
                    Send
                  </span>
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
