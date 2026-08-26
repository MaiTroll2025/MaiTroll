// src/lib/highlightedChat.ts
// Frontend utilities for MaiTroll Highlighted Chat perk

import { supabase } from './supabase';
import { isPerkActive, PERK_CONFIG } from './perkSystem';

export const HIGHLIGHTED_CHAT_PERK_ID = 'perk_highlighted_chat';
export const HIGHLIGHTED_CHAT_COST = 50;
export const HIGHLIGHTED_CHAT_DURATION_MINUTES = 1440; // 24 hours

export const HIGHLIGHTED_CHAT_CONFIG = {
  ...PERK_CONFIG,
  [HIGHLIGHTED_CHAT_PERK_ID]: {
    name: 'Highlighted Chat (24h)',
    duration_minutes: HIGHLIGHTED_CHAT_DURATION_MINUTES,
    cost: HIGHLIGHTED_CHAT_COST,
    description: 'Send highlighted flying chats for 24 hours',
    type: 'chat',
  },
};

export interface HighlightedChatPerk {
  user_id: string;
  perk_id: string;
  is_active: boolean;
  expires_at: string;
  metadata: {
    highlight_color?: string;
  } | null;
}

export async function isHighlightedChatActive(userId: string): Promise<boolean> {
  return isPerkActive(userId, HIGHLIGHTED_CHAT_PERK_ID);
}

export async function getHighlightedChatColor(userId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('user_perks')
    .select('metadata')
    .eq('user_id', userId)
    .eq('perk_id', HIGHLIGHTED_CHAT_PERK_ID)
    .eq('is_active', true)
    .gt('expires_at', new Date().toISOString())
    .order('expires_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return data.metadata?.highlight_color || null;
}

export async function purchaseHighlightedChat(
  userId: string,
  highlightColor: string
): Promise<{ success: boolean; error?: string }> {
  const { data, error } = await supabase.rpc('purchase_highlighted_chat', {
    p_user_id: userId,
    p_highlight_color: highlightColor,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  return data as { success: boolean; error?: string };
}

export async function sendHighlightedChat(
  streamId: string,
  content: string,
  highlightColor: string
): Promise<{ success: boolean; data?: any; error?: string }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, error: 'Not authenticated' };
  }

  const active = await isHighlightedChatActive(user.id);
  if (!active) {
    return { success: false, error: 'Highlighted Chat perk is not active' };
  }

  const { data, error } = await supabase
    .from('stream_messages')
    .insert({
      stream_id: streamId,
      user_id: user.id,
      content,
      type: 'chat',
      username: user.user_metadata?.username || 'Viewer',
      is_highlighted: true,
      highlight_color: highlightColor,
    })
    .select()
    .single();

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, data };
}
