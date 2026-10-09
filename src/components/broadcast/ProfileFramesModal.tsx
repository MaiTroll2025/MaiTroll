import { useState, useEffect, useCallback } from 'react';
import { X, ShoppingCart } from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '@/lib/store';
import { useProfileFrameStore } from '@/stores/useProfileFrameStore';
import type { ProfileFrame } from '@/config/profileFrames';

interface ProfileFramesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ProfileFramesModal({ isOpen, onClose }: ProfileFramesModalProps) {
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [purchasingFrameId, setPurchasingFrameId] = useState<string | null>(null);
  
  const {
    catalog: profileFrames,
    ownedFrames,
    equipFrame,
    purchaseFrame,
    loadCatalog,
    loadUserFrames,
    equippedFrameId,
  } = useProfileFrameStore();

  const broadcastFrames = profileFrames.filter(f => f.frameType === 'broadcast');
  const ownedFrameIds = ownedFrames.map(f => f.frame_id);
  const isFrameOwned = (frameId: string) => ownedFrameIds.includes(frameId);
  const isFrameEquipped = (frameId: string) => equippedFrameId === frameId;

  useEffect(() => {
    if (isOpen && user?.id) {
      setLoading(true);
      loadCatalog().finally(() => setLoading(false));
      loadUserFrames(user.id);
    }
  }, [isOpen, user?.id, loadCatalog, loadUserFrames]);

  const handlePurchaseAndEquip = useCallback(async (frame: ProfileFrame) => {
    if (!user?.id) {
      toast.error('Sign in to purchase frames');
      return;
    }

    setPurchasingFrameId(frame.id);
    
    const purchased = await purchaseFrame(frame.id);
    if (purchased) {
      const equipped = await equipFrame(frame.id);
      if (equipped) {
        toast.success(`${frame.name} purchased and equipped!`);
      }
    } else {
      toast.error(`Failed to purchase ${frame.name}`);
    }
    
    setPurchasingFrameId(null);
  }, [user?.id, purchaseFrame, equipFrame]);

  const handleEquip = useCallback(async (frameId: string) => {
    if (!user?.id) return;
    
    const success = await equipFrame(frameId);
    if (success) {
      toast.success('Frame equipped!');
    } else {
      toast.error('Failed to equip frame');
    }
  }, [user?.id, equipFrame]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-2xl bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-zinc-800">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-cyan-400" />
            Profile Frames
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-zinc-800 rounded-full transition-colors text-zinc-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="text-center py-8 text-zinc-400">Loading frames...</div>
          ) : broadcastFrames.length === 0 ? (
            <div className="text-center py-8 text-zinc-400">No broadcast frames available</div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {broadcastFrames.map((frame) => {
                const owned = isFrameOwned(frame.id);
                const equipped = isFrameEquipped(frame.id);
                const isPurchasing = purchasingFrameId === frame.id;

                return (
                  <div
                    key={frame.id}
                    className={`relative p-4 rounded-lg border transition-all ${
                      equipped
                        ? 'border-cyan-500/50 bg-cyan-500/10'
                        : owned
                        ? 'border-white/10 bg-white/5 hover:bg-white/10'
                        : 'border-zinc-700 bg-zinc-800/50 hover:bg-zinc-800'
                    }`}
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <span className="text-2xl">{frame.icon}</span>
                      <div>
                        <h3 className="font-bold text-white">{frame.name}</h3>
                        <p className="text-xs text-zinc-400">{frame.description}</p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-xs text-cyan-300 font-medium">
                        {owned ? 'Owned' : `${frame.coinCost} 🪙`}
                      </span>

                      {equipped ? (
                        <span className="text-xs text-cyan-400 font-bold">EQUIPPED</span>
                      ) : owned ? (
                        <button
                          onClick={() => handleEquip(frame.id)}
                          className="px-3 py-1 text-xs font-bold bg-cyan-500/20 text-cyan-300 rounded-full hover:bg-cyan-500/30 transition-colors"
                        >
                          Equip
                        </button>
                      ) : (
                        <button
                          onClick={() => handlePurchaseAndEquip(frame)}
                          disabled={isPurchasing}
                          className="px-3 py-1 text-xs font-bold bg-purple-500/20 text-purple-300 rounded-full hover:bg-purple-500/30 transition-colors disabled:opacity-50"
                        >
                          {isPurchasing ? 'Processing...' : 'Buy'}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg text-xs text-blue-200 text-center">
            Broadcast frames decorate your stream border. Each costs 500 Troll Coins and shows around your entire broadcast layout.
          </div>
        </div>
      </div>
    </div>
  );
}