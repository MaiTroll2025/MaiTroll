import { supabase } from './supabase';

export const getLiveKitRoomName = (
  stream?: { livekit_room_name?: string | null; id?: string | null },
  streamId?: string,
) => {
  return stream?.livekit_room_name || stream?.id || streamId;
};

/**
 * Determines the RTC provider for a stream.
 * Returns 'getstream' for staff/official broadcasts, 'livekit' for normal users.
 * The rtc_provider field on the stream is the source of truth (server-authoritative).
 */
export function getRTCProvider(stream?: { rtc_provider?: string | null } | null): 'livekit' | 'getstream' {
  if (!stream?.rtc_provider) return 'livekit';
  return stream.rtc_provider === 'getstream' ? 'getstream' : 'livekit';
}

/**
 * Checks if a stream should use GetStream RTC based on broadcaster's staff status.
 * This is a fallback when rtc_provider is not set on the stream.
 */
export function isStaffStream(stream?: { broadcaster?: { is_staff?: boolean; role?: string; troll_role?: string; is_admin?: boolean; is_superadmin?: boolean; is_troll_officer?: boolean; is_lead_officer?: boolean; is_secretary?: boolean; is_prosecutor?: boolean; is_attorney?: boolean } } | null): boolean {
  if (!stream?.broadcaster) return false;
  const profile = stream.broadcaster;
  const role = String(profile.role || '').toLowerCase();
  const trollRole = String(profile.troll_role || '').toLowerCase();

  return Boolean(
    profile.is_staff ||
      profile.is_admin ||
      (profile as any)?.is_superadmin === true ||
      profile.is_troll_officer ||
      profile.is_lead_officer ||
      profile.is_secretary ||
      profile.is_prosecutor ||
      profile.is_attorney ||
      STAFF_ROLES.has(role) ||
      STAFF_ROLES.has(trollRole)
  );
}

const STAFF_ROLES = new Set([
  'admin',
  'superadmin',
  'owner',
  'ceo',
  'staff',
  'lead_troll_officer',
  'troll_officer',
  'secretary',
  'prosecutor',
  'attorney',
  'agency_hr_manager',
  'agency_hr',
  'hr_admin',
  'marketing_agent',
  'empire_partner',
]);

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