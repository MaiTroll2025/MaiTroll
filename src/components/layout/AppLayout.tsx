import { useEffect, useState, type ReactNode } from 'react'
import BottomNavBar from '../nav/BottomNavBar'
import Sidebar from '../Sidebar'
import Header from '../Header'
import { useLocation } from 'react-router-dom'
import PurchaseRequiredModal from '../PurchaseRequiredModal'
import { useAuthStore } from '../../lib/store'
import { useSidebarStore } from '../../stores/useSidebarStore'
import { useIsMobile } from '../../hooks/useIsMobile'
import { isStandalone } from '../../pwa/install'

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

   // New bottom nav bar is always shown (replaces sidebar on all screen sizes)
   // Hidden on live pages and treelz pages
   const isHytroGamingSetupLivePage = location.pathname.startsWith('/broadcast/setup/gaming') && hytroSetupLive
    const showNewBottomNavBar = !isAuthPage && !isLivePage && !isTreelzPage && !isSingOffPage && !isHytroGamingSetupLivePage

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

   const effectiveShowSidebar = false;
    const effectiveShowHeader = showHeader && !isAuthPage && !isLivePage && !isTreelzPage && !isSingOffPage && !isHytroGamingSetupLivePage;
   const effectiveShowBottomNav = false;
    const mainOverflowClass = isLivePage || isHytroGamingSetupLivePage || isSingOffPage ? 'overflow-hidden' : 'overflow-x-hidden overflow-y-auto touch-pan-y scrollbar-thin scrollbar-thumb-purple-900/30 scrollbar-track-transparent';
   // The new bottom nav bar is ~64px tall on mobile (h-16) and ~144px tall on
   // desktop (md:h-36) plus the safe-area inset. The old 64px bottom padding
   // left the lower portion of every page hidden behind the fixed nav, so
   // content could never be scrolled fully into view. Pad past the tallest bar.
   const mainPaddingClass = showNewBottomNavBar && !isLivePage && !isHytroGamingSetupLivePage
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
        <main className={`flex-1 w-full min-h-0 relative ${mainOverflowClass} ${mainPaddingClass}`}>
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
    </div>
  )
}
