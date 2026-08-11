import { useState, useEffect, useCallback, useRef } from 'react';
import { X, ShoppingCart, Coins } from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '@/lib/store';
import { useProfileFrameStore } from '@/stores/useProfileFrameStore';
import type { ProfileFrame } from '@/config/profileFrames';
import { COIN_PACKAGES } from '@/config/coinConfig';
import PayPalPaymentModal from './PayPalPaymentModal'

  interface CoinPackage {
    id: string;
    coins: number;
    price: string;
    popular?: boolean;
  }

interface CoinStoreModalProps {
  isOpen: boolean;
  onClose: () => void;
  embedded?: boolean;
  allowCardPayment?: boolean;
}

export default function CoinStoreModal({ isOpen, onClose, embedded = false, allowCardPayment = true }: CoinStoreModalProps) {
  const { user, profile } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'coins' | 'frames'>('coins');
  const [selectedPack, setSelectedPack] = useState<CoinPackage | null>(null);
  const [packages, setPackages] = useState<CoinPackage[]>([]);
  const [loading, setLoading] = useState(true);
   
  // Profile frame store
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
  const [purchasingFrameId, setPurchasingFrameId] = useState<string | null>(null);
  
  const [showPayPalPayment, setShowPayPalPayment] = useState(false);
  const [showCardPayment, setShowCardPayment] = useState(false);
  const paymentInProgressRef = useRef(false);

   const fetchCoinPacks = async () => {
      setLoading(true);
      
     const basePacks: CoinPackage[] = COIN_PACKAGES.map((pkg) => ({
       id: pkg.id,
       coins: pkg.coins,
       price: `$${pkg.usdPrice.toFixed(2)}`,
       popular: pkg.id === 'pkg-1000',
     }));
     setPackages(basePacks);
     setLoading(false);
   };

  useEffect(() => {
    if (isOpen && !user?.id) {
      toast.error('Sign in to use the coin store.')
      onClose()
      return
    }

    if (isOpen) {
      fetchCoinPacks();
      loadCatalog();
      loadUserFrames(user?.id);
      // Reset state when opening
      setSelectedPack(null);
      setShowPayPalPayment(false);
    }
  }, [isOpen, onClose, user?.id, loadCatalog, loadUserFrames]);

    const handlePackageSelect = (pkg: CoinPackage) => {
      if (!user?.id) {
        toast.error('Sign in to use the coin store.')
        return
      }

      const pkgWithTax = {
        ...pkg,
        price: pkg.price,
        purchaseType: 'coins',
        metadata: { source: 'broadcast_quick_store' },
      };
      setSelectedPack(pkgWithTax);
      paymentInProgressRef.current = true;
      setShowPayPalPayment(true);
    };

    const handleCardCheckout = (pkg: CoinPackage) => {
      if (!allowCardPayment) {
        return;
      }

      if (!user?.id) {
        toast.error('Sign in to use the coin store.')
        return
      }

      const pkgWithTax: any = {
        ...pkg,
        price: pkg.price,
        purchaseType: 'coins',
        metadata: { source: 'broadcast_quick_store' },
        forceCard: true,
      };
      setSelectedPack(pkgWithTax);
      setShowCardPayment(true);
    };

    // Helper to calculate final price
    const getFinalPrice = (price: string) => {
      const numPrice = parseFloat(price.replace('$', ''));
      if (isNaN(numPrice)) return 0;
      return numPrice;
    };
  
  const handlePaymentSuccess = (data: any) => {
    paymentInProgressRef.current = false;
    toast.success(`Successfully purchased ${selectedPack?.coins.toLocaleString()} coins!`);
    setShowPayPalPayment(false);
    setShowCardPayment(false);
    setSelectedPack(null);
  };

  const handleSafeClose = () => {
    if (paymentInProgressRef.current) {
      toast.info('Please wait for the payment to complete.');
      return;
    }
    onClose();
  };

  const handleFramePurchaseAndEquip = useCallback(async (frame: ProfileFrame) => {
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
      toast.error(`Insufficient coins to purchase ${frame.name}`);
    }
    setPurchasingFrameId(null);
  }, [user?.id, purchaseFrame, equipFrame]);

  const handleFrameEquip = useCallback(async (frameId: string) => {
    if (!user?.id) return;

    const success = await equipFrame(frameId);
    if (success) {
      toast.success('Frame equipped!');
    } else {
      toast.error('Failed to equip frame');
    }
  }, [user?.id, equipFrame]);

  if (!isOpen || !user?.id) return null;

  return (
    <>
      <div
        className={embedded ? "h-full w-full" : "fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200"}
        onClick={!embedded ? handleSafeClose : undefined}
      >
        <div
          className={embedded ? "relative h-full w-full bg-zinc-900 overflow-hidden" : "relative w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"}
          onClick={(e) => e.stopPropagation()}
        >
{/* Header */}
           <div className="flex items-center justify-between p-4 border-b border-zinc-800 bg-zinc-900/50">
             <h2 className="text-xl font-bold text-white flex items-center gap-2">
               <Coins className="w-5 h-5 text-yellow-400" />
               Coin Store
             </h2>
             <button
               onClick={handleSafeClose}
               disabled={paymentInProgressRef.current}
               className="p-2 hover:bg-zinc-800 rounded-full transition-colors text-zinc-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
               title={paymentInProgressRef.current ? 'Payment in progress' : 'Close'}
             >
               <X className="w-5 h-5" />
             </button>
           </div>

           {/* Tab Navigation */}
           <div className="flex border-b border-zinc-800 bg-zinc-900/30">
             <button
               onClick={() => setActiveTab('coins')}
               className={`flex-1 py-3 text-sm font-bold transition-colors ${
                 activeTab === 'coins'
                   ? 'text-yellow-400 border-b-2 border-yellow-400'
                   : 'text-zinc-400 hover:text-white'
               }`}
             >
               Coins
             </button>
             <button
               onClick={() => setActiveTab('frames')}
               className={`flex-1 py-3 text-sm font-bold transition-colors ${
                 activeTab === 'frames'
                   ? 'text-cyan-400 border-b-2 border-cyan-400'
                   : 'text-zinc-400 hover:text-white'
               }`}
             >
               Broadcast Frames
             </button>
           </div>

          {/* Content */}
           <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
             {activeTab === 'coins' ? (
               <>
                 {loading ? (
                   <div className="text-center py-8 text-zinc-400">Loading packs...</div>
                 ) : (
                   <div className="grid grid-cols-1 gap-3">
                     {packages.map((pkg) => (
                        <button
                          key={pkg.id}
                          onClick={() => handlePackageSelect(pkg)}
                          className={`group relative flex items-center justify-between p-4 rounded-lg border transition-all duration-200
                            ${selectedPack?.id === pkg.id 
                              ? 'bg-yellow-500/10 border-yellow-500/50' 
                              : 'bg-zinc-800/50 border-zinc-700 hover:bg-zinc-800 hover:border-zinc-600'
                            }
                          `}
                        >
                          {pkg.popular && (
                            <div className="absolute -top-2 left-1/2 -translate-x-1/2 bg-yellow-500 text-black text-[10px] font-bold px-2 py-0.5 rounded-full shadow-lg">
                              BEST VALUE
                            </div>
                          )}
                          
                          <div className="absolute -top-2 right-4 bg-emerald-500 text-black text-[10px] font-bold px-2 py-0.5 rounded-full shadow-lg">
                            +10%
                          </div>
                          
                          <div className="flex items-center gap-3">
                           <div className={`p-2 rounded-full ${selectedPack?.id === pkg.id ? 'bg-yellow-500/20' : 'bg-zinc-700'}`}>
                             <Coins className={`w-5 h-5 ${selectedPack?.id === pkg.id ? 'text-yellow-400' : 'text-zinc-400 group-hover:text-yellow-400'}`} />
                           </div>
                           <div className="text-left">
                               <div className="text-zinc-500 text-sm line-through">{Math.round(pkg.coins / 1.1).toLocaleString()} Coins</div>
                               <div className="flex items-center gap-2">
                                 <span className="font-bold text-white text-lg">{pkg.coins.toLocaleString()} Coins</span>
                                 <span className="text-[10px] font-bold bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded">+10%</span>
                               </div>
                             </div>
                         </div>

                         <div className="flex flex-col items-end gap-1">
                           <span className="font-bold bg-zinc-950 px-3 py-1 rounded-md border border-zinc-800 text-white">
                             {getFinalPrice(pkg.price)}
                           </span>
                                           <div className="mt-2 flex gap-2">
                           <button
                             onClick={(e) => { e.stopPropagation(); handlePackageSelect(pkg); }}
                             className="px-3 py-1 bg-cyan-600 text-black font-bold rounded-md text-sm"
                           >
                             PayPal
                           </button>
                           {allowCardPayment && (
                             <button
                               onClick={(e) => { e.stopPropagation(); handleCardCheckout(pkg); }}
                               className="px-3 py-1 bg-zinc-800 text-white rounded-md text-sm border border-zinc-700"
                             >
                               Credit Card
                             </button>
                           )}
                         </div>
                       </div>
                     </button>
                   ))}
                 </div>
                 )}
                 
                 <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg text-xs text-blue-200 text-center">
                   Secure payments processed via PayPal. Broadcast quick-store packs include 10% extra coins.
                 </div>
               </>
             ) : (
               <>
                 {broadcastFrames.length === 0 ? (
                   <div className="text-center py-8 text-zinc-400">Loading frames...</div>
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
                                 onClick={() => handleFrameEquip(frame.id)}
                                 className="px-3 py-1 text-xs font-bold bg-cyan-500/20 text-cyan-300 rounded-full hover:bg-cyan-500/30 transition-colors"
                               >
                                 Equip
                               </button>
                             ) : (
                               <button
                                 onClick={() => handleFramePurchaseAndEquip(frame)}
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
                 
                 <div className="mt-4 p-3 bg-cyan-500/10 border border-cyan-500/20 rounded-lg text-xs text-cyan-200 text-center">
                   Broadcast frames decorate your stream border. Each costs 500 Troll Coins and shows around your entire broadcast layout.
                 </div>
               </>
             )}
           </div>
         </div>
       </div>

        <PayPalPaymentModal
         isOpen={showPayPalPayment || showCardPayment}
         onClose={() => {
           paymentInProgressRef.current = false;
           setShowPayPalPayment(false);
           setShowCardPayment(false);
           setSelectedPack(null);
         }}
         pkg={selectedPack}
         userId={user?.id || ''}
         profile={profile}
         onPaymentSuccess={handlePaymentSuccess}
         onSaveCard={true}
       />
    </>
  );
}
