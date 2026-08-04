import { useState } from 'react';
import { usePresidentSystem, PresidentCandidate } from '@/hooks/usePresidentSystem';
import { Coins, Vote, Crown } from 'lucide-react';

export default function PresidentialCampaignGrid() {
  const { currentElection, voteForCandidate, voteWithCoins, loading } = usePresidentSystem();
  const [selectedCandidate, setSelectedCandidate] = useState<PresidentCandidate | null>(null);
  const [coinAmount, setCoinAmount] = useState<number>(100);
  const [isVoteModalOpen, setIsVoteModalOpen] = useState(false);

  if (!currentElection || currentElection.status !== 'open') return null;

  // Filter approved candidates and sort by score
  const candidates = currentElection.candidates
    ?.filter(c => c.is_approved)
    .sort((a, b) => (b.score || 0) - (a.score || 0)) || [];

  if (candidates.length === 0) return null;

  const handleVoteClick = (candidate: PresidentCandidate) => {
    if (currentElection.voting_strategy === 'coins') {
      setSelectedCandidate(candidate);
      setIsVoteModalOpen(true);
    } else {
      voteForCandidate(candidate.id);
    }
  };

  const handleCoinVote = async () => {
    if (!selectedCandidate) return;
    await voteWithCoins(selectedCandidate.id, coinAmount);
    setIsVoteModalOpen(false);
    setSelectedCandidate(null);
  };

  return (
    <div className="w-full mb-12 animate-fade-in-up">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold mb-2 bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-600 bg-clip-text text-transparent flex items-center justify-center gap-2">
          <Crown className="w-8 h-8 text-amber-500" />
          Presidential Election Live
        </h2>
        <p className="text-slate-400">
          {currentElection.voting_strategy === 'coins' 
            ? "Vote with your Coins! The wealthiest backers decide the future."
            : "Cast your vote for the next President of Mai Troll."}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {candidates.map((candidate, index) => (
          <div 
            key={candidate.id}
            className="relative group bg-slate-900/50 backdrop-blur-md rounded-2xl border border-amber-500/20 hover:border-amber-400/50 transition-all duration-300 overflow-hidden"
          >
            {/* Rank Badge */}
            <div className="absolute top-3 left-3 z-10 bg-black/60 backdrop-blur-md px-3 py-1 rounded-full border border-amber-500/30 text-amber-400 font-bold text-sm">
              #{index + 1}
            </div>

            {/* Score Badge */}
            <div className="absolute top-3 right-3 z-10 bg-amber-500/90 backdrop-blur-md px-3 py-1 rounded-full text-black font-bold text-sm flex items-center gap-1">
              {currentElection.voting_strategy === 'coins' ? <Coins className="w-3 h-3" /> : <Vote className="w-3 h-3" />}
              {candidate.score || 0}
            </div>

            {/* Banner/Avatar Area */}
            <div className="h-32 bg-gradient-to-br from-slate-800 to-slate-900 relative">
               {/* Use avatar as banner fallback for now if no banner_path */}
               <div className="absolute inset-0 bg-cover bg-center opacity-50" style={{ backgroundImage: `url(${candidate.avatar_url})` }} />
               <div className="absolute -bottom-10 left-1/2 -translate-x-1/2">
                  <div className="w-20 h-20 rounded-full border-4 border-slate-900 bg-slate-800 overflow-hidden shadow-lg">
                    <img src={candidate.avatar_url || '/default-avatar.png'} alt={candidate.username} className="w-full h-full object-cover" />
                  </div>
               </div>
            </div>

            {/* Content */}
            <div className="pt-12 pb-6 px-4 text-center">
              <h3 className="text-xl font-bold text-white mb-1">{candidate.username}</h3>
              <p className="text-amber-200/80 text-sm mb-4 italic">&quot;{candidate.slogan || 'Vote for me!'}&quot;</p>
              
              <button
                onClick={() => handleVoteClick(candidate)}
                disabled={loading}
                className="w-full py-2 bg-gradient-to-r from-amber-600 to-yellow-600 text-black font-bold rounded-xl hover:shadow-[0_0_20px_rgba(245,158,11,0.4)] transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? 'Voting...' : (
                   <>
                     {currentElection.voting_strategy === 'coins' ? <Coins className="w-4 h-4" /> : <Vote className="w-4 h-4" />}
                     Vote Now
                   </>
                )}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Vote Modal */}
      {isVoteModalOpen && selectedCandidate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-amber-500/30 rounded-2xl p-6 max-w-md w-full shadow-2xl max-h-[calc(100vh-8rem)] overflow-y-auto">
            <h3 className="text-2xl font-bold text-white mb-4">Support {selectedCandidate.username}</h3>
            <p className="text-slate-400 mb-6">How many coins would you like to contribute? Each coin counts as one vote.</p>
            
            <div className="space-y-4 mb-6">
              <div className="flex justify-between gap-2">
                {[100, 500, 1000, 5000].map(amount => (
                  <button
                    key={amount}
                    onClick={() => setCoinAmount(amount)}
                    className={`flex-1 py-2 rounded-lg font-bold transition-all ${
                      coinAmount === amount 
                      ? 'bg-amber-500 text-black' 
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    {amount}
                  </button>
                ))}
              </div>
              <input
                type="number"
                value={coinAmount}
                onChange={(e) => setCoinAmount(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white focus:border-amber-500 focus:outline-none"
                placeholder="Custom Amount"
                min="1"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setIsVoteModalOpen(false)}
                className="flex-1 py-3 bg-slate-800 text-white rounded-xl font-bold hover:bg-slate-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCoinVote}
                disabled={loading || coinAmount < 1}
                className="flex-1 py-3 bg-gradient-to-r from-amber-600 to-yellow-600 text-black rounded-xl font-bold hover:shadow-[0_0_20px_rgba(245,158,11,0.4)] transition-all"
              >
                {loading ? 'Processing...' : `Vote (${coinAmount})`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
