import React, { useCallback, useEffect, useMemo, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import {
  ChevronDown,
  ChevronUp,
  Coins,
  Home,
  LogOut,
  MessageCircle,
  Radio,
  Sparkles,
  Store,
  User,
  Upload,
  Wallet,
  Zap,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import ProfileFrame from "@/components/profile/ProfileFrame";
import { useProfileFrameStore } from "@/stores/useProfileFrameStore";
import {
  getMobileBubbleRoutes,
  normalizeMobileRole,
  type MobileRouteItem,
  type MobileUserRole,
} from "../mobileRoutes.tsx";

type MobileUserCard = {
  id: string | null;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  role: MobileUserRole;
  level: number;
  xp: number;
  xpToNextLevel: number;
  trollCoins: number;
  hypeCoins: number;
  trollmonds: number;
};

const DEFAULT_USER: MobileUserCard = {
  id: null,
  username: "Guest",
  displayName: "Guest",
  avatarUrl: null,
  role: "user",
  level: 1,
  xp: 0,
  xpToNextLevel: 100,
  trollCoins: 0,
  hypeCoins: 0,
  trollmonds: 0,
};

const PAYOUT_TIERS = [2000, 4000, 10000, 20000, 30000, 50000, 100000, 200000, 500000, 1000000];

function numberFormat(value: number): string {
  return new Intl.NumberFormat("en-US").format(Number(value || 0));
}

function getNumberValue(source: any, keys: string[], fallback = 0): number {
  for (const key of keys) {
    const value = source?.[key];

    if (value !== null && value !== undefined && value !== "") {
      const numeric = Number(value);
      if (!Number.isNaN(numeric)) return numeric;
    }
  }

  return fallback;
}

function getStringValue(source: any, keys: string[], fallback = ""): string {
  for (const key of keys) {
    const value = source?.[key];

    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return fallback;
}

function getXpPercent(xp: number, xpToNextLevel: number): number {
  if (!xpToNextLevel || xpToNextLevel <= 0) return 0;
  return Math.min(Math.max((Number(xp || 0) / Number(xpToNextLevel)) * 100, 0), 100);
}

function getCoinsToNextPayout(trollCoins: number): number {
  const current = Number(trollCoins || 0);
  const nextTier = PAYOUT_TIERS.find((tier) => current < tier);

  if (!nextTier) return 0;

  return Math.max(nextTier - current, 0);
}

function MobileWalletBox({
  icon,
  label,
  value,
  hint,
  onClick,
  disabled,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
  onClick?: () => void;
  disabled?: boolean;
}) {
  const Component = onClick ? "button" : "div";

  return (
    <Component
      type={onClick ? "button" : undefined}
      className={[
        "tc-mobile-bottom-nav__wallet-box",
        onClick ? "tc-mobile-bottom-nav__wallet-box--button" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      onClick={onClick}
      disabled={disabled}
    >
      <div className="tc-mobile-bottom-nav__wallet-label">
        {icon}
        <span>{label}</span>
      </div>

      <div className="tc-mobile-bottom-nav__wallet-value">{value}</div>

      {hint && <div className="tc-mobile-bottom-nav__wallet-hint">{hint}</div>}
    </Component>
  );
}

function MobileUserPanel({
  user,
  isConverting,
  onConvertHype,
  onSignOut,
}: {
  user: MobileUserCard;
  isConverting: boolean;
  onConvertHype: () => void;
  onSignOut: () => void;
}) {
  const xpPercent = getXpPercent(user.xp, user.xpToNextLevel);
  const coinsToNextPayout = getCoinsToNextPayout(user.trollCoins);
  const payoutValue = coinsToNextPayout === 0 ? "Eligible" : numberFormat(coinsToNextPayout);
  const equippedFrame = useProfileFrameStore((s) => s.equippedFrame);

  return (
    <section className="tc-mobile-bottom-nav__user-card">
      <div className="tc-mobile-bottom-nav__user-top">
        <div className="tc-mobile-bottom-nav__avatar">
          {user.avatarUrl ? (
            <ProfileFrame
              frame={equippedFrame}
              avatarUrl={user.avatarUrl}
              username={user.username}
              size="sm"
            />
          ) : (
            user.username.slice(0, 2).toUpperCase()
          )}
        </div>

        <div className="tc-mobile-bottom-nav__user-meta">
          <div className="tc-mobile-bottom-nav__username">@{user.username}</div>
          <div className="tc-mobile-bottom-nav__role">{user.role}</div>
        </div>

        <button
          type="button"
          className="tc-mobile-bottom-nav__mini-btn"
          onClick={onSignOut}
          aria-label="Sign out"
        >
          <LogOut size={15} />
        </button>
      </div>

      <div className="tc-mobile-bottom-nav__level">
        <div className="tc-mobile-bottom-nav__level-label">
          <span>Level {user.level}</span>
          <span>
            {numberFormat(user.xp)} / {numberFormat(user.xpToNextLevel)} XP
          </span>
        </div>

        <div className="tc-mobile-bottom-nav__level-track">
          <div
            className="tc-mobile-bottom-nav__level-fill"
            style={{ width: `${xpPercent}%` }}
          />
        </div>
      </div>

      <div className="tc-mobile-bottom-nav__wallet-grid">
        <MobileWalletBox
          icon={<Coins size={15} />}
          label="Troll Coins"
          value={numberFormat(user.trollCoins)}
        />

        <MobileWalletBox
          icon={<Wallet size={15} />}
          label="To Payout"
          value={payoutValue}
        />

        <MobileWalletBox
          icon={<Zap size={15} />}
          label="Hype Coins"
          value={isConverting ? "Converting..." : numberFormat(user.hypeCoins)}
          hint="Tap to convert"
          onClick={onConvertHype}
          disabled={isConverting || user.hypeCoins <= 0}
        />

        <MobileWalletBox
          icon={<Sparkles size={15} />}
          label="Trollmonds"
          value={numberFormat(user.trollmonds)}
        />
      </div>
    </section>
  );
}

function MobileGoLiveButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" className="tc-mobile-bottom-nav__go-live" onClick={onClick}>
      <Radio size={20} />
      <span>
        <strong>GO LIVE</strong>
        <small>Start broadcast</small>
      </span>
    </button>
  );
}

function splitRoutes(routes: MobileRouteItem[]) {
  const primaryKeys = new Set(["home", "profile", "store", "wallet", "podcast"]);

  return {
    primaryRoutes: routes.filter((route) => primaryKeys.has(route.key)),
    extraRoutes: routes.filter((route) => !primaryKeys.has(route.key)),
  };
}

export default function MobileBottomNav() {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [userCard, setUserCard] = useState<MobileUserCard>(DEFAULT_USER);
  const [isConverting, setIsConverting] = useState(false);

  const fetchUserCard = useCallback(async () => {
    const { data: authData } = await supabase.auth.getUser();
    const authUser = authData.user;

    if (!authUser?.id) {
      setUserCard(DEFAULT_USER);
      return;
    }

    const { data: profile, error } = await supabase
      .from("user_profiles")
      .select("*")
      .eq("id", authUser.id)
      .maybeSingle();

    if (error) {
      console.error("[MobileBottomNav] Failed to load user profile:", error);
    }

    const role = normalizeMobileRole(
      getStringValue(profile, ["role", "app_role", "user_role"], "user")
    );

    const username =
      getStringValue(profile, ["username", "handle"], "") ||
      authUser.email?.split("@")[0] ||
      "user";

    const displayName =
      getStringValue(profile, ["display_name", "full_name", "name"], "") || username;

    setUserCard({
      id: authUser.id,
      username,
      displayName,
      avatarUrl:
        getStringValue(profile, ["avatar_url", "profile_image_url", "photo_url"], "") || null,
      role,
      level: getNumberValue(profile, ["level", "user_level"], 1),
      xp: getNumberValue(profile, ["xp", "experience", "level_xp"], 0),
      xpToNextLevel: getNumberValue(
        profile,
        ["xp_to_next_level", "next_level_xp", "xp_required"],
        100
      ),
      trollCoins: getNumberValue(
        profile,
        ["troll_coins", "coin_balance", "coins", "owc_balance", "balance"],
        0
      ),
      hypeCoins: getNumberValue(
        profile,
        ["hype_coins", "hype_coin_balance", "hype_balance"],
        0
      ),
      trollmonds: getNumberValue(
        profile,
        ["trollmonds", "trollmond_balance", "trollmonds_balance"],
        0
      ),
    });
  }, []);

  useEffect(() => {
    fetchUserCard();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      fetchUserCard();
    });

    return () => {
      if (subscription) {
        subscription.unsubscribe();
      }
    };
  }, [fetchUserCard]);

  const availableRoutes = useMemo(() => {
    return getMobileBubbleRoutes(userCard.role);
  }, [userCard.role]);

  const { primaryRoutes, extraRoutes } = useMemo(() => {
    return splitRoutes(availableRoutes);
  }, [availableRoutes]);

  const handleGoLive = useCallback(() => {
    setIsOpen(false);
    navigate("/broadcast/setup");
  }, [navigate]);

  const handleSignOut = useCallback(async () => {
    await supabase.auth.signOut();
    setUserCard(DEFAULT_USER);
    setIsOpen(false);
    navigate("/");
  }, [navigate]);

  const handleConvertHype = useCallback(async () => {
    if (!userCard.id || userCard.hypeCoins <= 0 || isConverting) return;

    setIsConverting(true);

    const rpcAttempts = [
      "convert_hype_coins_to_troll_coins",
      "convert_hype_to_troll_coins",
      "convert_hype_coins",
      "manual_convert_hype_coins",
    ];

    try {
      let lastError: any = null;

      for (const rpcName of rpcAttempts) {
        const { error } = await supabase.rpc(rpcName, {
          p_amount: userCard.hypeCoins,
        });

        if (!error) {
          await fetchUserCard();
          return;
        }

        lastError = error;
      }

      console.error("[MobileBottomNav] Hype conversion failed:", lastError);
      alert("Hype Coin conversion failed. Connect the correct existing conversion RPC name.");
    } finally {
      setIsConverting(false);
    }
  }, [fetchUserCard, isConverting, userCard.hypeCoins, userCard.id]);

  return (
    <nav className={`tc-mobile-bottom-nav ${isOpen ? "tc-mobile-bottom-nav--open" : ""}`}>
      {/* Always-visible bottom tab bar */}
      <div className="flex w-full items-center justify-around border-t border-white/10 bg-[#050715]/95 px-1 py-2 backdrop-blur-xl">
        <NavLink to="/" className={({ isActive }) => `flex min-w-0 shrink flex-col items-center gap-1 px-1 ${isActive ? "text-cyan-400" : "text-slate-400"}`}>
          <span className="text-xs font-black">Home</span>
        </NavLink>
        <NavLink to="/broadcast/setup" className={({ isActive }) => `flex min-w-0 shrink flex-col items-center gap-1 px-1 ${isActive ? "text-cyan-400" : "text-slate-400"}`}>
          <span className="text-xs font-black">Go Live</span>
        </NavLink>
        <NavLink to="/utromail" className={({ isActive }) => `flex min-w-0 shrink flex-col items-center gap-1 px-1 ${isActive ? "text-cyan-400" : "text-slate-400"}`}>
          <span className="text-xs font-black">Chats</span>
        </NavLink>
        <NavLink to="/store" className={({ isActive }) => `flex min-w-0 shrink flex-col items-center gap-1 px-1 ${isActive ? "text-cyan-400" : "text-slate-400"}`}>
          <span className="text-xs font-black">Coins</span>
        </NavLink>
        <NavLink to="/profile" className={({ isActive }) => `flex min-w-0 shrink flex-col items-center gap-1 px-1 ${isActive ? "text-cyan-400" : "text-slate-400"}`}>
          <span className="text-xs font-black">Profile</span>
        </NavLink>
        <button
          type="button"
          className="flex min-w-0 shrink flex-col items-center gap-1 px-1 text-slate-400"
          onClick={() => setIsOpen((value) => !value)}
          aria-expanded={isOpen}
        >
          <span className="text-xs font-black">{isOpen ? "Close" : "More"}</span>
        </button>
      </div>

      <button
        type="button"
        className="tc-mobile-bottom-nav__handle"
        onClick={() => setIsOpen((value) => !value)}
        aria-expanded={isOpen}
      >
        <span className="sr-only">City Menu</span>
      </button>

      {isOpen && (
        <div className="tc-mobile-bottom-nav__panel">
          <MobileUserPanel
            user={userCard}
            isConverting={isConverting}
            onConvertHype={handleConvertHype}
            onSignOut={handleSignOut}
          />

          <MobileGoLiveButton onClick={handleGoLive} />

          <div className="flex w-full items-center justify-around px-1">
            {primaryRoutes.map((route) => {
              const Icon = route.icon;

              return (
                <NavLink
                  key={route.key}
                  to={route.path}
                  onClick={() => setIsOpen(false)}
                  className={({ isActive }) =>
                    [
                      "flex flex-col items-center gap-0.5 px-1 py-1",
                      isActive ? "text-cyan-400" : "text-slate-400",
                    ]
                      .filter(Boolean)
                      .join(" ")
                  }
                >
                  <Icon size={16} />
                  <span className="text-[9px] font-bold leading-none">{route.label}</span>
                </NavLink>
              );
            })}
          </div>

          <div className="tc-mobile-bottom-nav__route-list">
            {extraRoutes.map((route) => {
              const Icon = route.icon;

              return (
                <NavLink
                  key={route.key}
                  to={route.path}
                  onClick={() => setIsOpen(false)}
                  className={({ isActive }) =>
                    [
                      "tc-mobile-bottom-nav__route-link",
                      isActive ? "tc-mobile-bottom-nav__route-link--active" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")
                  }
                >
                  <Icon size={17} />
                  <span>{route.label}</span>
                </NavLink>
              );
            })}
          </div>
        </div>
      )}
    </nav>
  );
}