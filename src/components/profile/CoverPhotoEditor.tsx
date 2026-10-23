import React, { useRef, useState, useEffect, useCallback } from 'react';

interface AutoCoverPhotoUploadProps {
  onSave: (result: {
    file: File;
    blob: Blob;
    previewUrl: string;
  }) => void | Promise<void>;
  isSaving?: boolean;
  currentImage?: string;
  targetWidth?: number;
  targetHeight?: number;
  outputQuality?: number;
}

const DEFAULT_WIDTH = 1800;
const DEFAULT_HEIGHT = 320;
const DEFAULT_QUALITY = 0.92;
const OUTPUT_TYPE = 'image/jpeg';

function createImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = src;
  });
}

function canvasToBlobFallback(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (result) => {
        if (result) {
          resolve(result);
          return;
        }

        try {
          const dataUrl = canvas.toDataURL(type, quality);
          const parts = dataUrl.split(',');
          const mime = parts[0].match(/:(.*?);/)?.[1] || type;
          const binary = atob(parts[1]);
          const bytes = new Uint8Array(binary.length);

          for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
          }

          resolve(new Blob([bytes], { type: mime }));
        } catch (error) {
          reject(
            error instanceof Error
              ? error
              : new Error('Failed to create image blob')
          );
        }
      },
      type,
      quality
    );
  });
}

async function autoCropCover(
  file: File,
  targetWidth = DEFAULT_WIDTH,
  targetHeight = DEFAULT_HEIGHT,
  quality = DEFAULT_QUALITY
): Promise<{ blob: Blob; file: File; previewUrl: string }> {
  const imageUrl = URL.createObjectURL(file);

  try {
    const image = await createImage(imageUrl);
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');

    if (!context) {
      throw new Error('Could not get canvas context');
    }

    canvas.width = targetWidth;
    canvas.height = targetHeight;

    const targetAspect = targetWidth / targetHeight;
    const imageAspect = image.width / image.height;

    let sourceX = 0;
    let sourceY = 0;
    let sourceWidth = image.width;
    let sourceHeight = image.height;

    if (imageAspect > targetAspect) {
      sourceWidth = Math.round(image.height * targetAspect);
      sourceX = Math.round((image.width - sourceWidth) / 2);
    } else {
      sourceHeight = Math.round(image.width / targetAspect);
      sourceY = Math.round((image.height - sourceHeight) / 2);
    }

    context.drawImage(
      image,
      sourceX,
      sourceY,
      sourceWidth,
      sourceHeight,
      0,
      0,
      targetWidth,
      targetHeight
    );

    const blob = await canvasToBlobFallback(
      canvas,
      OUTPUT_TYPE,
      quality
    );

    const outputFile = new File(
      [blob],
      `cover-${Date.now()}.jpg`,
      { type: OUTPUT_TYPE }
    );

    return {
      blob,
      file: outputFile,
      previewUrl: URL.createObjectURL(blob),
    };
  } finally {
    URL.revokeObjectURL(imageUrl);
  }
}

export default function AutoCoverPhotoUpload({
  onSave,
  isSaving = false,
  currentImage = '',
  targetWidth = DEFAULT_WIDTH,
  targetHeight = DEFAULT_HEIGHT,
  outputQuality = DEFAULT_QUALITY,
}: AutoCoverPhotoUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const previewUrlRef = useRef<string | null>(null);
  const mountedRef = useRef(true);
  const savingRef = useRef(false);

  const [preview, setPreview] = useState(currentImage);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');

  const releasePreviewUrl = useCallback(() => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      releasePreviewUrl();
    };
  }, [releasePreviewUrl]);

  useEffect(() => {
    if (!currentImage) {
      if (!isProcessing) {
        releasePreviewUrl();
        setPreview('');
      }
      return;
    }

    // Keep a local blob preview while saving. Once the parent confirms
    // the saved URL, replace the blob preview with the persisted image.
    if (
      !isProcessing &&
      currentImage !== previewUrlRef.current &&
      currentImage !== preview
    ) {
      releasePreviewUrl();
      setPreview(currentImage);
    }
  }, [
    currentImage,
    isProcessing,
    preview,
    releasePreviewUrl,
  ]);

  const handleChooseFile = useCallback(() => {
    if (isSaving || isProcessing || savingRef.current) return;
    inputRef.current?.click();
  }, [isSaving, isProcessing]);

  const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const input = event.currentTarget;
    const selectedFile = input.files?.[0];

    if (!selectedFile) return;

    // Allow selecting the same file again on a later attempt.
    input.value = '';

    if (isSaving || savingRef.current) return;

    if (!selectedFile.type.startsWith('image/')) {
      setError('Please select a valid image file.');
      return;
    }

    if (selectedFile.size > 10 * 1024 * 1024) {
      setError('Image size should be less than 10MB.');
      return;
    }

    savingRef.current = true;
    setError('');
    setIsProcessing(true);

    let result: {
      blob: Blob;
      file: File;
      previewUrl: string;
    } | null = null;

    try {
      result = await autoCropCover(
        selectedFile,
        targetWidth,
        targetHeight,
        outputQuality
      );

      if (!mountedRef.current) {
        URL.revokeObjectURL(result.previewUrl);
        return;
      }

      // Display the processed image immediately.
      releasePreviewUrl();
      previewUrlRef.current = result.previewUrl;
      setPreview(result.previewUrl);

      // The parent owns the actual Supabase upload and profile update.
      // Run that existing save flow exactly once.
      await onSave(result);
    } catch (err) {
      console.error('Cover photo upload error:', err);

      if (mountedRef.current) {
        setError(
          'Failed to save the cover photo. Please try again.'
        );
      }
    } finally {
      savingRef.current = false;

      if (mountedRef.current) {
        setIsProcessing(false);
      }
    }
  };

  return (
    <div className="w-full">
      <div
        className="relative w-full overflow-hidden rounded-2xl border border-purple-500/20 bg-gradient-to-r from-purple-900 via-indigo-900 to-blue-900"
        style={{ aspectRatio: `${targetWidth} / ${targetHeight}` }}
      >
        {preview ? (
          <img
            src={preview}
            alt="Cover photo preview"
            className="h-full w-full object-cover"
            onError={() => {
              if (previewUrlRef.current === preview) {
                return;
              }

              setPreview('');
            }}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-sm text-white/70">
            No cover photo selected
          </div>
        )}

        <div className="absolute inset-0 bg-black/20 pointer-events-none" />

        <div className="absolute bottom-4 right-4">
          <button
            type="button"
            onClick={handleChooseFile}
            disabled={isSaving || isProcessing}
            className="rounded-xl border border-white/15 bg-black/60 px-5 py-2.5 text-sm font-semibold text-white backdrop-blur-md transition-all hover:bg-black/80 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isProcessing
              ? 'Uploading...'
              : isSaving
                ? 'Saving...'
                : 'Verify'}
          </button>
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />

      {error && (
        <div
          role="alert"
          className="mt-3 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200"
        >
          {error}
        </div>
      )}
    </div>
  );
}