/**
 * SocialLinksManager.tsx
 * Manage social media links with drag-and-drop ordering
 */

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/lib/store';
import { toast } from 'sonner';
import { GripVertical, Plus, Trash2, Eye, EyeOff, ExternalLink, Link2 } from 'lucide-react';

interface SocialLink {
    id: string;
    platform: string;
    url: string | null;
    display_order: number;
    is_visible: boolean;
    verified_at: string | null;
}

interface PlatformConfig {
    value: string;
    label: string;
    icon: string;
    placeholder: string;
    color: string;
}

const PLATFORMS: PlatformConfig[] = [
    { value: 'tiktok', label: 'TikTok', icon: '🎵', placeholder: 'https://tiktok.com/@username', color: '#00f2ea' },
    { value: 'instagram', label: 'Instagram', icon: '📷', placeholder: 'https://instagram.com/username', color: '#E4405F' },
    { value: 'facebook', label: 'Facebook', icon: '👤', placeholder: 'https://facebook.com/username', color: '#1877F2' },
    { value: 'x', label: 'X (Twitter)', icon: '𝕏', placeholder: 'https://x.com/username', color: '#000000' },
    { value: 'youtube', label: 'YouTube', icon: '▶️', placeholder: 'https://youtube.com/@channel', color: '#FF0000' },
    { value: 'twitch', label: 'Twitch', icon: '🎮', placeholder: 'https://twitch.tv/username', color: '#9146FF' },
    { value: 'kick', label: 'Kick', icon: '🎯', placeholder: 'https://kick.com/username', color: '#53FC18' },
    { value: 'discord', label: 'Discord', icon: '💬', placeholder: 'https://discord.gg/invite', color: '#5865F2' },
    { value: 'onlyfans', label: 'OnlyFans', icon: '⭐', placeholder: 'https://onlyfans.com/username', color: '#00AFF0' },
    { value: 'reddit', label: 'Reddit', icon: '🤖', placeholder: 'https://reddit.com/user/username', color: '#FF4500' },
    { value: 'linkedin', label: 'LinkedIn', icon: '💼', placeholder: 'https://linkedin.com/in/username', color: '#0A66C2' },
    { value: 'github', label: 'GitHub', icon: '🐙', placeholder: 'https://github.com/username', color: '#8B5CF6' },
    { value: 'website', label: 'Personal Website', icon: '🌐', placeholder: 'https://yourwebsite.com', color: '#6366F1' },
];

export default function SocialLinksManager() {
    const { user } = useAuthStore();
    const [links, setLinks] = useState<SocialLink[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
    const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

    const fetchLinks = useCallback(async () => {
        if (!user) return;
        
        try {
            const { data, error } = await supabase.rpc('get_profile_social_links', {
                p_user_id: user.id,
            });
            
            if (error) throw error;
            setLinks(data || []);
        } catch (err) {
            console.error('Error fetching social links:', err);
        } finally {
            setLoading(false);
        }
    }, [user]);

    useEffect(() => {
        fetchLinks();
    }, [fetchLinks]);

    const isValidUrl = (url: string): boolean => {
        if (!url) return true;
        try {
            new URL(url);
            return url.startsWith('http://') || url.startsWith('https://');
        } catch {
            return false;
        }
    };

    const getAvailablePlatforms = () => {
        const usedPlatforms = links.map(l => l.platform);
        return PLATFORMS.filter(p => !usedPlatforms.includes(p.value));
    };

    const handleAddPlatform = async (platform: string) => {
        if (!user) return;
        
        const newLink: SocialLink = {
            id: crypto.randomUUID(),
            platform,
            url: null,
            display_order: links.length,
            is_visible: true,
            verified_at: null,
        };
        
        setLinks([...links, newLink]);
    };

    const handleRemovePlatform = async (platform: string) => {
        if (!user) return;
        
        try {
            const { error } = await supabase.rpc('delete_social_link', {
                p_user_id: user.id,
                p_platform: platform,
            });
            
            if (error) throw error;
            setLinks(links.filter(l => l.platform !== platform));
            toast.success('Social link removed');
        } catch {
            toast.error('Failed to remove social link');
        }
    };

    const handleUrlChange = async (platform: string, url: string) => {
        if (!user) return;
        
        if (url && !isValidUrl(url)) {
            toast.error('Please enter a valid URL');
            return;
        }
        
        setSaving(true);
        try {
            const { error } = await supabase.rpc('upsert_social_link', {
                p_user_id: user.id,
                p_platform: platform,
                p_url: url || null,
            });
            
            if (error) throw error;
            
            setLinks(links.map(l => 
                l.platform === platform ? { ...l, url: url || null } : l
            ));
        } catch {
            toast.error('Failed to save link');
        } finally {
            setSaving(false);
        }
    };

    const handleToggleVisibility = async (platform: string) => {
        if (!user) return;
        
        const link = links.find(l => l.platform === platform);
        if (!link) return;
        
        const newVisibility = !link.is_visible;
        
        try {
            const { error } = await supabase.rpc('upsert_social_link', {
                p_user_id: user.id,
                p_platform: platform,
                p_is_visible: newVisibility,
            });
            
            if (error) throw error;
            
            setLinks(links.map(l => 
                l.platform === platform ? { ...l, is_visible: newVisibility } : l
            ));
        } catch {
            toast.error('Failed to update visibility');
        }
    };

    const handleDragStart = (index: number) => {
        setDraggedIndex(index);
    };

    const handleDragOver = (e: React.DragEvent, index: number) => {
        e.preventDefault();
        setDragOverIndex(index);
    };

    const handleDragEnd = async () => {
        if (draggedIndex === null || dragOverIndex === null || draggedIndex === dragOverIndex) {
            setDraggedIndex(null);
            setDragOverIndex(null);
            return;
        }
        
        const newLinks = [...links];
        const [draggedItem] = newLinks.splice(draggedIndex, 1);
        newLinks.splice(dragOverIndex, 0, draggedItem);
        
        const updatedLinks = newLinks.map((link, index) => ({
            ...link,
            display_order: index,
        }));
        
        setLinks(updatedLinks);
        
        try {
            const platformOrders = updatedLinks.map(link => ({
                platform: link.platform,
                order: link.display_order,
            }));
            
            await supabase.rpc('reorder_social_links', {
                p_user_id: user?.id,
                p_platform_orders: JSON.stringify(platformOrders),
            });
        } catch {
            toast.error('Failed to save order');
        }
        
        setDraggedIndex(null);
        setDragOverIndex(null);
    };

    const getPlatformConfig = (platform: string): PlatformConfig => {
        return PLATFORMS.find(p => p.value === platform) || PLATFORMS[0];
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
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                    <Link2 className="w-5 h-5 text-purple-400" />
                    Social Links
                </h3>
            </div>

            <p className="text-sm text-white/50 mb-4">
                Add your social media profiles. Drag to reorder. Toggle visibility without deleting.
            </p>

            {/* Links List */}
            <div className="space-y-3 mb-4">
                {links.map((link, index) => {
                    const config = getPlatformConfig(link.platform);
                    return (
                        <div
                            key={link.id}
                            draggable
                            onDragStart={() => handleDragStart(index)}
                            onDragOver={(e) => handleDragOver(e, index)}
                            onDragEnd={handleDragEnd}
                            className={`flex items-center gap-3 p-3 rounded-xl bg-white/5 border transition-all ${
                                dragOverIndex === index ? 'border-purple-500 bg-purple-500/10' : 'border-white/10'
                            } ${draggedIndex === index ? 'opacity-50' : ''}`}
                        >
                            <div className="cursor-grab text-white/40 hover:text-white/60">
                                <GripVertical className="w-5 h-5" />
                            </div>
                            
                            <div 
                                className="w-8 h-8 rounded-lg flex items-center justify-center text-lg"
                                style={{ backgroundColor: `${config.color}20` }}
                            >
                                {config.icon}
                            </div>
                            
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="text-sm font-medium text-white">{config.label}</span>
                                    {!link.is_visible && (
                                        <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400">
                                            Hidden
                                        </span>
                                    )}
                                </div>
                                <input
                                    type="url"
                                    value={link.url || ''}
                                    onChange={(e) => handleUrlChange(link.platform, e.target.value)}
                                    placeholder={config.placeholder}
                                    disabled={saving}
                                    className="w-full px-3 py-1.5 text-sm rounded-lg bg-white/5 border border-white/10 text-white placeholder-white/30 focus:outline-none focus:border-purple-500 transition-colors disabled:opacity-50"
                                />
                            </div>
                            
                            <div className="flex items-center gap-1">
                                {link.url && (
                                    <a
                                        href={link.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="p-2 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-colors"
                                    >
                                        <ExternalLink className="w-4 h-4" />
                                    </a>
                                )}
                                <button
                                    onClick={() => handleToggleVisibility(link.platform)}
                                    className={`p-2 rounded-lg transition-colors ${
                                        link.is_visible 
                                            ? 'text-green-400 hover:bg-green-500/10' 
                                            : 'text-white/40 hover:bg-white/10'
                                    }`}
                                    title={link.is_visible ? 'Hide from profile' : 'Show on profile'}
                                >
                                    {link.is_visible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                                </button>
                                <button
                                    onClick={() => handleRemovePlatform(link.platform)}
                                    className="p-2 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors"
                                    title="Remove"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Add Platform */}
            {getAvailablePlatforms().length > 0 && (
                <div className="border-t border-white/10 pt-4">
                    <p className="text-sm text-white/50 mb-3">Add a social link:</p>
                    <div className="flex flex-wrap gap-2">
                        {getAvailablePlatforms().map(platform => (
                            <button
                                key={platform.value}
                                onClick={() => handleAddPlatform(platform.value)}
                                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white/70 text-sm hover:bg-white/10 hover:border-white/20 transition-colors"
                            >
                                <span>{platform.icon}</span>
                                <span>{platform.label}</span>
                                <Plus className="w-3 h-3" />
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {links.length === 0 && (
                <div className="text-center py-8 text-white/40">
                    <Link2 className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>No social links added yet</p>
                    <p className="text-sm">Click a platform above to add your profile</p>
                </div>
            )}
        </div>
    );
}
