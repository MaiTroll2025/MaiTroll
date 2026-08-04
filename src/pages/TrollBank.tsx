// src/pages/TrollBank.tsx
import React, { useEffect, useCallback, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useBank } from '@/lib/hooks/useBank'
import { useCoins } from '@/lib/hooks/useCoins'
import { toast } from 'sonner'
import { Coins, CreditCard, Landmark, History, AlertCircle, CheckCircle, Lock, Plus, ArrowUpRight, CalendarClock, AlertTriangle, Clock, TrendingDown } from 'lucide-react'
import { MaiTrollTheme } from '@/styles/trollCityTheme'
import SquarePaymentModal from '@/components/broadcast/SquarePaymentModal'
import TrollCardSaver from '@/components/payments/TrollCardSaver'
import { useAuthStore } from '@/lib/store'

function getDaysUntilDue(dueDate: string | null): number | null {
  if (!dueDate) return null;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const due = new Date(dueDate + 'T00:00:00');
  return Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

export default function TrollBank() {
  const { user, profile, refreshProfile } = useAuthStore()
  const { balances, refreshCoins } = useCoins()
  const { loans, ledger, payLoan, payCreditCard, creditInfo } = useBank()
  const activeLoan = loans && loans.length > 0 ? loans[0] : null
  
  const [bankBalance, setBankBalance] = useState<number | null>(null)
  
  const [savedCards, setSavedCards] = useState<any[]>([])
  const [showSaveCardModal, setShowSaveCardModal] = useState(false)

  // Small installment purchases (credit-building credit-card items under 100 coins)
  const [smallPurchases, setSmallPurchases] = useState<any[]>([])
  const [smallPurchasesLoading, setSmallPurchasesLoading] = useState(false)

  const fetchSmallPurchases = useCallback(async () => {
    if (!user?.id) return
    setSmallPurchasesLoading(true)
    try {
      const { data, error } = await supabase
        .from('small_installment_purchases')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20)
      if (error) throw error
      setSmallPurchases(data || [])
    } catch (err) {
      console.error('Failed to fetch small purchases:', err)
    } finally {
      setSmallPurchasesLoading(false)
    }
  }, [user?.id])

  // Refresh profile if not loaded
  useEffect(() => {
    if (user && !profile) {
      refreshProfile()
    }
  }, [user, profile, refreshProfile])

  // Function to fetch saved cards
  const fetchSavedCards = async () => {
    if (!user?.id) return
    try {
      const { data, error } = await supabase
        .from('user_payment_methods')
        .select('*')
        .eq('user_id', user.id)
        .order('is_default', { ascending: false })

      if (error) throw error
      setSavedCards(data || [])
    } catch (err) {
      console.error('Failed to fetch saved cards:', err)
    }
  }

  // Fetch saved cards on mount and when user changes
  useEffect(() => {
    fetchSavedCards()
  }, [user?.id])

  // Fetch small purchase credit-building trackers
   
  useEffect(() => {
    fetchSmallPurchases()
    // eslint-enable react-hooks/exhaustive-deps
  }, [])

  // Fetch and Subscribe to Bank Reserves
  useEffect(() => {
    const fetchReserves = async () => {
      try {
        const { data, error } = await supabase.rpc('get_bank_reserves')
        if (error) throw error
        setBankBalance(data)
      } catch (err) {
        console.error('Failed to fetch bank reserves:', err)
      }
    }

    fetchReserves()

    // Subscribe to ledger changes to update reserves instantly
    const channel = supabase
      .channel('bank_reserves_updates')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'coin_ledger' },
        () => fetchReserves()
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  const [payAmount, setPayAmount] = useState<string>('')
  const [paying, setPaying] = useState(false)
  
  // Legacy Loan Payment
  const [legacyPayAmount, setLegacyPayAmount] = useState<string>('')
  const [legacyPaying, setLegacyPaying] = useState(false)

  const handlePayCredit = async () => {
    if (!payAmount) return
    const amount = parseInt(payAmount)
    if (isNaN(amount) || amount <= 0) {
      toast.error('Invalid amount')
      return
    }
    
    setPaying(true)
    const result = await payCreditCard(amount)
    setPaying(false)
    
    if (result.success) {
      setPayAmount('')
      refreshCoins()
      fetchSmallPurchases() // refresh small-installment trackers after paying the bill
    }
  }

  const handlePayLegacyLoan = async () => {
    if (!activeLoan || !legacyPayAmount) return
    const amount = parseInt(legacyPayAmount)
    if (isNaN(amount) || amount <= 0) {
      toast.error('Invalid amount')
      return
    }
    
    setLegacyPaying(true)
    const result = await payLoan(activeLoan.id, amount)
    setLegacyPaying(false)
    
    if (result.success) {
      setLegacyPayAmount('')
      refreshCoins()
    }
  }

  return (
    <div className={`min-h-screen ${MaiTrollTheme.backgrounds.primary} text-white p-6 pb-24`}>
      <div className="max-w-4xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex items-center gap-4">
          <div className="p-3 bg-gradient-to-br from-yellow-500 to-yellow-700 rounded-xl shadow-lg shadow-yellow-900/20">
            <Landmark className="w-8 h-8 text-white" />
          </div>
          <div>
            <h1 className={`text-3xl font-bold ${MaiTrollTheme.text.heading}`}>
              Troll Bank
            </h1>
            <p className={MaiTrollTheme.text.secondary}>Secure Coin Storage & Credit Services</p>
          </div>
        </div>

        {/* Balance Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Main Balance */}
          <div className={`${MaiTrollTheme.backgrounds.card} ${MaiTrollTheme.borders.glass} rounded-2xl p-6 relative overflow-hidden group`}>
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <Coins className="w-32 h-32" />
            </div>
            <div className="relative z-10">
              <p className={`${MaiTrollTheme.text.secondary} text-sm font-medium mb-1`}>Available Balance</p>
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-bold text-yellow-400">{(balances?.troll_coins ?? 0).toLocaleString()}</span>
                <span className="text-sm text-yellow-400/70">coins</span>
              </div>
              <div className="mt-4 flex items-center gap-2 text-xs text-gray-500">
                <Lock className="w-3 h-3" />
                <span>Protected by Troll Bank Security</span>
              </div>
            </div>
          </div>

          {/* Bank Reserves */}
          <div className={`${MaiTrollTheme.backgrounds.card} ${MaiTrollTheme.borders.glass} rounded-2xl p-6 relative overflow-hidden group`}>
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <Landmark className="w-32 h-32" />
            </div>
            <div className="relative z-10">
              <p className={`${MaiTrollTheme.text.secondary} text-sm font-medium mb-1`}>Bank Reserves</p>
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-bold text-emerald-400">
                  {bankBalance !== null ? bankBalance.toLocaleString() : '---'}
                </span>
                <span className="text-sm text-emerald-400/70">coins</span>
              </div>
              <div className="mt-4 flex items-center gap-2 text-xs text-gray-500">
                <CheckCircle className="w-3 h-3" />
                <span>Verified Bank Holdings</span>
              </div>
            </div>
          </div>

          {/* Credit Card Status */}
          <div className={`${MaiTrollTheme.backgrounds.card} ${MaiTrollTheme.borders.glass} rounded-2xl p-6 relative overflow-hidden`}>
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <CreditCard className="w-32 h-32" />
            </div>
            <div className="relative z-10">
              <p className={`${MaiTrollTheme.text.secondary} text-sm font-medium mb-1`}>Credit Card Debt</p>
              {creditInfo.used > 0 ? (
                <div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl font-bold text-red-400">{creditInfo.used.toLocaleString()}</span>
                    <span className="text-sm text-red-400/70">owed</span>
                  </div>
                  <div className="mt-3 flex items-center gap-2 text-xs">
                    <span className={`font-medium ${creditInfo.pastDue ? 'text-red-400' : 'text-yellow-400'}`}>
                      {creditInfo.pastDue
                        ? `⚠ Past due — ${Number(creditInfo.apr).toFixed(1)}% APR accruing`
                        : `Min payment ${(creditInfo.minimumPayment ?? 0).toLocaleString()} by ${creditInfo.dueDate ? new Date(creditInfo.dueDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'}`
                      }
                    </span>
                  </div>
                  {creditInfo.pastDue && (
                    <div className="mt-2 p-2 bg-red-500/10 border border-red-500/20 rounded-lg">
                      <p className="text-xs text-red-200">
                        Interest and late fees are being charged daily.
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl font-bold text-green-400">None</span>
                  </div>
                  <p className={`mt-2 text-sm ${MaiTrollTheme.text.secondary}`}>You are debt free!</p>
                </div>
              )}
            </div>
          </div>
        </div>

         {/* Credit Card Management */}
         <div className={`${MaiTrollTheme.backgrounds.card} ${MaiTrollTheme.borders.glass} rounded-2xl p-6`}>
           <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
             <CreditCard className="w-5 h-5 text-purple-400" />
             Credit Card Management
           </h2>

           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <div className="p-4 bg-purple-500/10 border border-purple-500/20 rounded-xl">
                  <p className="text-sm text-purple-300 mb-1">Total Credit Limit</p>
                  <p className="text-2xl font-bold text-white">{(creditInfo?.limit ?? 0).toLocaleString()}</p>
              </div>
              <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl">
                  <p className="text-sm text-blue-300 mb-1">Available to Spend</p>
                  <p className="text-2xl font-bold text-white">{(creditInfo?.available ?? 0).toLocaleString()}</p>
              </div>
              <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                  <p className="text-sm text-amber-300 mb-1">Current APR</p>
                  <p className="text-2xl font-bold text-white">{Number(creditInfo?.apr ?? 25.0).toFixed(1)}%</p>
              </div>
              <div className="p-4 bg-cyan-500/10 border border-cyan-500/20 rounded-xl">
                  <div className="flex items-center gap-1">
                    <CalendarClock className="w-3.5 h-3.5 text-cyan-300" />
                    <p className="text-sm text-cyan-300 mb-1">Due Date</p>
                  </div>
                  <p className={`text-2xl font-bold ${creditInfo?.pastDue ? 'text-red-400' : 'text-white'}`}>
                    {creditInfo?.dueDate ? new Date(creditInfo.dueDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'}
                  </p>
              </div>
           </div>

           {/* Billing Cycle Info */}
           {creditInfo.used > 0 && (
             <div className="mb-4">
               {creditInfo.pastDue ? (
                 <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl mb-4">
                   <div className="flex items-center gap-2 mb-2">
                     <AlertTriangle className="w-5 h-5 text-red-400" />
                     <h3 className="font-semibold text-red-400">PAST DUE — Interest Accruing</h3>
                   </div>
                   <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                     <div>
                       <p className="text-red-300/70">Minimum Payment</p>
                       <p className="text-lg font-bold text-red-300">{(creditInfo.minimumPayment ?? 0).toLocaleString()}</p>
                     </div>
                     <div>
                       <p className="text-red-300/70">Interest Accrued</p>
                       <p className="text-lg font-bold text-red-300">{(creditInfo.interestAccrued ?? 0).toLocaleString()}</p>
                     </div>
                     <div>
                       <p className="text-red-300/70">Late Fees</p>
                       <p className="text-lg font-bold text-red-300">{(creditInfo.lateFeesAccrued ?? 0).toLocaleString()}</p>
                     </div>
                   </div>
                 </div>
               ) : (
                 creditInfo.minimumPayment > 0 && (
                   <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-xl mb-4">
                     <div className="flex items-center gap-2 mb-2">
                       <Clock className="w-5 h-5 text-yellow-400" />
                       <h3 className="font-semibold text-yellow-400">Next Payment Due</h3>
                     </div>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                       <div>
                         <p className="text-yellow-300/70">Minimum Payment</p>
                         <p className="text-lg font-bold text-yellow-300">{(creditInfo.minimumPayment ?? 0).toLocaleString()} coins</p>
                       </div>
                       <div>
                         <p className="text-yellow-300/70">Due By</p>
                         <p className="text-lg font-bold text-yellow-300">
                           {creditInfo.dueDate ? new Date(creditInfo.dueDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                         </p>
                       </div>
                     </div>
                   </div>
                 )
               )}

               <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                 <h3 className="font-semibold text-emerald-400 mb-2">Make a Payment</h3>
                 <p className={`text-sm ${MaiTrollTheme.text.secondary} mb-4`}>
                   Pay down your balance to reduce interest charges and restore your spending limit.
                   {creditInfo.pastDue && <span className="text-red-300 block mt-1">Pay at least the minimum of {(creditInfo.minimumPayment ?? 0).toLocaleString()} coins to stop additional late fees.</span>}
                 </p>
                 <div className="flex gap-2 items-center">
                   <input
                     type="number"
                     value={payAmount}
                     onChange={(e) => setPayAmount(e.target.value)}
                     placeholder="Amount to pay"
                     className={`${MaiTrollTheme.components.input} flex-1`}
                   />
                   <button
                     onClick={handlePayCredit}
                     disabled={paying || !payAmount}
                     className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg font-semibold transition-colors whitespace-nowrap"
                   >
                     {paying ? 'Paying...' : 'Pay Now'}
                   </button>
                   {creditInfo.minimumPayment > 0 && (
                     <button
                       onClick={() => setPayAmount(creditInfo.minimumPayment.toString())}
                       className={`${MaiTrollTheme.buttons.secondary} px-3 py-2 rounded-lg font-medium transition-colors whitespace-nowrap`}
                     >
                       Minimum
                     </button>
                   )}
                   <button
                     onClick={() => setPayAmount(creditInfo.used.toString())}
                     className={`${MaiTrollTheme.buttons.secondary} px-3 py-2 rounded-lg font-medium transition-colors whitespace-nowrap`}
                   >
                     Full Balance
                   </button>
                 </div>
               </div>

               {/* Payment History */}
               {(creditInfo.onTimePayments > 0 || creditInfo.latePayments > 0) && (
                 <div className="mt-4 p-4 bg-gray-800/50 rounded-xl">
                   <h3 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
                     <TrendingDown className="w-4 h-4 text-gray-400" />
                     Payment History
                   </h3>
                   <div className="grid grid-cols-2 gap-4">
                     <div className="flex items-center gap-2">
                       <div className="w-3 h-3 rounded-full bg-green-500" />
                       <span className="text-sm text-gray-400">On-time payments: <strong className="text-green-400">{creditInfo.onTimePayments}</strong></span>
                     </div>
                     <div className="flex items-center gap-2">
                       <div className="w-3 h-3 rounded-full bg-red-500" />
                       <span className="text-sm text-gray-400">Late payments: <strong className="text-red-400">{creditInfo.latePayments}</strong></span>
                     </div>
                   </div>
                 </div>
               )}
             </div>
           )}

           <div className="mt-6 p-4 bg-gray-800/50 rounded-xl">
              <h3 className="text-sm font-semibold text-gray-300 mb-2">Credit Card Terms</h3>
              <ul className="text-sm text-gray-400 space-y-1 list-disc pl-4">
                  <li><strong>Usage:</strong> Valid for Coin Store items and KT Auto vehicles.</li>
                  <li><strong>Restrictions:</strong> Cannot be used for P2P transfers, gifts, or rent.</li>
                  <li><strong>APR:</strong> Variable rate based on your credit tier (Elite 15%, Trusted 18%, Reliable 22%, Building 28%, Shaky 35%, Untrusted 45%).</li>
                  <li><strong>Grace Period:</strong> Pay your full statement balance within 25 days of the statement date to avoid all interest charges.</li>
                  <li><strong>Interest:</strong> If balance is not paid in full by the due date, daily compound interest accrues on the entire balance at your APR rate.</li>
                  <li><strong>Minimum Payment:</strong> Each billing cycle, pay at least 1% of your balance (min 25 coins) by the due date, or a 35-coin late fee is applied.</li>
                  <li><strong>Credit Limit:</strong> Automatically increases with on-time payments. Late payments reduce your limit.</li>
                  <li><strong>Cashouts:</strong> Blocked until debt is fully paid.</li>
                  <li><strong>Default:</strong> Assets may be repossessed if payment is 7+ days past due.</li>
              </ul>
           </div>
         </div>

        {/* ── Small Installment Purchase Credit Building ─────────────────── */}
        <div className={`${MaiTrollTheme.backgrounds.card} ${MaiTrollTheme.borders.glass} rounded-2xl p-6`}>
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <ArrowUpRight className="w-5 h-5 text-amber-400" />
            Small Purchase Credit Building
          </h2>
          <p className="text-sm text-gray-400 mb-4">
            Any credit-card purchase under <span className="text-amber-400 font-bold">100 troll coins</span> is tracked
            as a micro-installment. Pay it back over time and earn credit-score points at 25 %, 50 %, 75 %, and 100 % repayment.
          </p>

          {smallPurchasesLoading ? (
            <p className="text-gray-400 text-sm">Loading…</p>
          ) : smallPurchases.length === 0 ? (
            <p className="text-gray-500 text-sm">
              No small credit-card purchases yet. Buy a store item under 100 troll coins with your credit card
              to start building credit points!
            </p>
          ) : (
            <div className="space-y-3">
              {smallPurchases.map((p) => {
                const pct   = Math.round((p.total_paid / p.original_price) * 100)
                const isPaid= p.is_active === false
                return (
                  <div key={p.id} className="p-4 bg-zinc-800/70 border border-zinc-700/50 rounded-xl">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <p className="text-white font-medium text-sm">{p.item_name || 'Unknown item'}</p>
                        <p className="text-xs text-gray-500">{p.purchase_context} • {new Date(p.created_at).toLocaleDateString()}</p>
                      </div>
                      <span className={`text-xs font-semibold px-2 py-1 rounded ${isPaid ? 'bg-green-500/20 text-green-300' : pct >= 75 ? 'bg-amber-500/20 text-amber-300' : 'bg-zinc-700/30 text-gray-300'}`}>
                        {isPaid ? '✓ Paid Off' : `${pct}% repaid`}
                      </span>
                    </div>

                    <div className="w-full bg-zinc-900/80 rounded-full h-2 overflow-hidden mb-2">
                      <div
                        className={`h-2 rounded-full transition-all ${isPaid ? 'bg-green-500' : pct >= 75 ? 'bg-amber-500' : pct >= 50 ? 'bg-yellow-500' : 'bg-blue-500'}`}
                        style={{ width: `${Math.min(pct, 100)}%` }}
                      />
                    </div>

                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <span>{p.total_paid.toLocaleString()} / {p.original_price.toLocaleString()} coins repaid</span>
                      <span>Milestone reached: {p.milestone_level}/4</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Saved Payment Methods */}
        <div className={`${MaiTrollTheme.backgrounds.card} ${MaiTrollTheme.borders.glass} rounded-2xl p-6`}>
          <h2 className="text-xl font-bold mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-blue-400" />
              Saved Payment Methods
            </div>
            <button
              onClick={() => setShowSaveCardModal(true)}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg font-semibold transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Card
            </button>
          </h2>

          <div className="space-y-3">
            {savedCards.length === 0 ? (
              <p className="text-gray-400 text-center py-8">
                No saved payment methods. Click "Add Card" to save a payment method for faster checkout.
              </p>
            ) : (
              savedCards.map((card) => (
                <div
                  key={card.id}
                  className={`flex items-center justify-between p-4 rounded-xl border ${
                    card.is_default 
                      ? 'bg-blue-500/10 border-blue-500/30' 
                      : `${MaiTrollTheme.backgrounds.input} border-white/5`
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gray-700 rounded-lg flex items-center justify-center">
                      <CreditCard className="w-5 h-5 text-gray-300" />
                    </div>
                    <div>
                      <div className="font-medium text-white">
                        {card.brand} •••• {card.last4}
                      </div>
                      <div className="text-sm text-gray-400">
                        {card.provider === 'square' ? 'Cash App' : card.provider}
                        {card.is_default && (
                          <span className="ml-2 text-blue-400 font-medium">Default</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {!card.is_default && (
                      <button
                        onClick={async () => {
                          try {
                            await supabase
                              .from('user_payment_methods')
                              .update({ is_default: false })
                              .eq('user_id', user?.id)
                              .neq('id', card.id)

                            const { error } = await supabase
                              .from('user_payment_methods')
                              .update({ is_default: true })
                              .eq('id', card.id)

                            if (error) throw error

                            setSavedCards(prev => prev.map(c => ({ ...c, is_default: c.id === card.id })))
                            toast.success('Default payment method updated')
                          } catch (err: any) {
                            toast.error('Failed to set default')
                          }
                        }}
                        className="text-xs text-gray-400 hover:text-blue-400"
                      >
                        Set Default
                      </button>
                    )}
                    <button
                      onClick={async () => {
                        if (!confirm('Are you sure you want to remove this payment method?')) return
                        
                        try {
                          const { error } = await supabase
                            .from('user_payment_methods')
                            .delete()
                            .eq('id', card.id)
                            .eq('user_id', user?.id)

                          if (error) throw error

                          setSavedCards(prev => prev.filter(c => c.id !== card.id))
                          toast.success('Payment method removed')
                        } catch (err: any) {
                          toast.error('Failed to remove payment method')
                        }
                      }}
                      className="p-2 text-gray-400 hover:text-red-400"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Legacy Loan Section (Only visible if active) */}
        {activeLoan && (
            <div className={`${MaiTrollTheme.backgrounds.card} ${MaiTrollTheme.borders.glass} rounded-2xl p-6 border-red-500/30`}>
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-red-400">
                <AlertCircle className="w-5 h-5" />
                Legacy Loan (Outstanding)
            </h2>
            <p className="text-sm text-gray-400 mb-4">You have an outstanding loan from the old system. Please pay this off.</p>
            
            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
                <div className="flex justify-between items-center mb-4">
                    <span className="text-red-300">Amount Due</span>
                    <span className="text-xl font-bold text-red-400">{activeLoan.balance.toLocaleString()}</span>
                </div>
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={legacyPayAmount}
                    onChange={(e) => setLegacyPayAmount(e.target.value)}
                    placeholder="Amount to pay"
                    className={`${MaiTrollTheme.components.input} flex-1`}
                  />
                  <button
                    onClick={handlePayLegacyLoan}
                    disabled={legacyPaying || !legacyPayAmount}
                    className="bg-red-600 hover:bg-red-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg font-semibold transition-colors"
                  >
                    {legacyPaying ? 'Paying...' : 'Pay Legacy Loan'}
                  </button>
                </div>
            </div>
            </div>
        )}

        {/* Ledger */}
        <div className={`${MaiTrollTheme.backgrounds.card} ${MaiTrollTheme.borders.glass} rounded-2xl p-6`}>
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <History className="w-5 h-5 text-blue-400" />
            Recent Activity
          </h2>
          <div className="space-y-2">
            {ledger.map((entry) => (
              <div 
                key={entry.id} 
                className={`flex justify-between items-center p-3 rounded-lg ${MaiTrollTheme.backgrounds.input} border border-white/5`}
              >
                <div>
                  <p className="font-medium text-white">{entry.description}</p>
                  <p className="text-xs text-gray-500">
                    {new Date(entry.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div className={`font-bold ${(entry.amount || 0) > 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {(entry.amount || 0) > 0 ? '+' : ''}{(entry.amount || 0).toLocaleString()}
                </div>
              </div>
            ))}
            {ledger.length === 0 && (
              <p className="text-center text-gray-500 py-4">No recent activity</p>
            )}
          </div>
        </div>

      </div>
      {/* Save Card Modal */}
      {showSaveCardModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className={`${MaiTrollTheme.backgrounds.card} ${MaiTrollTheme.borders.glass} rounded-2xl p-6 max-w-md w-full mx-4`}>
            <h2 className="text-xl font-bold mb-4 text-white">Add Payment Method</h2>
            <TrollCardSaver
              onCardSaved={() => {
                fetchSavedCards()
                setShowSaveCardModal(false)
              }}
              onCancel={() => setShowSaveCardModal(false)}
              buttonText="Save Card Securely"
              showCancelButton={true}
            />
            <button
              onClick={() => setShowSaveCardModal(false)}
              className="mt-4 w-full text-gray-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}    </div>
  )
}
