/**
 * FeaturedContentManager.tsx
 * Manage featured content: badge, broadcast, podcast, stream, marketplace
 */

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/lib/store';
import { toast } from 'sonner';
import { Award, Video, Radio, ShoppingBag, Save } from 'lucide-react';

interface FeaturedContent {
    featured_badge_id: string | null;
    featured_broadcast_id: string | null;
    featured_podcast_id: string | null;
    featured_stream_id: string | null;
    featured_marketplace_item_id: string | null;
}

export default function FeaturedContentManager() {
    const { user } = useAuthStore();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [content, setContent] = useState<FeaturedContent>({
        featured_badge_id: null,
        featured_broadcast_id: null,
        featured_podcast_id: null,
        featured_stream_id: null,
        featured_marketplace_item_id: null,
    });
    
    const [badges, setBadges] = useState<any[]>([]);
    const [broadcasts, setBroadcasts] = useState<any[]>([]);
    const [_podcasts, _setPodcasts] = useState<any[]>([]);
    const [streams, setStreams] = useState<any[]>([]);
    const [marketplaceItems, setMarketplaceItems] = useState<any[]>([]);

    const fetchData = useCallback(async () => {
        if (!user) return;
        
        setLoading(true);
        try {
            // Fetch featured content settings
            const { data: customData } = await supabase.rpc('get_profile_customization', {
                p_user_id: user.id,
            });
            if (customData?.[0]) {
                setContent(customData[0]);
            }

            // Fetch user's badges
            const { data: badgesData } = await supabase
                .from('user_profile_badges')
                .select('*, badge_definitions(*)')
                .eq('user_id', user.id)
                .order('earned_at', { ascending: false });
            setBadges(badgesData || []);

            // Fetch user's broadcasts (replays)
            const { data: broadcastsData } = await supabase
                .from('streams')
                .select('id, title, thumbnail_url, created_at')
                .eq('broadcaster_id', user.id)
                .eq('status', 'ended')
                .order('created_at', { ascending: false })
                .limit(10);
            setBroadcasts(broadcastsData || []);

            // Fetch user's marketplace items
            const { data: marketplaceData } = await supabase
                .from('marketplace_items')
                .select('id, title, price_coins, image_url')
                .eq('seller_id', user.id)
                .eq('status', 'active')
                .order('created_at', { ascending: false })
                .limit(10);
            setMarketplaceItems(marketplaceData || []);

            // Fetch user's streams for featured
            const { data: streamsData } = await supabase
                .from('streams')
                .select('id, title, thumbnail_url')
                .eq('broadcaster_id', user.id)
                .order('created_at', { ascending: false })
                .limit(10);
            setStreams(streamsData || []);
        } catch (err) {
            console.error('Error fetching featured content:', err);
        } finally {
            setLoading(false);
        }
    }, [user]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleSave = async () => {
        if (!user) return;
        
        setSaving(true);
        try {
            const { error } = await supabase.rpc('upsert_profile_customization', {
                p_user_id: user.id,
                p_featured_badge_id: content.featured_badge_id,
                p_featured_broadcast_id: content.featured_broadcast_id,
                p_featured_podcast_id: content.featured_podcast_id,
                p_featured_stream_id: content.featured_stream_id,
                p_featured_marketplace_item_id: content.featured_marketplace_item_id,
            });
            
            if (error) throw error;
            toast.success('Featured content updated!');
        } catch (err: any) {
            console.error('Error saving featured content:', err);
            toast.error(err.message || 'Failed to save featured content');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-2 border-purple-500 border-t-transparent" />
            </div>
        );
    }

    return (
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Featured Content</h3>
            <p className="text-sm text-white/50 mb-6">
                Showcase your best content on your profile. Select one item from each category to feature.
            </p>

            <div className="space-y-6">
                {/* Featured Badge */}
                <div>
                    <label className="flex items-center gap-2 text-sm text-white/60 mb-2">
                        <Award className="w-4 h-4 text-yellow-400" />
                        Featured Badge
                    </label>
                    {badges.length > 0 ? (
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                            <button
                                onClick={() => setContent({ ...content, featured_badge_id: null })}
                                className={`p-3 rounded-xl text-left transition-colors ${
                                    !content.featured_badge_id
                                        ? 'bg-purple-500/20 border border-purple-500/50'
                                        : 'bg-white/5 border border-white/10 hover:bg-white/10'
                                }`}
                            >
                                <span className="text-sm text-white/50">None</span>
                            </button>
                            {badges.map((badge) => (
                                <button
                                    key={badge.badge_id}
                                    onClick={() => setContent({ ...content, featured_badge_id: badge.badge_id })}
                                    className={`p-3 rounded-xl text-left transition-colors ${
                                        content.featured_badge_id === badge.badge_id
                                            ? 'bg-purple-500/20 border border-purple-500/50'
                                            : 'bg-white/5 border border-white/10 hover:bg-white/10'
                                    }`}
                                >
                                    <div className="flex items-center gap-2">
                                        <span className="text-lg">{badge.badge_definitions?.icon_url || '🏆'}</span>
                                        <span className="text-sm text-white truncate">{badge.badge_definitions?.name || 'Badge'}</span>
                                    </div>
                                </button>
                            ))}
                        </div>
                    ) : (
                        <p className="text-sm text-white/40">No badges earned yet</p>
                    )}
                </div>

                {/* Featured Broadcast */}
                <div>
                    <label className="flex items-center gap-2 text-sm text-white/60 mb-2">
                        <Video className="w-4 h-4 text-red-400" />
                        Featured Broadcast
                    </label>
                    {broadcasts.length > 0 ? (
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                            <button
                                onClick={() => setContent({ ...content, featured_broadcast_id: null })}
                                className={`p-3 rounded-xl text-left transition-colors ${
                                    !content.featured_broadcast_id
                                        ? 'bg-purple-500/20 border border-purple-500/50'
                                        : 'bg-white/5 border border-white/10 hover:bg-white/10'
                                }`}
                            >
                                <span className="text-sm text-white/50">None</span>
                            </button>
                            {broadcasts.map((broadcast) => (
                                <button
                                    key={broadcast.id}
                                    onClick={() => setContent({ ...content, featured_broadcast_id: broadcast.id })}
                                    className={`p-3 rounded-xl text-left transition-colors ${
                                        content.featured_broadcast_id === broadcast.id
                                            ? 'bg-purple-500/20 border border-purple-500/50'
                                            : 'bg-white/5 border border-white/10 hover:bg-white/10'
                                    }`}
                                >
                                    <div className="flex items-center gap-2">
                                        {broadcast.thumbnail_url ? (
                                            <img src={broadcast.thumbnail_url} alt="" className="w-8 h-8 rounded object-cover" />
                                        ) : (
                                            <div className="w-8 h-8 rounded bg-white/10 flex items-center justify-center">
                                                <Video className="w-4 h-4 text-white/50" />
                                            </div>
                                        )}
                                        <span className="text-sm text-white truncate">{broadcast.title || 'Broadcast'}</span>
                                    </div>
                                </button>
                            ))}
                        </div>
                    ) : (
                        <p className="text-sm text-white/40">No broadcasts available</p>
                    )}
                </div>

                {/* Featured Stream */}
                <div>
                    <label className="flex items-center gap-2 text-sm text-white/60 mb-2">
                        <Radio className="w-4 h-4 text-purple-400" />
                        Featured Stream
                    </label>
                    {streams.length > 0 ? (
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                            <button
                                onClick={() => setContent({ ...content, featured_stream_id: null })}
                                className={`p-3 rounded-xl text-left transition-colors ${
                                    !content.featured_stream_id
                                        ? 'bg-purple-500/20 border border-purple-500/50'
                                        : 'bg-white/5 border border-white/10 hover:bg-white/10'
                                }`}
                            >
                                <span className="text-sm text-white/50">None</span>
                            </button>
                            {streams.map((stream) => (
                                <button
                                    key={stream.id}
                                    onClick={() => setContent({ ...content, featured_stream_id: stream.id })}
                                    className={`p-3 rounded-xl text-left transition-colors ${
                                        content.featured_stream_id === stream.id
                                            ? 'bg-purple-500/20 border border-purple-500/50'
                                            : 'bg-white/5 border border-white/10 hover:bg-white/10'
                                    }`}
                                >
                                    <div className="flex items-center gap-2">
                                        {stream.thumbnail_url ? (
                                            <img src={stream.thumbnail_url} alt="" className="w-8 h-8 rounded object-cover" />
                                        ) : (
                                            <div className="w-8 h-8 rounded bg-white/10 flex items-center justify-center">
                                                <Radio className="w-4 h-4 text-white/50" />
                                            </div>
                                        )}
                                        <span className="text-sm text-white truncate">{stream.title || 'Stream'}</span>
                                    </div>
                                </button>
                            ))}
                        </div>
                    ) : (
                        <p className="text-sm text-white/40">No streams available</p>
                    )}
                </div>

                {/* Featured Marketplace Item */}
                <div>
                    <label className="flex items-center gap-2 text-sm text-white/60 mb-2">
                        <ShoppingBag className="w-4 h-4 text-green-400" />
                        Featured Marketplace Listing
                    </label>
                    {marketplaceItems.length > 0 ? (
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                            <button
                                onClick={() => setContent({ ...content, featured_marketplace_item_id: null })}
                                className={`p-3 rounded-xl text-left transition-colors ${
                                    !content.featured_marketplace_item_id
                                        ? 'bg-purple-500/20 border border-purple-500/50'
                                        : 'bg-white/5 border border-white/10 hover:bg-white/10'
                                }`}
                            >
                                <span className="text-sm text-white/50">None</span>
                            </button>
                            {marketplaceItems.map((item) => (
                                <button
                                    key={item.id}
                                    onClick={() => setContent({ ...content, featured_marketplace_item_id: item.id })}
                                    className={`p-3 rounded-xl text-left transition-colors ${
                                        content.featured_marketplace_item_id === item.id
                                            ? 'bg-purple-500/20 border border-purple-500/50'
                                            : 'bg-white/5 border border-white/10 hover:bg-white/10'
                                    }`}
                                >
                                    <div className="flex items-center gap-2">
                                        {item.image_url ? (
                                            <img src={item.image_url} alt="" className="w-8 h-8 rounded object-cover" />
                                        ) : (
                                            <div className="w-8 h-8 rounded bg-white/10 flex items-center justify-center">
                                                <ShoppingBag className="w-4 h-4 text-white/50" />
                                            </div>
                                        )}
                                        <div className="flex-1 min-w-0">
                                            <span className="text-sm text-white truncate block">{item.title}</span>
                                            <span className="text-xs text-white/50">{item.price_coins} TC</span>
                                        </div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    ) : (
                        <p className="text-sm text-white/40">No marketplace listings available</p>
                    )}
                </div>
            </div>

            <div className="flex justify-end mt-6">
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-2 px-6 py-2 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold hover:from-purple-400 hover:to-pink-400 transition-all disabled:opacity-50"
                >
                    <Save className="w-4 h-4" />
                    {saving ? 'Saving...' : 'Save Featured Content'}
                </button>
            </div>
        </div>
    );
}
