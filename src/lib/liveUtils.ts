import { supabase } from './supabase';

export const getLiveKitRoomName = (
  stream?: { livekit_room_name?: string | null; id?: string | null },
  streamId?: string,
) => {
  return stream?.livekit_room_name || stream?.id || streamId;
};

/**
 * Determines the RTC provider for a stream.
 * All streams use LiveKit.
 */
export function getRTCProvider(_stream?: { rtc_provider?: string | null } | null): 'livekit' {
  return 'livekit';
}

/**
 * Check if a user is currently live by their user ID
 * @param userId - The user's ID to check
 * @returns Promise<boolean> - True if the user is live, false otherwise
 */
export const isUserLive = async (userId: string): Promise<boolean> => {
  try {
    const { data, error } = await supabase
      .from('streams')
      .select('id, is_live, status')
      .eq('broadcaster_id', userId)
      .eq('is_live', true)
      .single();

    if (error) {
      // If no stream found or error, user is not live
      return false;
    }

    return data?.is_live === true && data?.status === 'live';
  } catch (error) {
    console.error('Error checking if user is live:', error);
    return false;
  }
};

/**
 * Get the live stream ID for a user if they are currently live
 * @param userId - The user's ID to check
 * @returns Promise<string | null> - The stream ID if live, null otherwise
 */
export const getUserLiveStreamId = async (userId: string): Promise<string | null> => {
  try {
    const { data, error } = await supabase
      .from('streams')
      .select('id')
      .eq('broadcaster_id', userId)
      .eq('is_live', true)
      .single();

    if (error) {
      return null;
    }

    return data?.id || null;
  } catch (error) {
    console.error('Error getting user live stream ID:', error);
    return null;
  }
};

/**
 * Check multiple users at once to see which ones are live
 * @param userIds - Array of user IDs to check
 * @returns Promise<Map<string, boolean>> - Map of userId to live status
 */
export const areUsersLive = async (userIds: string[]): Promise<Map<string, boolean>> => {
  const result = new Map<string, boolean>();
  
  try {
    const { data, error } = await supabase
      .from('streams')
      .select('broadcaster_id')
      .in('broadcaster_id', userIds)
      .eq('is_live', true);

    if (error) {
      console.error('Error checking multiple users live status:', error);
      return result;
    }

    // Initialize all users as not live
    userIds.forEach(userId => {
      result.set(userId, false);
    });

    // Mark live users as true
    data?.forEach(stream => {
      if (stream.broadcaster_id) {
        result.set(stream.broadcaster_id, true);
      }
    });

  } catch (error) {
    console.error('Error checking multiple users live status:', error);
  }

  return result;
};