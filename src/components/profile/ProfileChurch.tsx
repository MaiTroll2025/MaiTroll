import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { BookOpen, Loader2, Heart, MessageCircle } from 'lucide-react';
import { toast } from 'sonner';

interface Prayer {
  id: string;
  content: string;
  created_at: string;
  likes_count: number;
  replies_count?: number;
}

export default function ProfileChurch({ userId }: { userId: string }) {
  const [loading, setLoading] = useState(true);
  const [prayers, setPrayers] = useState<Prayer[]>([]);

  useEffect(() => {
    if (!userId) return;
    let isMounted = true;

    async function load() {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('church_prayers')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(50);

        if (error) throw error;
        if (isMounted) setPrayers(data || []);
      } catch (err) {
        console.error('[ProfileChurch] Error:', err);
        toast.error('Failed to load prayers');
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    load();
    return () => {
      isMounted = false;
    };
  }, [userId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
        <span className="ml-2 text-gray-400">Loading prayers...</span>
      </div>
    );
  }

  if (prayers.length === 0) {
    return (
      <div className="text-center py-12 text-white/50">
        <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-30" />
        <p>No prayers yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {prayers.map(prayer => (
        <div key={prayer.id} className="rounded-2xl border border-white/10 bg-white/[0.025] p-4">
          <p className="text-white whitespace-pre-wrap">{prayer.content}</p>
          <div className="flex items-center gap-4 mt-3 text-xs text-slate-400">
            <span className="flex items-center gap-1">
              <Heart size={12} /> {prayer.likes_count || 0}
            </span>
            <span className="flex items-center gap-1">
              <MessageCircle size={12} /> {prayer.replies_count || 0}
            </span>
            <span>{new Date(prayer.created_at).toLocaleDateString()}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
