import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../lib/store';
import { toast } from 'sonner';
import { Loader2, Check, Gem, Crown, Star, Heart, Zap } from 'lucide-react';
import { SlaGuaranteesCard } from '../broadcast/SlaBadge';

export interface SubscriptionTier {
  id: string;
  name: string;
  price_coins: number;
  benefits: string[];
  color_hex: string;
  icon_name: string;
  sla_uptime_guarantee_pct?: number;
  sla_quality_guarantee?: string;
  sla_chat_priority?: string;
  sla_support_response_secs?: number;
  sla_features?: string[];
}

interface SubscriptionTierSelectorProps {
  broadcasterId: string;
  broadcasterUsername: string;
  onClose: () => void;
  onSelect: (tierId: string) => void;
}

const iconMap: Record<string, any> = {
  Heart,
  Crown,
  Gem,
  Star,
  Zap,
};

const SubscriptionTierSelector: React.FC<SubscriptionTierSelectorProps> = ({
  broadcasterId,
  broadcasterUsername,
  onClose,
  onSelect
}) => {
  const { user, profile } = useAuthStore();
  const [tiers, setTiers] = useState<SubscriptionTier[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTier, setSelectedTier] = useState<string | null>(null);
  const [subscribing, setSubscribing] = useState(false);

  useEffect(() => {
    fetchTiers();
  }, []);

  const fetchTiers = async () => {
    try {
      const { data } = await supabase
        .from('subscription_tiers')
        .select(`
          *,
          sla_uptime_guarantee_pct,
          sla_quality_guarantee,
          sla_chat_priority,
          sla_support_response_secs,
          sla_features
        `)
        .eq('is_active', true)
        .order('sort_order', { ascending: true });
      
      setTiers(data || []);
      if (data && data.length > 0) {
        setSelectedTier(data[0].id);
      }
    } catch (error) {
      console.error('Error fetching tiers:', error);
      setTiers([]);
    } finally {
      setLoading(false);
    }
  };

  const isSelfSubscription = user?.id === broadcasterId;

  const handleSubscribe = async () => {
    if (!selectedTier || !user) return;

    if (isSelfSubscription) {
      toast.error('You cannot subscribe to yourself');
      return;
    }

    const tier = tiers.find(t => t.id === selectedTier);
    if (!tier) return;

    const userCoins = profile?.troll_coins || 0;
    if (userCoins < tier.price_coins) {
      toast.error(`Insufficient coins. You need ${tier.price_coins} but have ${userCoins.toLocaleString()}`);
      return;
    }

    setSubscribing(true);
    try {
      const { data, error } = await supabase.rpc('create_subscription', {
        p_broadcaster_id: broadcasterId,
        p_tier_id: selectedTier,
        p_auto_renew: true
      });

      if (error || !data?.success) {
        throw new Error(data?.error || error?.message || 'Subscription failed');
      }

      toast.success(`Subscribed to ${broadcasterUsername} at ${tier.name} tier!`);
      onSelect(selectedTier);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSubscribing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full max-h-[85vh] overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-white">
            Subscribe to {broadcasterUsername}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-2xl leading-none">×</button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
          </div>
        ) : tiers.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            No subscription tiers available at this time.
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {tiers.map((tier) => {
              const Icon = iconMap[tier.icon_name] || Heart;
              const isSelected = selectedTier === tier.id;
              const canAfford = (profile?.troll_coins || 0) >= tier.price_coins;
              
              return (
                <div
                  key={tier.id}
                  onClick={() => canAfford && setSelectedTier(tier.id)}
                  className={`
                    w-full p-4 rounded-xl border-2 cursor-pointer transition-all relative
                    ${isSelected 
                      ? 'border-cyan-500 bg-cyan-500/20 ring-2 ring-cyan-500/50' 
                      : 'border-slate-700 hover:border-slate-600'
                    }
                    ${!canAfford ? 'opacity-50 cursor-not-allowed' : ''}
                  `}
                >
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div 
                          className="p-2.5 rounded-lg"
                          style={{ backgroundColor: tier.color_hex + '30' }}
                        >
                          <Icon className="w-7 h-7" style={{ color: tier.color_hex }} />
                        </div>
                        <div>
                          <h3 className="font-bold text-white text-lg">{tier.name}</h3>
                          <p className="text-2xl font-bold" style={{ color: tier.color_hex }}>
                            {tier.price_coins.toLocaleString()}
                            <span className="text-sm text-slate-400 font-normal">/mo</span>
                          </p>
                        </div>
                      </div>
                      {isSelected && (
                        <Check className="w-6 h-6 text-cyan-500" />
                      )}
                    </div>
                    
                    <ul className="space-y-1.5 pl-1">
                      {tier.benefits.map((benefit, idx) => (
                        <li key={idx} className="text-sm text-slate-300 flex items-center gap-2">
                          <Check className="w-3 h-3 text-green-400 flex-shrink-0" />
                          {benefit}
                        </li>
                      ))}
                    </ul>

                    {!canAfford && (
                      <p className="text-xs text-yellow-400">
                        Insufficient coins. Current: {(profile?.troll_coins || 0).toLocaleString()}
                      </p>
                    )}

                    {tier.sla_uptime_guarantee_pct !== undefined && (
                      <SlaGuaranteesCard
                        tierName={tier.name}
                        uptimeGuarantee={tier.sla_uptime_guarantee_pct ?? 99.0}
                        qualityGuarantee={tier.sla_quality_guarantee ?? '720p'}
                        chatPriority={(tier.sla_chat_priority as 'standard' | 'priority' | 'vip_only') ?? 'standard'}
                        supportResponseSecs={tier.sla_support_response_secs ?? 3600}
                        features={tier.sla_features ?? []}
                        className="mt-2"
                      />
                    )}
                  </div>
                </div>
              );
            })}

            <div className="flex flex-col gap-2 mt-6 pt-4 border-t border-slate-700">
              <button
                onClick={handleSubscribe}
                disabled={!selectedTier || subscribing}
                className="w-full px-4 py-3 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-700 disabled:text-slate-500 text-white font-semibold transition-colors"
              >
                {subscribing ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Subscribe'}
              </button>
              <button
                onClick={onClose}
                className="w-full px-4 py-2 rounded-lg bg-slate-800 text-white hover:bg-slate-700 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SubscriptionTierSelector;
