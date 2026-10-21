/**
 * Mai Voice â€” shared server-side authorization + moderation checks.
 *
 * These checks are intentionally server-side only. The client never asserts
 * eligibility; the 'mai-voice' edge function re-verifies every rule that
 * 'send-message' applies to text chat so that a recorded voice message or a
 * generated TTS clip can never be used to bypass moderation.
 */

/**
 * Minimal structural view of the Supabase client used by these helpers.
 * Declared locally so this module never depends on a specific client build.
 */
export interface MaiVoiceSupabase {
  from: (table: string) => any;
  rpc: (fn: string, args?: Record<string, unknown>) => any;
}

export interface ModerationFailure {
  allowed: false;
  code: string;
  reason: string;
  status: number;
}

export interface ModerationSuccess {
  allowed: true;
  /** Stream ids the sender must satisfy mute/ban/chat-block rules for. */
  streamIds: string[];
  profile: Record<string, unknown>;
}

export type ModerationResult = ModerationSuccess | ModerationFailure;

function fail(code: string, reason: string, status = 403): ModerationFailure {
  return { allowed: false, code, reason, status };
}

/**
 * Verifies that the sender may participate in the given room.
 *
 * Mirrors the canonical checks used by the `send-message` edge function:
 *   * jail status
 *   * chat restrictions (jail / chat block / mute)
 *   * per-stream mutes and bans
 *   * `chat_blocks` rows
 *   * active `broadcast_mod_actions` disable_chat rows
 *
 * Fails closed: if a check errors, the request is rejected.
 */
export async function checkVoiceEligibility(
  supabase: MaiVoiceSupabase,
  userId: string,
  roomKind: 'stream' | 'battle',
  roomId: string,
): Promise<ModerationResult> {
  // 1. Resolve the stream ids that make up this room.
  const streamIds = await resolveRoomStreamIds(supabase, roomKind, roomId);
  if (!streamIds.length) {
    return fail('ROOM_NOT_FOUND', 'This broadcast is no longer available.', 404);
  }

  // 2. Jail status.
  const { data: jailData, error: jailError } = await supabase.rpc('is_user_jailed', {
    p_user_id: userId,
  });
  if (jailError) {
    console.error('[mai-voice] jail check failed:', jailError.message);
    return fail('RESTRICTION_CHECK_FAILED', 'Could not verify chat eligibility.', 503);
  }
  if (Array.isArray(jailData) && jailData.length > 0 && jailData[0]?.is_jailed) {
    return fail('USER_JAILED', 'You are currently in jail.');
  }

  // 3. Chat restriction RPC (jail, chat block, mute).
  const { data: restrictionData, error: restrictionError } = await supabase.rpc(
    'check_user_chat_restriction',
    { p_user_id: userId, p_stream_id: streamIds[0] },
  );
  if (restrictionError || !restrictionData) {
    console.error('[mai-voice] chat restriction check failed:', restrictionError?.message);
    return fail('RESTRICTION_CHECK_FAILED', 'Could not verify chat eligibility.', 503);
  }
  if (restrictionData.restricted) {
    const reasons: string[] = restrictionData.reasons || [];
    const reason = reasons.includes('jailed')
      ? 'You are currently in jail.'
      : reasons.includes('chat_blocked')
        ? 'Your chat has been disabled by moderation.'
        : reasons.includes('muted')
          ? 'You are muted in this stream.'
          : 'Your chat access is restricted.';
    return fail('USER_JAILED', reason);
  }

  // 4. Per-stream mutes and bans (a battle checks both sides).
  for (const streamId of streamIds) {
    const [{ data: mute, error: muteError }, { data: ban, error: banError }] = await Promise.all([
      supabase.from('stream_mutes').select('id').eq('stream_id', streamId).eq('user_id', userId).maybeSingle(),
      supabase.from('stream_bans').select('id, expires_at').eq('stream_id', streamId).eq('user_id', userId).maybeSingle(),
    ]);
    if (muteError || banError) {
      console.error('[mai-voice] mute/ban lookup failed:', muteError?.message || banError?.message);
      return fail('RESTRICTION_CHECK_FAILED', 'Could not verify chat eligibility.', 503);
    }
    if (mute) {
      return fail('MUTED', 'You are muted in this stream.');
    }
    if (ban && (!ban.expires_at || new Date(ban.expires_at) > new Date())) {
      return fail('BANNED', 'You are banned from this stream.');
    }
  }

  // 5. chat_blocks rows.
  for (const streamId of streamIds) {
    const { data: chatBlock, error: chatBlockError } = await supabase
      .from('chat_blocks')
      .select('id, expires_at')
      .eq('stream_id', streamId)
      .eq('user_id', userId)
      .maybeSingle();
    if (chatBlockError) {
      console.error('[mai-voice] chat block lookup failed:', chatBlockError.message);
      return fail('RESTRICTION_CHECK_FAILED', 'Could not verify chat eligibility.', 503);
    }
    if (chatBlock && (!chatBlock.expires_at || new Date(chatBlock.expires_at) > new Date())) {
      return fail('CHAT_DISABLED', 'Your chat has been disabled by moderation.');
    }
  }

  // 6. Active moderator "disable_chat" actions.
  const { data: activeChatDisable, error: modActionError } = await supabase
    .from('broadcast_mod_actions')
    .select('id, expires_at')
    .eq('target_user_id', userId)
    .eq('action_type', 'disable_chat')
    .eq('status', 'active')
    .maybeSingle();
  if (modActionError) {
    console.error('[mai-voice] moderation action lookup failed:', modActionError.message);
    return fail('RESTRICTION_CHECK_FAILED', 'Could not verify chat eligibility.', 503);
  }
  if (activeChatDisable && (!activeChatDisable.expires_at || new Date(activeChatDisable.expires_at) > new Date())) {
    return fail('CHAT_DISABLED', 'Your chat has been disabled by moderation.');
  }

  // 7. Profile (for the display name shown with the clip).
  const { data: profile, error: profileError } = await supabase
    .from('user_profiles')
    .select('id, username, display_name, avatar_url, role, troll_role')
    .eq('id', userId)
    .maybeSingle();
  if (profileError) {
    console.error('[mai-voice] profile lookup failed:', profileError.message);
    return fail('PROFILE_LOOKUP_FAILED', 'Could not verify user authorization.', 503);
  }
  if (!profile) {
    return fail('PROFILE_LOOKUP_FAILED', 'Could not verify user authorization.', 403);
  }

  return { allowed: true, streamIds, profile: profile as Record<string, unknown> };
}

/**
 * Returns the stream ids that make up a room.
 * - stream room: the stream itself.
 * - battle room: both sides, so a mute on either side is honoured.
 */
export async function resolveRoomStreamIds(
  supabase: MaiVoiceSupabase,
  roomKind: 'stream' | 'battle',
  roomId: string,
): Promise<string[]> {
  if (roomKind === 'stream') {
    const { data } = await supabase
      .from('streams')
      .select('id, is_live, status, livekit_room_name, subscriber_only_chat')
      .eq('id', roomId)
      .maybeSingle();
    if (!data) return [];
    // A broadcast must still be live to accept voice content.
    if (data.is_live !== true || data.status !== 'live') return [];
    return [data.id as string];
  }

  const { data: battle } = await supabase
    .from('battles')
    .select('id, challenger_stream_id, opponent_stream_id, status')
    .eq('id', roomId)
    .maybeSingle();
  if (!battle) return [];
  if (battle.status === 'ended' || battle.status === 'cancelled') return [];

  const ids = [battle.challenger_stream_id, battle.opponent_stream_id].filter(Boolean) as string[];
  if (!ids.length) return [];

  const { data: streams } = await supabase
    .from('streams')
    .select('id, is_live, status, livekit_room_name')
    .in('id', ids);
  const live = (streams || []).filter(
    (s: any) => s.is_live === true && s.status === 'live',
  );
  return live.map((s: any) => s.id as string);
}

/** LiveKit room name for a Mai Voice room. */
export async function resolveLiveKitRoomName(
  supabase: MaiVoiceSupabase,
  roomKind: 'stream' | 'battle',
  roomId: string,
): Promise<string | null> {
  if (roomKind === 'battle') {
    return `battle-${roomId}`;
  }
  const { data } = await supabase
    .from('streams')
    .select('livekit_room_name, id')
    .eq('id', roomId)
    .maybeSingle();
  if (!data) return null;
  return (data.livekit_room_name as string) || (data.id as string);
}

/**
 * True when the user may moderate this room (broadcaster, officer, admin).
 * Uses the SQL helper so the rule matches the database definition exactly.
 */
export async function canModerateRoom(
  supabase: MaiVoiceSupabase,
  roomKind: 'stream' | 'battle',
  roomId: string,
  userId: string,
): Promise<boolean> {
  const { data, error } = await supabase.rpc('mai_voice_can_moderate_room', {
    p_room_kind: roomKind,
    p_room_id: roomId,
    p_user_id: userId,
  });
  if (error) {
    console.error('[mai-voice] moderation permission check failed:', error.message);
    return false;
  }
  return data === true;
}

/**
 * Normalizes chat text before it is sent to a speech provider.
 * Removes URLs, collapses repeated symbols, caps length and strips control
 * characters so a hostile message cannot produce an unbounded or abusive clip.
 */
export function normalizeSpeechText(raw: string, maxLength: number): string {
  let text = (raw || '').normalize('NFKC');

  // Strip control characters (keep newlines/tabs, they become pauses).
  text = text.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, ' ');

  // Replace URLs with a spoken-friendly token.
  text = text.replace(/\bhttps?:\/\/\S+/gi, ' link ');
  text = text.replace(/\bwww\.\S+/gi, ' link ');

  // Collapse repeated punctuation/symbols (spam guard).
  text = text.replace(/([!?$#@%^&*+=~`|<>])\1{2,}/g, '$1$1');
  text = text.replace(/[^\w\s'â€™.,!?-]/g, ' ');

  // Collapse whitespace.
  text = text.replace(/\s+/g, ' ').trim();

  if (text.length > maxLength) {
    text = `${text.slice(0, Math.max(0, maxLength - 1)).trimEnd()}â€¦`;
  }
  return text;
}


/**
 * Check if user is restricted from using Mai Voice
 */
export async function checkMaiVoiceRestriction(
  supabase: MaiVoiceSupabase,
  userId: string,
  roomKind: 'stream' | 'battle',
  roomId: string,
): Promise<ModerationFailure | null> {
  try {
    const { data: restricted, error } = await supabase.rpc('is_mai_voice_restricted', {
      p_user_id: userId,
      p_room_kind: roomKind,
      p_room_id: roomId,
    });
    if (error) {
      console.error('[mai-voice] restriction check failed:', error.message);
      return fail('RESTRICTION_CHECK_FAILED', 'Could not verify voice eligibility.', 503);
    }
    if (restricted === true) {
      return fail('VOICE_RESTRICTED', 'You have been restricted from using Mai Voice.', 403);
    }
  } catch (err) {
    console.error('[mai-voice] restriction check error:', err);
    return fail('RESTRICTION_CHECK_FAILED', 'Could not verify voice eligibility.', 503);
  }
  return null;
}
