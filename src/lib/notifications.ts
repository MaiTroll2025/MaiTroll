// Helper functions for creating notifications via MagicBell
import { supabase } from './supabase'
import { NotificationType, NotificationMetadata } from '../types/notifications'
import { sendNotification } from './sendNotification'

/**
 * Create a notification for a user
 */
export async function createNotification(
  userId: string,
  type: NotificationType,
  title: string,
  message: string,
  metadata?: NotificationMetadata
): Promise<{ success: boolean; error?: string }> {
  try {
    await sendNotification(userId, type, title, message, metadata || {})
    return { success: true }
  } catch (err: any) {
    console.error('Error creating notification:', err)
    return { success: false, error: err?.message || 'Unknown error' }
  }
}

export async function notifyAdmins(
  title: string,
  message: string,
  type: NotificationType,
  metadata: NotificationMetadata = {},
  targetRoles?: string[]
): Promise<{ success: boolean; error?: string }[]> {
  try {
    const { data: admins, error } = await supabase
      .from('user_profiles')
      .select('id, role, is_admin, is_troll_officer, is_lead_officer')
      .or('is_admin.eq.true,is_troll_officer.eq.true,is_lead_officer.eq.true,role.eq.admin,role.eq.superadmin,role.eq.owner')

    if (error) {
      console.error('[notifyAdmins] Failed to fetch admin users:', error)
      return [{ success: false, error: error.message }]
    }

    if (!admins || admins.length === 0) {
      console.warn('[notifyAdmins] No admin users found')
      return [{ success: false, error: 'No admin users found' }]
    }

    const adminIds = admins.map(a => a.id).filter(Boolean)

    if (adminIds.length === 0) {
      return [{ success: false, error: 'No valid admin IDs' }]
    }

    // Use the centralized edge function for admin notifications
    // This ensures online admins only get in-app notifications,
    // while offline admins get both in-app and push notifications
    const edgeResult = await supabase.functions.invoke('notify-admin-event', {
      body: {
        type,
        title,
        message,
        metadata: {
          ...metadata,
          audience: 'admin'
        },
        targetRoles: targetRoles || [
          'admin', 'superadmin', 'owner', 'ceo', 'lead_troll_officer',
          'troll_officer', 'moderator', 'staff', 'secretary',
          'executive_secretary', 'troll_city_secretary'
        ]
      }
    })

    if (edgeResult.error) {
      console.warn('[notifyAdmins] Edge function failed, falling back to direct notifications:', edgeResult.error)
      
      const results = await Promise.all(
        admins.map(async (admin: any) => {
          if (!admin?.id) {
            return { success: false, error: 'Invalid admin id' }
          }
          try {
            await sendNotification(admin.id, type, title, message, { ...metadata, audience: 'admin' })
            return { success: true }
          } catch (sendErr: any) {
            console.warn('[notifyAdmins] Failed to notify admin:', admin.id, sendErr)
            return { success: false, error: sendErr?.message || 'Notification send failed' }
          }
        })
      )
      return results
    }

    return adminIds.map(() => ({ success: true }))
  } catch (err: any) {
    console.error('[notifyAdmins] Unexpected error:', err)
    return [{ success: false, error: err?.message || 'Unknown error' }]
  }
}

// ==========================================
// ACCOUNT / SECURITY NOTIFICATIONS
// ==========================================

export async function notifyNewLogin(userId: string, ip?: string, location?: string) {
  return createNotification(
    userId,
    'new_login_detected',
    '🔐 New Login Detected',
    `New login to your account${location ? ` from ${location}` : ''}${ip ? ` (IP: ${ip})` : ''}. If this wasn't you, secure your account.`,
    { ip, location, action_url: '/profile/security' }
  )
}

export async function notifyPasswordChanged(userId: string) {
  return createNotification(
    userId,
    'password_changed',
    '✅ Password Changed',
    'Your password has been successfully updated.',
    { action_url: '/profile/security' }
  )
}

export async function notifyEmailChanged(userId: string, newEmail: string) {
  return createNotification(
    userId,
    'email_changed',
    '✅ Email Updated',
    `Your email has been changed to ${newEmail}.`,
    { new_email: newEmail, action_url: '/profile' }
  )
}

/**
 * Notify a seller about tier upgrade
 */
export async function notifySellerTierUpgraded(
  sellerId: string,
  newTier: string,
  oldTier: string
): Promise<{ success: boolean; error?: string }> {
  return createNotification(
    sellerId,
    'seller_tier_upgrade',
    'Seller Tier Upgraded!',
    `Congratulations! Your seller tier has been upgraded from ${oldTier} to ${newTier}.`,
    { newTier, oldTier }
  )
}

/**
 * Notify a seller about tier downgrade
 */
export async function notifySellerTierDowngraded(
  sellerId: string,
  newTier: string,
  oldTier: string
): Promise<{ success: boolean; error?: string }> {
  return createNotification(
    sellerId,
    'seller_tier_downgrade',
    'Seller Tier Changed',
    `Your seller tier has been adjusted from ${oldTier} to ${newTier}.`,
    { newTier, oldTier }
  )
}

export async function notifyProfileUpdated(userId: string) {
  return createNotification(
    userId,
    'profile_updated',
    '✅ Profile Updated',
    'Your profile has been successfully updated.',
    { action_url: '/profile' }
  )
}

export async function notifyFollowersOfProfilePictureUpdate(
  userId: string,
  username: string,
  avatarUrl: string
) {
  try {
    const { data: followers, error } = await supabase
      .from('user_follows')
      .select('follower_id')
      .eq('following_id', userId)

    if (error || !followers || followers.length === 0) {
      return { success: true, notified: 0 }
    }

    const results = await Promise.allSettled(
      followers.map((f: any) =>
        createNotification(
          f.follower_id,
          'profile_picture_updated',
          `📸 @${username} updated their profile picture`,
          `@${username} just updated their profile picture. Check it out!`,
          {
            actor_id: userId,
            actor_username: username,
            actor_avatar_url: avatarUrl,
            action_url: `/profile/${username}`,
          }
        )
      )
    )

    const notified = results.filter((r) => r.status === 'fulfilled').length
    return { success: true, notified }
  } catch (err: any) {
    console.error('Error notifying followers of profile picture update:', err)
    return { success: false, error: err?.message || 'Unknown error' }
  }
}

export async function notifyFollowersOfCoverPhotoUpdate(
  userId: string,
  username: string,
  coverUrl: string
) {
  try {
    const { data: followers, error } = await supabase
      .from('user_follows')
      .select('follower_id')
      .eq('following_id', userId)

    if (error || !followers || followers.length === 0) {
      return { success: true, notified: 0 }
    }

    const results = await Promise.allSettled(
      followers.map((f: any) =>
        createNotification(
          f.follower_id,
          'cover_photo_updated',
          `🖼️ @${username} updated their cover photo`,
          `@${username} just updated their cover photo. Check it out!`,
          {
            actor_id: userId,
            actor_username: username,
            actor_avatar_url: coverUrl,
            action_url: `/profile/${username}`,
          }
        )
      )
    )

    const notified = results.filter((r) => r.status === 'fulfilled').length
    return { success: true, notified }
  } catch (err: any) {
    console.error('Error notifying followers of cover photo update:', err)
    return { success: false, error: err?.message || 'Unknown error' }
  }
}

export async function notifyAccountWarning(userId: string, reason: string) {
  return createNotification(
    userId,
    'account_warning',
    '⚠️ Account Warning',
    `Warning issued: ${reason}`,
    { reason, action_url: '/profile' }
  )
}

export async function notifyAccountRestrictionStarted(userId: string, reason: string, duration?: string) {
  return createNotification(
    userId,
    'account_restriction_started',
    '⛔ Account Restriction Started',
    `Your account has been restricted. Reason: ${reason}${duration ? ` for ${duration}` : ''}.`,
    { reason, duration, action_url: '/profile' }
  )
}

export async function notifyAccountRestrictionExpired(userId: string) {
  return createNotification(
    userId,
    'account_restriction_expired',
    '✅ Restriction Lifted',
    'Your account restriction has expired and full access is restored.',
    { action_url: '/profile' }
  )
}

export async function notifyJailSentenceStarted(userId: string, duration: string, cellId?: string, judgeUsername?: string) {
  const messagePrefix = judgeUsername ? `📋 Judge @${judgeUsername} has sentenced you to jail` : 'You have been jailed'
  return createNotification(
    userId,
    'jail_sentence_started',
    '⛓️ Jail Sentence Started',
    `${messagePrefix} for ${duration}.`,
    { duration, cell_id: cellId, judge_username: judgeUsername, action_url: '/jail' }
  )
}

export async function notifyJailReleaseReminder(userId: string, releaseTime: string) {
  return createNotification(
    userId,
    'jail_release_reminder',
    '🔔 Jail Release Reminder',
    `You'll be released at ${releaseTime}.`,
    { release_time: releaseTime, action_url: '/jail' }
  )
}

export async function notifyJailReleaseCompleted(userId: string) {
  return createNotification(
    userId,
    'jail_release_completed',
    '✅ Released from Jail',
    'You have been released from jail. Welcome back!',
    { action_url: '/profile' }
  )
}

export async function notifyInmateMessageReceived(
  inmateUserId: string,
  senderUsername: string,
  messagePreview: string
) {
  return createNotification(
    inmateUserId,
    'inmate_message_received',
    `📩 New message from @${senderUsername}`,
    messagePreview,
    { sender_username: senderUsername, action_url: '/jail' }
  )
}

// ==========================================
// BROADCAST / LIVE NOTIFICATIONS
// ==========================================

export function fillNotificationTemplate(
  template: string,
  metadata: NotificationMetadata = {}
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
    const value = metadata[key]
    return value === undefined || value === null || value === '' ? 'Someone' : String(value)
  })
}

export function buildNotificationContent(
  type: NotificationType,
  metadata: NotificationMetadata = {}
): { title: string; message: string } {
  if (type === 'someone_you_follow_went_live') {
    return {
      title: `${metadata.broadcaster_username ?? 'Someone'} went live`,
      message: `Tap to join ${metadata.broadcaster_username ?? 'their'} broadcast.`,
    }
  }

  return {
    title: metadata.title ?? 'MaiTroll Notification',
    message: metadata.message ?? '',
  }
}

export async function notifySomeoneYouFollowWentLive(
  followerId: string,
  broadcasterUsername: string,
  streamId: string,
  broadcasterId?: string,
  broadcasterAvatarUrl?: string,
  streamTitle?: string
) {
  const content = buildNotificationContent('someone_you_follow_went_live', {
    broadcaster_id: broadcasterId,
    broadcaster_username: broadcasterUsername,
    broadcaster_avatar_url: broadcasterAvatarUrl,
    stream_id: streamId,
    stream_title: streamTitle,
    action_url: `/live/${encodeURIComponent(broadcasterUsername)}`,
  })

  return createNotification(
    followerId,
    'someone_you_follow_went_live',
    content.title,
    content.message,
    {
      broadcaster_id: broadcasterId,
      broadcaster_username: broadcasterUsername,
      broadcaster_avatar_url: broadcasterAvatarUrl,
      stream_id: streamId,
      stream_title: streamTitle,
      action_url: `/live/${encodeURIComponent(broadcasterUsername)}`,
    }
  )
}

export async function notifyYourStreamStarted(userId: string, streamId: string, title?: string) {
  return createNotification(
    userId,
    'your_stream_started',
    '🔴 Stream Started!',
    `Your stream "${title || 'Untitled'}" is now live.`,
    { stream_id: streamId, action_url: `/watch/${streamId}` }
  )
}

export async function notifyYourStreamEnded(userId: string, streamId: string, duration?: string) {
  return createNotification(
    userId,
    'your_stream_ended',
    '⏹️ Stream Ended',
    `Your stream has ended${duration ? ` after ${duration}` : ''}.`,
    { stream_id: streamId, duration, action_url: '/profile' }
  )
}

export async function notifyStreamDisconnected(userId: string, streamId: string) {
  return createNotification(
    userId,
    'stream_disconnected',
    '⚠️ Stream Disconnected',
    'Your stream connection was lost. Please reconnect.',
    { stream_id: streamId, action_url: `/watch/${streamId}` }
  )
}

export async function notifyInvitedToCohost(userId: string, hostUsername: string, streamId: string) {
  return createNotification(
    userId,
    'invited_to_cohost',
    '🎤 Co-host Invite',
    `@${hostUsername} invited you to co-host their stream.`,
    { host_username: hostUsername, stream_id: streamId, action_url: `/live/${encodeURIComponent(hostUsername)}` }
  )
}

export async function notifyCohostInviteAccepted(userId: string, guestUsername: string, streamId: string) {
  return createNotification(
    userId,
    'cohost_invite_accepted',
    '✅ Co-host Joined',
    `@${guestUsername} accepted your co-host invite.`,
    { guest_username: guestUsername, stream_id: streamId }
  )
}

export async function notifyCohostInviteDeclined(userId: string, guestUsername: string, streamId: string) {
  return createNotification(
    userId,
    'cohost_invite_declined',
    '❌ Co-host Declined',
    `@${guestUsername} declined your co-host invite.`,
    { guest_username: guestUsername, stream_id: streamId }
  )
}

export async function notifyRemovedFromCohost(userId: string, streamId: string, broadcasterUsername?: string) {
  const message = broadcasterUsername 
    ? `@${broadcasterUsername} has removed you from the co-host seat.`
    : 'You have been removed from the co-host seat.'
  return createNotification(
    userId,
    'removed_from_cohost',
    '👋 Removed from Co-host',
    message,
    { stream_id: streamId, broadcaster_username: broadcasterUsername, action_url: '/profile' }
  )
}

export async function notifyBroadofficerAssigned(userId: string, officerUsername: string, streamId: string) {
  return createNotification(
    userId,
    'broadofficer_assigned',
    '🛡️ BroadOfficer Assigned',
    `@${officerUsername} has made you a Broadofficer.`,
    { officer_username: officerUsername, stream_id: streamId }
  )
}

export async function notifyBroadofficerRemoved(userId: string, streamId: string, broadcasterUsername?: string) {
  const message = broadcasterUsername
    ? `@${broadcasterUsername} has removed you from moderating their stream.`
    : 'The BroadOfficer has been removed from your stream.'
  return createNotification(
    userId,
    'broadofficer_removed',
    'ℹ️ BroadOfficer Removed',
    message,
    { stream_id: streamId, broadcaster_username: broadcasterUsername }
  )
}

export async function notifyChatDisabled(userId: string, reason: string, streamId: string) {
  return createNotification(
    userId,
    'chat_disabled',
    '💬 Chat Disabled',
    `Chat has been disabled: ${reason}`,
    { reason, stream_id: streamId }
  )
}

export async function notifyKickedFromLive(userId: string, hostUsername: string, streamId: string, duration: string) {
  return createNotification(
    userId,
    'kicked_from_live',
    '👢 Kicked from Stream',
    `You were kicked from @${hostUsername}'s stream for ${duration}.`,
    { host_username: hostUsername, stream_id: streamId, duration, action_url: '/profile' }
  )
}

export async function notifyRestrictedFromLive(userId: string, hostUsername: string, streamId: string, duration: string) {
  return createNotification(
    userId,
    'restricted_from_live',
    '⚠️ Restricted from live',
    `You are restricted from @${hostUsername}'s stream for ${duration}.`,
    { host_username: hostUsername, stream_id: streamId, duration, action_url: '/profile' }
  )
}

export const notifyBannedFromLive = notifyRestrictedFromLive

export async function notifyLiveReceivedReport(userId: string, streamId: string, reportCount: number) {
  return createNotification(
    userId,
    'live_received_report',
    '⚠️ Stream Reported',
    `Your stream received ${reportCount} report${reportCount > 1 ? 's' : ''}. Review guidelines to avoid restrictions.`,
    { stream_id: streamId, report_count: reportCount, action_url: '/profile' }
  )
}

export async function notifyLiveEndedByStaff(userId: string, streamId: string, reason: string) {
  return createNotification(
    userId,
    'live_ended_by_staff',
    '🛑 Stream Ended by Staff',
    `Your stream was ended by staff: ${reason}`,
    { stream_id: streamId, reason, action_url: '/profile' }
  )
}

// ==========================================
// CHAT / SOCIAL NOTIFICATIONS
// ==========================================

export async function notifyNewPrivateMessage(
  receiverId: string,
  senderUsername: string,
  messagePreview: string,
  conversationId: string
) {
  return createNotification(
    receiverId,
    'new_private_message',
    '📩 New Message',
    `@${senderUsername}: ${messagePreview.substring(0, 100)}`,
    { sender_username: senderUsername, conversation_id: conversationId, action_url: `/utromail?recipientId=${senderUsername}` }
  )
}

export async function notifyMessageRequestReceived(userId: string, senderUsername: string) {
  return createNotification(
    userId,
    'message_request_received',
    '📨 Message Request',
    `@${senderUsername} wants to message you.`,
    { sender_username: senderUsername, action_url: '/utromail?tab=requests' }
  )
}

export async function notifySomeoneReplied(userId: string, replierUsername: string, context?: string) {
  return createNotification(
    userId,
    'someone_replied',
    '💬 New Reply',
    `@${replierUsername} replied to you${context ? ` in ${context}` : ''}.`,
    { replier_username: replierUsername, action_url: '/profile' }
  )
}

export async function notifySomeoneMentioned(userId: string, mentionerUsername: string, context?: string) {
  return createNotification(
    userId,
    'someone_mentioned',
    '📣 You Were Mentioned',
    `@${mentionerUsername} mentioned you${context ? ` in ${context}` : ''}.`,
    { mentioner_username: mentionerUsername, action_url: '/profile' }
  )
}

export async function notifySomeoneFollowed(userId: string, followerUsername: string) {
  return createNotification(
    userId,
    'someone_followed',
    '🤝 New Follower',
    `@${followerUsername} started following you.`,
    { follower_username: followerUsername, action_url: `/profile/${followerUsername}` }
  )
}

export async function followUser(followerId: string, followingId: string, followerUsername: string) {
  const { error } = await supabase
    .from('user_follows')
    .upsert({ follower_id: followerId, following_id: followingId }, { onConflict: 'follower_id,following_id' })

  if (error) {
    return { success: false, error: error.message }
  }

  if (followerId !== followingId) {
    await notifySomeoneFollowed(followingId, followerUsername)
  }

  return { success: true }
}

export async function notifyFriendRequestReceived(userId: string, requesterUsername: string) {
  return createNotification(
    userId,
    'friend_request_received',
    '👥 Friend Request',
    `@${requesterUsername} sent you a friend request.`,
    { requester_username: requesterUsername, action_url: '/profile?tab=friends' }
  )
}

export async function notifyRequestAccepted(userId: string, acceptorUsername: string) {
  return createNotification(
    userId,
    'request_accepted',
    '✅ Friend Request Accepted',
    `@${acceptorUsername} accepted your friend request.`,
    { acceptor_username: acceptorUsername, action_url: `/profile/${acceptorUsername}` }
  )
}

export async function notifyUtromailReceived(userId: string, senderUsername: string) {
  return createNotification(
    userId,
    'utromail_received',
    '📬 Utromail',
    `New mail from @${senderUsername}.`,
    { sender_username: senderUsername, action_url: '/utromail' }
  )
}

export async function notifyPaidMessageReceived(userId: string, senderUsername: string, price: number) {
  return createNotification(
    userId,
    'paid_message_received',
    '💰 Paid Message Received',
    `@${senderUsername} sent you a paid message (${price} coins).`,
    { sender_username: senderUsername, price, action_url: '/utromail' }
  )
}

// ==========================================
// GIFTS / COINS / WALLET NOTIFICATIONS
// ==========================================

export async function notifyGiftReceived(
  receiverId: string,
  senderId: string,
  coinsSpent: number,
  streamId?: string
) {
  const { data: sender } = await supabase
    .from('user_profiles')
    .select('username, glowing_username_color')
    .eq('id', senderId)
    .single()

  return createNotification(
    receiverId,
    'gift_received',
    '🎁 Gift Received!',
    `You received ${coinsSpent.toLocaleString()} coins from @${sender?.username || 'someone'}`,
    {
      sender_id: senderId,
      sender_username: sender?.username,
      sender_glowing_color: sender?.glowing_username_color,
      coins_spent: coinsSpent,
      stream_id: streamId,
      action_url: streamId ? `/watch/${streamId}` : '/wallet'
    }
  )
}

export async function notifyGiftSent(senderId: string, receiverUsername: string, coinsSpent: number) {
  return createNotification(
    senderId,
    'gift_sent',
    '🎁 Gift Sent',
    `You sent ${coinsSpent.toLocaleString()} coins to @${receiverUsername}.`,
    { receiver_username: receiverUsername, coins_spent: coinsSpent, action_url: '/wallet' }
  )
}

export async function notifyLargeGiftReceived(userId: string, senderUsername: string, coinsSpent: number) {
  return createNotification(
    userId,
    'large_gift_received',
    '🎁🎁 Large Gift!',
    `@${senderUsername} sent you a generous gift of ${coinsSpent.toLocaleString()} coins!`,
    { sender_username: senderUsername, coins_spent: coinsSpent, action_url: '/wallet' }
  )
}

export async function notifyCoinPurchaseSuccess(userId: string, amount: number, orderId: string) {
  return createNotification(
    userId,
    'coin_purchase_success',
    '✅ Purchase Successful',
    `${amount.toLocaleString()} coins added to your wallet.`,
    { amount, order_id: orderId, action_url: '/wallet' }
  )
}

export async function notifyCoinPurchaseFailed(userId: string, amount: number, reason?: string) {
  return createNotification(
    userId,
    'coin_purchase_failed',
    '❌ Purchase Failed',
    `Your coin purchase of ${amount.toLocaleString()} coins failed.${reason ? ` Reason: ${reason}` : ''}`,
    { amount, reason, action_url: '/wallet' }
  )
}

export async function notifyBonusCoinsAdded(userId: string, amount: number, reason?: string) {
  return createNotification(
    userId,
    'bonus_coins_added',
    '🎁 Bonus Coins Added',
    `${amount.toLocaleString()} bonus coins added to your wallet.${reason ? ` Reason: ${reason}` : ''}`,
    { amount, reason, action_url: '/wallet' }
  )
}

export async function notifyCashoutSubmitted(userId: string, amount: number) {
  return createNotification(
    userId,
    'cashout_submitted',
    '📤 Cashout Submitted',
    `Your cashout request for $${amount.toFixed(2)} has been submitted.`,
    { amount, action_url: '/wallet' }
  )
}

export async function notifyCashoutApproved(userId: string, amount: number) {
  return createNotification(
    userId,
    'cashout_approved',
    '✅ Cashout Approved',
    `Your cashout of $${amount.toFixed(2)} has been approved.`,
    { amount, action_url: '/wallet' }
  )
}

export async function notifyCashoutRejected(userId: string, amount: number, reason?: string) {
  return createNotification(
    userId,
    'cashout_rejected',
    '❌ Cashout Rejected',
    `Your cashout of $${amount.toFixed(2)} was rejected.${reason ? ` Reason: ${reason}` : ''}`,
    { amount, reason, action_url: '/wallet' }
  )
}

export async function notifyCashoutPaid(userId: string, amount: number) {
  return createNotification(
    userId,
    'cashout_paid',
    '💰 Cashout Paid',
    `Your cashout of $${amount.toFixed(2)} has been processed.`,
    { amount, action_url: '/wallet' }
  )
}

export async function notifyCashoutHoldPlaced(userId: string, amount: number, reason: string) {
  return createNotification(
    userId,
    'cashout_hold_placed',
    '⏸️ Cashout On Hold',
    `Your cashout of $${amount.toFixed(2)} is on hold. Reason: ${reason}`,
    { amount, reason, action_url: '/wallet' }
  )
}

export async function notifyCashoutHoldRemoved(userId: string, amount: number) {
  return createNotification(
    userId,
    'cashout_hold_removed',
    '✅ Cashout Hold Removed',
    `The hold on your cashout of $${amount.toFixed(2)} has been removed.`,
    { amount, action_url: '/wallet' }
  )
}

export async function notifyWalletAdjustment(userId: string, amount: number, adminUsername: string, reason?: string) {
  return createNotification(
    userId,
    'wallet_adjustment',
    '⚖️ Wallet Adjusted',
    `${amount >= 0 ? '+' : ''}${amount.toLocaleString()} coins by @${adminUsername}.${reason ? ` Reason: ${reason}` : ''}`,
    { amount, admin_username: adminUsername, reason, action_url: '/wallet' }
  )
}

// ==========================================
// COURT / JAIL / CITY GOVERNANCE NOTIFICATIONS
// ==========================================

export async function notifyCourtCaseOpened(userId: string, caseNumber: string, role: string) {
  return createNotification(
    userId,
    'court_case_opened',
    '⚖️ Court Case Opened',
    `Case #${caseNumber} has been opened. Your role: ${role}.`,
    { case_number: caseNumber, role, action_url: '/court' }
  )
}

export async function notifyAddedToCase(userId: string, caseNumber: string, addedByName: string) {
  return createNotification(
    userId,
    'added_to_case',
    '⚖️ Added to Case',
    `@${addedByName} added you to case #${caseNumber}.`,
    { case_number: caseNumber, action_url: '/court' }
  )
}

export async function notifyCourtHearingScheduled(userId: string, caseNumber: string, hearingTime: string) {
  return createNotification(
    userId,
    'court_hearing_scheduled',
    '📅 Hearing Scheduled',
    `Hearing for case #${caseNumber} scheduled for ${hearingTime}.`,
    { case_number: caseNumber, hearing_time: hearingTime, action_url: '/court' }
  )
}

export async function notifyHearingStartingSoon(userId: string, caseNumber: string, minutes: number) {
  return createNotification(
    userId,
    'hearing_starting_soon',
    '⏰ Hearing Starting Soon',
    `Case #${caseNumber} hearing starts in ${minutes} minutes.`,
    { case_number: caseNumber, minutes, action_url: '/court' }
  )
}

export async function notifyJudgeAssigned(userId: string, caseNumber: string, judgeUsername: string) {
  return createNotification(
    userId,
    'judge_assigned',
    '⚖️ Judge Assigned',
    `@${judgeUsername} has been assigned to case #${caseNumber}.`,
    { case_number: caseNumber, judge_username: judgeUsername, action_url: '/court' }
  )
}

export async function notifyAttorneyAssigned(userId: string, caseNumber: string, attorneyUsername: string) {
  return createNotification(
    userId,
    'attorney_assigned',
    '👨‍⚖️ Attorney Assigned',
    `@${attorneyUsername} has been assigned to your case #${caseNumber}.`,
    { case_number: caseNumber, attorney_username: attorneyUsername, action_url: '/court' }
  )
}

export async function notifyVerdictIssued(userId: string, caseNumber: string, verdict: string) {
  return createNotification(
    userId,
    'verdict_issued',
    '📋 Verdict Issued',
    `Case #${caseNumber} verdict: ${verdict}.`,
    { case_number: caseNumber, verdict, action_url: '/court' }
  )
}

export async function notifySentenceIssued(userId: string, caseNumber: string, sentence: string) {
  return createNotification(
    userId,
    'sentence_issued',
    '⚖️ Sentence Issued',
    `Case #${caseNumber} sentence: ${sentence}.`,
    { case_number: caseNumber, sentence, action_url: '/court' }
  )
}

export async function notifyFineAssigned(userId: string, caseNumber: string, amount: number) {
  return createNotification(
    userId,
    'fine_assigned',
    '💵 Fine Assigned',
    `Case #${caseNumber} fine: $${amount.toFixed(2)}.`,
    { case_number: caseNumber, amount, action_url: '/court' }
  )
}

export async function notifyFinePaid(userId: string, caseNumber: string, amount: number) {
  return createNotification(
    userId,
    'fine_paid',
    '✅ Fine Paid',
    `You paid $${amount.toFixed(2)} fine for case #${caseNumber}.`,
    { case_number: caseNumber, amount, action_url: '/court' }
  )
}

export async function notifyLicenseSuspensionStarted(userId: string, reason: string) {
  return createNotification(
    userId,
    'license_suspension_started',
    '⛔ License Suspended',
    `Your account license suspended: ${reason}.`,
    { reason, action_url: '/court' }
  )
}

export async function notifyLicenseSuspensionEnded(userId: string) {
  return createNotification(
    userId,
    'license_suspension_ended',
    '✅ License Restored',
    'Your account license has been restored.',
    { action_url: '/profile' }
  )
}

export async function notifyAppealSubmitted(userId: string, caseNumber: string) {
  return createNotification(
    userId,
    'appeal_submitted',
    '📝 Appeal Submitted',
    `Appeal submitted for case #${caseNumber}.`,
    { case_number: caseNumber, action_url: '/court' }
  )
}

export async function notifyAppealDecision(userId: string, caseNumber: string, decision: string) {
  return createNotification(
    userId,
    'appeal_decision',
    '📋 Appeal Decision',
    `Appeal for case #${caseNumber}: ${decision}.`,
    { case_number: caseNumber, decision, action_url: '/court' }
  )
}

// ==========================================
// AUCTIONS / MARKETPLACE NOTIFICATIONS
// ==========================================

export async function notifyAuctionStartingSoon(userId: string, sellerUsername: string, listingId: string) {
  return createNotification(
    userId,
    'auction_starting_soon',
    '⏰ Auction Starting Soon',
    `@${sellerUsername}'s auction is starting in 30 minutes.`,
    { seller_username: sellerUsername, listing_id: listingId, action_url: `/marketplace/${listingId}` }
  )
}

export async function notifyYouPlacedBid(userId: string, listingId: string, bidAmount: number) {
  return createNotification(
    userId,
    'you_placed_bid',
    '✅ Bid Placed',
    `Your bid of ${bidAmount.toLocaleString()} coins is now active.`,
    { listing_id: listingId, bid_amount: bidAmount, action_url: `/marketplace/${listingId}` }
  )
}

export async function notifyYouWereOutbid(userId: string, listingId: string, newBid: number) {
  return createNotification(
    userId,
    'you_were_outbid',
    '❌ Outbid',
    `You were outbid. New bid: ${newBid.toLocaleString()} coins.`,
    { listing_id: listingId, new_bid: newBid, action_url: `/marketplace/${listingId}` }
  )
}

export async function notifyYouWonAuction(userId: string, listingId: string, finalBid: number) {
  return createNotification(
    userId,
    'you_won_auction',
    '🏆 Auction Won!',
    `You won the auction with ${finalBid.toLocaleString()} coins!`,
    { listing_id: listingId, final_bid: finalBid, action_url: `/marketplace/${listingId}` }
  )
}

export async function notifyYouLostAuction(userId: string, listingId: string) {
  return createNotification(
    userId,
    'you_lost_auction',
    '😔 Auction Lost',
    'You lost the auction. Better luck next time!',
    { listing_id: listingId, action_url: '/marketplace' }
  )
}

export async function notifyPaymentRequired(userId: string, orderId: string, amount: number) {
  return createNotification(
    userId,
    'payment_required',
    '💳 Payment Required',
    `Payment of $${amount.toFixed(2)} required for your auction win.`,
    { order_id: orderId, amount, action_url: '/wallet' }
  )
}

export async function notifyOrderDelivered(userId: string, orderId: string) {
  return createNotification(
    userId,
    'order_delivered',
    '📦 Order Delivered',
    `Your order #${orderId} has been delivered.`,
    { order_id: orderId, action_url: '/marketplace/orders' }
  )
}

export async function notifyDisputeOpened(userId: string, orderId: string) {
  return createNotification(
    userId,
    'dispute_opened',
    '⚠️ Dispute Opened',
    `A dispute has been opened for order #${orderId}.`,
    { order_id: orderId, action_url: '/marketplace/orders' }
  )
}

export async function notifyDisputeResolved(userId: string, orderId: string, outcome: string) {
  return createNotification(
    userId,
    'dispute_resolved',
    '📋 Dispute Resolved',
    `Dispute for order #${orderId}: ${outcome}.`,
    { order_id: orderId, outcome, action_url: '/marketplace/orders' }
  )
}

// ==========================================
// FAMILIES / NEIGHBORHOODS NOTIFICATIONS
// ==========================================

export async function notifyFamilyInviteReceived(userId: string, familyName: string) {
  return createNotification(
    userId,
    'family_invite_received',
    '👨‍👩‍👧‍👦 Family Invite',
    `You've been invited to join ${familyName}.`,
    { family_name: familyName, action_url: '/families' }
  )
}

export async function notifyFamilyRoleChanged(userId: string, newRole: string) {
  return createNotification(
    userId,
    'family_role_changed',
    '🔄 Role Changed',
    `Your family role has been changed to ${newRole}.`,
    { new_role: newRole, action_url: '/families' }
  )
}

export async function notifyRoleInviteReceived(userId: string, inviterUsername: string, role: string, inviteId: string) {
  return createNotification(
    userId,
    'role_invite_received',
    '🎖️ Role Invitation',
    `@${inviterUsername} invited you to become ${role}.`,
    { inviter_username: inviterUsername, role, invite_id: inviteId, action_url: '/notifications' }
  )
}

export async function notifyRoleInviteAccepted(userId: string, targetUsername: string, role: string) {
  return createNotification(
    userId,
    'role_invite_accepted',
    '✅ Role Invite Accepted',
    `@${targetUsername} accepted your invitation to become ${role}.`,
    { target_username: targetUsername, role }
  )
}

export async function notifyRoleInviteDeclined(userId: string, targetUsername: string, role: string) {
  return createNotification(
    userId,
    'role_invite_declined',
    '❌ Role Invite Declined',
    `@${targetUsername} declined your invitation to become ${role}.`,
    { target_username: targetUsername, role }
  )
}

export async function notifyFamilyXPMilestone(userId: string, xp: number) {
  return createNotification(
    userId,
    'family_xp_milestone',
    '🎉 Family XP Milestone!',
    `Your family reached ${xp.toLocaleString()} XP!`,
    { xp, action_url: '/families' }
  )
}

export async function notifyFamilyChallengeStarted(userId: string, challengeName: string) {
  return createNotification(
    userId,
    'family_challenge_started',
    '🏆 Family Challenge Started',
    `${challengeName} challenge has begun!`,
    { challenge_name: challengeName, action_url: '/families' }
  )
}

export async function notifyFamilyChallengeCompleted(userId: string, challengeName: string, reward: string) {
  return createNotification(
    userId,
    'family_challenge_completed',
    '✅ Challenge Complete!',
    `Challenge "${challengeName}" completed! Reward: ${reward}`,
    { challenge_name: challengeName, reward, action_url: '/families' }
  )
}

// ==========================================
// STORE / INVENTORY NOTIFICATIONS
// ==========================================

export async function notifyPurchaseSuccessful(userId: string, itemName: string, price: number) {
  return createNotification(
    userId,
    'purchase_successful',
    '✅ Purchase Complete',
    `${itemName} purchased for ${price.toLocaleString()} coins.`,
    { item_name: itemName, price, action_url: '/store' }
  )
}

export async function notifyItemUnlocked(userId: string, itemName: string) {
  return createNotification(
    userId,
    'item_unlocked',
    '🔓 Item Unlocked!',
    `${itemName} is now available in your inventory.`,
    { item_name: itemName, action_url: '/inventory' }
  )
}

export async function notifyThemeEquipped(userId: string, themeName: string) {
  return createNotification(
    userId,
    'theme_equipped',
    '🎨 Theme Applied',
    `"${themeName}" theme has been equipped.`,
    { theme_name: themeName, action_url: '/profile' }
  )
}

export async function notifyVIPPerkUnlocked(userId: string, perkName: string) {
  return createNotification(
    userId,
    'vip_perk_unlocked',
    '⭐ VIP Perk Unlocked!',
    `"${perkName}" is now available.`,
    { perk_name: perkName, action_url: '/profile' }
  )
}

export async function notifySubscriptionRenewed(userId: string, perkName: string) {
  return createNotification(
    userId,
    'subscription_renewed',
    '🔄 Subscription Renewed',
    `"${perkName}" subscription has been renewed.`,
    { perk_name: perkName, action_url: '/profile' }
  )
}

export async function notifySubscriptionExpired(userId: string, perkName: string) {
  return createNotification(
    userId,
    'subscription_expired',
    '⌛ Subscription Expired',
    `"${perkName}" subscription has expired.`,
    { perk_name: perkName, action_url: '/store' }
  )
}

// ==========================================
// TEAM MEETING NOTIFICATIONS
// ==========================================

export async function notifyTeamMeetingStarted(
  meetingId: string,
  meetingTitle: string,
  staffUserIds: string[]
): Promise<{ success: boolean; error?: string }> {
  if (!staffUserIds || staffUserIds.length === 0) {
    return { success: false, error: 'No staff users to notify' }
  }

  try {
    for (const userId of staffUserIds) {
      await createNotification(
        userId,
        'team_meeting_started',
        '👥 Team Meeting Started',
        `${meetingTitle} has started. Click to join.`,
        {
          meeting_id: meetingId,
          meeting_title: meetingTitle,
          action_url: `/meeting/${meetingId}`
        }
      )
    }
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to send notifications' }
  }
}

// ==========================================
// CAREER / JOB APPLICATION NOTIFICATIONS
// ==========================================

export async function notifyCareerApplicationSubmitted(
  applicantId: string,
  positionId: string,
  positionTitle: string
): Promise<void> {
  await notifyAdmins(
    '📝 New Job Application',
    `A user has applied for the ${positionTitle} position.`,
    'career_application_submitted',
    {
      applicant_id: applicantId,
      position_id: positionId,
      position_title: positionTitle,
      action_url: '/admin/applications'
    }
  )

  await createNotification(
    applicantId,
    'application_submitted',
    '✅ Application Submitted',
    `Your application for ${positionTitle} has been submitted and is pending review.`,
    {
      position_id: positionId,
      position_title: positionTitle,
      action_url: '/jobs'
    }
  )
}

// ==========================================
// INTERVIEW NOTIFICATIONS
// ==========================================

export async function notifyInterviewScheduled(
  applicantId: string,
  interviewerId: string,
  scheduledAtIso: string,
  roomName: string
): Promise<void> {
  const when = new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(scheduledAtIso))

  await createNotification(
    applicantId,
    'interview_scheduled',
    '📅 Interview Scheduled',
    `Your interview is scheduled for ${when}.`,
    {
      scheduled_at: scheduledAtIso,
      room_name: roomName,
      interviewer_id: interviewerId,
      action_url: `/interview/by-room/${roomName}`,
    }
  )

  await createNotification(
    interviewerId,
    'interview_scheduled_staff',
    '🗓️ Interview to Conduct',
    `You are scheduled to interview an applicant on ${when}.`,
    {
      scheduled_at: scheduledAtIso,
      room_name: roomName,
      applicant_id: applicantId,
      action_url: '/Employees?tab=hiring',
    }
  )
}

export async function notifyInterviewStarted(
  applicantId: string,
  interviewerId: string
): Promise<void> {
  await createNotification(
    applicantId,
    'interview_started',
    '🔴 Interview Starting Now',
    'Your interview is starting now. Join the live room.',
    {
      action_url: '/jobs',
    }
  )

  await createNotification(
    interviewerId,
    'interview_started',
    '🔴 Interview Starting Now',
    'The interview room is now active.',
    {
      action_url: '/Employees?tab=hiring',
    }
  )
}

// ==========================================
// NEW USER SIGNUP (admin alerts)
// ==========================================

export async function notifyNewUserSignup(
  username: string,
  userId: string
): Promise<void> {
  await notifyAdmins(
    '🆕 New User Signup',
    `@${username} just created an account.`,
    'new_user_signup',
    {
      signup_user_id: userId,
      signup_username: username,
      action_url: `/profile/${username}`,
      audience: 'admin',
    }
  )
}

// ==========================================
// ADMIN ACTION NOTIFICATIONS
// ==========================================

export async function notifyAdminUserKicked(
  kickedUserId: string,
  kickedUsername: string,
  streamId: string,
  duration: string,
  kickedBy: string
): Promise<void> {
  await notifyAdmins(
    '👢 User Kicked from Stream',
    `@${kickedUsername} was kicked from a stream for ${duration} by @${kickedBy}.`,
    'user_kicked',
    {
      kicked_user_id: kickedUserId,
      kicked_username: kickedUsername,
      stream_id: streamId,
      duration,
      kicked_by: kickedBy,
      action_url: `/watch/${streamId}`,
    }
  )
}

export async function notifyAdminUserArrested(
  arrestedUserId: string,
  arrestedUsername: string,
  reason: string,
  severity: string,
  arrestedBy: string
): Promise<void> {
  await notifyAdmins(
    '⚖️ User Arrested',
    `@${arrestedUsername} was arrested by @${arrestedBy}. Reason: ${reason}. Severity: ${severity}`,
    'user_arrested',
    {
      arrested_user_id: arrestedUserId,
      arrested_username: arrestedUsername,
      reason,
      severity,
      arrested_by: arrestedBy,
      action_url: '/jail',
    }
  )
}

export async function notifyAdminCourtStarted(
  caseId: string,
  defendantId: string,
  defendantUsername: string,
  reason: string,
  courtDate: string
): Promise<void> {
  await notifyAdmins(
    '⚖️ Court Case Started',
    `Court case opened for @${defendantUsername}. Reason: ${reason}. Court date: ${courtDate}`,
    'court_started',
    {
      case_id: caseId,
      defendant_id: defendantId,
      defendant_username: defendantUsername,
      reason,
      court_date: courtDate,
      action_url: '/court',
    }
  )
}

export async function notifyAdminCoinPurchase(
  userId: string,
  username: string,
  amount: number,
  orderId: string
): Promise<void> {
  await notifyAdmins(
    '💰 Coin Purchase',
    `@${username} purchased ${amount.toLocaleString()} coins. Order ID: ${orderId}`,
    'coin_purchase_admin_alert',
    {
      purchase_user_id: userId,
      purchase_username: username,
      amount,
      order_id: orderId,
      action_url: '/admin/payments',
    }
  )
}

export async function notifyAdminReportFiled(
  reportId: string,
  reporterId: string,
  reporterUsername: string,
  targetUserId: string,
  targetUsername: string,
  reason: string,
  streamId?: string
): Promise<void> {
  await notifyAdmins(
    '⚠️ Report Filed',
    `@${reporterUsername} reported @${targetUsername}: ${reason}`,
    'report_filed',
    {
      report_id: reportId,
      reporter_id: reporterId,
      reporter_username: reporterUsername,
      target_user_id: targetUserId,
      target_username: targetUsername,
      reason,
      stream_id: streamId,
      action_url: '/admin/reports',
    }
  )
}

// ==========================================
// MAI PIKS NOTIFICATIONS
// ==========================================

export async function notifyMaipiksNewPost(
  userId: string,
  username: string,
  avatarUrl?: string | null
): Promise<{ success: boolean; error?: string }> {
  return createNotification(
    userId,
    'maipiks_new_post',
    `📸 @${username} posted a new MaiPik`,
    `@${username} just shared a new MaiPik on their feed.`,
    {
      actor_id: userId,
      actor_username: username,
      actor_avatar_url: avatarUrl,
    }
  )
}

export async function notifyMaipiksNewStory(
  userId: string,
  username: string,
  avatarUrl?: string | null
): Promise<{ success: boolean; error?: string }> {
  return createNotification(
    userId,
    'maipiks_new_story',
    `🎬 @${username} posted a new story`,
    `@${username} just posted a new MaiPiks story.`,
    {
      actor_id: userId,
      actor_username: username,
      actor_avatar_url: avatarUrl,
    }
  )
}

export async function notifyMaipiksScreenshot(
  ownerUserId: string,
  screenshotterUsername: string,
  contentType: 'story' | 'feed' | 'profile' | 'chat' | 'broadcast',
  contentId?: string
): Promise<{ success: boolean; error?: string }> {
  return createNotification(
    ownerUserId,
    'maipiks_screenshot',
    '📸 Screenshot Taken',
    `@${screenshotterUsername} took a screenshot of your MaiPiks ${contentType}.`,
    {
      actor_username: screenshotterUsername,
      content_type: contentType,
      content_id: contentId,
    }
  )
}