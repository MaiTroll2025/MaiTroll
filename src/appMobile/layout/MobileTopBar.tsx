import React, { useEffect, useState } from "react";
import { Bell, Menu, Search, X } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface MobileTopBarProps {
  drawerOpen?: boolean;
  onToggleDrawer?: () => void;
  onOpenDrawer?: () => void;
  onCloseDrawer?: () => void;
}

export default function MobileTopBar({
  drawerOpen = false,
  onToggleDrawer,
  onOpenDrawer,
  onCloseDrawer,
}: MobileTopBarProps) {
  const navigate = useNavigate();
  const [notificationCount, setNotificationCount] = useState(0);

  useEffect(() => {
    // Placeholder for real notification count later.
    // Keep this here so the top bar is already ready for Supabase wiring.
    setNotificationCount(0);
  }, []);

  const handleMenuClick = () => {
    if (onToggleDrawer) {
      onToggleDrawer();
      return;
    }

    if (drawerOpen && onCloseDrawer) {
      onCloseDrawer();
      return;
    }

    if (!drawerOpen && onOpenDrawer) {
      onOpenDrawer();
    }
  };

  return (
    <header className="tc-mobile-topbar">
      <button
        type="button"
        className="tc-mobile-topbar__icon-btn"
        onClick={handleMenuClick}
        aria-label={drawerOpen ? "Close menu" : "Open menu"}
      >
        {drawerOpen ? <X size={21} /> : <Menu size={21} />}
      </button>

      <button
        type="button"
        className="tc-mobile-topbar__brand"
        onClick={() => navigate("/")}
        aria-label="Go to Mai Troll home"
      >
        <span className="tc-mobile-topbar__brand-mark">TC</span>

        <span className="tc-mobile-topbar__brand-text">
          <span className="tc-mobile-topbar__brand-line tc-mobile-topbar__brand-line--top">
            TROLL
          </span>
          <span className="tc-mobile-topbar__brand-line tc-mobile-topbar__brand-line--bottom">
            CITY
          </span>
        </span>
      </button>

      <div className="tc-mobile-topbar__actions">
        <button
          type="button"
          className="tc-mobile-topbar__icon-btn"
          onClick={() => navigate("/search")}
          aria-label="Search Mai Troll"
        >
          <Search size={20} />
        </button>

        <button
          type="button"
          className="tc-mobile-topbar__icon-btn tc-mobile-topbar__icon-btn--notify"
          onClick={() => navigate("/notifications")}
          aria-label="Open notifications"
        >
          <Bell size={20} />

          {notificationCount > 0 && (
            <span className="tc-mobile-topbar__badge">
              {notificationCount > 99 ? "99+" : notificationCount}
            </span>
          )}
        </button>
      </div>
    </header>
  );
}