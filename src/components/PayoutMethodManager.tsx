import React, { useState } from 'react'
import { Save, Check, DollarSign, CreditCard } from 'lucide-react';
import { cn } from '../lib/utils'
import { toast } from 'sonner'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../lib/store'

type PayoutMethod = 'cash_app' | 'paypal' | 'venmo'

interface PayoutMethodManagerProps {
  onSaved?: () => void
}

export default function PayoutMethodManager({ onSaved }: PayoutMethodManagerProps) {
  const { user, profile } = useAuthStore()
  const [preferredMethod, setPreferredMethod] = useState<PayoutMethod>(
    (profile?.preferred_payout_method as PayoutMethod) || 'cash_app'
  )
  const [cashAppHandle, setCashAppHandle] = useState(profile?.cashapp_handle || '')
  const [venmoHandle, setVenmoHandle] = useState(profile?.venmo_handle || '')
  const [paypalEmail, setPaypalEmail] = useState(profile?.paypal_email || '')
  const [saving, setSaving] = useState(false)

  // Validation functions
  const validatePaypalEmail = (email: string): boolean => {
    if (!email) return true // Optional field
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  }

  const validateCashAppHandle = (handle: string): boolean => {
    if (!handle) return true // Optional field
    // Support $cashtag or plain handle (4-14 characters after $)
    const cashtagRegex = /^\$?[a-zA-Z][a-zA-Z0-9_]{3,13}$/
    return cashtagRegex.test(handle)
  }

  const validateVenmoHandle = (handle: string): boolean => {
    if (!handle) return true // Optional field
    // Venmo usernames: 4-20 characters, alphanumeric and underscores
    const venmoRegex = /^[a-zA-Z][a-zA-Z0-9_]{3,19}$/
    return venmoRegex.test(handle)
  }

  const handleSave = async () => {
    if (!user) {
      toast.error('Please log in to save payout methods')
      return
    }

    // Validate fields
    const errors: string[] = []

    if (preferredMethod === 'paypal' && paypalEmail && !validatePaypalEmail(paypalEmail)) {
      errors.push('Invalid PayPal email format')
    }
    if (preferredMethod === 'cash_app' && cashAppHandle && !validateCashAppHandle(cashAppHandle)) {
      errors.push('Invalid Cash App handle format')
    }
    if (preferredMethod === 'venmo' && venmoHandle && !validateVenmoHandle(venmoHandle)) {
      errors.push('Invalid Venmo username format')
    }

    if (errors.length > 0) {
      errors.forEach(err => toast.error(err))
      return
    }

    setSaving(true)
    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({
          preferred_payout_method: preferredMethod,
          cashapp_handle: cashAppHandle || null,
          venmo_handle: venmoHandle || null,
          paypal_email: paypalEmail || null,
        })
        .eq('id', user.id)

      if (error) throw error

      // Update local profile
      useAuthStore.getState().setProfile({
        ...profile,
        preferred_payout_method: preferredMethod,
        cashapp_handle: cashAppHandle || null,
        venmo_handle: venmoHandle || null,
        paypal_email: paypalEmail || null,
      })

      toast.success('Payout methods saved!')
      onSaved?.()
    } catch (error: any) {
      console.error('Save payout methods error:', error)
      toast.error(error.message || 'Failed to save payout methods')
    } finally {
      setSaving(false)
    }
  }

  const _getMethodIcon = (method: PayoutMethod) => {
    switch (method) {
      case 'cash_app': return '$'
      case 'paypal': return <DollarSign className="h-4 w-4" />
      case 'venmo': return <CreditCard className="h-4 w-4" />
    }
  }

  return (
    <div className="space-y-6">
      {/* Preferred Method Selection */}
      <div>
        <label className="block text-sm font-bold text-slate-300 mb-3">
          Preferred Payout Method
        </label>
        <div className="grid grid-cols-3 gap-3">
          {(['cash_app', 'paypal', 'venmo'] as PayoutMethod[]).map((method) => (
            <button
              key={method}
              onClick={() => setPreferredMethod(method)}
              className={cn(
                'flex flex-col items-center gap-2 rounded-xl border p-4 transition-all',
                preferredMethod === method
                  ? 'border-troll-gold bg-troll-gold/10 text-troll-gold'
                  : 'border-white/10 bg-white/5 text-slate-300 hover:border-white/20'
              )}
            >
              <span className="text-lg font-bold">
                {method === 'cash_app' ? '$' : method === 'paypal' ? 'PP' : 'V'}
              </span>
              <span className="text-xs font-medium">
                {method === 'cash_app' ? 'Cash App' : method === 'paypal' ? 'PayPal' : 'Venmo'}
              </span>
              {preferredMethod === method && (
                <Check className="h-4 w-4 text-troll-gold" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Payout Details */}
      <div className="space-y-4">
        {/* Cash App */}
        <div>
          <label className="block text-xs font-bold text-slate-400 mb-1">
            Cash App Handle ($cashtag or username)
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">$</span>
            <input
              type="text"
              value={cashAppHandle}
              onChange={(e) => setCashAppHandle(e.target.value.replace('$', ''))}
              placeholder="yourcashtag"
              className={cn(
                'w-full rounded-xl border bg-white/5 py-3 pl-8 pr-4 text-white placeholder-slate-500 transition-colors focus:outline-none focus:ring-2',
                cashAppHandle && !validateCashAppHandle(cashAppHandle)
                  ? 'border-red-500 focus:ring-red-500'
                  : 'border-white/10 focus:ring-cyan-500'
              )}
            />
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Optional. Format: $cashtag or username (4-14 characters)
          </p>
        </div>

        {/* Venmo */}
        <div>
          <label className="block text-xs font-bold text-slate-400 mb-1">
            Venmo Username
          </label>
          <input
            type="text"
            value={venmoHandle}
            onChange={(e) => setVenmoHandle(e.target.value)}
            placeholder="yourusername"
            className={cn(
              'w-full rounded-xl border bg-white/5 py-3 px-4 text-white placeholder-slate-500 transition-colors focus:outline-none focus:ring-2',
              venmoHandle && !validateVenmoHandle(venmoHandle)
                ? 'border-red-500 focus:ring-red-500'
                : 'border-white/10 focus:ring-cyan-500'
            )}
          />
          <p className="mt-1 text-xs text-slate-500">
            Optional. Username format: 4-20 characters
          </p>
        </div>

        {/* PayPal */}
        <div>
          <label className="block text-xs font-bold text-slate-400 mb-1">
            PayPal Email
          </label>
          <input
            type="email"
            value={paypalEmail}
            onChange={(e) => setPaypalEmail(e.target.value)}
            placeholder="you@example.com"
            className={cn(
              'w-full rounded-xl border bg-white/5 py-3 px-4 text-white placeholder-slate-500 transition-colors focus:outline-none focus:ring-2',
              paypalEmail && !validatePaypalEmail(paypalEmail)
                ? 'border-red-500 focus:ring-red-500'
                : 'border-white/10 focus:ring-cyan-500'
            )}
          />
          <p className="mt-1 text-xs text-slate-500">
            Optional. Valid email format required for PayPal
          </p>
        </div>
      </div>

      {/* Save Button */}
      <button
        onClick={handleSave}
        disabled={saving}
        className={cn(
          'flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 font-bold text-white transition-all',
          saving
            ? 'cursor-not-allowed bg-gray-600'
            : 'bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500'
        )}
      >
        <Save className="h-5 w-5" />
        {saving ? 'Saving...' : 'Save Payout Methods'}
      </button>
    </div>
  )
}