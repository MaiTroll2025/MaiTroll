import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/lib/store';
import { UserRole } from '@/lib/supabase';

export interface NavBadges {
  home: number;
  chats: number;
  coins: number;
  auctions: number;
  court: number;
  neighborhood: number;
  academy: number;
  wallet: number;
  family: number;
  shop: number;
  inventory: number;
  alerts: number;
}

// Track which tabs the user has clicked/visited since last notification
let dismissedTabs: Set<keyof NavBadges> = new Set();
let lastBadgeCounts: NavBadges = {
  home: 0, chats: 0, coins: 0, auctions: 0, court: 0,
  neighborhood: 0, academy: 0, wallet: 0, family: 0,
  shop: 0, inventory: 0, alerts: 0,
};
const listeners: Set<() => void> = new Set();

function notifyListeners() {
  listeners.forEach((fn) => fn());
}

export function dismissBadge(tab: keyof NavBadges) {
  dismissedTabs.add(tab);
  notifyListeners();
}

export function getEffectiveBadges(counts: NavBadges): NavBadges & { dismissed: Set<keyof NavBadges> } {
  const result: any = { dismissed: dismissedTabs };
  for (const key of Object.keys(counts) as (keyof NavBadges)[]) {
    const newCount = counts[key];
    const oldCount = lastBadgeCounts[key];
    // If count increased since last check, undismiss this tab (new notifications arrived)
    if (newCount > oldCount) {
      dismissedTabs.delete(key);
    }
    // Show badge only if count > 0 and tab hasn't been dismissed
    result[key] = dismissedTabs.has(key) ? 0 : newCount;
  }
  lastBadgeCounts = { ...counts };
  return result;
}

// Map each notification type to the nav tab(s) it should badge
const TAB_NOTIFICATION_TYPES: Record<keyof NavBadges, string[]> = {
  // Home = total unread notifications (all types)
  home: [], // special: counts everything

  // Chats = unread conversation messages (handled separately via conversation_messages table)
  chats: [], // special: counts from conversation_messages

  // Coins tab: coin/gift/wallet purchase events
  coins: [
    'gift_received',
    'gift_sent',
    'large_gift_received',
    'coin_purchase_success',
    'coin_purchase_failed',
    'bonus_coins_added',
    'daily_reward_available',
    'daily_reward_claimed',
    'hype_coin_earned',
    'hype_coin_daily_cap_reached',
    'hype_coin_weekly_cap_reached',
    'hype_coins_converted',
    'hype_coin_adjustment',
  ],

  // Auctions tab: auction/marketplace events
  auctions: [
    'auction_starting_soon',
    'seller_you_follow_auction',
    'you_placed_bid',
    'you_were_outbid',
    'you_won_auction',
    'you_lost_auction',
    'payment_required',
    'payment_confirmed',
    'seller_shipped',
    'tracking_added',
    'order_delivered',
    'mystery_box_assigned',
    'mystery_box_opened_live',
    'dispute_opened',
    'dispute_resolved',
    'seller_rating_received',
    'buyer_rating_received',
  ],

  // Court tab: court/jail/legal events
  court: [
    'court_case_opened',
    'added_to_case',
    'court_hearing_scheduled',
    'hearing_starting_soon',
    'judge_assigned',
    'attorney_assigned',
    'evidence_submitted',
    'verdict_issued',
    'sentence_issued',
    'fine_assigned',
    'fine_paid',
    'license_suspension_started',
    'license_suspension_ended',
    'appeal_submitted',
    'appeal_decision',
    'jail_sentence_started',
    'jail_release_reminder',
    'jail_release_completed',
    'jail_status_changed',
    'jail_insurance_purchased',
    'jail_insurance_expiring_soon',
    'jail_insurance_expired',
    'get_out_of_jail_coin_won',
    'get_out_of_jail_coin_used',
    'get_out_of_jail_coin_denied',
    'inmate_message_received',
  ],

  // Neighborhood tab: neighborhood/family social events
  neighborhood: [
    'neighborhood_event_started',
    'family_invite_received',
    'family_invite_accepted',
    'family_role_changed',
    'family_xp_milestone',
    'family_challenge_started',
    'family_challenge_completed',
    'someone_followed',
    'friend_request_received',
    'request_accepted',
    'someone_replied',
    'someone_mentioned',
  ],

  // Academy tab: learning/mail events
  academy: [
    'academy_mail',
    'government_mail',
  ],

  // Wallet tab: financial/cashout events
  wallet: [
    'cashout_submitted',
    'cashout_approved',
    'cashout_rejected',
    'cashout_paid',
    'cashout_hold_placed',
    'cashout_hold_removed',
    'wallet_adjustment',
    'refund_issued',
  ],

  // Family tab: family-specific events
  family: [
    'family_invite_received',
    'family_invite_accepted',
    'family_role_changed',
    'family_xp_milestone',
    'family_challenge_started',
    'family_challenge_completed',
  ],

  // Shop tab: store/purchase events
  shop: [
    'purchase_successful',
    'purchase_failed',
    'seller_tier_upgrade',
    'seller_tier_downgrade',
  ],

  // Inventory tab: item/unlock events
  inventory: [
    'item_unlocked',
    'entrance_effect_activated',
    'theme_purchased',
    'theme_equipped',
    'vip_perk_unlocked',
    'subscription_renewed',
    'subscription_expired',
  ],

  // Alerts tab: total unread notifications (same as home)
  alerts: [], // special: counts everything
};

export function useNavBadges(): NavBadges & { dismissed: Set<keyof NavBadges>; dismiss: (tab: keyof NavBadges) => void } {
  const { user, profile } = useAuthStore();
  const [badgeCounts, setBadgeCounts] = useState<NavBadges>({
    home: 0,
    chats: 0,
    coins: 0,
    auctions: 0,
    court: 0,
    neighborhood: 0,
    academy: 0,
    wallet: 0,
    family: 0,
    shop: 0,
    inventory: 0,
    alerts: 0,
  });

  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const notifChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const coinPurchaseChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const signupAlertChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const isMountedRef = useRef(true);
  const profileRef = useRef(profile);
  profileRef.current = profile;

  const fetchNotificationCounts = useCallback(async (userId: string) => {
    // Fetch all unread notifications for this user in one query
    const { data, error } = await supabase
      .from('notifications')
      .select('type', { count: 'exact' })
      .eq('user_id', userId)
      .eq('is_read', false);

    if (error || !data) {
      if (isMountedRef.current) {
        setBadgeCounts((prev) => ({
          ...prev,
          home: 0,
          alerts: 0,
          coins: prev.coins,
          auctions: 0,
          court: 0,
          neighborhood: 0,
          academy: 0,
          wallet: 0,
          family: 0,
          shop: 0,
          inventory: 0,
        }));
      }
      return;
    }

    const rows = data as unknown as { type: string }[];
    const total = rows.length;

    // Build reverse lookup: type -> tab
    const typeToTabs = new Map<string, (keyof NavBadges)[]>();
    for (const [tab, types] of Object.entries(TAB_NOTIFICATION_TYPES)) {
      for (const type of types) {
        const existing = typeToTabs.get(type) || [];
        existing.push(tab as keyof NavBadges);
        typeToTabs.set(type, existing);
      }
    }

    // Count per tab
    const counts: Record<string, number> = {
      coins: 0,
      auctions: 0,
      court: 0,
      neighborhood: 0,
      academy: 0,
      wallet: 0,
      family: 0,
      shop: 0,
      inventory: 0,
    };

    for (const row of rows) {
      const tabs = typeToTabs.get(row.type);
      if (tabs) {
        for (const tab of tabs) {
          counts[tab] = (counts[tab] || 0) + 1;
        }
      }
    }

    if (isMountedRef.current) {
      setBadgeCounts((prev) => ({
        ...prev,
        home: total,
        alerts: total,
        ...counts,
      }));
    }
  }, []);

  const fetchUnreadMessages = useCallback(async (userId: string) => {
    const { data: memberships } = await supabase
      .from('conversation_members')
      .select('conversation_id')
      .eq('user_id', userId);

    if (!memberships || memberships.length === 0) {
      if (isMountedRef.current) {
        setBadgeCounts((prev) => ({ ...prev, chats: 0 }));
      }
      return [];
    }

    const convIds = memberships.map((m) => m.conversation_id);
    const BATCH_SIZE = 50;
    let total = 0;

    for (let i = 0; i < convIds.length; i += BATCH_SIZE) {
      const batch = convIds.slice(i, i + BATCH_SIZE);
      const { count } = await supabase
        .from('conversation_messages')
        .select('*', { count: 'exact', head: true })
        .in('conversation_id', batch)
        .neq('sender_id', userId)
        .is('read_at', null);

      total += count || 0;
    }

    if (isMountedRef.current) {
      setBadgeCounts((prev) => ({ ...prev, chats: total }));
    }

    return convIds;
  }, []);

  useEffect(() => {
    isMountedRef.current = true;

    if (!user?.id) {
      setBadgeCounts({
        home: 0, chats: 0, coins: 0, auctions: 0, court: 0,
        neighborhood: 0, academy: 0, wallet: 0, family: 0,
        shop: 0, inventory: 0, alerts: 0,
      });
      return;
    }

    const userId = user.id;

    fetchNotificationCounts(userId);
    fetchUnreadMessages(userId);

    // Realtime subscription for notifications
    notifChannelRef.current = supabase
      .channel(`nav-notifications:${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        () => fetchNotificationCounts(userId),
      )
      .subscribe();

    // Admin-only realtime subscription for coin purchases (flashes Coins tab)
    const setupCoinPurchaseSubscription = async () => {
      const profile = profileRef.current;
      const role = String(profile?.role || '');
      const isAdmin = role === String(UserRole.ADMIN) || role === 'superadmin' || role === 'ceo' || (profile as any)?.is_admin;

      if (isAdmin) {
        coinPurchaseChannelRef.current = supabase
          .channel('admin-coin-purchases')
          .on(
            'postgres_changes',
            {
              event: 'INSERT',
              schema: 'public',
              table: 'paypal_transactions',
            },
            () => {
              setBadgeCounts((prev) => ({ ...prev, coins: (prev.coins || 0) + 1 }));
            },
          )
          .subscribe();
      }
    };

    setupCoinPurchaseSubscription();

    // Admin-only realtime subscription for new user signups (flashes Alerts tab)
    const setupSignupAlertSubscription = async () => {
      const profile = profileRef.current;
      const role = String(profile?.role || '');
      const isAdmin = role === String(UserRole.ADMIN) || role === 'superadmin' || role === 'ceo' || (profile as any)?.is_admin;

      if (!isAdmin) return;

      signupAlertChannelRef.current = supabase
        .channel('nav-signup-alerts')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'user_profiles',
          },
          (payload: any) => {
            const newUser = payload?.new;
            if (!newUser) return;
            setBadgeCounts((prev) => ({ ...prev, alerts: (prev.alerts || 0) + 1 }));
            import('@/lib/notifications')
              .then(({ notifyNewUserSignup }) =>
                notifyNewUserSignup(newUser.username || 'unknown', newUser.id),
              )
              .catch(() => undefined);
          },
        )
        .subscribe();
    };

    setupSignupAlertSubscription();

    // Realtime subscription for chat messages
    const setupChatSubscription = async () => {
      const { data: memberships } = await supabase
        .from('conversation_members')
        .select('conversation_id')
        .eq('user_id', userId);

      if (!memberships || memberships.length === 0) return;

      const convIds = memberships.map((m) => m.conversation_id);

      channelRef.current = supabase
        .channel(`nav-chats:${userId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'conversation_messages',
            filter: `conversation_id=in.(${convIds.join(',')})`,
          },
          () => fetchUnreadMessages(userId),
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'conversation_messages',
            filter: `conversation_id=in.(${convIds.join(',')})`,
          },
          () => fetchUnreadMessages(userId),
        )
        .subscribe();
    };

    setupChatSubscription();

    return () => {
      isMountedRef.current = false;
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      if (notifChannelRef.current) {
        supabase.removeChannel(notifChannelRef.current);
        notifChannelRef.current = null;
      }
      if (coinPurchaseChannelRef.current) {
        supabase.removeChannel(coinPurchaseChannelRef.current);
        coinPurchaseChannelRef.current = null;
      }
      if (signupAlertChannelRef.current) {
        supabase.removeChannel(signupAlertChannelRef.current);
        signupAlertChannelRef.current = null;
      }
    };
  }, [user?.id, fetchNotificationCounts, fetchUnreadMessages]);

  return { ...getEffectiveBadges(badgeCounts), dismissed: dismissedTabs, dismiss: dismissBadge };
}
