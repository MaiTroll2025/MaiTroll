// ==========================================
// SELLER API FUNCTIONS
// ==========================================

import { supabase } from './supabase';
import { validateFile, FILE_VALIDATION } from './fileValidation';
import type { 
  SellerTier, 
  MarketplaceReview, 
  CreateReviewInput, 
  MediaMetadata 
} from './sellerTiers';

/**
 * Get seller profile with tier information
 */
export async function getSellerProfile(sellerId: string) {
  const { data, error } = await supabase
    .from('user_profiles')
    .select(`
      id,
      username,
      avatar_url,
      seller_tier,
      completed_sales,
      positive_reviews,
      negative_reviews,
      created_at
    `)
    .eq('id', sellerId)
    .single();

  if (error) throw error;
  return data;
}

/**
 * Get top sellers by tier
 */
export async function getTopSellers(tier?: SellerTier, limit: number = 10) {
  let query = supabase
    .from('user_profiles')
    .select(`
      id,
      username,
      avatar_url,
      seller_tier,
      completed_sales,
      positive_reviews,
      negative_reviews
    `)
    .eq('is_banned', false)
    .order('completed_sales', { ascending: false })
    .limit(limit);

  if (tier) {
    query = query.eq('seller_tier', tier);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

// ==========================================
// REVIEW MANAGEMENT
// ==========================================

/**
 * Create a marketplace review
 */
export async function createMarketplaceReview(input: CreateReviewInput): Promise<{
  success: boolean;
  review_id: string;
  seller_avg_rating: number;
  seller_total_reviews: number;
}> {
  const { data, error } = await supabase.rpc('create_marketplace_review', {
    p_order_id: input.order_id,
    p_seller_id: input.seller_id,
    p_buyer_id: input.buyer_id,
    p_listing_id: input.listing_id || null,
    p_listing_type: input.listing_type || 'marketplace',
    p_rating: input.rating,
    p_comment: input.comment || null,
    p_images: input.images || [],
    p_delivery_rating: input.delivery_rating || null,
    p_item_as_described: input.item_as_described ?? true,
    p_would_recommend: input.would_recommend ?? true,
  });

  if (error) throw error;
  return data;
}

/**
 * Get seller reviews
 */
export async function getSellerReviews(
  sellerId: string, 
  limit: number = 20, 
  offset: number = 0
): Promise<MarketplaceReview[]> {
  const { data, error } = await supabase.rpc('get_seller_reviews', {
    p_seller_id: sellerId,
    p_limit: limit,
    p_offset: offset,
  });

  if (error) throw error;
  return data || [];
}

/**
 * Get reviews for a specific order
 */
export async function getOrderReview(orderId: string, sellerId: string): Promise<MarketplaceReview | null> {
  const { data, error } = await supabase
    .from('marketplace_reviews')
    .select('*')
    .eq('order_id', orderId)
    .eq('seller_id', sellerId)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

/**
 * Get buyer's review history
 */
export async function getBuyerReviews(buyerId: string, limit: number = 20) {
  const { data, error } = await supabase
    .from('marketplace_reviews')
    .select(`
      *,
      seller:user_profiles!seller_id(
        id,
        username,
        avatar_url,
        seller_tier
      )
    `)
    .eq('buyer_id', buyerId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data;
}

// ==========================================
// APPEAL MEDIA MANAGEMENT
// ==========================================

/**
 * Update appeal with media attachments
 */
export async function updateAppealMedia(
  appealId: string,
  images: MediaMetadata[],
  videos: MediaMetadata[] = [],
  imageMetadata: any[] = [],
  videoMetadata: any[] = []
) {
  const { data, error } = await supabase.rpc('update_appeal_media', {
    p_appeal_id: appealId,
    p_images: images.map(img => img.url),
    p_videos: videos.map(vid => vid.url),
    p_image_metadata: imageMetadata,
    p_video_metadata: videoMetadata,
  });

  if (error) throw error;
  return data;
}

/**
 * Get appeal with media
 */
export async function getAppealWithMedia(appealId: string) {
  const { data, error } = await supabase
    .from('transaction_appeals')
    .select('*')
    .eq('id', appealId)
    .single();

  if (error) throw error;
  return data;
}

// ==========================================
// IMAGE UPLOAD HELPERS
// ==========================================

/**
 * Upload image to review-images bucket
 */
export async function uploadReviewImage(
  file: File,
  userId: string
): Promise<{ url: string; metadata: MediaMetadata }> {
  const validation = validateFile(file, FILE_VALIDATION.image.types, FILE_VALIDATION.image.maxSize, 'Review image')
  if (!validation.valid) throw new Error(validation.error)

  const fileExt = file.name.split('.').pop();
  const fileName = `${userId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
  
  const { data: _data, error } = await supabase.storage
    .from('review-images')
    .upload(fileName, file, {
      cacheControl: '3600',
      upsert: false,
    });

  if (error) throw error;

  const { data: urlData } = supabase.storage
    .from('review-images')
    .getPublicUrl(fileName);

  // Try to extract EXIF metadata
  const metadata = await extractImageMetadata(file);

  return {
    url: urlData.publicUrl,
    metadata: {
      url: urlData.publicUrl,
      filename: fileName,
      contentType: file.type,
      size: file.size,
      ...metadata,
    },
  };
}

/**
 * Upload media to appeal-media bucket
 */
export async function uploadAppealMedia(
  file: File,
  userId: string
): Promise<{ url: string; metadata: MediaMetadata }> {
  const isVideo = file.type.startsWith('video/')
  const allowedTypes = isVideo ? FILE_VALIDATION.videoShort.types : FILE_VALIDATION.image.types
  const maxSize = isVideo ? FILE_VALIDATION.videoShort.maxSize : FILE_VALIDATION.image.maxSize
  const validation = validateFile(file, allowedTypes, maxSize, isVideo ? 'Appeal video' : 'Appeal image')
  if (!validation.valid) throw new Error(validation.error)
  const bucket = isVideo ? 'appeal-media' : 'appeal-media';
  
  const fileExt = file.name.split('.').pop();
  const fileName = `${userId}/${isVideo ? 'videos' : 'images'}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
  
  const { data: _data, error } = await supabase.storage
    .from(bucket)
    .upload(fileName, file, {
      cacheControl: '3600',
      upsert: false,
    });

  if (error) throw error;

  const { data: urlData } = supabase.storage
    .from(bucket)
    .getPublicUrl(fileName);

  // Extract metadata
  let metadata: Partial<MediaMetadata> = {};
  if (!isVideo) {
    metadata = await extractImageMetadata(file);
  } else {
    metadata = {
      upload_time: new Date().toISOString(),
      metadata_available: false,
    };
  }

  return {
    url: urlData.publicUrl,
    metadata: {
      url: urlData.publicUrl,
      filename: fileName,
      contentType: file.type,
      size: file.size,
      ...metadata,
    },
  };
}

/**
 * Extract EXIF metadata from image
 */
async function extractImageMetadata(file: File): Promise<Partial<MediaMetadata>> {
  try {
    // Basic metadata - actual EXIF extraction would require a library like exif-js
    // For now, we'll use the file's lastModified as a proxy
    const fileDate = new Date(file.lastModified);
    const now = new Date();
    
    // Check if the file appears to have been taken recently (within last 7 days)
    const daysDiff = (now.getTime() - fileDate.getTime()) / (1000 * 60 * 60 * 24);
    const metadata_available = daysDiff <= 7;

    return {
      image_taken_at: fileDate.toISOString(),
      upload_time: now.toISOString(),
      metadata_available,
    };
  } catch (_e) {
    return {
      upload_time: new Date().toISOString(),
      metadata_available: false,
    };
  }
}

/**
 * Delete uploaded image
 */
export async function deleteReviewImage(url: string): Promise<void> {
  const path = url.split('/').slice(-2).join('/');
  const { error } = await supabase.storage
    .from('review-images')
    .remove([path]);

  if (error) throw error;
}

/**
 * Delete uploaded appeal media
 */
export async function deleteAppealMedia(url: string): Promise<void> {
  const path = url.split('/').slice(-2).join('/');
  const { error } = await supabase.storage
    .from('appeal-media')
    .remove([path]);

  if (error) throw error;
}
