import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../../lib/store';
import { supabase } from '../../lib/supabase';
import { toast } from 'sonner';
import { Crown, Heart, Loader2, Check } from 'lucide-react';
import { useCoins } from '../../lib/hooks/useCoins';

interface SubscribeButtonProps {
  broadcasterId: string;
  broadcasterUsername: string;
  onSubscribe?: () => void;
  onUnsubscribe?: () => void;
}

const SubscribeButton: React.FC<SubscribeButtonProps> = ({
  broadcasterId,
  broadcasterUsername,
  onSubscribe,
  onUnsubscribe
}) => {
  const { user, profile } = useAuthStore();
  const { refreshCoins } = useCoins();
  const [loading, setLoading] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [subscriptionPrice, setSubscriptionPrice] = useState<number | null>(null);
  const [canSubscribe, setCanSubscribe] = useState(false);

  useEffect(() => {
    if (!user) return;
    checkCreatorSubscription();
  }, [user, broadcasterId]);

  const checkCreatorSubscription = async () => {
    try {
      // Check if creator has subscriptions enabled and get price
      const { data: creator } = await supabase
        .from('user_profiles')
        .select('creator_subscription_enabled, creator_subscription_price_coins')
        .eq('id', broadcasterId)
        .single();

      // Check level from user_profiles (same source as bottom nav bar)
      setCanSubscribe(creator?.creator_subscription_enabled && (profile?.level || 0) >= 10);
      setSubscriptionPrice(creator?.creator_subscription_price_coins || 100);

      // Check if already subscribed
      const { data: subscription } = await supabase
        .from('user_subscriptions')
        .select('id')
        .eq('subscriber_id', user.id)
        .eq('broadcaster_id', broadcasterId)
        .eq('is_active', true)
        .single();

      setIsSubscribed(!!subscription);
    } catch (err) {
      console.error('[SubscribeButton] Error checking subscription:', err);
    }
  };

  const handleSubscribe = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('subscribe_to_creator', {
        p_creator_id: broadcasterId
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Subscription failed');

      toast.success(`Subscribed to ${broadcasterUsername}! (80% to creator, 20% to CEO)`);
      setIsSubscribed(true);
      await refreshCoins(); // Refresh coin balance (same as bottom nav bar)
      onSubscribe?.();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUnsubscribe = async () => {
    if (!user) return;

    const confirmUnsubscribe = confirm(`Unsubscribe from ${broadcasterUsername}? You'll lose subscriber benefits.`);
    if (!confirmUnsubscribe) return;

    setLoading(true);
    try {
      const { error } = await supabase.rpc('unsubscribe_from_broadcaster', {
        p_subscriber_id: user.id,
        p_broadcaster_id: broadcasterId
      });

      if (error) throw error;
      toast.success(`Unsubscribed from ${broadcasterUsername}`);
      setIsSubscribed(false);
      await refreshCoins(); // Refresh coin balance (same as bottom nav bar)
      onUnsubscribe?.();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const currentLevel = profile?.level || 0;

  const getButtonStyle = () => {
    if (isSubscribed) {
      return 'bg-green-600 hover:bg-green-500 text-white';
    }
    if (!canSubscribe) {
      return 'bg-gray-600 text-gray-400 cursor-not-allowed';
    }
    return 'bg-cyan-600 hover:bg-cyan-500 text-white';
  };

  const getButtonText = () => {
    if (loading) return '...';
    if (isSubscribed) return 'Subscribed ✓';
    if (currentLevel < 10) return `Level ${currentLevel}/10 to Subscribe`;
    return subscriptionPrice ? `Subscribe (${subscriptionPrice} TC)` : 'Subscribe';
  };

  return (
    <button
      onClick={isSubscribed ? handleUnsubscribe : handleSubscribe}
      disabled={loading || !canSubscribe}
      className={`flex items-center gap-2 px-3 py-2 rounded-lg font-semibold text-xs sm:text-sm transition-all ${getButtonStyle()}`}
      title={isSubscribed ? 'Click to unsubscribe' : `Subscribe to support ${broadcasterUsername}`}
    >
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : isSubscribed ? (
        <>
          <Crown className="w-4 h-4" />
          {getButtonText()}
        </>
      ) : (
        <>
          <Heart className="w-4 h-4" />
          {getButtonText()}
        </>
      )}
    </button>
  );
};

export default SubscribeButton;
