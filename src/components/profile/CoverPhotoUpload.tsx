import React, { useState, useRef, useCallback, forwardRef, useImperativeHandle } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../lib/store';
import { toast } from 'sonner';
import { Upload, X, Image as ImageIcon, Check } from 'lucide-react';
import CoverPhotoEditor from './CoverPhotoEditor';
import { notifyFollowersOfCoverPhotoUpdate } from '../../lib/notifications';

export interface CoverPhotoUploadRef {
  triggerFileSelect: () => void;
}

interface CoverPhotoUploadProps {
  onUploadComplete?: (url: string | null) => void;
  currentCoverUrl?: string | null;
  userId?: string;
}

interface CoverPhotoSaveResult {
  blob: Blob;
  file: File;
  previewUrl: string;
}

export default forwardRef<CoverPhotoUploadRef, CoverPhotoUploadProps>(function CoverPhotoUpload({
  onUploadComplete,
  currentCoverUrl,
  userId: propUserId
}: CoverPhotoUploadProps, ref) {
  const { user } = useAuthStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [showEditor, setShowEditor] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const triggerFileSelect = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  useImperativeHandle(ref, () => ({
    triggerFileSelect
  }), [triggerFileSelect]);

  const effectiveUserId = propUserId || user?.id;

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

  const handleContinueToEditor = () => {
    if (!preview) return;
    setSelectedImage(preview);
    setShowEditor(true);
    setPreview(null);
  };

  const handleSave = async (result: CoverPhotoSaveResult) => {
    if (!effectiveUserId) {
      toast.error('You must be logged in to upload a cover photo');
      return;
    }

    console.log('FILE BEFORE UPLOAD:', {
      size: result.file.size,
      type: result.file.type,
      name: result.file.name,
    })

    if (result.file.size <= 0) {
      toast.error('Selected cover file is empty');
      return;
    }

    setIsSaving(true);
    try {
      const timestamp = Date.now();
      const fileExt = result.file.name.split('.').pop() || 'jpg';
      const filePath = `${effectiveUserId}/${timestamp}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('covers')
        .upload(filePath, result.file, {
          contentType: result.file.type || 'image/jpeg',
          cacheControl: '3600',
          upsert: true,
        });

      if (uploadError) {
        console.error('Upload error:', uploadError);
        toast.error('Failed to upload cover photo: ' + uploadError.message);
        return;
      }

      const { data: urlData } = supabase.storage
        .from('covers')
        .getPublicUrl(filePath);

      const publicUrl = urlData?.publicUrl;
      if (!publicUrl) {
        toast.error('Failed to get public URL');
        return;
      }

      console.log('[CoverPhotoUpload] Uploaded filePath:', filePath);
      console.log('[CoverPhotoUpload] Public URL:', publicUrl);

      const { error: updateError } = await supabase
        .from('user_profiles')
        .update({ cover_url: publicUrl })
        .eq('id', effectiveUserId);

      if (updateError) {
        console.error('Profile update error:', updateError);
        toast.error('Failed to save cover photo to profile');
        return;
      }

      toast.success('Cover photo saved!');
      setShowEditor(false);
      setSelectedImage(null);
      setPreview(null);

      onUploadComplete?.(publicUrl);

      const user = useAuthStore.getState().user;
      const username = user?.user_metadata?.username || 'Someone';
      supabase
        .from('troll_posts')
        .insert({
          user_id: effectiveUserId,
          content: 'Updated my cover photo',
          post_type: 'image',
          image_url: publicUrl,
        })
        .then(({ error: postError }) => {
          if (postError) {
            console.error('Auto-post error:', postError);
          } else {
            notifyFollowersOfCoverPhotoUpdate(effectiveUserId, username, publicUrl).catch((notifyErr) => {
              console.error('Follower notification error:', notifyErr);
            });
          }
        });
    } catch (err) {
      console.error('Error saving cover photo:', err);
      toast.error('Failed to save cover photo');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setShowEditor(false);
    setSelectedImage(null);
  };

  const handleRemoveCover = async () => {
    if (!effectiveUserId) return;

    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({ cover_url: null })
        .eq('id', effectiveUserId);

      if (error) throw error;
      
      toast.success('Cover photo removed');
      onUploadComplete?.(null);
    } catch (err) {
      console.error('Error removing cover photo:', err);
      toast.error('Failed to remove cover photo');
    }
  };

  return (
    <>
      <div className="space-y-4 p-4 bg-slate-900/50 rounded-xl border border-purple-500/20">
        {/* Cover Preview */}
        <div className="w-full aspect-[3/1] rounded-xl overflow-hidden bg-black/40 border border-white/10">
          {(currentCoverUrl || preview) ? (
            <img
              src={preview || currentCoverUrl}
              alt="Cover preview"
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-white/30 text-sm">
              No cover photo selected
            </div>
          )}
        </div>

        {/* Upload Button */}
        <div className="flex items-center gap-3">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
          />
          
          <button
            onClick={triggerFileSelect}
            disabled={isUploading || !effectiveUserId}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-pink-500 via-purple-500 to-pink-500 hover:from-pink-400 hover:via-purple-400 hover:to-pink-400 text-white font-semibold transition-all transform hover:scale-105 shadow-lg shadow-purple-500/25 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
          >
            {isUploading ? (
              <>
                <span className="animate-spin rounded-full h-4 w-4 border-2 border-white/30 border-t-white" />
                Uploading...
              </>
            ) : (
              <>
                <Upload size={18} />
                Change Cover
              </>
            )}
          </button>

          {currentCoverUrl && (
            <button
              onClick={handleRemoveCover}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-600/20 hover:bg-red-600/30 border border-red-500/30 text-red-400 font-medium transition-all"
            >
              🗑️ Remove
            </button>
          )}
        </div>

        {/* Help Text */}
        <p className="text-sm text-purple-200/60">
          📐 Recommended: 1500x500 pixels (3:1 ratio) • JPG or PNG up to 5MB
        </p>
      </div>

      {/* Preview Modal */}
      {preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="bg-slate-900 rounded-2xl p-6 max-w-2xl w-full border border-white/10">
            <h3 className="text-lg font-semibold text-white mb-4">Preview Cover Photo</h3>
            <div className="w-full aspect-[3/1] rounded-xl overflow-hidden mb-4 bg-black/40">
              <img src={preview} alt="Cover preview" className="w-full h-full object-cover" />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setPreview(null)}
                className="flex-1 px-4 py-2 rounded-lg bg-white/10 text-white font-medium hover:bg-white/20 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleContinueToEditor}
                className="flex-1 px-4 py-2 rounded-lg bg-gradient-to-r from-pink-500 to-purple-500 text-white font-medium hover:from-pink-400 hover:to-purple-400 transition-colors flex items-center justify-center gap-2"
              >
                <Check className="w-4 h-4" />
                Continue
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cover Photo Editor Modal */}
      {showEditor && selectedImage && (
        <CoverPhotoEditor
          image={selectedImage}
          onSave={handleSave}
          onCancel={handleCancel}
          isSaving={isSaving}
        />
      )}
    </>
  );
});
