import { useCallback, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useSwipeNavigation } from '@/contexts/SwipeNavigationContext';

export interface SwipeDestination {
  path: string;
  label: string;
}

const SWIPE_DESTINATIONS: SwipeDestination[] = [
  { path: '/', label: 'Home' },
  { path: '/utromail', label: 'Chats' },
  { path: '/store', label: 'Coins' },
  { path: '/treelz', label: 'Treelz' },
  { path: '/high-bcasters', label: 'High Bcasters' },
  { path: '/broadcast/setup', label: 'Go Live' },
  { path: '/podcast', label: 'Podcast' },
  { path: '/careers', label: 'Careers' },
  { path: '/tcnn', label: 'TCNN' },
  { path: '/auctions', label: 'Auctions' },
  { path: '/troll-court', label: 'Court' },
  { path: '/hytrogaming', label: 'HydroGaming' },
  { path: '/academy', label: 'Academy' },
  { path: '/mai-pay', label: 'MAI Pay' },
  { path: '/leaderboard', label: 'Leaderboard' },
  { path: '/notifications', label: 'Alerts' },
  { path: '/search', label: 'Search' },
  { path: '/family/home', label: 'Family' },
  { path: '/marketplace', label: 'Shop' },
  { path: '/inventory', label: 'Inventory' },
  { path: '/church', label: 'Church' },
  { path: '/safety', label: 'Safety' },
  { path: '/explore', label: 'Explore' },
  { path: '/beta-feedback', label: 'Beta Feedback' },
  { path: '/profile', label: 'Profile' },
  { path: '__more__', label: 'More' },
];

const SWIPE_THRESHOLD = 60;
const SWIPE_VERTICAL_RATIO = 0.6;

function matchesDestination(pathname: string, dest: SwipeDestination): boolean {
  if (dest.path === '__more__') return false;
  if (dest.path === '/' || dest.path === '/home') {
    return pathname === '/' || pathname === '/home';
  }
  if (dest.path === '/profile') {
    return pathname === '/profile' || pathname.startsWith('/profile/');
  }
  return pathname === dest.path || pathname.startsWith(dest.path + '/');
}

export function useHomeSwipeNavigation() {
  const navigate = useNavigate();
  const location = useLocation();
  const { setDirection } = useSwipeNavigation();

  const currentIndex = useMemo(() => {
    const pathname = location.pathname;
    const idx = SWIPE_DESTINATIONS.findIndex((d) => matchesDestination(pathname, d));
    return idx >= 0 ? idx : 0;
  }, [location.pathname]);

  const swipeNext = useCallback(() => {
    if (currentIndex < SWIPE_DESTINATIONS.length - 1) {
      setDirection('left');
      const next = SWIPE_DESTINATIONS[currentIndex + 1];
      if (next.path === '__more__') {
        window.dispatchEvent(new CustomEvent('open-more-panel'));
      } else {
        navigate(next.path);
      }
      setTimeout(() => setDirection(null), 340);
    }
  }, [currentIndex, navigate, setDirection]);

  const swipePrev = useCallback(() => {
    if (currentIndex > 0) {
      setDirection('right');
      const prev = SWIPE_DESTINATIONS[currentIndex - 1];
      navigate(prev.path);
      setTimeout(() => setDirection(null), 340);
    }
  }, [currentIndex, navigate, setDirection]);

  const canSwipeLeft = currentIndex < SWIPE_DESTINATIONS.length - 1;
  const canSwipeRight = currentIndex > 0;

  return {
    currentIndex,
    swipeNext,
    swipePrev,
    canSwipeLeft,
    canSwipeRight,
    currentDestination: SWIPE_DESTINATIONS[currentIndex]?.label ?? 'Home',
  };
}

export { SWIPE_THRESHOLD, SWIPE_VERTICAL_RATIO };
