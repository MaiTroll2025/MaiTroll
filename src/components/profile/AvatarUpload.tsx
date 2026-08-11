/**
 * AvatarUpload.tsx
 * Profile picture upload component with cropping
 */

import React, { useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/lib/store';
import { toast } from 'sonner';
import { Upload, X, User } from 'lucide-react';
import { notifyFollowersOfProfilePictureUpdate } from '@/lib/notifications';

interface AvatarUploadProps {
    currentUrl: string | null;
    onUploadComplete: (url: string | null) => void;
    size?: 'sm' | 'md' | 'lg';
}

export default function AvatarUpload({ 
    currentUrl, 
    onUploadComplete,
    size = 'md' 
}: AvatarUploadProps) {
    const { user } = useAuthStore();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [preview, setPreview] = useState<string | null>(null);

    const sizeClasses = {
        sm: 'w-16 h-16',
        md: 'w-24 h-24',
        lg: 'w-32 h-32',
    };

    // Convert canvas to a Blob, falling back to dataURL→Blob if toBlob returns null
    // (toBlob can return null in Safari / some mobile browsers, which previously
    // caused "Failed to create blob" errors).
    const canvasToBlobFallback = (
        canvas: HTMLCanvasElement,
        type: string,
        quality: number
    ): Promise<Blob> => {
        return new Promise((resolve, reject) => {
            canvas.toBlob(
                (blob) => {
                    if (blob) {
                        resolve(blob);
                        return;
                    }
                    try {
                        const dataUrl = canvas.toDataURL(type, quality);
                        const arr = dataUrl.split(',');
                        const mime = arr[0].match(/:(.*?);/)?.[1] || type;
                        const bstr = atob(arr[1]);
                        let n = bstr.length;
                        const u8arr = new Uint8Array(n);
                        while (n--) {
                            u8arr[n] = bstr.charCodeAt(n);
                        }
                        resolve(new Blob([u8arr], { type: mime }));
                    } catch (err) {
                        reject(err instanceof Error ? err : new Error('Failed to create blob'));
                    }
                },
                type,
                quality
            );
        });
    };

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            toast.error('Please select an image file');
            return;
        }

        if (file.size > 5 * 1024 * 1024) {
            toast.error('Image must be less than 5MB');
            return;
        }

        const reader = new FileReader();
        reader.onload = () => {
            setPreview(reader.result as string);
        };
        reader.readAsDataURL(file);

        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const handleUpload = async () => {
        if (!user || !preview) return;

        setIsUploading(true);
        try {
            const img = new Image();
            img.src = preview;
            await new Promise((resolve) => { img.onload = resolve; });

            const canvas = document.createElement('canvas');
            const outputSize = 400;
            canvas.width = outputSize;
            canvas.height = outputSize;

            const ctx = canvas.getContext('2d');
            if (!ctx) throw new Error('Failed to get canvas context');

            const min = Math.min(img.width, img.height);
            const sx = (img.width - min) / 2;
            const sy = (img.height - min) / 2;

            ctx.drawImage(img, sx, sy, min, min, 0, 0, outputSize, outputSize);

            const blob = await canvasToBlobFallback(canvas, 'image/jpeg', 0.9);

            const filePath = `${user.id}/avatar-${Date.now()}.jpg`;

            const { error: uploadError } = await supabase.storage
                .from('avatars')
                .upload(filePath, blob, {
                    contentType: 'image/jpeg',
                    upsert: true,
                });

            if (uploadError) throw uploadError;

            const { data: urlData } = supabase.storage
                .from('avatars')
                .getPublicUrl(filePath);

            const publicUrl = urlData?.publicUrl;
            if (!publicUrl) throw new Error('Failed to get public URL');

            const { error: profileError } = await supabase
                .from('user_profiles')
                .update({ avatar_url: publicUrl })
                .eq('id', user.id);

            if (profileError) throw profileError;

            onUploadComplete(publicUrl);
            setPreview(null);
            toast.success('Profile picture updated!');

            const username = user.user_metadata?.username || 'Someone';
            supabase
              .from('troll_posts')
              .insert({
                user_id: user.id,
                content: 'Updated my profile picture',
                post_type: 'image',
                image_url: publicUrl,
              })
              .then(({ error: postError }) => {
                if (postError) {
                  console.error('Auto-post error:', postError);
                } else {
                  notifyFollowersOfProfilePictureUpdate(user.id, username, publicUrl).catch((notifyErr) => {
                    console.error('Follower notification error:', notifyErr);
                  });
                }
              });
        } catch (err) {
            console.error('Upload error:', err);
            toast.error('Failed to upload profile picture');
        } finally {
            setIsUploading(false);
        }
    };

    const handleRemove = async () => {
        if (!user) return;

        try {
            const { error } = await supabase
                .from('user_profiles')
                .update({ avatar_url: null })
                .eq('id', user.id);

            if (error) throw error;
            onUploadComplete(null);
            toast.success('Profile picture removed');
        } catch {
            toast.error('Failed to remove profile picture');
        }
    };

    return (
        <div className="space-y-3">
            <div className="flex items-center gap-4">
                <div className={`${sizeClasses[size]} rounded-xl overflow-hidden bg-white/5 border border-white/10 flex items-center justify-center`}>
                    {currentUrl ? (
                        <img 
                            src={currentUrl} 
                            alt="Avatar" 
                            className="w-full h-full object-cover"
                        />
                    ) : (
                        <User className="w-1/2 h-1/2 text-white/30" />
                    )}
                </div>
                
                <div className="flex flex-col gap-2">
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleFileSelect}
                        className="hidden"
                    />
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploading}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-500/20 border border-purple-500/30 text-purple-300 text-sm font-medium hover:bg-purple-500/30 transition-colors disabled:opacity-50"
                    >
                        <Upload className="w-4 h-4" />
                        {isUploading ? 'Uploading...' : 'Change Photo'}
                    </button>
                    {currentUrl && (
                        <button
                            onClick={handleRemove}
                            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-medium hover:bg-red-500/20 transition-colors"
                        >
                            <X className="w-4 h-4" />
                            Remove
                        </button>
                    )}
                </div>
            </div>

            {preview && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
                    <div className="bg-slate-900 rounded-2xl p-6 max-w-sm w-full border border-white/10">
                        <h3 className="text-lg font-semibold text-white mb-4">Preview</h3>
                        <div className="w-48 h-48 mx-auto rounded-xl overflow-hidden mb-4">
                            <img src={preview} alt="Preview" className="w-full h-full object-cover" />
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setPreview(null)}
                                className="flex-1 px-4 py-2 rounded-lg bg-white/10 text-white font-medium hover:bg-white/20 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleUpload}
                                disabled={isUploading}
                                className="flex-1 px-4 py-2 rounded-lg bg-purple-500 text-white font-medium hover:bg-purple-400 transition-colors disabled:opacity-50"
                            >
                                {isUploading ? 'Saving...' : 'Save'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <p className="text-xs text-white/40">
                Recommended: Square image, at least 400x400px. JPG or PNG up to 5MB.
            </p>
        </div>
    );
}
