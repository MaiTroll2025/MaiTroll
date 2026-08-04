import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Ban,
  Boxes,
  CreditCard,
  KeyRound,
  Save,
  Settings,
  Sparkles,
  Trash2,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/lib/supabase";
import { useAuthStore } from "../lib/store";
import { MaiTrollTheme } from "../styles/trollCityTheme";
import UserInventory from "./UserInventory";
import FamilyMinorSettings from "../components/profile/FamilyMinorSettings";
import BatterySaverToggle from "@/components/BatterySaverToggle";

const PLATFORM_OPTIONS = [
  { value: "", label: "Select platform" },
  { value: "Mai Troll", label: "Mai Troll" },
  { value: "tiktok", label: "TikTok" },
  { value: "liveme", label: "LiveMe" },
  { value: "bigo", label: "Bigo Live" },
  { value: "favortied", label: "Favortied" },
];

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={onChange}
      className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${
        checked ? "bg-purple-600" : "bg-slate-700"
      }`}
    >
      <span
        className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-transform ${
          checked ? "translate-x-6" : "translate-x-1"
        }`}
      />
    </button>
  );
}

export default function ProfileSettings() {
  const { user, profile, refreshProfile } = useAuthStore();
  const navigate = useNavigate();

  const [username, setUsername] = useState("");
  const [fullName, setFullName] = useState("");
  const [bio, setBio] = useState("");
  const [platform, setPlatform] = useState("");
  const [bannerNotifications, setBannerNotifications] = useState(true);
  const [isMinor, setIsMinor] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);

  const [creatorSubscriptionEnabled, setCreatorSubscriptionEnabled] =
    useState(false);
  const [creatorSubscriptionPrice, setCreatorSubscriptionPrice] = useState(100);
  const [savingSubscription, setSavingSubscription] = useState(false);

  useEffect(() => {
    if (!user) {
      navigate("/auth", { replace: true });
    }
  }, [navigate, user]);

  useEffect(() => {
    if (!profile) return;

    setUsername(profile.username || "");
    setFullName((profile as any).full_name || "");
    setBio(profile.bio || "");
    setPlatform((profile as any).platform || "");
    setBannerNotifications(
      (profile as any).banner_notifications_enabled ?? true,
    );
    setIsMinor((profile as any).is_minor ?? false);
    setCreatorSubscriptionEnabled(
      (profile as any).creator_subscription_enabled ?? false,
    );
    setCreatorSubscriptionPrice(
      (profile as any).creator_subscription_price_coins ?? 100,
    );
  }, [profile]);

  const handleSaveProfile = async () => {
    if (!user) return;

    const cleanUsername = username.trim().toLowerCase();
    const cleanFullName = fullName.trim();
    const cleanBio = bio.trim();

    if (!/^[a-zA-Z0-9_]{2,20}$/.test(cleanUsername)) {
      toast.error(
        "Username must be 2–20 characters using letters, numbers, or underscores.",
      );
      return;
    }

    if (cleanBio.length > 500) {
      toast.error("Bio must be 500 characters or fewer.");
      return;
    }

    setSavingProfile(true);

    try {
      if (profile?.username?.toLowerCase() !== cleanUsername) {
        const { data: existing, error: availabilityError } = await supabase
          .from("user_profiles")
          .select("id")
          .eq("username", cleanUsername)
          .neq("id", user.id)
          .maybeSingle();

        if (availabilityError) throw availabilityError;

        if (existing) {
          toast.error("That username is already taken.");
          return;
        }
      }

      const { error } = await supabase
        .from("user_profiles")
        .update({
          username: cleanUsername,
          full_name: cleanFullName || null,
          bio: cleanBio,
          platform: platform || null,
          banner_notifications_enabled: bannerNotifications,
          is_minor: isMinor,
          updated_at: new Date().toISOString(),
        })
        .eq("id", user.id);

      if (error) throw error;

      await refreshProfile(true);
      toast.success("Profile settings saved.");
    } catch (error) {
      console.error("[ProfileSettings] Failed to save profile:", error);
      toast.error("Failed to save profile settings.");
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSaveCreatorMemberships = async () => {
    if (!user) return;

    const normalizedPrice = Math.max(
      10,
      Math.min(10000, creatorSubscriptionPrice || 100),
    );
    setCreatorSubscriptionPrice(normalizedPrice);
    setSavingSubscription(true);

    try {
      const { error } = await supabase
        .from("user_profiles")
        .update({
          creator_subscription_enabled: creatorSubscriptionEnabled,
          creator_subscription_price_coins: normalizedPrice,
          updated_at: new Date().toISOString(),
        })
        .eq("id", user.id);

      if (error) throw error;

      await refreshProfile(true);
      toast.success("Creator memberships updated.");
    } catch (error) {
      console.error(
        "[ProfileSettings] Failed to save creator memberships:",
        error,
      );
      toast.error("Failed to update creator memberships.");
    } finally {
      setSavingSubscription(false);
    }
  };

  if (!user) return null;

  return (
    <div
      className={`min-h-screen ${MaiTrollTheme.backgrounds.primary} p-4 text-white sm:p-6 overflow-y-auto`}
    >
      <main className="mx-auto max-w-6xl space-y-6">
        <header className="flex items-center gap-3">
          <div
            className={`flex h-12 w-12 items-center justify-center rounded-xl ${MaiTrollTheme.gradients.button}`}
          >
            <Settings className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-3xl font-black">Account Settings</h1>
            <p className={`text-sm ${MaiTrollTheme.text.muted}`}>
              Manage your profile, creator tools, preferences, and account
              access.
            </p>
          </div>
        </header>

        <section className={`${MaiTrollTheme.components.card} space-y-5`}>
          <div className="flex items-center gap-2">
            <UserRound className="h-5 w-5 text-cyan-300" />
            <div>
              <h2 className="text-xl font-semibold">Profile</h2>
              <p className={`text-xs ${MaiTrollTheme.text.muted}`}>
                Update the public details shown across Mai Troll.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <label className="space-y-2">
              <span className={`text-sm ${MaiTrollTheme.text.muted}`}>
                Full Name
              </span>
              <input
                type="text"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                className={`w-full rounded-xl px-4 py-3 text-white outline-none ${MaiTrollTheme.components.input}`}
                placeholder="Your name"
                maxLength={80}
              />
              <span className={`block text-xs ${MaiTrollTheme.text.muted}`}>
                Used for account recovery and internal verification.
              </span>
            </label>

            <label className="space-y-2">
              <span className={`text-sm ${MaiTrollTheme.text.muted}`}>
                Username
              </span>
              <input
                type="text"
                value={username}
                onChange={(event) =>
                  setUsername(event.target.value.replace(/[^a-zA-Z0-9_]/g, ""))
                }
                className={`w-full rounded-xl px-4 py-3 text-white outline-none ${MaiTrollTheme.components.input}`}
                placeholder="username"
                maxLength={20}
                autoCapitalize="none"
                autoCorrect="off"
              />
              <span className={`block text-xs ${MaiTrollTheme.text.muted}`}>
                Two to twenty characters. Letters, numbers, and underscores
                only.
              </span>
            </label>

            <label className="space-y-2 md:col-span-2">
              <span className={`text-sm ${MaiTrollTheme.text.muted}`}>
                Bio
              </span>
              <textarea
                value={bio}
                onChange={(event) => setBio(event.target.value)}
                className={`min-h-28 w-full resize-y rounded-xl px-4 py-3 text-white outline-none ${MaiTrollTheme.components.input}`}
                placeholder="Tell Mai Troll who you are."
                maxLength={500}
              />
              <span
                className={`block text-right text-xs ${MaiTrollTheme.text.muted}`}
              >
                {bio.length}/500
              </span>
            </label>

            <label className="space-y-2 md:col-span-2">
              <span className={`text-sm ${MaiTrollTheme.text.muted}`}>
                Platform You Represent
              </span>
              <select
                value={platform}
                onChange={(event) => setPlatform(event.target.value)}
                className={`w-full rounded-xl px-4 py-3 text-white outline-none ${MaiTrollTheme.components.input}`}
              >
                {PLATFORM_OPTIONS.map((option) => (
                  <option
                    key={option.value}
                    value={option.value}
                    className="bg-slate-950"
                  >
                    {option.label}
                  </option>
                ))}
              </select>
              <span className={`block text-xs ${MaiTrollTheme.text.muted}`}>
                This may appear on your profile and in battle experiences.
              </span>
            </label>
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleSaveProfile}
              disabled={savingProfile}
              className={`flex items-center gap-2 rounded-xl px-6 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50 ${MaiTrollTheme.gradients.button}`}
            >
              <Save className="h-4 w-4" />
              {savingProfile ? "Saving..." : "Save Profile"}
            </button>
          </div>
        </section>

        <section className={`${MaiTrollTheme.components.card} space-y-4`}>
          <div className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-emerald-300" />
            <div>
              <h2 className="text-xl font-semibold">Creator Memberships</h2>
              <p className={`text-xs ${MaiTrollTheme.text.muted}`}>
                Let supporters subscribe to your Mai Troll content.
              </p>
            </div>
          </div>

          <div
            className={`flex items-center justify-between gap-4 rounded-xl border p-4 ${MaiTrollTheme.backgrounds.glass} ${MaiTrollTheme.borders.glass}`}
          >
            <div>
              <p className="font-medium">Enable memberships</p>
              <p className={`text-xs ${MaiTrollTheme.text.muted}`}>
                Supporters can subscribe for recurring Troll Coin access.
              </p>
            </div>
            <Toggle
              checked={creatorSubscriptionEnabled}
              onChange={() =>
                setCreatorSubscriptionEnabled((current) => !current)
              }
              label="Enable creator memberships"
            />
          </div>

          <label className="space-y-2">
            <span className={`text-sm ${MaiTrollTheme.text.muted}`}>
              Membership Price (Troll Coins)
            </span>
            <input
              type="number"
              min={10}
              max={10000}
              value={creatorSubscriptionPrice}
              onChange={(event) =>
                setCreatorSubscriptionPrice(
                  Math.max(
                    10,
                    Math.min(
                      10000,
                      Number.parseInt(event.target.value, 10) || 100,
                    ),
                  ),
                )
              }
              disabled={!creatorSubscriptionEnabled}
              className={`w-full rounded-xl px-4 py-3 text-white outline-none disabled:cursor-not-allowed disabled:opacity-50 ${MaiTrollTheme.components.input}`}
            />
            <span className={`block text-xs ${MaiTrollTheme.text.muted}`}>
              Membership benefits can include a badge, seat discounts, and
              faster seat approval.
            </span>
          </label>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleSaveCreatorMemberships}
              disabled={savingSubscription}
              className={`flex items-center gap-2 rounded-xl px-6 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50 ${MaiTrollTheme.gradients.button}`}
            >
              <Save className="h-4 w-4" />
              {savingSubscription ? "Saving..." : "Save Memberships"}
            </button>
          </div>
        </section>

        <section className={`${MaiTrollTheme.components.card} space-y-4`}>
          <h2 className="text-xl font-semibold">Preferences</h2>

          <div
            className={`flex items-center justify-between gap-4 rounded-xl border p-4 ${MaiTrollTheme.backgrounds.glass} ${MaiTrollTheme.borders.glass}`}
          >
            <div>
              <p className="font-medium">Global Pod Notifications</p>
              <p className={`text-xs ${MaiTrollTheme.text.muted}`}>
                Receive a banner when a Pod goes live.
              </p>
            </div>
            <Toggle
              checked={bannerNotifications}
              onChange={() => setBannerNotifications((current) => !current)}
              label="Global Pod notifications"
            />
          </div>

          <div
            className={`rounded-xl border p-4 ${MaiTrollTheme.backgrounds.glass} ${MaiTrollTheme.borders.glass}`}
          >
            <BatterySaverToggle />
          </div>

          <div
            className={`flex items-center justify-between gap-4 rounded-xl border p-4 ${MaiTrollTheme.backgrounds.glass} ${MaiTrollTheme.borders.glass}`}
          >
            <div>
              <p className="font-medium">Minor Account</p>
              <p className={`text-xs ${MaiTrollTheme.text.muted}`}>
                Enable this only when the account belongs to someone under 18.
              </p>
            </div>
            <Toggle
              checked={isMinor}
              onChange={() => setIsMinor((current) => !current)}
              label="Minor account"
            />
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleSaveProfile}
              disabled={savingProfile}
              className={`flex items-center gap-2 rounded-xl px-6 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50 ${MaiTrollTheme.gradients.button}`}
            >
              <Save className="h-4 w-4" />
              {savingProfile ? "Saving..." : "Save Preferences"}
            </button>
          </div>
        </section>

        {profile && (
          <section className={MaiTrollTheme.components.card}>
            <FamilyMinorSettings
              profile={profile as any}
              onUpdate={() => refreshProfile(true)}
            />
          </section>
        )}

        <section className={MaiTrollTheme.components.card}>
          <div className="mb-4 flex items-center gap-2">
            <Boxes className="h-5 w-5 text-purple-300" />
            <div>
              <h2 className="text-xl font-semibold">Inventory</h2>
              <p className={`text-xs ${MaiTrollTheme.text.muted}`}>
                View and manage your Mai Troll items.
              </p>
            </div>
          </div>
          <UserInventory embedded />
        </section>

        <section className={`${MaiTrollTheme.components.card} space-y-4`}>
          <h2 className="text-xl font-semibold">Appearance</h2>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <Sparkles className="h-5 w-5 text-pink-400" />
              <div>
                <h3 className="font-semibold">Avatar Studio</h3>
                <p className={`text-xs ${MaiTrollTheme.text.muted}`}>
                  Equip clothing and update your Mai Troll look.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => navigate("/avatar-customizer")}
              className={`rounded-lg px-4 py-2 text-sm font-semibold text-white ${MaiTrollTheme.gradients.button}`}
            >
              Open Avatar Studio
            </button>
          </div>
        </section>

        <section className={`${MaiTrollTheme.components.card} space-y-5`}>
          <h2 className="text-xl font-semibold">Security</h2>

          <div className="flex items-start gap-3">
            <KeyRound className="mt-0.5 h-5 w-5 text-emerald-400" />
            <div>
              <h3 className="font-semibold">Password Reset</h3>
              <p className={`text-xs ${MaiTrollTheme.text.muted}`}>
                Use the Forgot Password link on the sign-in page to reset your
                password by email.
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-4 border-t border-white/10 pt-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <Ban className="h-5 w-5 text-amber-400" />
              <div>
                <h3 className="font-semibold">Blocked Users</h3>
                <p className={`text-xs ${MaiTrollTheme.text.muted}`}>
                  Review and manage the people you have blocked.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => navigate("/blocked-users")}
              className={`rounded-lg px-4 py-2 text-sm font-semibold text-white ${MaiTrollTheme.gradients.button}`}
            >
              Manage Blocked Users
            </button>
          </div>
        </section>

        <section className={`${MaiTrollTheme.components.card} space-y-4`}>
          <h2 className="text-xl font-semibold">Mai Troll Experience</h2>
          <div className="flex flex-col gap-4 border-t border-white/10 pt-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <Sparkles className="h-5 w-5 text-emerald-400" />
              <div>
                <h3 className="font-semibold">Grand Entrance</h3>
                <p className={`text-xs ${MaiTrollTheme.text.muted}`}>
                  Replay the cinematic Mai Troll welcome sequence.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => navigate("/?replay-entrance=1")}
              className={`rounded-lg px-4 py-2 text-sm font-semibold text-white ${MaiTrollTheme.gradients.button}`}
            >
              Replay Grand Entrance
            </button>
          </div>
        </section>

        <section
          className={`${MaiTrollTheme.components.card} border border-red-500/30`}
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <Trash2 className="h-5 w-5 text-red-400" />
              <div>
                <h2 className="text-lg font-semibold text-red-400">
                  Danger Zone
                </h2>
                <p className={`text-xs ${MaiTrollTheme.text.muted}`}>
                  Permanently delete your account and associated data.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => navigate("/profile/delete")}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-500"
            >
              Delete Account
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}
