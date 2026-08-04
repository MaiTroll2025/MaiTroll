import React, { useEffect, useState, useRef } from 'react';
import { Rarity } from '../useTrollEngine';
import { playSoundBuffer } from '../soundUtils';

interface TrollCourtSummonsProps {
  rarity: Rarity;
}

const TrollCourtSummons: React.FC<TrollCourtSummonsProps> = ({ rarity }) => {
  const [isAnimating, setIsAnimating] = useState<boolean>(false);
  const [showDetails, setShowDetails] = useState<boolean>(false);
  const hasPlayedRef = useRef(false);

  useEffect(() => {
    // Start animation after a short delay
    const timer = setTimeout(() => {
      setIsAnimating(true);
      // Play dramatic sound on reveal
      if (!hasPlayedRef.current) {
        hasPlayedRef.current = true;
        playSoundBuffer('/sounds/entrance/royal_fanfare.mp3', 0.6);
      }
    }, 100);

    // Show details after a delay
    const detailsTimer = setTimeout(() => {
      setShowDetails(true);
    }, 800);

    return () => {
      clearTimeout(timer);
      clearTimeout(detailsTimer);
    };
  }, []);

  return (
    <div className="fixed top-0 left-0 w-full h-full bg-black z-[1001] flex items-center justify-center">
      <div 
        className={`max-w-2xl w-full bg-black rounded-lg border-4 p-8 text-center transition-all duration-500 ${
          isAnimating ? 'opacity-100 scale-100' : 'opacity-0 scale-50'
        } ${
          rarity === 'COMMON' ? 'border-blue-500' :
          rarity === 'RARE' ? 'border-purple-500' :
          rarity === 'EPIC' ? 'border-pink-500' : 'border-yellow-500'
        }`}
      >
        {/* Court seal */}
        <div className="mb-6">
          <div className={`w-24 h-24 rounded-full bg-yellow-600 flex items-center justify-center mx-auto mb-4 ${
            rarity === 'LEGENDARY' ? 'animate-pulse' : ''
          }`}>
            <svg className="w-12 h-12 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className={`text-3xl font-bold mb-2 ${
            rarity === 'COMMON' ? 'text-blue-400' :
            rarity === 'RARE' ? 'text-purple-400' :
            rarity === 'EPIC' ? 'text-pink-400' : 'text-yellow-400'
          }`}>
            TROLL COURT
          </h1>
          <p className="text-gray-400 text-sm">In the matter of the City of Trolls</p>
        </div>

        {/* Summons message */}
        <div className={`mb-6 transition-opacity duration-500 ${
          showDetails ? 'opacity-100' : 'opacity-0'
        }`}>
          <h2 className="text-xl font-semibold mb-2 text-white">SUMMONS TO APPEAR</h2>
          <p className="text-gray-300 mb-4">You have been summoned to appear before the Troll Court</p>
          <div className="bg-gray-800 rounded p-4 mb-4 text-left">
            <p className="text-sm mb-2"><span className="font-semibold">Case No:</span> TC-{Date.now().toString().slice(-6)}</p>
            <p className="text-sm mb-2"><span className="font-semibold">Date:</span> {new Date().toLocaleDateString()}</p>
            <p className="text-sm"><span className="font-semibold">Time:</span> {new Date().toLocaleTimeString()}</p>
          </div>
          <p className="text-red-400 text-sm mb-4">
            FAILURE TO APPEAR MAY RESULT IN TROLL PRISON!
          </p>
          <p className="text-gray-400 text-sm">
            You are hereby ordered to appear before the court to face charges of<br />
            <span className="font-semibold text-yellow-400">Being too predictable</span>
          </p>
        </div>

        {/* Court action buttons */}
        <div className={`flex justify-center space-x-4 transition-opacity duration-500 ${
          showDetails ? 'opacity-100' : 'opacity-0'
        }`}>
          <button className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-lg transition-colors border-2 border-red-400">
            Plead Guilty
          </button>
          <button className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg transition-colors border-2 border-blue-400">
            Plead Not Guilty
          </button>
          <button className="bg-gray-700 hover:bg-gray-800 text-white px-6 py-2 rounded-lg transition-colors border-2 border-gray-400">
            Request Lawyer
          </button>
        </div>

        {/* Legendary court seal animation */}
        {rarity === 'LEGENDARY' && (
          <div className="mt-8">
            <p className="text-yellow-400 text-sm mb-2">COURT ANNOUNCEMENT</p>
            <div className="bg-yellow-900 bg-opacity-20 rounded p-4">
              <p className="text-yellow-300 text-sm">
                The Troll King has personally reviewed your case. This trial will be broadcast to all of Mai Troll!
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TrollCourtSummons;
