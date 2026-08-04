import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Gavel, Users, Clock, Coins, Trophy, AlertCircle, CheckCircle, XCircle, MessageSquare, Bell, Shield } from 'lucide-react';

const mockAuctionShow = {
  id: '1',
  title: '🔥 Rare Collectibles Auction - Day 1',
  auctioneer: {
    id: '1',
    displayName: 'TrollCollector',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=trollcollector',
    verified: true,
  },
  category: 'Collectibles',
  viewerCount: 247,
  status: 'live',
  currentLot: {
    id: 'lot-1',
    title: 'Vintage 1985 Mai Troll Founder Edition Figure - Mint Condition',
    description: 'Original founder edition figure from the launch of Mai Troll. Includes original packaging and certificate of authenticity.',
    images: ['https://picsum.photos/seed/auction1/800/600'],
    startingBid: 5000,
    minIncrement: 100,
    currentHighestBid: 12500,
    currentHighestBidder: 'TrollKing99',
    status: 'live',
    endsAt: new Date(Date.now() + 45 * 1000).toISOString(),
    condition: 'Mint',
    shipping: 'Buyer pays shipping. Local pickup available.',
  },
  upcomingLots: [
    { id: 'lot-2', title: 'Limited Edition Gold Troll Crown', startingBid: 10000 },
    { id: 'lot-3', title: 'Antique Brass Telescope', startingBid: 2500 },
    { id: 'lot-4', title: 'Signed Memorabilia Bundle', startingBid: 8000 },
  ],
  recentBids: [
    { id: '1', bidder: 'TrollKing99', amount: 12500, time: '12 seconds ago' },
    { id: '2', bidder: 'CollectorPro', amount: 12000, time: '28 seconds ago' },
    { id: '3', bidder: 'RareHunter', amount: 11500, time: '45 seconds ago' },
    { id: '4', bidder: 'TrollKing99', amount: 11000, time: '1 minute ago' },
    { id: '5', bidder: 'VintageFan', amount: 10000, time: '2 minutes ago' },
  ],
};

const mockUser = {
  id: 'user-1',
  username: 'TestUser',
  coinBalance: 15000,
  isBlocked: false,
  isBiddingEligible: true,
};

const LiveAuctionPreview: React.FC = () => {
  const navigate = useNavigate();
  const [bidAmount, setBidAmount] = useState('');
  const [timeLeft, setTimeLeft] = useState(45);
  const [lastBid, setLastBid] = useState<{ amount: number; bidder: string } | null>(null);
  const [bidStatus, setBidStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [selectedTab, setSelectedTab] = useState<'bids' | 'info' | 'chat'>('bids');

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleBid = (amount: number) => {
    if (amount <= mockAuctionShow.currentLot.currentHighestBid + mockAuctionShow.currentLot.minIncrement) {
      setBidStatus('error');
      setTimeout(() => setBidStatus('idle'), 2000);
      return;
    }
    setLastBid({ amount, bidder: mockUser.username });
    setBidStatus('success');
    setTimeout(() => setBidStatus('idle'), 2000);
    setBidAmount('');
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <div className="bg-gradient-to-r from-green-900/80 to-emerald-900/80 border-b border-green-500/30">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate(-1)}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-green-400" />
              </button>
              <div className="flex items-center gap-2">
                <div className="px-2 py-1 bg-red-500 text-white text-xs font-bold rounded animate-pulse">
                  LIVE
                </div>
                <span className="text-green-400 font-bold">{mockAuctionShow.viewerCount} watching</span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button className="p-2 hover:bg-white/10 rounded-lg transition-colors">
                <Bell className="w-5 h-5 text-gray-400" />
              </button>
              <button className="p-2 hover:bg-white/10 rounded-lg transition-colors">
                <Shield className="w-5 h-5 text-gray-400" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-4">
          {/* Live Video Area */}
          <div className="relative aspect-video bg-gradient-to-br from-gray-900 to-gray-800 rounded-xl overflow-hidden border border-green-500/30">
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <Gavel className="w-16 h-16 text-green-500 mx-auto mb-4 animate-pulse" />
                <p className="text-green-400 text-lg font-bold">LiveKit Video Would Load Here</p>
                <p className="text-gray-500 text-sm">Auctioneer camera feed</p>
              </div>
            </div>
            {/* Live badge */}
            <div className="absolute top-4 left-4 flex items-center gap-2">
              <div className="px-3 py-1.5 bg-red-500 text-white text-sm font-bold rounded-lg flex items-center gap-2">
                <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
                LIVE
              </div>
              <div className="px-3 py-1.5 bg-black/70 text-white text-sm rounded-lg flex items-center gap-2">
                <Users className="w-4 h-4" />
                {mockAuctionShow.viewerCount}
              </div>
            </div>
            {/* Countdown */}
            <div className="absolute bottom-4 left-4">
              <div className={`px-4 py-2 rounded-lg text-2xl font-bold font-mono ${
                timeLeft <= 10 ? 'bg-red-500 text-white animate-pulse' : 'bg-black/70 text-green-400'
              }`}>
                <Clock className="w-5 h-5 inline mr-2" />
                {formatTime(timeLeft)}
              </div>
            </div>
          </div>

          {/* Current Lot Card */}
          <div className="bg-gradient-to-br from-green-900/20 to-emerald-900/10 rounded-xl border border-green-500/30 p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-green-400 text-sm font-medium">Current Lot</span>
              <span className="px-2 py-1 bg-green-500/20 text-green-400 text-xs rounded">Live</span>
            </div>
            <h2 className="text-xl font-bold text-white mb-2">{mockAuctionShow.currentLot.title}</h2>
            <p className="text-gray-400 text-sm mb-4 line-clamp-2">{mockAuctionShow.currentLot.description}</p>
            
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="bg-black/30 rounded-lg p-3">
                <p className="text-gray-500 text-xs mb-1">Condition</p>
                <p className="text-white font-medium">{mockAuctionShow.currentLot.condition}</p>
              </div>
              <div className="bg-black/30 rounded-lg p-3">
                <p className="text-gray-500 text-xs mb-1">Shipping</p>
                <p className="text-white text-sm">{mockAuctionShow.currentLot.shipping}</p>
              </div>
            </div>

            {/* Current Bid Display */}
            <div className="bg-gradient-to-r from-green-600/30 to-emerald-600/30 rounded-xl p-4 text-center border border-green-500/50">
              <p className="text-green-400 text-sm mb-1">Current Highest Bid</p>
              <div className="flex items-center justify-center gap-2">
                <Coins className="w-8 h-8 text-yellow-400" />
                <span className="text-4xl font-bold text-white">
                  {mockAuctionShow.currentLot.currentHighestBid.toLocaleString()}
                </span>
              </div>
              <p className="text-gray-400 text-sm mt-1">
                by {mockAuctionShow.currentLot.currentHighestBidder}
              </p>
            </div>
          </div>

          {/* Bid Controls */}
          <div className="bg-gray-900/80 rounded-xl border border-gray-700 p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <Coins className="w-6 h-6 text-yellow-400" />
                <span className="text-white font-medium">Your Balance: {mockUser.coinBalance.toLocaleString()} coins</span>
              </div>
              {mockUser.isBiddingEligible ? (
                <span className="flex items-center gap-1 text-green-400 text-sm">
                  <CheckCircle className="w-4 h-4" /> Eligible to bid
                </span>
              ) : (
                <span className="flex items-center gap-1 text-red-400 text-sm">
                  <XCircle className="w-4 h-4" /> Not eligible
                </span>
              )}
            </div>

            <div className="flex gap-3">
              <div className="flex-1 flex gap-2">
                {[500, 1000, 2500].map((amount) => (
                  <button
                    key={amount}
                    onClick={() => setBidAmount((mockAuctionShow.currentLot.currentHighestBid + amount).toString())}
                    className="flex-1 py-3 bg-gray-800 hover:bg-gray-700 border border-gray-600 rounded-lg text-white font-medium transition-colors"
                  >
                    +{amount.toLocaleString()}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-3 mt-3">
              <div className="flex-1 relative">
                <input
                  type="number"
                  value={bidAmount}
                  onChange={(e) => setBidAmount(e.target.value)}
                  placeholder={`Min: ${(mockAuctionShow.currentLot.currentHighestBid + mockAuctionShow.currentLot.minIncrement).toLocaleString()}`}
                  className="w-full py-3 px-4 bg-gray-800 border border-gray-600 rounded-lg text-white text-lg"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500">coins</span>
              </div>
              <button
                onClick={() => handleBid(parseInt(bidAmount) || 0)}
                disabled={!mockUser.isBiddingEligible || !bidAmount}
                className="px-8 py-3 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 disabled:from-gray-600 disabled:to-gray-700 text-white font-bold rounded-lg transition-all transform hover:scale-105 disabled:transform-none"
              >
                Place Bid
              </button>
            </div>

            {/* Bid Status */}
            {bidStatus === 'success' && (
              <div className="mt-3 p-3 bg-green-500/20 border border-green-500/50 rounded-lg flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-400" />
                <span className="text-green-400">Bid accepted!</span>
              </div>
            )}
            {bidStatus === 'error' && (
              <div className="mt-3 p-3 bg-red-500/20 border border-red-500/50 rounded-lg flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-red-400" />
                <span className="text-red-400">Bid too low! Minimum: {(mockAuctionShow.currentLot.currentHighestBid + mockAuctionShow.currentLot.minIncrement).toLocaleString()}</span>
              </div>
            )}
          </div>

          {/* Upcoming Lots */}
          <div className="bg-gray-900/80 rounded-xl border border-gray-700 p-4">
            <h3 className="text-lg font-bold text-white mb-3">Upcoming Lots</h3>
            <div className="space-y-2">
              {mockAuctionShow.upcomingLots.map((lot, index) => (
                <div key={lot.id} className="flex items-center justify-between p-3 bg-black/30 rounded-lg">
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 bg-gray-700 rounded flex items-center justify-center text-gray-400 text-sm">
                      {index + 2}
                    </span>
                    <span className="text-white">{lot.title}</span>
                  </div>
                  <span className="text-yellow-400 text-sm">Starting: {lot.startingBid.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Sidebar */}
        <div className="space-y-4">
          {/* Auction Info */}
          <div className="bg-gray-900/80 rounded-xl border border-gray-700 p-4">
            <h3 className="text-lg font-bold text-white mb-3">Auction Details</h3>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <img
                  src={mockAuctionShow.auctioneer.avatar}
                  alt={mockAuctionShow.auctioneer.displayName}
                  className="w-10 h-10 rounded-full"
                />
                <div>
                  <p className="text-white font-medium flex items-center gap-1">
                    {mockAuctionShow.auctioneer.displayName}
                    {mockAuctionShow.auctioneer.verified && (
                      <span className="w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
                        <CheckCircle className="w-3 h-3 text-white" />
                      </span>
                    )}
                  </p>
                  <p className="text-gray-500 text-xs">Auctioneer</p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-gray-400 text-sm">
                <Gavel className="w-4 h-4" />
                <span>{mockAuctionShow.category}</span>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="bg-gray-900/80 rounded-xl border border-gray-700 overflow-hidden">
            <div className="flex border-b border-gray-700">
              <button
                onClick={() => setSelectedTab('bids')}
                className={`flex-1 py-3 text-sm font-medium transition-colors ${
                  selectedTab === 'bids' ? 'text-green-400 border-b-2 border-green-400 bg-black/30' : 'text-gray-400 hover:text-white'
                }`}
              >
                Live Bids
              </button>
              <button
                onClick={() => setSelectedTab('info')}
                className={`flex-1 py-3 text-sm font-medium transition-colors ${
                  selectedTab === 'info' ? 'text-green-400 border-b-2 border-green-400 bg-black/30' : 'text-gray-400 hover:text-white'
                }`}
              >
                Info
              </button>
              <button
                onClick={() => setSelectedTab('chat')}
                className={`flex-1 py-3 text-sm font-medium transition-colors ${
                  selectedTab === 'chat' ? 'text-green-400 border-b-2 border-green-400 bg-black/30' : 'text-gray-400 hover:text-white'
                }`}
              >
                Chat
              </button>
            </div>

            {selectedTab === 'bids' && (
              <div className="p-3 max-h-80 overflow-y-auto space-y-2">
                {mockAuctionShow.recentBids.map((bid) => (
                  <div
                    key={bid.id}
                    className={`flex items-center justify-between p-2 rounded-lg ${
                      bid.bidder === mockAuctionShow.currentLot.currentHighestBidder
                        ? 'bg-green-500/20 border border-green-500/30'
                        : 'bg-black/30'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center text-white text-xs font-bold">
                        {bid.bidder.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-white text-sm font-medium">{bid.bidder}</p>
                        <p className="text-gray-500 text-xs">{bid.time}</p>
                      </div>
                    </div>
                    <span className={`font-bold ${
                      bid.bidder === mockAuctionShow.currentLot.currentHighestBidder ? 'text-green-400' : 'text-yellow-400'
                    }`}>
                      {bid.amount.toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {selectedTab === 'info' && (
              <div className="p-3 space-y-3">
                <div>
                  <p className="text-gray-500 text-xs">Minimum Increment</p>
                  <p className="text-white">{mockAuctionShow.currentLot.minIncrement.toLocaleString()} coins</p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs">Starting Bid</p>
                  <p className="text-white">{mockAuctionShow.currentLot.startingBid.toLocaleString()} coins</p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs">Total Bids</p>
                  <p className="text-white">{mockAuctionShow.recentBids.length}</p>
                </div>
              </div>
            )}

            {selectedTab === 'chat' && (
              <div className="p-3 h-80 flex items-center justify-center">
                <p className="text-gray-500 text-sm">Chat disabled during auction</p>
              </div>
            )}
          </div>

          {/* Report Button */}
          <button className="w-full py-3 bg-red-500/20 hover:bg-red-500/30 border border-red-500/50 text-red-400 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2">
            <AlertCircle className="w-4 h-4" />
            Report Issue
          </button>
        </div>
      </div>

      {/* Neon Glow Effect */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-0 w-64 h-64 bg-green-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-0 w-64 h-64 bg-green-500/5 rounded-full blur-3xl" />
      </div>
    </div>
  );
};

export default LiveAuctionPreview;