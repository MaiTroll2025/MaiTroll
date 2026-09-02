import React, { useState, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/lib/store';
import { toast } from 'sonner';
import { Upload, X, Image as ImageIcon } from 'lucide-react';

interface CameraOffImageUploadProps {
  onUploadComplete?: (url: string | null) => void;
  currentImageUrl?: string | null;
  userId?: string;
}

export default function CameraOffImageUpload({
  onUploadComplete,
  currentImageUrl,
  userId: propUserId
}: CameraOffImageUploadProps) {
  const { user } = useAuthStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(currentImageUrl || null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const effectiveUserId = propUserId || user?.id;

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error('Image must be less than 10MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setPreview(reader.result as string);
      setSelectedFile(file);
    };
    reader.readAsDataURL(file);
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      toast.error('Please select an image first');
      return;
    }

    if (!effectiveUserId) {
      toast.error('You must be logged in to upload an image');
      return;
    }

    setIsUploading(true);
    try {
      const timestamp = Date.now();
      const fileExt = selectedFile.name.split('.').pop() || 'jpg';
      const filePath = `${effectiveUserId}/${timestamp}.${fileExt}`;

      // Upload to camera-off-images bucket
      const { error: uploadError } = await supabase.storage
        .from('camera-off-images')
        .upload(filePath, selectedFile, {
          contentType: selectedFile.type || 'image/jpeg',
          cacheControl: '3600',
          upsert: true,
        });

      if (uploadError) {
        console.error('Upload error:', uploadError);
        toast.error('Failed to upload image: ' + uploadError.message);
        setIsUploading(false);
        return;
      }

      const { data: urlData } = supabase.storage
        .from('camera-off-images')
        .getPublicUrl(filePath);

      const publicUrl = urlData?.publicUrl;
      if (!publicUrl) {
        toast.error('Failed to get public URL');
        setIsUploading(false);
        return;
      }

      // Update user profile
      const { error: updateError } = await supabase
        .from('user_profiles')
        .update({ camera_off_image_url: publicUrl })
        .eq('id', effectiveUserId);

      if (updateError) {
        console.error('Profile update error:', updateError);
        toast.error('Failed to save image to profile');
        setIsUploading(false);
        return;
      }

      toast.success('Camera-off image saved!');
      setSelectedFile(null);
      onUploadComplete?.(publicUrl);
    } catch (err) {
      console.error('Upload error:', err);
      toast.error('Failed to upload image');
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemove = async () => {
    if (!effectiveUserId) return;

    setIsUploading(true);
    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({ camera_off_image_url: null })
        .eq('id', effectiveUserId);

      if (error) {
        toast.error('Failed to remove image');
        return;
      }

      toast.success('Camera-off image removed');
      setPreview(null);
      setSelectedFile(null);
      onUploadComplete?.(null);
    } finally {
      setIsUploading(false);
    }
  };

  const triggerFileSelect = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2">
        <label className="text-sm font-semibold text-white">
          Camera Off Image
        </label>
        <p className="text-xs text-white/60">
          Upload an image to display when your camera is turned off during broadcasts. The image will fill the entire broadcaster box.
        </p>
      </div>

      {/* Preview */}
      {preview && (
        <div className="relative w-full max-w-sm aspect-video mx-auto rounded-lg overflow-hidden border-2 border-white/20 bg-black/50">
          <img
            src={preview}
            alt="Camera off preview"
            className="w-full h-full object-cover"
          />
          <button
            onClick={() => setPreview(null)}
            className="absolute top-2 right-2 bg-red-600 hover:bg-red-700 text-white p-1.5 rounded-full transition-all"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Upload Area */}
      <div
        onClick={triggerFileSelect}
        className="w-full border-2 border-dashed border-white/20 hover:border-cyan-400/50 rounded-lg p-6 text-center cursor-pointer transition-all bg-white/[0.02] hover:bg-white/[0.05]"
      >
        <div className="flex flex-col items-center gap-3">
          <ImageIcon size={32} className="text-white/60" />
          <div>
            <p className="text-sm font-semibold text-white">
              Click to upload or drag and drop
            </p>
            <p className="text-xs text-white/60">
              PNG, JPG, GIF up to 10MB
            </p>
          </div>
        </div>
      </div>

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* Action Buttons */}
      <div className="flex gap-3">
        {selectedFile && (
          <>
            <button
              onClick={handleUpload}
              disabled={isUploading}
              className="flex-1 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 disabled:from-cyan-500/50 disabled:to-blue-500/50 text-white font-bold py-2 px-4 rounded-lg transition-all flex items-center justify-center gap-2"
            >
              <Upload size={16} />
              {isUploading ? 'Uploading...' : 'Save Image'}
            </button>
            <button
              onClick={() => {
                setSelectedFile(null);
                if (!currentImageUrl) setPreview(null);
              }}
              className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-all"
            >
              Cancel
            </button>
          </>
        )}

        {currentImageUrl && !selectedFile && (
          <button
            onClick={handleRemove}
            disabled={isUploading}
            className="flex-1 bg-red-600/20 hover:bg-red-600/30 disabled:bg-red-600/10 text-red-400 font-bold py-2 px-4 rounded-lg transition-all border border-red-500/30"
          >
            Remove Image
          </button>
        )}
      </div>
    </div>
  );
}
