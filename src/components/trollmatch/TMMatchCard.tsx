import { useState } from 'react';
import { motion } from 'framer-motion';
import { MessageCircle, UserPlus, Heart, Eye, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { TMMatch } from '../../types/trollMatch';
import { useAuthStore } from '../../lib/store';
import { useTMMessagePricing, useTMRecordView, useTMFamilyInvites } from '../../hooks/useTrollMatch';
import { toast } from 'sonner';
import { supabase } from '../../lib/supabase';

interface TMMatchCardProps {
  match: TMMatch;
  type: 'friends' | 'dating';
  onMessage?: (userId: string, price: number) => void;
}

interface FamilyOption {
  id: string;
  name: string;
  role: string | null;
}

export function TMMatchCard({ match, type, onMessage }: TMMatchCardProps) {
  const navigate = useNavigate();
  const { user, profile } = useAuthStore();
  const { pricing, loading: _pricingLoading } = useTMMessagePricing(match.user_id);
  const { recordView } = useTMRecordView();
  const { createInvite } = useTMFamilyInvites();

  const [showPricingModal, setShowPricingModal] = useState(false);
  const [messageText, setMessageText] = useState('');
  const [sending, setSending] = useState(false);
  const [showFamilyModal, setShowFamilyModal] = useState(false);
  const [families, setFamilies] = useState<FamilyOption[]>([]);
  const [loadingFamilies, setLoadingFamilies] = useState(false);
  const [invitingFamilyId, setInvitingFamilyId] = useState<string | null>(null);

  const handleViewProfile = async () => {
    // Record the view
    await recordView(match.user_id);
    navigate(`/profile/${match.username}`);
  };

  const handleMessage = () => {
    if (!user || !profile) {
      toast.error('Please log in to send messages');
      return;
    }

    // If there's a price, show the confirmation modal
    if (pricing && pricing.price > 0) {
      setShowPricingModal(true);
    } else {
      // Free message - navigate to Utromail
      onMessage?.(match.user_id, 0);
    }
  };

  const handleSendPaidMessage = async () => {
    if (!messageText.trim()) {
      toast.error('Please enter a message');
      return;
    }

    if (!profile || profile.troll_coins < pricing!.price) {
      toast.error('Insufficient coins');
      navigate('/coins');
      return;
    }

    setSending(true);
    try {
      onMessage?.(match.user_id, pricing!.price);
      setShowPricingModal(false);
      setMessageText('');
    } catch (err: any) {
      toast.error(err.message || 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const handleInviteToFamily = async () => {
    if (!user) {
      toast.error('Please log in to invite to family');
      return;
    }

    setLoadingFamilies(true);
    try {
      const { data, error } = await supabase
        .from('troll_families')
        .select('id, name')
        .eq('leader_id', user.id);

      if (error) throw error;

      const userFamilies = (data || []).map((f: any) => ({
        id: f.id,
        name: f.name,
        role: 'leader' as const,
      }));

      if (userFamilies.length === 0) {
        toast.error('You need to lead a family to invite members');
        return;
      }

      setFamilies(userFamilies);
      setShowFamilyModal(true);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load families');
    } finally {
      setLoadingFamilies(false);
    }
  };

  const handleSelectFamily = async (familyId: string) => {
    setInvitingFamilyId(familyId);
    try {
      await createInvite(match.user_id, familyId);
      toast.success(`Invited @${match.username} to your family!`);
      setShowFamilyModal(false);
    } catch (err: any) {
      toast.error(err.message || 'Failed to send invite');
    } finally {
      setInvitingFamilyId(null);
    }
  };

  const _handleFollow = () => {
    toast.success(`Followed @${match.username}`);
  };

  const isOnline = match.is_online;
  const price = pricing?.price || 0;

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        whileHover={{ y: -2 }}
        className="relative bg-slate-800/80 backdrop-blur-sm rounded-2xl border border-purple-500/20 overflow-hidden group"
      >
        {/* Online Indicator */}
        {isOnline && (
          <div className="absolute top-2 right-2 z-10">
            <div className="w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse shadow-lg shadow-green-500/50" />
          </div>
        )}

        {/* Avatar */}
        <div 
          className="relative bg-gradient-to-br from-purple-900/50 to-pink-900/50 cursor-pointer"
          onClick={handleViewProfile}
        >
          {match.avatar_url ? (
            <img 
              src={match.avatar_url} 
              alt={match.username}
              className="w-full aspect-square object-cover"
            />
          ) : (
            <div className="w-full aspect-square flex items-center justify-center">
              <div className="w-16 h-16 rounded-full bg-slate-700 flex items-center justify-center">
                <span className="text-2xl font-bold text-slate-400">
                  {match.username.charAt(0).toUpperCase()}
                </span>
              </div>
            </div>
          )}

          {/* Glow effect for online users */}
          {isOnline && (
            <div className="absolute inset-0 bg-gradient-to-t from-green-500/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          )}
        </div>

        {/* Content */}
        <div className="p-2">
          {/* Username */}
          <h3 
            className="font-bold text-white text-sm truncate cursor-pointer hover:text-purple-400 transition-colors"
            onClick={handleViewProfile}
          >
            @{match.username}
          </h3>

          {/* Match Score */}
          {match.match_score > 0 && (
            <div className="flex items-center gap-1 mt-1">
              <span className="text-[10px] text-purple-400 font-medium">
                {match.match_score}% Match
              </span>
              <div className="flex gap-0.5">
                {[...Array(5)].map((_, i) => (
                  <div 
                    key={i}
                    className={`w-1 h-1 rounded-full ${
                      i < Math.ceil(match.match_score / 20) 
                        ? 'bg-purple-500' 
                        : 'bg-slate-700'
                    }`}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Shared Interests */}
          {match.shared_interests && match.shared_interests.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {match.shared_interests.slice(0, 2).map((interest) => (
                <span 
                  key={interest}
                  className="px-1.5 py-0.5 text-[10px] font-medium bg-purple-500/20 text-purple-300 rounded-full"
                >
                  {interest}
                </span>
              ))}
            </div>
          )}

          {/* Dating indicator */}
          {type === 'dating' && (
            <div className="flex items-center gap-1 mt-2 text-pink-400">
              <Heart className="w-3 h-3" />
              <span className="text-[10px] font-medium">Dating</span>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-1 mt-2">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleMessage}
              className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg bg-purple-500/20 text-purple-300 hover:bg-purple-500/30 transition-colors"
            >
              <MessageCircle className="w-3 h-3" />
              <span className="text-xs font-medium">
                {price > 0 ? `${price}` : 'Msg'}
              </span>
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleViewProfile}
              className="p-1.5 rounded-lg bg-slate-700/50 text-slate-300 hover:bg-slate-700 transition-colors"
              title="View Profile"
            >
              <Eye className="w-3 h-3" />
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleInviteToFamily}
              className="p-1.5 rounded-lg bg-slate-700/50 text-slate-300 hover:bg-slate-700 transition-colors"
              title="Invite to Family"
            >
              <UserPlus className="w-3 h-3" />
            </motion.button>
          </div>
        </div>
      </motion.div>

      {/* Pricing Modal */}
      {showPricingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-md bg-slate-800 rounded-2xl border border-purple-500/20 overflow-hidden"
          >
            <div className="p-6 bg-gradient-to-r from-purple-600 to-pink-600">
              <h3 className="text-xl font-bold text-white">Send Message</h3>
              <p className="text-purple-100 text-sm mt-1">
                This user charges {price} coins per message
              </p>
            </div>

            <div className="p-6">
              <textarea
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                placeholder="Write your message..."
                className="w-full h-32 px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-purple-500 resize-none"
              />

              <div className="flex items-center justify-between mt-4 p-3 bg-slate-700/50 rounded-xl">
                <span className="text-slate-300">Price:</span>
                <span className="text-xl font-bold text-white">{price} 💰</span>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowPricingModal(false)}
                  className="flex-1 px-4 py-3 rounded-xl font-bold text-slate-300 bg-slate-700 hover:bg-slate-600 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSendPaidMessage}
                  disabled={sending || !messageText.trim()}
                  className="flex-1 px-4 py-3 rounded-xl font-bold text-white bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 transition-all disabled:opacity-50"
                >
                  {sending ? 'Sending...' : `Send - ${price} Coins`}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Family Selector Modal */}
      {showFamilyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-md bg-slate-800 rounded-2xl border border-purple-500/20 overflow-hidden"
          >
            <div className="p-6 bg-gradient-to-r from-purple-600 to-pink-600">
              <h3 className="text-xl font-bold text-white">Invite to Family</h3>
              <p className="text-purple-100 text-sm mt-1">
                Select a family to invite @{match.username}
              </p>
            </div>

            <div className="p-4 space-y-2 max-h-80 overflow-y-auto">
              {loadingFamilies ? (
                <div className="text-center text-slate-400 py-4">Loading families...</div>
              ) : families.length === 0 ? (
                <div className="text-center text-slate-400 py-4">No families found</div>
              ) : (
                families.map((family) => (
                  <button
                    key={family.id}
                    onClick={() => handleSelectFamily(family.id)}
                    disabled={invitingFamilyId === family.id}
                    className="w-full flex items-center gap-3 p-3 rounded-xl bg-slate-700/50 hover:bg-slate-700 transition-colors text-left disabled:opacity-50"
                  >
                    <Users className="w-5 h-5 text-purple-400" />
                    <div>
                      <div className="font-bold text-white">{family.name}</div>
                      <div className="text-xs text-slate-400 capitalize">{family.role}</div>
                    </div>
                    {invitingFamilyId === family.id && (
                      <div className="ml-auto text-xs text-slate-400">Inviting...</div>
                    )}
                  </button>
                ))
              )}
            </div>

            <div className="p-4 border-t border-slate-700">
              <button
                onClick={() => setShowFamilyModal(false)}
                className="w-full px-4 py-2 rounded-xl font-bold text-slate-300 bg-slate-700 hover:bg-slate-600 transition-colors"
              >
                Cancel
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </>
  );
}

export default TMMatchCard;
