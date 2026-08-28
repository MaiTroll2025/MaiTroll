import React, { useEffect, useState, useRef } from 'react';
import { Rarity } from '../useTrollEngine';
import { playSoundBuffer } from '../soundUtils';

interface FakeBanScreenProps {
  rarity: Rarity;
}

const FakeBanScreen: React.FC<FakeBanScreenProps> = ({ rarity }) => {
  const [isTrolling, setIsTrolling] = useState<boolean>(true);
  const [isAnimating, setIsAnimating] = useState<boolean>(false);
  const hasPlayedRef = useRef(false);

  useEffect(() => {
    // Start animation after a short delay
    const timer = setTimeout(() => {
      setIsAnimating(true);
      // Play alarm/siren sound on reveal
      if (!hasPlayedRef.current) {
        hasPlayedRef.current = true;
        playSoundBuffer('/sounds/entrance/police_siren.mp3', 0.6);
      }
    }, 100);

    // Show the fake ban message for 2 seconds, then reveal the joke
    const trollingTimer = setTimeout(() => {
      setIsTrolling(false);
      // Play laugh sound on reveal
      playSoundBuffer('/sounds/evil_laugh.mp3', 0.5);
    }, 2000);

    return () => {
      clearTimeout(timer);
      clearTimeout(trollingTimer);
    };
  }, []);

  return (
    <div className="fixed top-0 left-0 w-full h-full bg-black z-[1001] flex items-center justify-center">
      <div 
        className={`max-w-md w-full bg-gray-900 rounded-lg border-2 p-8 text-center transition-all duration-500 ${
          isAnimating ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
        } ${
          rarity === 'COMMON' ? 'border-red-500' :
          rarity === 'RARE' ? 'border-orange-500' :
          rarity === 'EPIC' ? 'border-purple-500' : 'border-yellow-500'
        }`}
      >
        {isTrolling ? (
          <>
            {/* Fake ban message */}
            <div className="mb-6">
              <div className={`w-20 h-20 rounded-full bg-red-500 flex items-center justify-center mx-auto mb-4 ${
                rarity === 'LEGENDARY' ? 'animate-pulse' : ''
              }`}>
                <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.824 0L3.6 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <h1 className={`text-2xl font-bold mb-2 ${
                rarity === 'COMMON' ? 'text-red-400' :
                rarity === 'RARE' ? 'text-orange-400' :
                rarity === 'EPIC' ? 'text-purple-400' : 'text-yellow-400'
              }`}>
                Account Suspended
              </h1>
              <p className="text-red-300 mb-4">Your account has been permanently suspended</p>
              <p className="text-gray-400 text-sm">
                Reason: Violation of Mai Troll terms of service<br />
                Offense: Being too easy to prank
              </p>
            </div>

            {/* Fake buttons */}
            <div className="flex justify-center space-x-4">
              <button className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-lg transition-colors">
                Appeal Suspension
              </button>
              <button className="bg-gray-700 hover:bg-gray-800 text-white px-6 py-2 rounded-lg transition-colors">
                Contact Support
              </button>
            </div>
          </>
        ) : (
          <>
            {/* Joke reveal */}
            <div className="mb-6">
              <div className={`w-20 h-20 rounded-full bg-yellow-500 flex items-center justify-center mx-auto mb-4 ${
                rarity === 'LEGENDARY' ? 'animate-pulse' : ''
              }`}>
                <svg className="w-10 h-10 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h1 className={`text-2xl font-bold mb-2 ${
                rarity === 'COMMON' ? 'text-yellow-400' :
                rarity === 'RARE' ? 'text-yellow-400' :
                rarity === 'EPIC' ? 'text-yellow-400' : 'text-yellow-400'
              }`}>
                JUST KIDDING 😈
              </h1>
              <p className="text-yellow-300 mb-4">Welcome to MaiTroll!</p>
              <p className="text-gray-400 text-sm">
                Did we get you good? This is just a taste of the chaos that awaits you in MaiTroll.
              </p>
            </div>

            {/* Fake dismiss button */}
            <div className="flex justify-center">
              <button className="bg-yellow-600 hover:bg-yellow-700 text-black px-6 py-2 rounded-lg transition-colors">
                Continue to MaiTroll
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default FakeBanScreen;
