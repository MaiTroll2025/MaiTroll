import React, { useState } from 'react';
import { X, Upload, Trash2, Image as ImageIcon } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface CameraOffImageModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId?: string;
  currentImageUrl?: string | null;
  onImageUpdated?: (url: string | null) => void;
}

export default function CameraOffImageModal({
  isOpen,
  onClose,
  userId,
  currentImageUrl,
  onImageUpdated
}: CameraOffImageModalProps) {
  const [preview, setPreview] = useState<string | null>(currentImageUrl || null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
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

    if (!userId) {
      toast.error('You must be logged in to upload an image');
      return;
    }

    setIsUploading(true);
    try {
      const timestamp = Date.now();
      const fileExt = selectedFile.name.split('.').pop() || 'jpg';
      const filePath = `${userId}/${timestamp}.${fileExt}`;

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
        .eq('id', userId);

      if (updateError) {
        console.error('Profile update error:', updateError);
        toast.error('Failed to save image to profile');
        setIsUploading(false);
        return;
      }

      toast.success('Camera-off image updated!');
      setSelectedFile(null);
      onImageUpdated?.(publicUrl);
      onClose();
    } catch (err) {
      console.error('Upload error:', err);
      toast.error('Failed to upload image');
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemove = async () => {
    if (!userId) return;

    setIsUploading(true);
    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({ camera_off_image_url: null })
        .eq('id', userId);

      if (error) {
        toast.error('Failed to remove image');
        return;
      }

      toast.success('Camera-off image removed');
      setPreview(null);
      setSelectedFile(null);
      onImageUpdated?.(null);
      onClose();
    } finally {
      setIsUploading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="bg-zinc-900 border border-cyan-500/30 rounded-2xl w-full max-w-lg mx-4 p-6 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <ImageIcon size={20} className="text-cyan-400" />
            <h2 className="text-lg font-bold text-white">Camera Off Image</h2>
          </div>
          <button
            onClick={onClose}
            className="text-white/60 hover:text-white transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Description */}
        <p className="text-sm text-white/70 mb-4">
          Upload an image to display when your camera is off. The image will fill the entire broadcaster box.
        </p>

        {/* Preview */}
        {preview && (
          <div className="relative w-full aspect-video rounded-lg overflow-hidden border-2 border-cyan-500/30 bg-black/50 mb-4">
            <img
              src={preview}
              alt="Camera off preview"
              className="w-full h-full object-cover"
            />
            {selectedFile && (
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                <div className="text-center">
                  <Upload size={32} className="text-cyan-400 mx-auto mb-2" />
                  <p className="text-sm font-bold text-cyan-300">New image ready to upload</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Upload Area */}
        <label className="block w-full border-2 border-dashed border-cyan-500/30 hover:border-cyan-400/60 rounded-lg p-6 text-center cursor-pointer transition-all bg-cyan-500/5 hover:bg-cyan-500/10 mb-4">
          <div className="flex flex-col items-center gap-2">
            <ImageIcon size={32} className="text-cyan-400/60" />
            <div>
              <p className="text-sm font-semibold text-white">
                Click to upload or drag and drop
              </p>
              <p className="text-xs text-white/60">
                PNG, JPG, GIF up to 10MB
              </p>
            </div>
          </div>
          <input
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
          />
        </label>

        {/* Action Buttons */}
        <div className="flex gap-3">
          {selectedFile ? (
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
                className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-all font-medium"
              >
                Cancel
              </button>
            </>
          ) : (
            <>
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-all font-medium"
              >
                Close
              </button>
              {currentImageUrl && (
                <button
                  onClick={handleRemove}
                  disabled={isUploading}
                  className="flex-1 bg-red-600/20 hover:bg-red-600/30 disabled:bg-red-600/10 text-red-400 font-bold py-2 px-4 rounded-lg transition-all border border-red-500/30 flex items-center justify-center gap-2"
                >
                  <Trash2 size={16} />
                  Remove
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
