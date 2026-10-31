import { useEffect, useState, useRef, useCallback, useMemo, type ReactNode } from 'react'
import { MorePagesPanel } from '../nav/MorePagesPanel'
import LeftNavSidebar from '../home/LeftNavSidebar'
import Header from '../Header'
import { useLocation, useNavigate } from 'react-router-dom'
import PurchaseRequiredModal from '../PurchaseRequiredModal'
import { useAuthStore } from '../../lib/store'
import { useIsMobile } from '../../hooks/useIsMobile'
import { useUcRedirect } from '../../hooks/usePageVisibility'
import type { SwipeDirection } from '../../contexts/SwipeNavigationContext'
import { useSwipeNavigationProvider } from '../../hooks/useSwipeNavigation'
import { useHomeSwipeNavigation } from '../../hooks/useHomeSwipeNavigation'
import { requiresWebRenderer } from '../../lib/seo/seoRoutes'
import { useLiveContent } from '../../hooks/useLiveContent'
import { usePresidentSystem } from '../../hooks/usePresidentSystem'
import { useWallNotifications } from '../../hooks/useWallNotifications'
import type { TabType } from '../../types/homeTabs'

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
  showSidebar: _showSidebar = true, 
  showHeader = true, 
  showBottomNav: _showBottomNav = true,
  mobileHeader,
  mobileTopBanner,
  mobileFooter,
  mobileFloatingActionButton,
  mobileBodyClassName = '',
  mobileShellClassName = '',
  isJailed = false,
}: AppLayoutProps) {
   const location = useLocation();
    const _showLegacySidebar = useAuthStore((s) => s.showLegacySidebar)
    const user = useAuthStore((s) => s.user)
    const { isMobileWidth } = useIsMobile()
    const isHomePage = location.pathname === '/' || location.pathname === '/home'
    const isAuthPage = location.pathname.startsWith('/auth');
    const isPublicWebOnlyPage = requiresWebRenderer(location.pathname);
    const isLivePage = location.pathname.startsWith('/live/') || location.pathname.startsWith('/watch/') || location.pathname.startsWith('/gaming/watch/') || (location.pathname.startsWith('/broadcast/') && !location.pathname.startsWith('/broadcast/setup')) || location.pathname.startsWith('/stream/') || location.pathname === '/live-swipe';
    const isTreelzPage = location.pathname.startsWith('/treelz');
     const _isUtromailPage = location.pathname.startsWith('/utromail') || location.pathname.startsWith('/tromail') || location.pathname.startsWith('/messages');
     const isSingOffPage = location.pathname.startsWith('/mai-sing-off');
     const normalizedPath = location.pathname.toLowerCase();
    const isThemeExemptPage = normalizedPath.includes('court') || normalizedPath.startsWith('/church');
    const _isKeyboardVisible = false;
    const isMobileLayout = isMobileWidth && !isAuthPage;
   const [hytroSetupLive, setHytroSetupLive] = useState(() => typeof window !== 'undefined' && sessionStorage.getItem('tc_hytro_gaming_setup_live') === 'true')
  const [morePagesOpen, setMorePagesOpen] = useState(false)

  useUcRedirect();

  useEffect(() => {
    const openMore = () => setMorePagesOpen(true)
    window.addEventListener('open-more-panel', openMore)
    return () => window.removeEventListener('open-more-panel', openMore)
  }, [])

  // The app navigation is hidden on focused experiences and public web-only pages.
   const isHytroGamingSetupLivePage = location.pathname.startsWith('/broadcast/setup/gaming') && hytroSetupLive

   // Left-nav navigation is shown on every web page so users can reach Home or
   // any other page from anywhere. The bottom nav bar is removed: phone keeps
   // its own bottom nav, and both phone and web expose all pages via More.
   // Homepage renders its own LeftNavSidebar internally, so AppLayout skips it
   // there to avoid a duplicate sidebar.

   const { liveItems, totalViewers: _totalViewers, onlineUsers: _onlineUsers, loadingLive: _loadingLive } = useLiveContent()
   const battleItems = useMemo(() => liveItems.filter((item) => item.isBattle), [liveItems])
   const { currentElection, currentPresident } = usePresidentSystem()
   const { newPostCount: wallNotificationCount } = useWallNotifications(false)

   const presidentTabLabel = currentElection?.status === 'open'
     ? 'President Candidates'
     : currentPresident
       ? 'President'
       : 'President Office'
   const showPresidentTab = currentElection?.status === 'open'

   const path = location.pathname
   const params = new URLSearchParams(location.search)
   const homeTab = params.get('tab')
   let activeTab: TabType = 'home'
   if (path.startsWith('/live') || path.startsWith('/watch/')) activeTab = 'live'
   else if (path === '/universe') activeTab = 'universe'
   else if (path === '/leagues') activeTab = 'leagues'
   else if (path === '/laws-fees' || (path === '/home' && homeTab === 'laws-fees')) activeTab = 'laws-fees'
    else if (path === '/' || path === '/home') activeTab = 'home'

   const showLeftNav = !isAuthPage && !isLivePage && !isTreelzPage && !isSingOffPage && !isHytroGamingSetupLivePage && !isJailed && !isPublicWebOnlyPage && !isMobileLayout && activeTab !== 'home'

   const navigate = useNavigate()
   const handleSetActiveTab = useCallback((tab: TabType) => {
     if (tab === 'home') navigate('/')
     else navigate(`/home?tab=${tab}`)
   }, [navigate])

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

     const effectiveShowHeader = showHeader && !isAuthPage && !isLivePage && !isTreelzPage && !isSingOffPage && !isHytroGamingSetupLivePage && !isJailed;
     const _effectiveShowBottomNav = false;
    const _isHomePage = location.pathname === '/';
     const mainOverflowClass = isLivePage || isHytroGamingSetupLivePage || isSingOffPage ? 'overflow-hidden' : 'overflow-x-hidden overflow-y-auto touch-pan-y scrollbar-thin scrollbar-thumb-purple-900/30 scrollbar-track-transparent';
     const mainPaddingClass = '';
   const appThemeClass = isThemeExemptPage ? 'tc-theme-exempt' : 'tc-app-shell';

  return (
    <div className={`app-viewport ${appThemeClass} ${!isMobileWidth ? 'tc-web-layout' : ''} ${!isMobileWidth ? (isHomePage ? 'tc-home-web-zoom' : 'tc-web-page-zoom') : ''} w-full min-w-0 h-dvh overflow-hidden text-white flex relative`}>
      {!isAuthPage && <PurchaseRequiredModal />}
      <div className="flex-1 flex flex-col min-h-0 min-w-0 relative">
        {/* Header - Sticky or Fixed */}
        {effectiveShowHeader && !isMobileLayout && (
          <div className="relative z-[1000] shrink-0">
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
          <div className="flex h-full min-h-0">
            {showLeftNav && (
              <div className="shrink-0">
                <LeftNavSidebar
                  activeTab={activeTab}
                  setActiveTab={handleSetActiveTab}
                  liveCount={liveItems.length}
                  battleCount={battleItems.length}
                  followersLiveCount={0}
                  presidentTabLabel={presidentTabLabel}
                  showPresidentTab={showPresidentTab}
                  wallNotificationCount={wallNotificationCount}
                  onMoreClick={() => setMorePagesOpen(true)}
                />
              </div>
            )}
            <div className="min-h-0 min-w-0 flex-1">
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
            </div>
          </div>
        </main>

      </div>

      {/* Global More Pages Panel — always mounted so sidebar "More" works on every page */}
      <MorePagesPanel isOpen={morePagesOpen} onClose={() => setMorePagesOpen(false)} />
    </div>
  )
}
