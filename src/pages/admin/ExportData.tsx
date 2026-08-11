import React, { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/lib/store'
import { toast } from 'sonner'
import {
  Search, Download, FileText, Coins, DollarSign, Users,
  ArrowUp, ArrowDown, Calendar, Filter, X, Loader2, FileDown
} from 'lucide-react'

interface UserSearchResult {
  id: string
  username: string
  email: string
  full_name: string
  troll_coins: number
  level: number
  role: string
  id_verification_status: string
  terms_accepted: boolean
  created_at: string
}

interface CoinTransaction {
  id: string
  user_id: string
  type: string
  amount: number
  coin_type: 'paid' | 'free' | 'troll_coins'
  source: string
  description: string | null
  from_user_id: string | null
  from_user_name: string | null
  to_user_id: string | null
  to_user_name: string | null
  usd_amount: number | null
  platform_profit: number | null
  created_at: string
  balance_after: number | null
}

interface CoinPurchase {
  id: string
  user_id: string
  coins: number
  amount: number
  order_id: string
  status: string
  created_at: string
}

interface GiftsSent {
  id: string
  from_user_id: string
  from_user_name: string
  to_user_id: string
  to_user_name: string
  gift_name: string
  coin_amount: number
  usd_amount: number | null
  created_at: string
}

interface BackgroundCheck {
  id_verification_status: string
  id_verification_submitted_at: string | null
  terms_accepted: boolean
  terms_accepted_at: string | null
  court_recording_consent: boolean
  court_recording_consent_at: string | null
  onboarding_completed: boolean
  profile_complete: boolean
  last_login: string | null
  sessions_count: number
}

export default function ExportData() {
  const { profile: adminProfile } = useAuthStore()
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([])
  const [selectedUser, setSelectedUser] = useState<UserSearchResult | null>(null)
  const [transactions, setTransactions] = useState<CoinTransaction[]>([])
  const [purchases, setPurchases] = useState<CoinPurchase[]>([])
  const [giftsSent, setGiftsSent] = useState<GiftsSent[]>([])
   const [giftsReceived, setGiftsReceived] = useState<GiftsSent[]>([])
   const [backgroundCheck, setBackgroundCheck] = useState<BackgroundCheck | null>(null)
   const [loading, setLoading] = useState(false)
   const [loadingDetails, setLoadingDetails] = useState(false)
   const [loadingAllReports, setLoadingAllReports] = useState(false)

  // Platform revenue state
  const [platformRevenue, setPlatformRevenue] = useState<{
    totalRevenue: number
    totalCoinsSold: number
    totalGiftsSent: number
    totalGiftsUsd: number
  }>({ totalRevenue: 0, totalCoinsSold: 0, totalGiftsSent: 0, totalGiftsUsd: 0 })

  // Search users
  const handleSearch = async (query: string) => {
    if (query.length < 2) {
      setSearchResults([])
      return
    }
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select(`
          id, username, email, full_name, troll_coins,
          level, role, id_verification_status, terms_accepted, created_at
        `)
        .or(`username.ilike.%${query}%,email.ilike.%${query}%,id.eq.${query}`)
        .limit(20)

      if (error) throw error
      setSearchResults((data as UserSearchResult[]) || [])
    } catch (error) {
      console.error('Search error:', error)
      toast.error('Search failed')
    } finally {
      setLoading(false)
    }
  }

  // Load user details
  const loadUserDetails = async (userId: string) => {
    setLoadingDetails(true)
    try {
      // 1. Coin transactions (sent/received)
      const { data: txData, error: txError } = await supabase
        .from('coin_transactions')
        .select('*')
        .or(`user_id.eq.${userId},from_user_id.eq.${userId},to_user_id.eq.${userId}`)
        .order('created_at', { ascending: false })
        .limit(1000)

      if (txError) throw txError
      setTransactions((txData as CoinTransaction[]) || [])

      // 2. Coin purchases
      const { data: purchaseData, error: purchaseError } = await supabase
        .from('coin_purchases')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1000)

      if (purchaseError) throw purchaseError
      setPurchases((purchaseData as CoinPurchase[]) || [])

      // 3. Gifts sent
      const { data: sentData, error: sentError } = await supabase
        .from('gift_transactions')
        .select('*')
        .eq('from_user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1000)

      if (sentError) throw sentError
      setGiftsSent((sentData as GiftsSent[]) || [])

      // 4. Gifts received
      const { data: receivedData, error: receivedError } = await supabase
        .from('gift_transactions')
        .select('*')
        .eq('to_user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1000)

      if (receivedError) throw receivedError
      setGiftsReceived((receivedData as GiftsSent[]) || [])

      // 5. Background check data
      const { data: profileData, error: profileError } = await supabase
        .from('user_profiles')
        .select(`
          id_verification_status, id_verification_submitted_at,
          terms_accepted, terms_accepted_at,
          court_recording_consent, court_recording_consent_at,
          onboarding_completed, created_at
        `)
        .eq('id', userId)
        .single()

      if (!profileError && profileData) {
        // Get last login from auth.sessions (approximate)
        const { data: sessionData } = await supabase.auth.admin.listUsers()
        const targetUser = sessionData?.users.find((u: any) => u.id === userId)
        setBackgroundCheck({
          id_verification_status: profileData.id_verification_status,
          id_verification_submitted_at: profileData.id_verification_submitted_at,
          terms_accepted: profileData.terms_accepted || false,
          terms_accepted_at: profileData.terms_accepted_at,
          court_recording_consent: profileData.court_recording_consent || false,
          court_recording_consent_at: profileData.court_recording_consent_at,
          onboarding_completed: profileData.onboarding_completed || false,
          profile_complete: true, // simplified
          last_login: targetUser?.last_sign_in_at || null,
          sessions_count: (targetUser as any)?.sessions?.length || 0
        })
      }

      // Build aggregated user object for summary
      const userTx = txData as CoinTransaction[]
      const userPurchases = purchaseData as CoinPurchase[]
      const userGiftsSent = sentData as GiftsSent[]
      const userGiftsReceived = receivedData as GiftsSent[]

      setSelectedUser({
        id: userId,
        username: (profileData as any)?.username || 'Unknown',
        email: (profileData as any)?.email || '',
        full_name: (profileData as any)?.full_name || '',
        troll_coins: (profileData as any)?.troll_coins || 0,
        level: (profileData as any)?.level || 1,
        role: (profileData as any)?.role || 'user',
        id_verification_status: profileData?.id_verification_status || 'pending',
        terms_accepted: profileData?.terms_accepted || false,
        created_at: (profileData as any)?.created_at || ''
      })

    } catch (error) {
      console.error('Error loading user details:', error)
      toast.error('Failed to load user data')
    } finally {
      setLoadingDetails(false)
    }
  }

  // Load platform revenue summary
  useEffect(() => {
    const loadPlatformRevenue = async () => {
      try {
        // Total platform profit from coin_transactions
        const { data: profitData, error: profitError } = await supabase
          .from('coin_transactions')
          .select('platform_profit')
          .not('platform_profit', 'is', null)

        if (!profitError && profitData) {
          const total = profitData.reduce((sum, row) => sum + Number(row.platform_profit || 0), 0)
          setPlatformRevenue(prev => ({ ...prev, totalRevenue: total }))
        }

        // Total coins purchased
        const { data: coinsData, error: coinsError } = await supabase
          .from('coin_purchases')
          .select('coins, amount')

        if (!coinsError && coinsData) {
          const totalCoins = coinsData.reduce((sum, row) => sum + Number(row.coins || 0), 0)
          const totalAmount = coinsData.reduce((sum, row) => sum + Number(row.amount || 0), 0)
          setPlatformRevenue(prev => ({ ...prev, totalCoinsSold: totalCoins }))
        }

        // Gifts total USD
        const { data: giftsData, error: giftsError } = await supabase
          .from('gift_transactions')
          .select('usd_amount')

        if (!giftsError && giftsData) {
          const totalUsd = giftsData.reduce((sum, row) => sum + Number(row.usd_amount || 0), 0)
          setPlatformRevenue(prev => ({ ...prev, totalGiftsUsd: totalUsd }))
        }

      } catch (error) {
        console.error('Failed to load platform revenue:', error)
      }
    }

    loadPlatformRevenue()
  }, [])

  // Export to CSV
  const exportToCSV = (type: 'transactions' | 'purchases' | 'gifts_sent' | 'gifts_received' | 'all') => {
    if (!selectedUser) return

    let csv = ''
    const filename = `${selectedUser.username}_${type}_${new Date().toISOString().split('T')[0]}.csv`

    if (type === 'transactions' || type === 'all') {
      csv = 'ID,Type,Amount,Coin Type,Source,Description,From User,To User,USD Amount,Platform Profit,Created At\n'
      transactions.forEach(tx => {
        csv += `"${tx.id}","${tx.type}",${tx.amount},"${tx.coin_type}","${tx.source || ''}","${(tx.description || '').replace(/"/g, '""')}","${tx.from_user_name || ''}","${tx.to_user_name || ''}",${tx.usd_amount || 0},${tx.platform_profit || 0},"${tx.created_at}"\n`
      })
    } else if (type === 'purchases') {
      csv = 'ID,Coins,Amount (USD),Order ID,Status,Created At\n'
      purchases.forEach(p => {
        csv += `"${p.id}",${p.coins},${p.amount || 0},"${p.order_id}","${p.status}","${p.created_at}"\n`
      })
    } else if (type === 'gifts_sent') {
      csv = 'ID,To User,Gift Name,Coin Amount,USD Amount,Created At\n'
      giftsSent.forEach(g => {
        csv += `"${g.id}","${g.to_user_name || ''}","${g.gift_name}",${g.coin_amount},${g.usd_amount || 0},"${g.created_at}"\n`
      })
    } else if (type === 'gifts_received') {
      csv = 'ID,From User,Gift Name,Coin Amount,USD Amount,Created At\n'
      giftsReceived.forEach(g => {
        csv += `"${g.id}","${g.from_user_name || ''}","${g.gift_name}",${g.coin_amount},${g.usd_amount || 0},"${g.created_at}"\n`
      })
    }

    downloadCSV(csv, filename)
    toast.success(`Exported ${type}`)
  }

  const downloadCSV = (csv: string, filename: string) => {
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = filename
    link.click()
  }

   // Download full user report as single CSV
   const exportFullReport = () => {
     if (!selectedUser) return

     const sections: string[] = []
     sections.push(`=== USER PROFILE ===`)
     sections.push(`Username,${selectedUser.username}`)
     sections.push(`Email,${selectedUser.email}`)
     sections.push(`Full Name,${selectedUser.full_name}`)
     sections.push(`Paid Coins,${selectedUser.troll_coins}`)
      sections.push(`Total Coins,${selectedUser.troll_coins}`)
     sections.push(`Level,${selectedUser.level}`)
     sections.push(`Role,${selectedUser.role}`)
     sections.push(`ID Verification,${selectedUser.id_verification_status}`)
     sections.push(`Terms Accepted,${selectedUser.terms_accepted}`)
     sections.push(`Created At,${selectedUser.created_at}`)
     sections.push(`\n=== COIN TRANSACTIONS ===`)
     sections.push(`ID,Type,Amount,Coin Type,Source,Description,From User,To User,USD Amount,Platform Profit,Created At`)
     transactions.forEach(tx => {
       sections.push(`"${tx.id}","${tx.type}",${tx.amount},"${tx.coin_type}","${tx.source || ''}","${(tx.description || '').replace(/"/g, '""')}","${tx.from_user_name || ''}","${tx.to_user_name || ''}",${tx.usd_amount || 0},${tx.platform_profit || 0},"${tx.created_at}"`)
     })
     sections.push(`\n=== COIN PURCHASES ===`)
     sections.push(`ID,Coins,Amount (USD),Order ID,Status,Created At`)
     purchases.forEach(p => {
       sections.push(`"${p.id}",${p.coins},${p.amount || 0},"${p.order_id}","${p.status}","${p.created_at}"`)
     })
     sections.push(`\n=== GIFTS SENT ===`)
     sections.push(`ID,To User,Gift Name,Coin Amount,USD Amount,Created At`)
     giftsSent.forEach(g => {
       sections.push(`"${g.id}","${g.to_user_name || ''}","${g.gift_name}",${g.coin_amount},${g.usd_amount || 0},"${g.created_at}"`)
     })
     sections.push(`\n=== GIFTS RECEIVED ===`)
     sections.push(`ID,From User,Gift Name,Coin Amount,USD Amount,Created At`)
     giftsReceived.forEach(g => {
       sections.push(`"${g.id}","${g.from_user_name || ''}","${g.gift_name}",${g.coin_amount},${g.usd_amount || 0},"${g.created_at}"`)
     })
     sections.push(`\n=== PLATFORM REVENUE SUMMARY ===`)
     sections.push(`Total Platform Profit,$${platformRevenue.totalRevenue.toFixed(2)}`)
     sections.push(`Total Coins Sold,${platformRevenue.totalCoinsSold}`)
     sections.push(`Total Gifts USD,$${platformRevenue.totalGiftsUsd.toFixed(2)}`)

     const csv = sections.join('\n')
     downloadCSV(csv, `${selectedUser.username}_FULL_REPORT_${new Date().toISOString().split('T')[0]}.csv`)
     toast.success('Full report exported')
   }

   // Download ALL reports as single TXT file (opens in Notepad)
   const downloadAllReportsTXT = async () => {
     setLoadingAllReports(true)
     try {
       const lines: string[] = []
       const timestamp = new Date().toISOString()
       
       // Header
       lines.push('='.repeat(80))
       lines.push('MaiTroll - COMPREHENSIVE ADMIN REPORT')
       lines.push(`Generated: ${timestamp}`)
       lines.push(`Generated By: ${adminProfile?.username || 'Admin'}`)
       lines.push('='.repeat(80))
       lines.push('')

       // 1. Platform Revenue Summary
       lines.push('--- PLATFORM REVENUE SUMMARY ---')
       lines.push(`Total Platform Profit: $${platformRevenue.totalRevenue.toFixed(2)}`)
       lines.push(`Total Coins Sold: ${platformRevenue.totalCoinsSold.toLocaleString()}`)
       lines.push(`Total Gifts Revenue (USD): $${platformRevenue.totalGiftsUsd.toFixed(2)}`)
       lines.push('')

       // 2. All User Profiles Summary
       lines.push('--- ALL USER PROFILES ---')
       const { data: allUsers, error: usersError } = await supabase
         .from('user_profiles')
          .select('id, username, email, role, level, troll_coins, created_at')
         .order('created_at', { ascending: false })
         .limit(1000)

       if (!usersError && allUsers) {
         lines.push(`Total Users (showing up to 1000): ${allUsers.length}`)
         lines.push(`ID,Username,Email,Role,Level,Paid Coins,Free Coins,Total Coins,Created At`)
         allUsers.forEach(u => {
            const total = Number(u.troll_coins || 0)
            lines.push(`"${u.id}","${u.username}","${u.email}","${u.role}",${u.level},${u.troll_coins || 0},${total},"${u.created_at}"`)
         })
       } else {
         lines.push(`Error loading users: ${usersError?.message || 'Unknown error'}`)
       }
       lines.push('')

       // 3. Recent Coin Transactions (last 500)
       lines.push('--- RECENT COIN TRANSACTIONS (Last 500) ---')
       const { data: allTx, error: txError } = await supabase
         .from('coin_transactions')
         .select('*')
         .order('created_at', { ascending: false })
         .limit(500)

       if (!txError && allTx) {
         lines.push(`Total Transactions: ${allTx.length}`)
         lines.push(`ID,Type,Amount,Coin Type,Source,Description,From User,To User,USD Amount,Platform Profit,Created At`)
         allTx.forEach(tx => {
           lines.push(`"${tx.id}","${tx.type}",${tx.amount},"${tx.coin_type}","${tx.source || ''}","${(tx.description || '').replace(/"/g, '""')}","${tx.from_user_name || ''}","${tx.to_user_name || ''}",${tx.usd_amount || 0},${tx.platform_profit || 0},"${tx.created_at}"`)
         })
       } else {
         lines.push(`Error loading transactions: ${txError?.message || 'Unknown error'}`)
       }
       lines.push('')

       // 4. All Coin Purchases
       lines.push('--- ALL COIN PURCHASES ---')
       const { data: allPurchases, error: purchasesError } = await supabase
         .from('coin_purchases')
         .select('*')
         .order('created_at', { ascending: false })
         .limit(1000)

       if (!purchasesError && allPurchases) {
         lines.push(`Total Purchases: ${allPurchases.length}`)
         lines.push(`ID,User ID,Coins,Amount (USD),Order ID,Status,Created At`)
         allPurchases.forEach(p => {
           lines.push(`"${p.id}","${p.user_id || ''}",${p.coins},${p.amount || 0},"${p.order_id}","${p.status}","${p.created_at}"`)
         })
       } else {
         lines.push(`Error loading purchases: ${purchasesError?.message || 'Unknown error'}`)
       }
       lines.push('')

       // 5. All Gift Transactions
       lines.push('--- ALL GIFT TRANSACTIONS ---')
       const { data: allGifts, error: giftsError } = await supabase
         .from('gift_transactions')
         .select('*')
         .order('created_at', { ascending: false })
         .limit(1000)

       if (!giftsError && allGifts) {
         lines.push(`Total Gifts: ${allGifts.length}`)
         lines.push(`ID,From User,To User,Gift Name,Coin Amount,USD Amount,Created At`)
         allGifts.forEach(g => {
           lines.push(`"${g.id}","${g.from_user_name || ''}","${g.to_user_name || ''}","${g.gift_name}",${g.coin_amount},${g.usd_amount || 0},"${g.created_at}"`)
         })
       } else {
         lines.push(`Error loading gifts: ${giftsError?.message || 'Unknown error'}`)
       }
       lines.push('')

       // 6. Bug Reports (if table exists)
       lines.push('--- BUG REPORTS ---')
       try {
         const { data: bugs, error: bugsError } = await supabase
           .from('app_bug_reports')
           .select('*')
           .order('created_at', { ascending: false })
           .limit(100)

         if (!bugsError && bugs) {
           lines.push(`Total Bug Reports: ${bugs.length}`)
           bugs.forEach(bug => {
             lines.push(`ID: ${bug.id}`)
             lines.push(`Status: ${bug.status} | Severity: ${bug.severity} | Source: ${bug.source}`)
             lines.push(`Error: ${bug.error_message}`)
             if (bug.stack_trace) lines.push(`Stack: ${bug.stack_trace}`)
             lines.push(`Created: ${bug.created_at}`)
             lines.push('-' * 40)
           })
         } else {
           lines.push(`Bug reports not available: ${bugsError?.message || 'Table may not exist'}`)
         }
       } catch (e: any) {
         lines.push(`Error loading bug reports: ${e.message}`)
       }
       lines.push('')

       // 7. Weekly Officer Reports
       lines.push('--- WEEKLY OFFICER REPORTS ---')
       try {
         const { data: weeklyReports, error: weeklyError } = await supabase
           .from('weekly_officer_reports')
           .select('*')
           .order('created_at', { ascending: false })
           .limit(50)

         if (!weeklyError && weeklyReports) {
           lines.push(`Total Weekly Reports: ${weeklyReports.length}`)
           weeklyReports.forEach(r => {
             lines.push(`Officer: ${r.officer_name || r.officer_id} | Week: ${r.week_start} | Status: ${r.status}`)
             lines.push(`Actions Taken: ${r.actions_taken || 'None'}`)
             lines.push(`Issues: ${r.issues_encountered || 'None'}`)
             lines.push('-' * 40)
           })
         } else {
           lines.push(`Weekly reports not available: ${weeklyError?.message || 'Table may not exist'}`)
         }
       } catch (e: any) {
         lines.push(`Error loading weekly reports: ${e.message}`)
       }
       lines.push('')

       // Footer
       lines.push('='.repeat(80))
       lines.push('END OF REPORT')
       lines.push('='.repeat(80))

       // Create and download TXT file
       const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' })
       const url = URL.createObjectURL(blob)
       const a = document.createElement('a')
       a.href = url
       a.download = `MaiTroll_All_Reports_${new Date().toISOString().split('T')[0]}.txt`
       document.body.appendChild(a)
       a.click()
       document.body.removeChild(a)
       URL.revokeObjectURL(url)

        toast.success('All reports downloaded as text file (opens in Notepad)')
      } catch (error) {
        console.error('Error generating all reports:', error)
        toast.error('Failed to download all reports')
      } finally {
        setLoadingAllReports(false)
      }
    }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <FileText className="w-8 h-8 text-purple-400" />
              Admin Data Export
            </h1>
            {adminProfile?.role === 'admin' && (
              <span className="px-3 py-1 bg-red-900/50 border border-red-500/30 rounded-full text-xs text-red-300">
                Admin Access
              </span>
            )}
          </div>

          {/* Platform Revenue Summary */}
          <div className="flex items-center gap-6 bg-black/60 border border-green-600/30 rounded-xl p-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-400">
                ${platformRevenue.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </div>
              <div className="text-xs text-gray-400">Total Platform Profit</div>
            </div>
            <div className="w-px h-10 bg-gray-700" />
            <div className="text-center">
              <div className="text-2xl font-bold text-cyan-400">
                {platformRevenue.totalCoinsSold.toLocaleString()}
              </div>
              <div className="text-xs text-gray-400">Coins Sold</div>
            </div>
            <div className="w-px h-10 bg-gray-700" />
            <div className="text-center">
              <div className="text-2xl font-bold text-pink-400">
                ${platformRevenue.totalGiftsUsd.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </div>
              <div className="text-xs text-gray-400">Gifts Revenue (USD)</div>
            </div>
          </div>
        </div>

        {/* User Search */}
        <div className="bg-black/60 border border-purple-600/30 rounded-xl p-6 mb-6">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <Search className="w-5 h-5 text-purple-400" />
            Search User for Export
          </h2>
          <div className="relative max-w-2xl">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by username, email, or user ID..."
              onChange={(e) => {
                setSearchQuery(e.target.value)
                handleSearch(e.target.value)
              }}
              value={searchQuery}
              className="w-full pl-12 pr-4 py-3 bg-zinc-800 border border-gray-700 rounded-xl text-white text-lg placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
            {loading && (
              <Loader2 className="absolute right-4 top-1/2 transform -translate-y-1/2 w-5 h-5 animate-spin text-purple-400" />
            )}
          </div>

          {/* Search Results */}
          {searchResults.length > 0 && (
            <div className="mt-4 max-h-96 overflow-y-auto space-y-2">
              {searchResults.map((user) => (
                <div
                  key={user.id}
                  onClick={() => loadUserDetails(user.id)}
                  className="p-4 bg-zinc-800/80 hover:bg-purple-900/30 border border-gray-700 hover:border-purple-500/50 rounded-xl cursor-pointer transition-all"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-white font-semibold text-lg flex items-center gap-2">
                        {user.username}
                        {user.role === 'admin' && <span className="text-xs bg-red-600 px-2 py-0.5 rounded">CEO</span>}
                        {user.role === 'troll_officer' && <span className="text-xs bg-purple-600 px-2 py-0.5 rounded">Officer</span>}
                      </div>
                      <div className="text-sm text-gray-400">{user.email}</div>
                      <div className="text-xs text-gray-500 mt-1">
                        ID: {user.id} • Level {user.level} • Coins: {user.troll_coins?.toLocaleString()}
                      </div>
                    </div>
                    <button className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg text-sm font-semibold">
                      View Full Report
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Selected User Report */}
        {selectedUser && (
          <div className="space-y-6">
            {/* User Header */}
            <div className="bg-black/60 border border-blue-600/30 rounded-xl p-6">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                    <Users className="w-7 h-7 text-blue-400" />
                    {selectedUser.username}
                    {selectedUser.role === 'admin' && <span className="text-sm bg-red-600 px-3 py-1 rounded-full">CEO</span>}
                  </h2>
                  <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="text-gray-400">Email:</span>
                      <div className="text-white">{selectedUser.email}</div>
                    </div>
                    <div>
                      <span className="text-gray-400">Full Name:</span>
                      <div className="text-white">{selectedUser.full_name || 'Not set'}</div>
                    </div>
                    <div>
                      <span className="text-gray-400">Paid Coins:</span>
                      <div className="text-purple-300 font-semibold">{selectedUser.troll_coins?.toLocaleString()}</div>
                    </div>
                     <div>
                       <span className="text-gray-400">Level:</span>
                       <div className="text-white">{selectedUser.level}</div>
                     </div>
                    <div>
                      <span className="text-gray-400">Role:</span>
                      <div className="text-white capitalize">{selectedUser.role}</div>
                    </div>
                    <div>
                      <span className="text-gray-400">ID Verification:</span>
                      <div className={`font-semibold ${selectedUser.id_verification_status === 'approved' ? 'text-green-400' : selectedUser.id_verification_status === 'rejected' ? 'text-red-400' : 'text-yellow-400'}`}>
                        {selectedUser.id_verification_status}
                      </div>
                    </div>
                    <div>
                      <span className="text-gray-400">Terms Accepted:</span>
                      <div className={selectedUser.terms_accepted ? 'text-green-400' : 'text-red-400'}>
                        {selectedUser.terms_accepted ? 'Yes' : 'No'}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <button
                    onClick={exportFullReport}
                    disabled={loadingDetails}
                    className="px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 rounded-xl font-semibold flex items-center justify-center gap-2"
                  >
                    <Download className="w-5 h-5" />
                    Export Full CSV
                  </button>
                </div>
               </div>
             </div>

             {/* Download All Reports Button */}
             <div className="bg-black/60 border border-orange-600/30 rounded-xl p-6 mb-6">
               <div className="flex items-center justify-between">
                 <div>
                   <h3 className="text-lg font-bold flex items-center gap-2 text-orange-400">
                     <FileDown className="w-6 h-6" />
                     System-Wide Report Export
                   </h3>
                   <p className="text-sm text-gray-400 mt-1">
                     Downloads ALL reports (users, transactions, purchases, gifts, bug reports, weekly reports) into a single text file that opens directly in Notepad.
                   </p>
                 </div>
                  <button
                    onClick={downloadAllReportsTXT}
                    disabled={loadingAllReports}
                    className="px-8 py-4 bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 rounded-xl font-bold flex items-center gap-3 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loadingAllReports ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <FileDown className="w-5 h-5" />
                        Download All Reports (.TXT)
                      </>
                    )}
                  </button>
               </div>
             </div>

             {/* Quick Export Buttons */}
             <div className="bg-black/60 border border-cyan-600/30 rounded-xl p-6">
               <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                 <FileText className="w-5 h-5 text-cyan-400" />
                 Quick Exports (Current User)
               </h3>
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() => exportToCSV('transactions')}
                  className="px-4 py-2 bg-purple-600/80 hover:bg-purple-700 border border-purple-500/30 rounded-lg flex items-center gap-2"
                >
                  <Coins className="w-4 h-4" /> Export Transactions
                </button>
                <button
                  onClick={() => exportToCSV('purchases')}
                  className="px-4 py-2 bg-green-600/80 hover:bg-green-700 border border-green-500/30 rounded-lg flex items-center gap-2"
                >
                  <DollarSign className="w-4 h-4" /> Export Purchases
                </button>
                <button
                  onClick={() => exportToCSV('gifts_sent')}
                  className="px-4 py-2 bg-pink-600/80 hover:bg-pink-700 border border-pink-500/30 rounded-lg flex items-center gap-2"
                >
                  <ArrowUp className="w-4 h-4" /> Gifts Sent
                </button>
                <button
                  onClick={() => exportToCSV('gifts_received')}
                  className="px-4 py-2 bg-blue-600/80 hover:bg-blue-700 border border-blue-500/30 rounded-lg flex items-center gap-2"
                >
                  <ArrowDown className="w-4 h-4" /> Gifts Received
                </button>
              </div>
            </div>

            {/* Tables */}
            {loadingDetails ? (
              <div className="text-center py-12">
                <Loader2 className="w-10 h-10 animate-spin mx-auto mb-4 text-purple-400" />
                <p className="text-gray-400">Loading user data...</p>
              </div>
            ) : (
              <>
                {/* Transactions */}
                <div className="bg-black/60 border border-purple-600/30 rounded-xl overflow-hidden">
                  <div className="p-4 border-b border-gray-800 bg-purple-900/20">
                    <h3 className="text-lg font-bold flex items-center gap-2">
                      <Coins className="w-5 h-5 text-purple-400" />
                      Coin Transactions ({transactions.length})
                    </h3>
                  </div>
                  <div className="overflow-x-auto max-h-96">
                    <table className="w-full text-sm">
                      <thead className="bg-zinc-900 sticky top-0">
                        <tr>
                          <th className="p-3 text-left text-gray-400">Type</th>
                          <th className="p-3 text-left text-gray-400">Amount</th>
                          <th className="p-3 text-left text-gray-400">Coin Type</th>
                          <th className="p-3 text-left text-gray-400">Source</th>
                          <th className="p-3 text-left text-gray-400">From/To</th>
                          <th className="p-3 text-left text-gray-400">USD</th>
                          <th className="p-3 text-left text-gray-400">Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {transactions.map((tx) => (
                          <tr key={tx.id} className="border-t border-gray-800 hover:bg-purple-900/10">
                            <td className="p-3 capitalize text-white">{tx.type.replace('_', ' ')}</td>
                            <td className={`p-3 font-semibold ${tx.amount >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                              {tx.amount >= 0 ? '+' : ''}{tx.amount.toLocaleString()}
                            </td>
                            <td className="p-3 text-gray-300">{tx.coin_type}</td>
                            <td className="p-3 text-gray-300 capitalize">{tx.source || 'system'}</td>
                            <td className="p-3 text-gray-300">
                              {tx.from_user_name && <span className="text-red-300">← {tx.from_user_name}</span>}
                              {tx.to_user_name && <span className="text-green-300">→ {tx.to_user_name}</span>}
                            </td>
                            <td className="p-3 text-cyan-300">${(tx.usd_amount || 0).toFixed(2)}</td>
                            <td className="p-3 text-gray-400 text-xs">{new Date(tx.created_at).toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Purchases */}
                <div className="bg-black/60 border border-green-600/30 rounded-xl overflow-hidden">
                  <div className="p-4 border-b border-gray-800 bg-green-900/20">
                    <h3 className="text-lg font-bold flex items-center gap-2">
                      <DollarSign className="w-5 h-5 text-green-400" />
                      Coin Purchases ({purchases.length})
                    </h3>
                  </div>
                  <div className="overflow-x-auto max-h-80">
                    <table className="w-full text-sm">
                      <thead className="bg-zinc-900 sticky top-0">
                        <tr>
                          <th className="p-3 text-left text-gray-400">Coins</th>
                          <th className="p-3 text-left text-gray-400">Amount (USD)</th>
                          <th className="p-3 text-left text-gray-400">Order ID</th>
                          <th className="p-3 text-left text-gray-400">Status</th>
                          <th className="p-3 text-left text-gray-400">Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {purchases.map((p) => (
                          <tr key={p.id} className="border-t border-gray-800 hover:bg-green-900/10">
                            <td className="p-3 text-purple-300 font-semibold">{p.coins.toLocaleString()}</td>
                            <td className="p-3 text-green-300">${(p.amount || 0).toFixed(2)}</td>
                            <td className="p-3 text-gray-300 font-mono text-xs">{p.order_id}</td>
                            <td className="p-3">
                              <span className={`px-2 py-1 rounded text-xs ${p.status === 'completed' ? 'bg-green-900/50 text-green-300' : 'bg-yellow-900/50 text-yellow-300'}`}>
                                {p.status}
                              </span>
                            </td>
                            <td className="p-3 text-gray-400 text-xs">{new Date(p.created_at).toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Gifts Sent/Received */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-black/60 border border-pink-600/30 rounded-xl overflow-hidden">
                    <div className="p-4 border-b border-gray-800 bg-pink-900/20">
                      <h3 className="text-lg font-bold flex items-center gap-2">
                        <ArrowUp className="w-5 h-5 text-pink-400" />
                        Gifts Sent ({giftsSent.length})
                      </h3>
                    </div>
                    <div className="overflow-x-auto max-h-80">
                      <table className="w-full text-sm">
                        <thead className="bg-zinc-900 sticky top-0">
                          <tr>
                            <th className="p-3 text-left text-gray-400">To</th>
                            <th className="p-3 text-left text-gray-400">Gift</th>
                            <th className="p-3 text-left text-gray-400">Coins</th>
                            <th className="p-3 text-left text-gray-400">USD</th>
                          </tr>
                        </thead>
                        <tbody>
                          {giftsSent.map((g) => (
                            <tr key={g.id} className="border-t border-gray-800 hover:bg-pink-900/10">
                              <td className="p-3 text-white">{g.to_user_name}</td>
                              <td className="p-3 text-gray-300">{g.gift_name}</td>
                              <td className="p-3 text-pink-300">{g.coin_amount.toLocaleString()}</td>
                              <td className="p-3 text-cyan-300">${g.usd_amount?.toFixed(2) || 0}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="bg-black/60 border border-cyan-600/30 rounded-xl overflow-hidden">
                    <div className="p-4 border-b border-gray-800 bg-cyan-900/20">
                      <h3 className="text-lg font-bold flex items-center gap-2">
                        <ArrowDown className="w-5 h-5 text-cyan-400" />
                        Gifts Received ({giftsReceived.length})
                      </h3>
                    </div>
                    <div className="overflow-x-auto max-h-80">
                      <table className="w-full text-sm">
                        <thead className="bg-zinc-900 sticky top-0">
                          <tr>
                            <th className="p-3 text-left text-gray-400">From</th>
                            <th className="p-3 text-left text-gray-400">Gift</th>
                            <th className="p-3 text-left text-gray-400">Coins</th>
                            <th className="p-3 text-left text-gray-400">USD</th>
                          </tr>
                        </thead>
                        <tbody>
                          {giftsReceived.map((g) => (
                            <tr key={g.id} className="border-t border-gray-800 hover:bg-cyan-900/10">
                              <td className="p-3 text-white">{g.from_user_name}</td>
                              <td className="p-3 text-gray-300">{g.gift_name}</td>
                              <td className="p-3 text-cyan-300">{g.coin_amount.toLocaleString()}</td>
                              <td className="p-3 text-green-300">${g.usd_amount?.toFixed(2) || 0}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                {/* Background Check */}
                {backgroundCheck && (
                  <div className="bg-black/60 border border-yellow-600/30 rounded-xl p-6">
                    <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                      <Search className="w-5 h-5 text-yellow-400" />
                      Background Check & Verification
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div className="p-3 bg-zinc-800 rounded-lg">
                        <div className="text-gray-400 text-xs uppercase">ID Verification</div>
                        <div className={`font-semibold ${backgroundCheck.id_verification_status === 'approved' ? 'text-green-400' : backgroundCheck.id_verification_status === 'rejected' ? 'text-red-400' : 'text-yellow-400'}`}>
                          {backgroundCheck.id_verification_status}
                        </div>
                        {backgroundCheck.id_verification_submitted_at && (
                          <div className="text-xs text-gray-500">
                            {new Date(backgroundCheck.id_verification_submitted_at).toLocaleDateString()}
                          </div>
                        )}
                      </div>
                      <div className="p-3 bg-zinc-800 rounded-lg">
                        <div className="text-gray-400 text-xs uppercase">Terms Accepted</div>
                        <div className={backgroundCheck.terms_accepted ? 'text-green-400' : 'text-red-400'}>
                          {backgroundCheck.terms_accepted ? 'Yes' : 'No'}
                        </div>
                      </div>
                      <div className="p-3 bg-zinc-800 rounded-lg">
                        <div className="text-gray-400 text-xs uppercase">Court Consent</div>
                        <div className={backgroundCheck.court_recording_consent ? 'text-green-400' : 'text-red-400'}>
                          {backgroundCheck.court_recording_consent ? 'Yes' : 'No'}
                        </div>
                      </div>
                      <div className="p-3 bg-zinc-800 rounded-lg">
                        <div className="text-gray-400 text-xs uppercase">Onboarding</div>
                        <div className={backgroundCheck.onboarding_completed ? 'text-green-400' : 'text-red-400'}>
                          {backgroundCheck.onboarding_completed ? 'Complete' : 'Incomplete'}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
