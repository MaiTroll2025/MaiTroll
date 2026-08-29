import { useEffect, useState, useRef, useCallback, type ReactNode } from 'react'
import BottomNavBar from '../nav/BottomNavBar'
import { MorePagesPanel } from '../nav/BottomNavBar'
import Sidebar from '../Sidebar'
import Header from '../Header'
import { useLocation } from 'react-router-dom'
import PurchaseRequiredModal from '../PurchaseRequiredModal'
import { useAuthStore } from '../../lib/store'
import { useSidebarStore } from '../../stores/useSidebarStore'
import { useIsMobile } from '../../hooks/useIsMobile'
import { isStandalone } from '../../pwa/install'
import { useUcRedirect } from '../../hooks/usePageVisibility'
import { useSwipeNavigationProvider, type SwipeDirection } from '../../contexts/SwipeNavigationContext'
import { useHomeSwipeNavigation } from '../../hooks/useHomeSwipeNavigation'

interface AppLayoutProps {
  children: ReactNode
  showSidebar?: boolean
  showHeader?: boolean
  showBottomNav?: boolean
  mobileHeader?: ReactNode
  mobileTopBanner?: ReactNode
  mobileFooter?: ReactNode
  mobileFloatingActionButton?: ReactNode
  mobileBodyClassName?: string
  mobileShellClassName?: string
  isJailed?: boolean
}

export default function AppLayout({ 
  children, 
  showSidebar = true, 
  showHeader = true, 
  showBottomNav = true,
  mobileHeader,
  mobileTopBanner,
  mobileFooter,
  mobileFloatingActionButton,
  mobileBodyClassName = '',
  mobileShellClassName = '',
  isJailed = false,
}: AppLayoutProps) {
   const location = useLocation();
   const showLegacySidebar = useAuthStore((s) => s.showLegacySidebar)
   const user = useAuthStore((s) => s.user)
   const { isCollapsed } = useSidebarStore()
   const { isMobileWidth } = useIsMobile()
    const isAuthPage = location.pathname.startsWith('/auth');
    const isLivePage = location.pathname.startsWith('/live/') || location.pathname.startsWith('/watch/') || location.pathname.startsWith('/gaming/watch/') || (location.pathname.startsWith('/broadcast/') && !location.pathname.startsWith('/broadcast/setup')) || location.pathname.startsWith('/stream/') || location.pathname === '/live-swipe';
    const isTreelzPage = location.pathname.startsWith('/treelz');
     const isUtromailPage = location.pathname.startsWith('/utromail') || location.pathname.startsWith('/tromail') || location.pathname.startsWith('/messages');
     const isSingOffPage = location.pathname.startsWith('/mai-sing-off');
     const normalizedPath = location.pathname.toLowerCase();
    const isThemeExemptPage = normalizedPath.includes('court') || normalizedPath.startsWith('/church');
    const isKeyboardVisible = false;
    const isMobileLayout = isMobileWidth && !isAuthPage;
   const [hytroSetupLive, setHytroSetupLive] = useState(() => typeof window !== 'undefined' && sessionStorage.getItem('tc_hytro_gaming_setup_live') === 'true')
  const [morePagesOpen, setMorePagesOpen] = useState(false)

  useUcRedirect();

  useEffect(() => {
    const openMore = () => setMorePagesOpen(true)
    window.addEventListener('open-more-panel', openMore)
    return () => window.removeEventListener('open-more-panel', openMore)
  }, [])

  // New bottom nav bar is always shown (replaces sidebar on all screen sizes)
   // Hidden on live pages and treelz pages
   const isHytroGamingSetupLivePage = location.pathname.startsWith('/broadcast/setup/gaming') && hytroSetupLive
    const showNewBottomNavBar = !isAuthPage && !isLivePage && !isTreelzPage && !isSingOffPage && !isHytroGamingSetupLivePage && !isJailed && location.pathname !== '/'

 // Setup global message notifications - opens chat bubble when message received
 useEffect(() => {
   if (!user?.id) return
 }, [user?.id])

 useEffect(() => {
   const updateHytroSetupLive = () => {
     setHytroSetupLive(typeof window !== 'undefined' && sessionStorage.getItem('tc_hytro_gaming_setup_live') === 'true')
   }

   window.addEventListener('tc-hytro-gaming-setup-live-changed', updateHytroSetupLive)
   window.addEventListener('focus', updateHytroSetupLive)
   return () => {
     window.removeEventListener('tc-hytro-gaming-setup-live-changed', updateHytroSetupLive)
     window.removeEventListener('focus', updateHytroSetupLive)
   }
 }, [])

 useEffect(() => {
   document.body.classList.toggle('tc-theme-exempt-body', isThemeExemptPage);

   return () => {
     document.body.classList.remove('tc-theme-exempt-body');
   };
 }, [isThemeExemptPage]);

   const { direction } = useSwipeNavigationProvider()

   const directionRef = useRef<SwipeDirection>(null)

   useEffect(() => {
    directionRef.current = direction
   }, [direction])

   const { swipeNext, swipePrev, canSwipeLeft, canSwipeRight } = useHomeSwipeNavigation()
   const touchStartRef = useRef<{ x: number; y: number } | null>(null)
   const touchCurrentRef = useRef<{ x: number; y: number } | null>(null)
   const swipeDirectionRef = useRef<SwipeDirection>(null)
   const isTransitioningRef = useRef(false)

   const completeSwipe = useCallback((dir: 'left' | 'right') => {
     if (isTransitioningRef.current) return
     isTransitioningRef.current = true
     if (dir === 'left' && canSwipeLeft) {
       swipeNext()
     } else if (dir === 'right' && canSwipeRight) {
       swipePrev()
     }
     setTimeout(() => {
       isTransitioningRef.current = false
     }, 320)
   }, [canSwipeLeft, canSwipeRight, swipeNext, swipePrev])

   const handleTouchStart = useCallback((e: React.TouchEvent) => {
     const touch = e.touches[0]
     touchStartRef.current = { x: touch.clientX, y: touch.clientY }
     touchCurrentRef.current = { x: touch.clientX, y: touch.clientY }
     swipeDirectionRef.current = null
   }, [])

   const handleTouchMove = useCallback((e: React.TouchEvent) => {
     if (!touchStartRef.current) return
     const touch = e.touches[0]
     touchCurrentRef.current = { x: touch.clientX, y: touch.clientY }
     if (!swipeDirectionRef.current) {
       const dx = touch.clientX - touchStartRef.current.x
       const dy = touch.clientY - touchStartRef.current.y
       if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy)) {
         swipeDirectionRef.current = dx > 0 ? 'right' : 'left'
       }
     } else if (swipeDirectionRef.current) {
       e.preventDefault()
     }
   }, [])

   const handleTouchEnd = useCallback(() => {
     if (!touchStartRef.current || !touchCurrentRef.current) {
       touchStartRef.current = null
       touchCurrentRef.current = null
       swipeDirectionRef.current = null
       return
     }
     const dx = touchCurrentRef.current.x - touchStartRef.current.x
     const dy = touchCurrentRef.current.y - touchStartRef.current.y
     const absDx = Math.abs(dx)
     const absDy = Math.abs(dy)
     if (absDx > 55 && absDx > absDy * 0.6) {
       if (dx < 0 && canSwipeLeft) {
         completeSwipe('left')
       } else if (dx > 0 && canSwipeRight) {
         completeSwipe('right')
       }
     }
     touchStartRef.current = null
     touchCurrentRef.current = null
     swipeDirectionRef.current = null
   }, [canSwipeLeft, canSwipeRight, completeSwipe])

  const mainRef = useRef<HTMLElement | null>(null)

 useEffect(() => {
   const targets = [mainRef.current, document.scrollingElement, document.body]
   targets.forEach((el) => {
     if (el && typeof (el as HTMLElement).scrollTo === 'function') {
       ;(el as HTMLElement).scrollTo({ top: 0, left: 0 })
     }
   })
 }, [location.pathname])

   const effectiveShowSidebar = false;
    const effectiveShowHeader = showHeader && !isAuthPage && !isLivePage && !isTreelzPage && !isSingOffPage && !isHytroGamingSetupLivePage && !isJailed;
   const effectiveShowBottomNav = false;
    const isHomePage = location.pathname === '/';
    const mainOverflowClass = isLivePage || isHytroGamingSetupLivePage || isSingOffPage ? 'overflow-hidden' : 'overflow-x-hidden overflow-y-auto touch-pan-y scrollbar-thin scrollbar-thumb-purple-900/30 scrollbar-track-transparent';
   // The new bottom nav bar is ~64px tall on mobile (h-16) and ~144px tall on
   // desktop (md:h-36) plus the safe-area inset. The old 64px bottom padding
   // left the lower portion of every page hidden behind the fixed nav, so
   // content could never be scrolled fully into view. Pad past the tallest bar.
    const mainPaddingClass = showNewBottomNavBar && !isLivePage && !isHytroGamingSetupLivePage && !isJailed
      ? 'pb-[calc(72px+env(safe-area-inset-bottom,0px))] md:pb-[calc(156px+env(safe-area-inset-bottom,0px))]'
      : '';
  const appThemeClass = isThemeExemptPage ? 'tc-theme-exempt' : 'tc-app-shell';

  return (
    <div className={`app-viewport ${appThemeClass} w-screen h-dvh overflow-hidden text-white flex relative`}>
      {!isAuthPage && <PurchaseRequiredModal />}
{/* Desktop Sidebar - Hidden on Mobile PWA */}
   {effectiveShowSidebar && (
    <div className={`h-full shrink-0 z-60 transition-all duration-300 ${isCollapsed ? 'w-20' : 'w-64'}`}>
      <Sidebar />
    </div>
  )}

      <div className="flex-1 flex flex-col min-h-0 min-w-0 relative">
        {/* Header - Sticky or Fixed */}
        {effectiveShowHeader && !isMobileLayout && (
          <div className="shrink-0 z-20">
            <Header />
          </div>
        )}

       

        {/* Main Content Area */}
        <main
          ref={mainRef}
          className={`flex-1 w-full min-h-0 relative ${mainOverflowClass} ${mainPaddingClass}`}
          style={
            direction === 'left'
              ? { animation: 'routeSlideLeft 0.32s cubic-bezier(0.32, 0.72, 0, 1) forwards' }
              : direction === 'right'
                ? { animation: 'routeSlideRight 0.32s cubic-bezier(0.32, 0.72, 0, 1) forwards' }
              : undefined
          }
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          {isMobileLayout ? (
            <div className={`mx-auto flex min-h-full w-full flex-col ${mobileShellClassName} bg-slate-950/30 backdrop-blur-sm`}>
              {mobileHeader ? (
                <div className="shrink-0 border-b border-white/10 bg-slate-950/50 px-4 pb-3 pt-3">
                  {mobileHeader}
                </div>
              ) : null}

              {mobileTopBanner ? (
                <div className="shrink-0 px-3 pt-3">
                  {mobileTopBanner}
                </div>
              ) : null}

              <div className={`flex-1 min-h-0 min-w-0 ${mobileBodyClassName}`}>
                {children}
              </div>

              {mobileFooter ? (
                <div className="shrink-0 border-t border-white/10 bg-slate-950/55">
                  {mobileFooter}
                </div>
              ) : null}

              {mobileFloatingActionButton ? (
                <div className="pointer-events-none fixed bottom-[calc(64px+1rem+env(safe-area-inset-bottom,0px))] right-4 z-20">
                  <div className="pointer-events-auto">
                    {mobileFloatingActionButton}
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            children
          )}
        </main>

      </div>

      {/* New OS-Style Bottom Navigation Bar */}
      {showNewBottomNavBar && (
        <BottomNavBar />
      )}

      {/* Global More Pages Panel — always mounted so sidebar "More" works on every page */}
      <MorePagesPanel isOpen={morePagesOpen} onClose={() => setMorePagesOpen(false)} />
    </div>
  )
}
