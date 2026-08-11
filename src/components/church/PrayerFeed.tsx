import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/lib/store';
import { Heart, Trash2, Send, MessageCircle, AlertTriangle, Loader2, Gavel, Reply, ShieldOff, Ban, Volume2, VolumeX } from 'lucide-react';
import { toast } from 'sonner';

interface Prayer {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
  likes_count: number;
  user_profiles: {
    username: string;
    avatar_url: string;
    role: string;
    is_pastor: boolean;
  };
  has_liked?: boolean;
}

interface PrayerReply {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
  user_profiles: {
    username: string;
    avatar_url: string;
    is_pastor: boolean;
  };
}

export default function PrayerFeed({ isOpen }: { isOpen: boolean }) {
  const { profile } = useAuthStore();
  const [prayers, setPrayers] = useState<Prayer[]>([]);
  const [replies, setReplies] = useState<Record<string, PrayerReply[]>>({});
  const [newPrayer, setNewPrayer] = useState('');
  const [replyTexts, setReplyTexts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [modActionLoading, setModActionLoading] = useState<string | null>(null);

  const isPastorOrAdmin = profile?.is_pastor || profile?.role === 'admin' || (profile as any)?.is_admin;
  const isModerator = isPastorOrAdmin || profile?.is_troll_officer || profile?.is_lead_officer;

  const fetchPrayers = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('church_prayers')
        .select(`
          *,
          user_profiles:user_id (username, avatar_url, role, is_pastor)
        `)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      let prayersWithLikes = data || [];
      if (profile) {
        const { data: likes } = await supabase
          .from('church_prayer_likes')
          .select('prayer_id')
          .eq('user_id', profile.id);

        const likedIds = new Set(likes?.map(l => l.prayer_id));
        prayersWithLikes = prayersWithLikes.map(p => ({
          ...p,
          has_liked: likedIds.has(p.id)
        }));
      }

      setPrayers(prayersWithLikes);

      const prayerIds = prayersWithLikes.map(p => p.id);
      if (prayerIds.length > 0) {
        const { data: repliesData } = await supabase
          .from('church_prayer_replies')
          .select(`
            *,
            user_profiles:user_id (username, avatar_url, is_pastor)
          `)
          .in('prayer_id', prayerIds)
          .order('created_at', { ascending: true });

        const repliesByPrayer: Record<string, PrayerReply[]> = {};
        (repliesData || []).forEach(r => {
          if (!repliesByPrayer[r.prayer_id]) repliesByPrayer[r.prayer_id] = [];
          repliesByPrayer[r.prayer_id].push(r);
        });
        setReplies(repliesByPrayer);
      }
    } catch (err) {
      console.error('Error fetching prayers:', err);
    } finally {
      setLoading(false);
    }
  }, [profile]);

  useEffect(() => {
    fetchPrayers();

    const interval = setInterval(() => {
      fetchPrayers();
    }, 30000);

    return () => {
      clearInterval(interval);
    };
  }, [fetchPrayers]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPrayer.trim() || !isOpen) return;

    setSending(true);
    try {
      const { error } = await supabase
        .from('church_prayers')
        .insert({
          user_id: profile?.id,
          content: newPrayer.trim()
        });

      if (error) throw error;

      setNewPrayer('');
      toast.success('Prayer posted successfully');
      checkChurchBadge();

    } catch (err) {
      toast.error('Failed to post prayer');
      console.error(err);
    } finally {
      setSending(false);
    }
  };

  const checkChurchBadge = async () => {
    if (!profile) return;
    await supabase.from('user_badges').insert({
        user_id: profile.id,
        badge_id: (await supabase.from('badge_catalog').select('id').eq('slug', 'church_attendee').single()).data?.id
    }).maybeSingle();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this prayer?')) return;
    try {
      if (isModerator && isPastorOrAdmin) {
        await supabase.rpc('perform_church_mod_action', {
          target_user_id: prayers.find(p => p.id === id)?.user_id,
          action_type: 'prayer_delete',
          prayer_id: id,
          reason: 'Prayer removed by moderator'
        });
      } else {
        await supabase.from('church_prayers').delete().eq('id', id);
      }
      toast.success('Prayer deleted');
      fetchPrayers();
    } catch {
      toast.error('Failed to delete');
    }
  };

  const handleKick = async (userId: string, username: string) => {
    if (!confirm(`Kick ${username} from Troll Church and summon to Troll Court?`)) return;

    setModActionLoading(userId);
    try {
      const { error } = await supabase.rpc('kick_church_member', {
        target_user_id: userId,
        reason: 'Removed from Troll Church by pastor/moderator'
      });

      if (error) throw error;

      await supabase.rpc('perform_church_mod_action', {
        target_user_id: userId,
        action_type: 'kick',
        reason: 'Kicked from Troll Church'
      });

      toast.success(`${username} has been kicked from Troll Church and summoned to court`);
    } catch (err: any) {
      console.error('Kick error:', err);
      toast.error(err?.message || 'Failed to kick user');
    } finally {
      setModActionLoading(null);
    }
  };

  const handleBan = async (userId: string, username: string) => {
    const reason = prompt(`Ban ${username} from Troll Church. Enter reason:`);
    if (!reason) return;

    const durationStr = prompt('Ban duration in minutes (leave empty for permanent):');
    const duration = durationStr ? parseInt(durationStr) : null;

    setModActionLoading(userId);
    try {
      await supabase.rpc('perform_church_mod_action', {
        target_user_id: userId,
        action_type: 'ban',
        reason,
        duration_minutes: duration
      });

      toast.success(`${username} has been banned from Troll Church` + (duration ? ` for ${duration} minutes` : ''));
      fetchPrayers();
    } catch (err: any) {
      console.error('Ban error:', err);
      toast.error(err?.message || 'Failed to ban user');
    } finally {
      setModActionLoading(null);
    }
  };

  const handleWarn = async (userId: string, username: string) => {
    const reason = prompt(`Warn ${username}. Enter warning reason:`);
    if (!reason) return;

    setModActionLoading(userId);
    try {
      await supabase.rpc('perform_church_mod_action', {
        target_user_id: userId,
        action_type: 'warn',
        reason
      });

      toast.success(`Warning issued to ${username}`);
    } catch (err: any) {
      console.error('Warn error:', err);
      toast.error(err?.message || 'Failed to warn user');
    } finally {
      setModActionLoading(null);
    }
  };

  const handleLike = async (prayer: Prayer) => {
     if (!profile) return;

     setPrayers(prev => prev.map(p => {
        if (p.id === prayer.id) {
           return {
              ...p,
              likes_count: p.has_liked ? p.likes_count - 1 : p.likes_count + 1,
              has_liked: !p.has_liked
           };
        }
        return p;
     }));

     try {
       if (prayer.has_liked) {
          await supabase.from('church_prayer_likes').delete().eq('prayer_id', prayer.id).eq('user_id', profile.id);
       } else {
          await supabase.from('church_prayer_likes').insert({ prayer_id: prayer.id, user_id: profile.id });
       }
     } catch {
       fetchPrayers();
     }
  };

  const handleReply = async (prayerId: string) => {
    if (!isPastorOrAdmin) return;
    const text = replyTexts[prayerId]?.trim();
    if (!text) return;

    try {
      const { error } = await supabase.from('church_prayer_replies').insert({
        prayer_id: prayerId,
        user_id: profile?.id,
        content: text
      });

      if (error) throw error;

      setReplyTexts(prev => ({ ...prev, [prayerId]: '' }));
      toast.success('Reply posted');
      fetchPrayers();
    } catch {
      toast.error('Failed to post reply');
    }
  };

  return (
    <div className="space-y-6">
       <div className="bg-zinc-900/50 p-4 rounded-xl border border-zinc-800">
          <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
             <MessageCircle size={20} className="text-purple-400" />
             Share Your Prayer
          </h3>

          {isOpen ? (
            <form onSubmit={handleSubmit} className="space-y-3">
               <textarea
                 value={newPrayer}
                 onChange={e => setNewPrayer(e.target.value)}
                 placeholder="Write your prayer or reflection here..."
                 className="w-full bg-black/40 border border-zinc-700 rounded-lg p-3 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 min-h-[100px]"
                 maxLength={500}
               />
               <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-500">{newPrayer.length}/500</span>
                  <button
                    type="submit"
                    disabled={sending || !newPrayer.trim()}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-medium flex items-center gap-2 transition-all"
                  >
                    {sending ? <Loader2 className="animate-spin" size={16} /> : <Send size={16} />}
                    Post Prayer
                  </button>
               </div>
            </form>
          ) : (
            <div className="flex items-center gap-3 p-3 bg-red-900/20 border border-red-500/20 rounded-lg text-red-200">
               <AlertTriangle size={20} />
               <p className="text-sm">Prayers can only be posted during church hours (1 PM - 3 PM).</p>
            </div>
          )}
       </div>

       <div className="space-y-4">
          {prayers.map(prayer => (
             <div key={prayer.id} className="bg-zinc-900 p-4 rounded-xl border border-zinc-800 hover:border-zinc-700 transition-colors">
                <div className="flex justify-between items-start mb-3">
                   <div className="flex items-center gap-3">
                      <img
                        src={prayer.user_profiles?.avatar_url || `https://ui-avatars.com/api/?name=${prayer.user_profiles?.username || 'User'}`}
                        alt={prayer.user_profiles?.username}
                        className="w-10 h-10 rounded-full border border-zinc-700"
                      />
                      <div>
                         <div className="flex items-center gap-2">
                            <span className="font-bold text-white">{prayer.user_profiles?.username}</span>
                            {prayer.user_profiles?.is_pastor && (
                               <span className="px-1.5 py-0.5 bg-purple-500/20 text-purple-300 border border-purple-500/30 text-[10px] font-bold rounded uppercase">
                                  Pastor
                               </span>
                            )}
                         </div>
                         <span className="text-xs text-gray-500">{new Date(prayer.created_at).toLocaleString()}</span>
                      </div>
                   </div>

                   {(isPastorOrAdmin || prayer.user_id === profile?.id || isModerator) && (
                      <div className="flex gap-1">
                        {isModerator && prayer.user_id !== profile?.id && (
                          <>
                            <button
                              onClick={() => handleWarn(prayer.user_id, prayer.user_profiles?.username)}
                              disabled={modActionLoading === prayer.user_id}
                              className="p-1.5 text-gray-500 hover:text-yellow-400 hover:bg-yellow-900/20 rounded transition-colors disabled:opacity-50"
                              title="Warn User"
                            >
                              <ShieldOff size={16} />
                            </button>
                            <button
                              onClick={() => handleKick(prayer.user_id, prayer.user_profiles?.username)}
                              disabled={modActionLoading === prayer.user_id}
                              className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-900/20 rounded transition-colors disabled:opacity-50"
                              title="Kick from Church & Summon to Court"
                            >
                              <Gavel size={16} />
                            </button>
                            <button
                              onClick={() => handleBan(prayer.user_id, prayer.user_profiles?.username)}
                              disabled={modActionLoading === prayer.user_id}
                              className="p-1.5 text-gray-500 hover:text-orange-400 hover:bg-orange-900/20 rounded transition-colors disabled:opacity-50"
                              title="Ban from Church"
                            >
                              <Ban size={16} />
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => handleDelete(prayer.id)}
                          className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-900/20 rounded transition-colors"
                        >
                           <Trash2 size={16} />
                        </button>
                      </div>
                   )}
                </div>

                <p className="text-gray-200 text-sm leading-relaxed mb-4 whitespace-pre-wrap">
                   {prayer.content}
                </p>

                <div className="flex items-center gap-4 pt-3 border-t border-zinc-800">
                   <button
                     onClick={() => handleLike(prayer)}
                     className={`flex items-center gap-1.5 text-sm transition-colors ${prayer.has_liked ? 'text-pink-500' : 'text-gray-500 hover:text-pink-400'}`}
                   >
                      <Heart size={16} className={prayer.has_liked ? 'fill-current' : ''} />
                      <span>{prayer.likes_count}</span>
                   </button>

                   {isPastorOrAdmin && (
                      <label className="flex items-center gap-1.5 text-sm text-gray-500 cursor-pointer select-none">
                        <Reply size={16} />
                        <span>{replies[prayer.id]?.length || 0} Replies</span>
                      </label>
                   )}
                </div>

                {(isPastorOrAdmin || (replies[prayer.id]?.length > 0)) && (
                  <div className="mt-3 space-y-2 border-t border-zinc-800/50 pt-3">
                    {(replies[prayer.id] || []).map(reply => (
                      <div key={reply.id} className="flex items-start gap-2 pl-4 border-l-2 border-purple-500/30">
                        <img
                          src={reply.user_profiles?.avatar_url || `https://ui-avatars.com/api/?name=${reply.user_profiles?.username || 'Pastor'}`}
                          alt=""
                          className="w-6 h-6 rounded-full border border-zinc-700 mt-0.5"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-purple-300">{reply.user_profiles?.username}</span>
                            {reply.user_profiles?.is_pastor && (
                              <span className="px-1 py-0.5 bg-purple-500/20 text-purple-300 border border-purple-500/30 text-[8px] font-bold rounded uppercase">Pastor</span>
                            )}
                            <span className="text-[10px] text-gray-600">{new Date(reply.created_at).toLocaleString()}</span>
                          </div>
                          <p className="text-xs text-gray-300 mt-0.5">{reply.content}</p>
                        </div>
                      </div>
                    ))}

                    {isPastorOrAdmin && (
                      <div className="flex gap-2 mt-2">
                        <input
                          type="text"
                          value={replyTexts[prayer.id] || ''}
                          onChange={e => setReplyTexts(prev => ({ ...prev, [prayer.id]: e.target.value }))}
                          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleReply(prayer.id); } }}
                          placeholder="Write a reply..."
                          className="flex-1 bg-black/40 border border-zinc-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
                          maxLength={300}
                        />
                        <button
                          onClick={() => handleReply(prayer.id)}
                          disabled={!replyTexts[prayer.id]?.trim()}
                          className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-xs font-medium flex items-center gap-1 transition-all"
                        >
                          <Send size={12} />
                          Reply
                        </button>
                      </div>
                    )}
                  </div>
                )}
             </div>
          ))}

          {prayers.length === 0 && !loading && (
             <div className="text-center py-12 text-gray-500">
                <p>No prayers yet. Be the first to share.</p>
             </div>
          )}
       </div>
    </div>
  );
}
