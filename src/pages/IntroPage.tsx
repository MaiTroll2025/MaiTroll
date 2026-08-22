import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../lib/store';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const INTRO_VIDEO_PATH = 'troll intro.mp4';

function getIntroVideoUrl(): string {
  if (!SUPABASE_URL) return '/assets/troll intro.mp4';
  return `${SUPABASE_URL.replace(/\/+$/g, '')}/storage/v1/object/public/troll-city-assets/${INTRO_VIDEO_PATH.replace(/^\/+/, '')}`;
}

export default function IntroPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const introVideoUrl = getIntroVideoUrl();

  // Synchronous check: skip if authenticated or already seen intro
  const introSeen = sessionStorage.getItem('trollIntroSeen') === 'true';

  // If user is authenticated, go to home (skip intro)
  useEffect(() => {
    if (user) {
      navigate('/home', { replace: true });
    }
  }, [user, navigate]);

  // If intro already seen, go to landing page
  useEffect(() => {
    if (introSeen) {
      navigate('/landing', { replace: true });
    }
  }, [introSeen, navigate]);

  // Otherwise, show the intro video
  const handleVideoEnd = () => {
    // Mark intro as seen and navigate to landing
    sessionStorage.setItem('trollIntroSeen', 'true');
    navigate('/landing', { replace: true });
  };

  const handleSkip = () => {
    // Allow users to skip the intro
    sessionStorage.setItem('trollIntroSeen', 'true');
    navigate('/landing', { replace: true });
  };

  // If we're redirecting, don't render the intro
  if (user || introSeen) {
    return null;
  }

  return (
    <div className="relative w-full h-screen bg-black overflow-y-auto overflow-x-hidden md:overflow-hidden">
      {/* Video Container */}
      <video
        autoPlay
        onEnded={handleVideoEnd}
        playsInline
        className="w-full h-full object-cover"
        style={{
          display: 'block',
        }}
      >
        <source src={introVideoUrl} type="video/mp4" />
        Your browser does not support the video tag.
      </video>

      {/* Skip Button */}
      <button
        onClick={handleSkip}
        className="absolute top-6 right-6 px-6 py-2 bg-black/60 hover:bg-black/80 text-white rounded-lg font-semibold transition-all duration-200 z-10 backdrop-blur-sm"
      >
        Skip
      </button>

      {/* Optional: Loading indicator while video loads */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="animate-spin text-white text-4xl opacity-20">
          <span>⚙️</span>
        </div>
      </div>
    </div>
  );
}

