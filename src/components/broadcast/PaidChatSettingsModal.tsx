import React, { useState, useEffect } from 'react';
import { X, MessageSquare, Users, MessageCircle, Lock } from 'lucide-react';
import { supabase } from '@/supabaseClient';
import { toast } from 'sonner';

interface PaidChatSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  streamId: string;
  isHost: boolean;
  onSave: (pricePerUser: number, pricePerChat: number) => void;
  streamCategory?: string;
}

const MIN_LEVEL_FOR_PAID_CHAT = 10;

export default function PaidChatSettingsModal({
  isOpen,
  onClose,
  streamId,
  isHost: _isHost,
  onSave,
  streamCategory,
}: PaidChatSettingsModalProps) {
  const [pricePerUser, setPricePerUser] = useState(0);
  const [pricePerChat, setPricePerChat] = useState(0);
  const [saving, setSaving] = useState(false);
  const [streamerLevel, setStreamerLevel] = useState<number | null>(null);
  const [loadingLevel, setLoadingLevel] = useState(true);
  const [_isEnabled, setIsEnabled] = useState(false);

  const isPodcast = streamCategory === 'podcast' || streamCategory === 'hytro_gaming';

  useEffect(() => {
    if (!isOpen) return;
    setPricePerUser(0);
    setPricePerChat(0);

    const checkLevelAndSettings = async () => {
      setLoadingLevel(true);
      try {
        const { data: streamData } = await supabase
          .from('streams')
          .select('user_id')
          .eq('id', streamId)
          .maybeSingle();
        if (streamData?.user_id) {
           const { data: xpData } = await supabase
             .from('user_stats')
             .select('level')
             .eq('user_id', streamData.user_id)
             .maybeSingle();
           setStreamerLevel(xpData?.level ?? 1);


          const { data: settingsData } = await supabase
            .from('stream_settings')
            .select('paid_chat_enabled, paid_chat_type, paid_chat_price')
            .eq('stream_id', streamId)
            .maybeSingle();
          setIsEnabled(settingsData?.paid_chat_enabled ?? false);
          if (settingsData?.paid_chat_enabled) {
            const price = Number(settingsData.paid_chat_price ?? 0);
            const type = settingsData.paid_chat_type || 'per_user';
            if (type === 'per_chat') {
              setPricePerChat(price);
            } else {
              setPricePerUser(price);
            }
          }
        } else {
          setStreamerLevel(null);
        }
      } catch {
        setStreamerLevel(null);
      } finally {
        setLoadingLevel(false);
      }
    };
    checkLevelAndSettings();
  }, [isOpen, streamId]);

  if (!isOpen) return null;

  const canSetPaidChat = streamerLevel === null || streamerLevel >= MIN_LEVEL_FOR_PAID_CHAT;

  const handleSave = async () => {
    if (!canSetPaidChat) {
      toast.error(`You must be level ${MIN_LEVEL_FOR_PAID_CHAT} or higher to set paid chat prices.`);
      return;
    }
    if (pricePerUser < 0 || pricePerChat < 0) {
      toast.error('Prices cannot be negative.');
      return;
    }
    if (pricePerUser > 50000 || pricePerChat > 50000) {
      toast.error('Price too high.');
      return;
    }

    setSaving(true);
    try {
      const { data: existingSettings } = await supabase
        .from('stream_settings')
        .select('id')
        .eq('stream_id', streamId)
        .maybeSingle();

      if (existingSettings) {
        const { error } = await supabase
          .from('stream_settings')
          .update({
            paid_chat_enabled: true,
            paid_chat_type: pricePerChat > 0 ? 'per_chat' : 'per_user',
            paid_chat_price: pricePerUser > 0 ? pricePerUser : pricePerChat,
            updated_at: new Date().toISOString(),
          })
          .eq('stream_id', streamId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('stream_settings')
          .insert({
            stream_id: streamId,
            paid_chat_enabled: true,
            paid_chat_type: pricePerChat > 0 ? 'per_chat' : 'per_user',
            paid_chat_price: pricePerUser > 0 ? pricePerUser : pricePerChat,
          });
        if (error) throw error;
      }

      toast.success('Paid chat settings saved.');
      onSave(pricePerUser, pricePerChat);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to save paid chat settings.');
    } finally {
      setSaving(false);
    }
  };

  const handleDisable = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('stream_settings')
        .update({
          paid_chat_enabled: false,
          paid_chat_price: 0,
          updated_at: new Date().toISOString(),
        })
        .eq('stream_id', streamId);

      if (error) throw error;
      setPricePerUser(0);
      setPricePerChat(0);
      setIsEnabled(false);
      toast.success('Paid chat disabled.');
      onSave(0, 0);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to disable paid chat.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-md" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-3xl border border-cyan-400/30 bg-slate-950/98 p-6 shadow-[0_0_60px_rgba(45,212,191,0.25)] backdrop-blur-2xl">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-2xl border border-cyan-400/30 bg-cyan-500/15">
              <MessageSquare className="h-5 w-5 text-cyan-300" />
            </div>
            <div>
              <h3 className="text-lg font-black text-white">Paid Chat</h3>
              <p className="text-xs text-cyan-200/70">Set price for private messages</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="grid h-9 w-9 place-items-center rounded-xl border border-white/10 bg-white/5 text-white/80 transition hover:bg-white/10 hover:text-white"
          >
            <X size={18} />
          </button>
        </div>

        {loadingLevel ? (
          <div className="flex items-center justify-center py-8">
            <Lock className="h-5 w-5 text-slate-400 animate-pulse" />
          </div>
        ) : !canSetPaidChat ? (
          <div className="rounded-2xl border border-amber-400/30 bg-amber-950/30 p-4 text-center">
            <Lock className="mx-auto mb-2 h-8 w-8 text-amber-400" />
            <p className="text-sm font-bold text-amber-200">Level {MIN_LEVEL_FOR_PAID_CHAT} Required</p>
            <p className="mt-1 text-xs text-amber-200/70">
              You must be level {MIN_LEVEL_FOR_PAID_CHAT} to enable paid chat for your broadcast.
            </p>
          </div>
        ) : (
          <>
            <div className="space-y-4">
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                <div className="flex items-center gap-3 mb-3">
                  <Users className="h-4 w-4 text-cyan-300" />
                  <span className="text-sm font-bold text-white">Price Per User</span>
                </div>
                <p className="text-xs text-slate-400 mb-3">
                  Charge this amount when a viewer wants to start a private chat with you.
                </p>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    max="50000"
                    value={pricePerUser}
                    onChange={(e) => setPricePerUser(Math.max(0, Number(e.target.value)))}
                    className="w-full rounded-xl border border-white/15 bg-black/40 px-4 py-2.5 text-white text-sm outline-none focus:border-cyan-400/60 focus:ring-2 focus:ring-cyan-400/20"
                    placeholder="0 = free"
                  />
                  <span className="text-xs text-slate-400 shrink-0">coins</span>
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                <div className="flex items-center gap-3 mb-3">
                  <MessageCircle className="h-4 w-4 text-cyan-300" />
                  <span className="text-sm font-bold text-white">Price Per Chat</span>
                </div>
                <p className="text-xs text-slate-400 mb-3">
                  Charge this amount for each message sent in a private chat session.
                </p>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    max="50000"
                    value={pricePerChat}
                    onChange={(e) => setPricePerChat(Math.max(0, Number(e.target.value)))}
                    className="w-full rounded-xl border border-white/15 bg-black/40 px-4 py-2.5 text-white text-sm outline-none focus:border-cyan-400/60 focus:ring-2 focus:ring-cyan-400/20"
                    placeholder="0 = free"
                  />
                  <span className="text-xs text-slate-400 shrink-0">coins</span>
                </div>
              </div>

              {isPodcast && (
                <div className="rounded-2xl border border-purple-400/20 bg-purple-950/20 p-3">
                  <p className="text-xs text-purple-200/80">
                    <span className="font-bold">Podcast / Gaming Mode:</span> As the host, you set the paid chat price for your podcast or gaming broadcasts.
                  </p>
                </div>
              )}
            </div>

            <div className="mt-6 flex gap-3">
              <button
                onClick={handleDisable}
                disabled={saving}
                className="flex-1 rounded-2xl border border-white/10 bg-white/[0.05] py-3 text-sm font-bold text-white/70 transition hover:bg-white/10 disabled:opacity-50"
              >
                Disable
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 rounded-2xl bg-gradient-to-r from-purple-600 via-cyan-500 to-pink-600 py-3 text-sm font-bold text-white shadow-[0_0_22px_rgba(45,212,191,0.30)] transition hover:scale-[1.02] disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
