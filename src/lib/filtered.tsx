// ============================================================
// UTROMAIL & TROMAIL - DATABASE SERVICE
// ============================================================

import { supabase } from '@/lib/supabase';
import type { UtromailThread, UtromailMessage, UtromailBlock, UtromailRequest, UtromailReport, UtromailNotification, UtromailAccount, TromailRoleAccount, MailFolder, MailSearchResult } from '@/types/mail';

// ============================================================
// ACCOUNTS
// ============================================================
export const getUtromailAccount = async (userId: string): Promise<UtromailAccount | null> => {
  const { data, error } = await supabase
    .from('utromail_accounts')
    .select('*, user_profiles(username, avatar_url)')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return { ...data, username: data.user_profiles?.username, avatar_url: data.user_profiles?.avatar_url };
};

export const getTromailAccounts = async (): Promise<TromailRoleAccount[]> => {
  const { data, error } = await supabase
    .from('tromail_role_accounts')
    .select('*, user_profiles(username, display_name, avatar_url)')
    .eq('is_active', true)
    .order('role_name');
  if (error) throw error;
  return (data || []).map((a: any) => ({
    ...a,
    username: a.user_profiles?.username,
    display_name: a.user_profiles?.display_name,
    avatar_url: a.user_profiles?.avatar_url,
  }));
};

export const createTromailAccount = async (userId: string, roleName: string): Promise<TromailRoleAccount> => {
  const mailAddress = roleName.toLowerCase().replace(/[^a-z0-9]/g, '') + '@tromail';
  const { data, error } = await supabase
    .from('tromail_role_accounts')
    .insert({ user_id: userId, mail_address: mailAddress, role_name: roleName })
    .select()
    .single();
  if (error) throw error;
  return data;
};

// ============================================================
// THREADS
// ============================================================
export const getThreads = async (userId: string, folder: MailFolder = 'inbox'): Promise<UtromailThread[]> => {
  // Get all thread IDs where the user is a member (in any folder)
  const { data: memberRows, error: memberError } = await supabase
    .from('utromail_thread_members')
    .select('thread_id, folder')
    .eq('user_id', userId);
  if (memberError) throw memberError;

  // Filter by folder
  const filtered = (memberRows || []).filter((r: any) => {
    if (folder === 'inbox') return r.folder === 'inbox' || r.folder === 'sent';
    if (folder === 'sent') return r.folder === 'sent';
    return r.folder === folder;
  });

  // Deduplicate thread_ids (user may have both sent+inbox entries)
  const seenThreadIds = new Set<string>();
  const threadIds: string[] = [];
  for (const r of filtered) {
    if (!seenThreadIds.has(r.thread_id)) {
      seenThreadIds.add(r.thread_id);
      threadIds.push(r.thread_id);
    }
  }

  if (threadIds.length === 0) return [];

  // Fetch threads with their members and last message
  const { data, error } = await supabase
    .from('utromail_threads')
    .select(`
      *,
      utromail_thread_members(user_id, folder),
      utromail_messages(id, body, sender_id, recipient_id, recipient_mail_address, sent_at, sender_mail_address)
    `)
    .in('id', threadIds)
    .order('last_message_at', { ascending: false })
    .limit(50);
  if (error) throw error;

  // For each thread, determine the "other" user (not the current user)
  // and collect their user_ids for batch profile fetch
  const otherUserIds = new Set<string>();
  const threadOtherMap: Record<string, string> = {}; // threadId -> otherUserId

  for (const t of data || []) {
    const members = t.utromail_thread_members || [];
    // Find first member who isn't the current user
    const other = members.find((m: any) => m.user_id !== userId);
    if (other) {
      otherUserIds.add(other.user_id);
      threadOtherMap[t.id] = other.user_id;
    }
  }

  // Batch-fetch profiles for all "other" users
  const profileMap: Record<string, { username?: string; display_name?: string; avatar_url?: string; utromail_address?: string }> = {};
  if (otherUserIds.size > 0) {
    const { data: profiles, error: profileError } = await supabase
      .from('user_profiles')
      .select('id, username, display_name, avatar_url, utromail_address')
      .in('id', Array.from(otherUserIds));
    if (!profileError && profiles) {
      for (const p of profiles) {
        profileMap[p.id] = p;
      }
    }
  }

  // Also collect sender user_ids from last messages for profile fetch
  const senderIds = new Set<string>();
  for (const t of data || []) {
    const msgs = t.utromail_messages || [];
    const sorted = Array.isArray(msgs) ? [...msgs].sort((a: any, b: any) => new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime()) : [];
    if (sorted.length > 0 && sorted[0].sender_id) {
      senderIds.add(sorted[0].sender_id);
    }
  }

  // Fetch sender profiles too
  if (senderIds.size > 0) {
    const { data: senderProfiles, error: senderError } = await supabase
      .from('user_profiles')
      .select('id, username, display_name, avatar_url')
      .in('id', Array.from(senderIds));
    if (!senderError && senderProfiles) {
      for (const p of senderProfiles) {
        if (!profileMap[p.id]) profileMap[p.id] = p;
      }
    }
  }

  // Build final result
  return (data || []).map((t: any) => {
    const otherUserId = threadOtherMap[t.id];
    const otherProfile = otherUserId ? profileMap[otherUserId] : null;

    // Build members with profiles
    const membersWithProfiles = (t.utromail_thread_members || []).map((m: any) => ({
      ...m,
      ...(profileMap[m.user_id] || {}),
    }));

    // Get last message with sender info
    const msgs = t.utromail_messages || [];
    const sorted = Array.isArray(msgs) ? [...msgs].sort((a: any, b: any) => new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime()) : [];
    const lastMsg = sorted[0] || null;
    const senderProfile = lastMsg ? profileMap[lastMsg.sender_id] || null : null;

    return {
      ...t,
      // Add flat "other user" fields for easy sidebar display
      other_user_id: otherUserId || null,
      other_username: otherProfile?.display_name || otherProfile?.username || lastMsg?.sender_mail_address || 'Unknown',
      other_avatar_url: otherProfile?.avatar_url || null,
      other_utromail_address: otherProfile?.utromail_address || null,
      other_display_name: otherProfile?.display_name || null,
      last_message: lastMsg ? {
        ...lastMsg,
        sender_name: senderProfile?.display_name || senderProfile?.username || null,
        sender_username: senderProfile?.username || null,
        sender_avatar: senderProfile?.avatar_url || null,
      } : null,
      members: membersWithProfiles,
    };
  });
};

export const getThread = async (threadId: string): Promise<UtromailThread | null> => {
  const { data, error } = await supabase
    .from('utromail_threads')
    .select(`
      *,
      utromail_thread_members(user_id, folder)
    `)
    .eq('id', threadId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  // Batch-fetch user profiles for all members
  const memberUserIds = (data.utromail_thread_members || []).map((m: any) => m.user_id);
  const uniqueIds = [...new Set(memberUserIds)];
  const profileMap: Record<string, { username?: string; display_name?: string; avatar_url?: string; utromail_address?: string }> = {};
  if (uniqueIds.length > 0) {
    const { data: profiles } = await supabase
      .from('user_profiles')
      .select('id, username, display_name, avatar_url, utromail_address')
      .in('id', uniqueIds);
    for (const p of profiles || []) {
      profileMap[p.id] = p;
    }
  }

  return {
    ...data,
    members: (data.utromail_thread_members || []).map((m: any) => ({
      ...m,
      ...(profileMap[m.user_id] || {}),
    })),
  };
};

// ============================================================
// MESSAGES
// ============================================================
export const getThreadMessages = async (threadId: string): Promise<UtromailMessage[]> => {
  const { data, error } = await supabase
    .from('utromail_messages')
    .select(`
      *,
      utromail_attachments(*),
      user_profiles!utromail_messages_sender_id_fkey(username, display_name, avatar_url)
    `)
    .eq('thread_id', threadId)
    .eq('is_draft', false)
    .order('sent_at', { ascending: true });
  if (error) throw error;
  return (data || []).map((m: any) => ({
    ...m,
    sender_name: m.user_profiles?.display_name || m.user_profiles?.username,
    sender_username: m.user_profiles?.username,
    sender_avatar: m.user_profiles?.avatar_url,
  }));
};

export const sendMessage = async (params: {
  senderId: string;
  senderMail: string;
  recipientId?: string;
  recipientMail?: string;
  subject?: string;
  body: string;
  messageType?: string;
  parentMessageId?: string;
  attachments?: { file_name: string; file_url: string; file_size?: number; mime_type?: string }[];
}): Promise<UtromailMessage> => {
  // Check permission
  if (params.recipientId) {
    const { data: canSend } = await supabase.rpc('can_send_utromail', {
      sender_id: params.senderId,
      recipient_id: params.recipientId,
    });
    if (canSend === false) {
      throw new Error('You cannot send mail to this user. They may have blocked you or restricted their privacy settings.');
    }
  }

  // Find or create thread
  let threadId: string;

  if (params.recipientId) {
    // Check for existing 1-on-1 thread
    const { data: existingThread } = await supabase.rpc('find_utromail_thread', {
      user_a: params.senderId,
      user_b: params.recipientId,
    });

    if (existingThread) {
      threadId = existingThread;
    } else {
      // Create new thread
      const { data: newThread, error: threadError } = await supabase
        .from('utromail_threads')
        .insert({ subject: params.subject, created_by: params.senderId })
        .select('id')
        .single();
      if (threadError) throw threadError;
      threadId = newThread.id;

      // Add members - sender gets BOTH 'sent' and 'inbox' so thread appears in their inbox view
      await supabase.from('utromail_thread_members').insert([
        { thread_id: threadId, user_id: params.senderId, folder: 'sent' },
        { thread_id: threadId, user_id: params.senderId, folder: 'inbox' },
        { thread_id: threadId, user_id: params.recipientId, folder: 'inbox' },
      ]);
    }

    // Ensure sender also has an 'inbox' membership for existing threads
    // (handles case where thread was created before this fix)
    const { data: existingMember } = await supabase
      .from('utromail_thread_members')
      .select('id')
      .eq('thread_id', threadId)
      .eq('user_id', params.senderId)
      .eq('folder', 'inbox')
      .maybeSingle();
    if (!existingMember) {
      await supabase.from('utromail_thread_members').insert({
        thread_id: threadId, user_id: params.senderId, folder: 'inbox',
      });
    }
  } else {
    // System/broadcast message
    const { data: newThread, error: threadError } = await supabase
      .from('utromail_threads')
      .insert({ subject: params.subject, created_by: params.senderId })
      .select('id')
      .single();
    if (threadError) throw threadError;
    threadId = newThread.id;

    await supabase.from('utromail_thread_members').insert({
      thread_id: threadId, user_id: params.senderId, folder: 'sent',
    });
  }

  // Insert message
  const { data: message, error: msgError } = await supabase
    .from('utromail_messages')
    .insert({
      thread_id: threadId,
      sender_id: params.senderId,
      sender_mail_address: params.senderMail,
      recipient_id: params.recipientId,
      recipient_mail_address: params.recipientMail,
      subject: params.subject,
      body: params.body,
      message_type: params.messageType || 'normal',
      parent_message_id: params.parentMessageId,
    })
    .select()
    .single();
  if (msgError) throw msgError;

  // Insert attachments
  if (params.attachments?.length) {
    await supabase.from('utromail_attachments').insert(
      params.attachments.map(a => ({ ...a, message_id: message.id }))
    );
  }

  // Create notification
  if (params.recipientId) {
    await supabase.from('utromail_notifications').insert({
      user_id: params.recipientId,
      message_id: message.id,
      notification_type: params.messageType === 'academy_notification' ? 'academy_mail' :
                         params.messageType === 'government' ? 'government_mail' : 'new_message',
    });
  }

  return message;
};

export const markAsRead = async (messageId: string, userId: string): Promise<void> => {
  await supabase.from('utromail_read_status').upsert(
    { message_id: messageId, user_id: userId, read_at: new Date().toISOString() },
    { onConflict: 'message_id,user_id' }
  );
};

export const markThreadAsRead = async (threadId: string, userId: string): Promise<void> => {
  const { data: messages } = await supabase
    .from('utromail_messages')
    .select('id')
    .eq('thread_id', threadId)
    .neq('sender_id', userId);

  if (messages?.length) {
    await supabase.from('utromail_read_status').upsert(
      messages.map(m => ({ message_id: m.id, user_id: userId, read_at: new Date().toISOString() })),
      { onConflict: 'message_id,user_id' }
    );
  }
};

// ============================================================
// REQUESTS
// ============================================================
export const getMessageRequests = async (userId: string): Promise<UtromailRequest[]> => {
  const { data, error } = await supabase
    .from('utromail_requests')
    .select('*, user_profiles!utromail_requests_sender_id_fkey(username, display_name, avatar_url, utromail_address)')
    .eq('recipient_id', userId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map((r: any) => ({
    ...r,
    sender_name: r.user_profiles?.display_name || r.user_profiles?.username,
    sender_username: r.user_profiles?.username,
    sender_avatar: r.user_profiles?.avatar_url,
    sender_mail: r.user_profiles?.utromail_address,
  }));
};

export const respondToRequest = async (requestId: string, status: 'accepted' | 'ignored' | 'blocked'): Promise<void> => {
  await supabase.from('utromail_requests').update({ status, updated_at: new Date().toISOString() }).eq('id', requestId);
  if (status === 'blocked') {
    const { data: req } = await supabase.from('utromail_requests').select('sender_id, recipient_id').eq('id', requestId).single();
    if (req) {
      await supabase.from('utromail_blocks').insert({ blocker_id: req.recipient_id, blocked_id: req.sender_id });
    }
  }
};

// ============================================================
// BLOCKS
// ============================================================
export const getBlockedUsers = async (userId: string): Promise<UtromailBlock[]> => {
  const { data, error } = await supabase
    .from('utromail_blocks')
    .select('*, user_profiles!utromail_blocks_blocked_id_fkey(username, display_name, avatar_url)')
    .eq('blocker_id', userId);
  if (error) throw error;
  return (data || []).map((b: any) => ({
    ...b,
    blocked_username: b.user_profiles?.username,
    blocked_display_name: b.user_profiles?.display_name,
    blocked_avatar: b.user_profiles?.avatar_url,
  }));
};

export const blockUser = async (blockerId: string, blockedId: string): Promise<void> => {
  await supabase.from('utromail_blocks').insert({ blocker_id: blockerId, blocked_id: blockedId });
};

export const unblockUser = async (blockerId: string, blockedId: string): Promise<void> => {
  await supabase.from('utromail_blocks').delete().eq('blocker_id', blockerId).eq('blocked_id', blockedId);
};

// ============================================================
// SEARCH
// ============================================================
export const searchUsers = async (query: string): Promise<MailSearchResult['users']> => {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('id, username, display_name, avatar_url, utromail_address, role, is_admin')
    .ilike('username', `%${query}%`)
    .limit(20);
  if (error) throw error;
  return (data || []).map((u: any) => ({
    ...u,
    is_staff: u.is_admin || ['admin','ceo','superadmin','troll_officer','lead_troll_officer','secretary',
      'academy_teacher','academy_director','admissions_officer','moderator','attorney','prosecutor'].includes(u.role),
  }));
};

// ============================================================
// REPORTS
// ============================================================
export const submitReport = async (params: {
  reporterId: string;
  reportedId: string;
  messageId?: string;
  threadId?: string;
  reason: string;
  screenshotUrl?: string;
}): Promise<void> => {
  const { error } = await supabase.from('utromail_reports').insert({
    reporter_id: params.reporterId,
    reported_id: params.reportedId,
    message_id: params.messageId,
    thread_id: params.threadId,
    report_reason: params.reason,
    screenshot_url: params.screenshotUrl,
  });
  if (error) throw error;
};

export const getReports = async (status?: string): Promise<UtromailReport[]> => {
  let query = supabase
    .from('utromail_reports')
    .select(`
      *,
      reporter:user_profiles!utromail_reports_reporter_id_fkey(username, display_name),
      reported:user_profiles!utromail_reports_reported_id_fkey(username, display_name),
      reviewer:user_profiles!utromail_reports_reviewed_by_fkey(username, display_name)
    `)
    .order('created_at', { ascending: false });
  if (status) query = query.eq('status', status);
  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map((r: any) => ({
    ...r,
    reporter_name: r.reporter?.display_name || r.reporter?.username,
    reported_name: r.reported?.display_name || r.reported?.username,
    reviewed_by_name: r.reviewer?.display_name || r.reviewer?.username,
  }));
};

// ============================================================
// NOTIFICATIONS
// ============================================================
export const getUnreadNotifications = async (userId: string): Promise<UtromailNotification[]> => {
  const { data, error } = await supabase
    .from('utromail_notifications')
    .select('*')
    .eq('user_id', userId)
    .eq('is_read', false)
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw error;
  return data || [];
};

export const markNotificationRead = async (notifId: string): Promise<void> => {
  await supabase.from('utromail_notifications').update({ is_read: true }).eq('id', notifId);
};

// ============================================================
// UTILITY
// ============================================================
export const getUnreadCount = async (userId: string): Promise<number> => {
  const { count, error } = await supabase
    .from('utromail_notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('is_read', false);
  if (error) throw error;
  return count || 0;
};

export const moveThreadToFolder = async (threadId: string, userId: string, folder: MailFolder): Promise<void> => {
  await supabase.from('utromail_thread_members')
    .update({ folder })
    .eq('thread_id', threadId)
    .eq('user_id', userId);
};

export const deleteThread = async (threadId: string, userId: string): Promise<void> => {
  await moveThreadToFolder(threadId, userId, 'trash');
};

export const starMessage = async (messageId: string, starred: boolean): Promise<void> => {
  await supabase.from('utromail_messages').update({ is_starred: starred }).eq('id', messageId);
};
