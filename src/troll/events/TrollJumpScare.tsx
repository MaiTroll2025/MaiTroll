import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Rarity } from '../useTrollEngine';

interface TrollJumpScareProps {
  rarity: Rarity;
}

// ─── Shared AudioContext for reliable playback ──────────────────
let _sharedAudioCtx: AudioContext | null = null;
function getAudioCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!_sharedAudioCtx) {
    _sharedAudioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  if (_sharedAudioCtx.state === 'suspended') {
    _sharedAudioCtx.resume();
  }
  return _sharedAudioCtx;
}

// ─── Fetch + decode an MP3 via Web Audio API ────────────────────
async function fetchAudioBuffer(url: string): Promise<AudioBuffer | null> {
  const ctx = getAudioCtx();
  if (!ctx) return null;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const arrayBuf = await res.arrayBuffer();
    return await ctx.decodeAudioData(arrayBuf);
  } catch {
    return null;
  }
}

const SCARY_SOUNDS = [
  '/sounds/entrance/explosion.mp3',
  '/sounds/evil_laugh.mp3',
  '/sounds/troll.mp3',
  '/sounds/entrance/magical.mp3',
  '/sounds/entrance/lightning.mp3',
  '/sounds/metal_spin.mp3',
  '/sounds/click.mp3',
  '/sounds/entrance/flame.mp3',
  '/sounds/calls/ringtone-neon.mp3',
  '/sounds/calls/dialtone-neon.mp3',
  '/sounds/entrance/curtain-open.mp3',
];

const TrollJumpScare: React.FC<TrollJumpScareProps> = ({ rarity }) => {
  const [isAnimating, setIsAnimating] = useState<boolean>(false);
  const [scaryImageIndex, setScaryImageIndex] = useState<number>(0);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);

  // Scary images - local jumpscare images
  const scaryImages = [
    '/img/jumpscares/jumpscare1.png',
    '/img/jumpscares/jumpscare2.png',
    '/img/jumpscares/jumpscare3.png',
    '/img/jumpscares/jumpscare4.png',
    '/img/jumpscares/jumpscare5.png',
    '/img/jumpscares/jumpscare6.png',
    '/img/jumpscares/jumpscare7.jpeg',
    '/img/jumpscares/jumpscare8.jpeg',
    '/img/jumpscares/jumpscare9.jpeg',
    '/img/jumpscares/jumpscare10.jpeg',
    '/img/jumpscares/jumpscare11.jpeg',
  ];

  // Play scary sound using Web Audio API (bypasses autoplay restrictions)
  const playScarySound = useCallback(async (index: number, volume: number) => {
    try {
      // Stop any previous sound
      if (sourceRef.current) {
        try { sourceRef.current.stop(); } catch { /* already stopped */ }
        sourceRef.current = null;
      }

      const soundIndex = index % SCARY_SOUNDS.length;
      const soundPath = SCARY_SOUNDS[soundIndex];

      const ctx = getAudioCtx();
      if (!ctx) return;

      const buffer = await fetchAudioBuffer(soundPath);
      if (!buffer) {
        console.warn('[JumpScare] Could not load sound:', soundPath);
        return;
      }

      const source = ctx.createBufferSource();
      source.buffer = buffer;

      const gain = ctx.createGain();
      gain.gain.value = Math.min(volume, 1.0);

      source.connect(gain);
      gain.connect(ctx.destination);

      sourceRef.current = source;
      source.onended = () => { sourceRef.current = null; };
      source.start(0);
    } catch (err) {
      console.warn('[JumpScare] Sound error:', err);
    }
  }, []);

  useEffect(() => {
    // Randomly select a scary image and sound
    const randomIndex = Math.floor(Math.random() * scaryImages.length);
    setScaryImageIndex(randomIndex);
    
    // Start animation after a short delay to ensure the overlay is visible
    const timer = setTimeout(() => {
      setIsAnimating(true);
      
      // Play scary sound based on random index with volume based on rarity
      const volume = rarity === 'LEGENDARY' ? 1.0 : rarity === 'EPIC' ? 0.8 : 0.6;
      playScarySound(randomIndex, volume);
    }, 100);

    return () => {
      clearTimeout(timer);
      // Cleanup audio on unmount
      if (sourceRef.current) {
        try { sourceRef.current.stop(); } catch { /* already stopped */ }
        sourceRef.current = null;
      }
    };
  }, [playScarySound, rarity, scaryImages.length]);

  // Determine the size and intensity of the jumpscare based on rarity
  const getJumpScareStyle = () => {
    switch (rarity) {
      case 'COMMON':
        return 'w-64 h-64';
      case 'RARE':
        return 'w-80 h-80';
      case 'EPIC':
        return 'w-96 h-96';
      case 'LEGENDARY':
        return 'w-[80vh] h-[80vh]';
      default:
        return 'w-64 h-64';
    }
  };

  return (
    <div className="fixed top-0 left-0 w-full h-full bg-black z-[1001] flex items-center justify-center">
      <div 
        className={`relative transition-all duration-300 ease-out ${
          isAnimating ? getJumpScareStyle() : 'w-0 h-0'
        }`}
      >
        {/* Scary image - jumps out at user */}
        <img 
          src={scaryImages[scaryImageIndex]} 
          alt="Troll Jumpscare" 
          className="object-cover rounded-full shadow-2xl animate-pulse"
          style={{ 
            filter: 'brightness(1.3) saturate(1.4) contrast(1.2)',
            animation: 'pulse 0.3s ease-in-out infinite'
          }}
        />
        
        {/* Neon border effect based on rarity */}
        <div 
          className={`absolute inset-0 rounded-full border-4 ${
            rarity === 'COMMON' ? 'border-green-500' :
            rarity === 'RARE' ? 'border-blue-500' :
            rarity === 'EPIC' ? 'border-purple-500' : 'border-yellow-500'
          } animate-pulse`}
          style={{ 
            animationDuration: rarity === 'LEGENDARY' ? '0.2s' : '0.5s',
            boxShadow: `0 0 ${rarity === 'LEGENDARY' ? '80' : '40'}px ${
              rarity === 'COMMON' ? 'rgba(0, 255, 0, 0.8)' :
              rarity === 'RARE' ? 'rgba(0, 0, 255, 0.8)' :
              rarity === 'EPIC' ? 'rgba(128, 0, 128, 0.8)' : 'rgba(255, 255, 0, 0.8)'
            }`
          }}
        />

        {/* Random text based on rarity */}
        <div className="absolute -bottom-16 left-1/2 transform -translate-x-1/2 text-white text-center">
          <p className={`text-xl font-bold ${
            rarity === 'COMMON' ? 'text-green-400' :
            rarity === 'RARE' ? 'text-blue-400' :
            rarity === 'EPIC' ? 'text-purple-400' : 'text-yellow-400'
          }`}>
            {rarity === 'COMMON' ? 'BOO!' :
             rarity === 'RARE' ? 'Gotcha!' :
             rarity === 'EPIC' ? 'Mwahahaha!' : 'SURPRISE!'
            }
          </p>
          {rarity === 'LEGENDARY' && (
            <p className="text-sm text-yellow-300 mt-1">You&apos;ve been trolled!</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default TrollJumpScare;
