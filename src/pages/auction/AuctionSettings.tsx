import React, { useCallback, useEffect, useState } from 'react'
import { Bell, Coins, Eye, Loader2, Save, Shield, Trophy, Zap } from 'lucide-react';
import { toast } from 'sonner'

import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../lib/store'
import { cn } from '../../lib/utils'

import AuctionNav from './AuctionNav'

interface AuctioneerSettings {
  default_bid_increment: number
  auto_advance_queue: boolean
  notify_on_bid: boolean
  notify_on_sale: boolean
  require_shipping_address: boolean
  default_auction_duration_minutes: number
  min_starting_bid: number
  max_lots_per_show: number
  // Anonymous Round
  anonymous_round_enabled: boolean
  anonymous_round_default_duration: number
  anonymous_round_max_duration: number
  // Boost Bid
  boost_bids_enabled: boolean
  boost_bid_allowed_increments: string
  boost_bid_max_amount: number
  boost_bid_custom_enabled: boolean
  // Predictions
  predictions_enabled: boolean
}

const shell =
  'relative min-h-screen overflow-y-auto overflow-x-hidden md:overflow-hidden bg-[#07101f] px-3 pb-8 pt-20 text-white sm:px-4 md:px-6'
const panel =
  'rounded-[1.65rem] border border-cyan-300/15 bg-[#0b1628]/85 shadow-[0_0_45px_rgba(34,211,238,0.12)] backdrop-blur-2xl'
const _panelSoft =
  'rounded-[1.4rem] border border-cyan-300/12 bg-[#0d1a2f]/78 shadow-[0_0_28px_rgba(34,211,238,0.08)] backdrop-blur-xl'
const input =
  'w-full rounded-xl border border-cyan-300/20 bg-[#07101f]/85 px-4 py-3 text-sm text-white placeholder:text-slate-500 outline-none transition focus:border-cyan-300/50 focus:ring-2 focus:ring-cyan-300/15'
const primary =
  'inline-flex items-center justify-center gap-2 rounded-xl border border-cyan-200/40 bg-cyan-300 px-4 py-2.5 text-sm font-black text-slate-950 shadow-[0_0_26px_rgba(34,211,238,0.28)] transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-50'
const _secondary =
  'inline-flex items-center justify-center gap-2 rounded-xl border border-cyan-300/20 bg-cyan-400/10 px-4 py-2.5 text-sm font-bold text-cyan-100 transition hover:border-cyan-300/35 hover:bg-cyan-400/18 hover:text-white disabled:cursor-not-allowed disabled:opacity-50'

export default function AuctionSettings() {
  const { user } = useAuthStore()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [auctioneerId, setAuctioneerId] = useState<string | null>(null)

  const [settings, setSettings] = useState<AuctioneerSettings>({
    default_bid_increment: 500,
    auto_advance_queue: false,
    notify_on_bid: true,
    notify_on_sale: true,
    require_shipping_address: true,
    default_auction_duration_minutes: 120,
    min_starting_bid: 100,
    max_lots_per_show: 50,
    // Anonymous Round
    anonymous_round_enabled: true,
    anonymous_round_default_duration: 30,
    anonymous_round_max_duration: 120,
    // Boost Bid
    boost_bids_enabled: true,
    boost_bid_allowed_increments: '2,5,10',
    boost_bid_max_amount: 100,
    boost_bid_custom_enabled: false,
    // Predictions
    predictions_enabled: true,
  })

  const fetchSettings = useCallback(async () => {
    if (!user?.id) return

    setLoading(true)
    try {
      const { data: auctioneer } = await supabase
        .from('auctioneer_profiles')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle()

      if (auctioneer) {
        setAuctioneerId(auctioneer.id)
        if (auctioneer.settings) {
          const s = auctioneer.settings as any;
          setSettings((prev) => ({
            ...prev,
            ...s,
            // Convert int[] to comma-separated string for UI
            boost_bid_allowed_increments: Array.isArray(s.boost_bid_allowed_increments)
              ? s.boost_bid_allowed_increments.join(',')
              : (s.boost_bid_allowed_increments || '2,5,10'),
          }));
        }
      }
    } catch (error) {
      console.error('[AuctionSettings] Error:', error)
    } finally {
      setLoading(false)
    }
  }, [user?.id])

  useEffect(() => {
    void fetchSettings()
  }, [fetchSettings])

  const updateSetting = <K extends keyof AuctioneerSettings>(key: K, value: AuctioneerSettings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }))
  }

  const saveSettings = async () => {
    if (!auctioneerId) return

    setSaving(true)
    try {
      // Convert comma-separated string to int[] for DB
      const settingsToSave = {
        ...settings,
        boost_bid_allowed_increments: settings.boost_bid_allowed_increments
          .split(',')
          .map((s: string) => parseInt(s.trim(), 10))
          .filter((n: number) => !isNaN(n)),
      };

      const { error } = await supabase
        .from('auctioneer_profiles')
        .update({ settings: settingsToSave })
        .eq('id', auctioneerId)

      if (error) throw error
      toast.success('Settings saved')
    } catch (_error: any) {
      toast.error('Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className={shell}>
        <div className="flex min-h-[60vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-cyan-300" />
        </div>
      </div>
    )
  }

  return (
    <div className={shell}>
      <div className="pointer-events-none fixed inset-0 z-0 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.15),transparent_32%),radial-gradient(circle_at_75%_20%,rgba(59,130,246,0.12),transparent_26%)]" />

      <main className="relative z-10 mx-auto max-w-[900px] space-y-4">
        <AuctionNav active="settings" />

        {/* Header */}
        <header className={cn(panel, 'overflow-hidden p-5')}>
          <h1 className="text-3xl font-black text-white md:text-4xl">Settings</h1>
          <p className="mt-1 text-sm text-slate-400">
            Configure your auctioneer defaults and preferences.
          </p>
        </header>

        {/* Auction Defaults */}
        <section className={cn(panel, 'p-5')}>
          <h2 className="mb-4 flex items-center gap-2 text-lg font-black text-white">
            <Coins className="h-5 w-5 text-cyan-300" />
            Auction Defaults
          </h2>

          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-bold text-cyan-100">Default Bid Increment</label>
                <input
                  type="number"
                  value={settings.default_bid_increment}
                  onChange={(e) => updateSetting('default_bid_increment', Number(e.target.value))}
                  className={input}
                />
                <p className="mt-1 text-xs text-slate-500">Default increment for new lots (in coins)</p>
              </div>

              <div>
                <label className="mb-2 block text-sm font-bold text-cyan-100">Minimum Starting Bid</label>
                <input
                  type="number"
                  value={settings.min_starting_bid}
                  onChange={(e) => updateSetting('min_starting_bid', Number(e.target.value))}
                  className={input}
                />
                <p className="mt-1 text-xs text-slate-500">Minimum allowed starting bid (in coins)</p>
              </div>

              <div>
                <label className="mb-2 block text-sm font-bold text-cyan-100">Default Show Duration</label>
                <input
                  type="number"
                  value={settings.default_auction_duration_minutes}
                  onChange={(e) => updateSetting('default_auction_duration_minutes', Number(e.target.value))}
                  className={input}
                />
                <p className="mt-1 text-xs text-slate-500">Expected show length in minutes</p>
              </div>

              <div>
                <label className="mb-2 block text-sm font-bold text-cyan-100">Max Lots Per Show</label>
                <input
                  type="number"
                  value={settings.max_lots_per_show}
                  onChange={(e) => updateSetting('max_lots_per_show', Number(e.target.value))}
                  className={input}
                />
                <p className="mt-1 text-xs text-slate-500">Maximum items allowed in a single show</p>
              </div>
            </div>
          </div>
        </section>

        {/* Behavior */}
        <section className={cn(panel, 'p-5')}>
          <h2 className="mb-4 flex items-center gap-2 text-lg font-black text-white">
            <Shield className="h-5 w-5 text-cyan-300" />
            Behavior
          </h2>

          <div className="space-y-3">
            <ToggleRow
              label="Auto-advance Queue"
              description="Automatically show the next lot when the current one is marked sold or pass"
              checked={settings.auto_advance_queue}
              onChange={(v) => updateSetting('auto_advance_queue', v)}
            />
            <ToggleRow
              label="Require Shipping Address"
              description="Require buyers to provide a shipping address before they can bid"
              checked={settings.require_shipping_address}
              onChange={(v) => updateSetting('require_shipping_address', v)}
            />
          </div>
        </section>

        {/* Notifications */}
        <section className={cn(panel, 'p-5')}>
          <h2 className="mb-4 flex items-center gap-2 text-lg font-black text-white">
            <Bell className="h-5 w-5 text-cyan-300" />
            Notifications
          </h2>

          <div className="space-y-3">
            <ToggleRow
              label="Notify on New Bid"
              description="Get notified when a new bid is placed on your lots"
              checked={settings.notify_on_bid}
              onChange={(v) => updateSetting('notify_on_bid', v)}
            />
            <ToggleRow
              label="Notify on Sale"
              description="Get notified when a lot is sold"
              checked={settings.notify_on_sale}
              onChange={(v) => updateSetting('notify_on_sale', v)}
            />
          </div>
        </section>

        {/* Anonymous Round Settings */}
        <section className={cn(panel, 'p-5')}>
          <h2 className="mb-4 flex items-center gap-2 text-lg font-black text-white">
            <Eye className="h-5 w-5 text-indigo-300" />
            Anonymous Bid Round
          </h2>

          <div className="space-y-4">
            <ToggleRow
              label="Enable Anonymous Rounds"
              description="Allow hiding bidder identities during live auctions"
              checked={settings.anonymous_round_enabled}
              onChange={(v) => updateSetting('anonymous_round_enabled', v)}
            />

            {settings.anonymous_round_enabled && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-bold text-indigo-100">Default Duration (seconds)</label>
                  <input
                    type="number"
                    value={settings.anonymous_round_default_duration}
                    onChange={(e) => updateSetting('anonymous_round_default_duration', Number(e.target.value))}
                    min={10}
                    max={300}
                    className={input}
                  />
                  <p className="mt-1 text-xs text-slate-500">Default duration when starting an anonymous round</p>
                </div>
                <div>
                  <label className="mb-2 block text-sm font-bold text-indigo-100">Max Duration (seconds)</label>
                  <input
                    type="number"
                    value={settings.anonymous_round_max_duration}
                    onChange={(e) => updateSetting('anonymous_round_max_duration', Number(e.target.value))}
                    min={10}
                    max={600}
                    className={input}
                  />
                  <p className="mt-1 text-xs text-slate-500">Maximum allowed anonymous round duration</p>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Boost Bid Settings */}
        <section className={cn(panel, 'p-5')}>
          <h2 className="mb-4 flex items-center gap-2 text-lg font-black text-white">
            <Zap className="h-5 w-5 text-amber-300" />
            Boost Bids
          </h2>

          <div className="space-y-4">
            <ToggleRow
              label="Enable Boost Bids"
              description="Allow bidders to increase their bid increment for extra impact"
              checked={settings.boost_bids_enabled}
              onChange={(v) => updateSetting('boost_bids_enabled', v)}
            />

            {settings.boost_bids_enabled && (
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-bold text-amber-100">Allowed Increments (comma-separated)</label>
                    <input
                      type="text"
                      value={settings.boost_bid_allowed_increments}
                      onChange={(e) => updateSetting('boost_bid_allowed_increments', e.target.value)}
                      placeholder="2,5,10"
                      className={input}
                    />
                    <p className="mt-1 text-xs text-slate-500">Comma-separated boost values (e.g. 2,5,10)</p>
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-bold text-amber-100">Max Boost Amount</label>
                    <input
                      type="number"
                      value={settings.boost_bid_max_amount}
                      onChange={(e) => updateSetting('boost_bid_max_amount', Number(e.target.value))}
                      min={1}
                      className={input}
                    />
                    <p className="mt-1 text-xs text-slate-500">Maximum boost in coins</p>
                  </div>
                </div>
                <ToggleRow
                  label="Allow Custom Boost Amounts"
                  description="Let bidders enter any boost amount up to the maximum"
                  checked={settings.boost_bid_custom_enabled}
                  onChange={(v) => updateSetting('boost_bid_custom_enabled', v)}
                />
              </>
            )}
          </div>
        </section>

        {/* Prediction Settings */}
        <section className={cn(panel, 'p-5')}>
          <h2 className="mb-4 flex items-center gap-2 text-lg font-black text-white">
            <Trophy className="h-5 w-5 text-purple-300" />
            Prediction Bids
          </h2>

          <div className="space-y-3">
            <ToggleRow
              label="Enable Predictions"
              description="Let bidders and spectators predict auction outcomes"
              checked={settings.predictions_enabled}
              onChange={(v) => updateSetting('predictions_enabled', v)}
            />
            <p className="text-xs text-slate-500">
              Reward settings (crowns, XP, event points) are configured by admins in the global auction settings.
            </p>
          </div>
        </section>

        {/* Save */}
        <div className="flex justify-end">
          <button onClick={saveSettings} disabled={saving} className={cn(primary, 'min-w-[200px]')}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save Settings
          </button>
        </div>
      </main>
    </div>
  )
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string
  description: string
  checked: boolean
  onChange: (value: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-white/[0.03] p-4">
      <div>
        <p className="text-sm font-bold text-white">{label}</p>
        <p className="mt-0.5 text-xs text-slate-500">{description}</p>
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={cn(
          'relative h-7 w-12 shrink-0 rounded-full transition',
          checked ? 'bg-cyan-400' : 'bg-slate-700'
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition',
            checked ? 'left-[22px]' : 'left-0.5'
          )}
        />
      </button>
    </div>
  )
}
