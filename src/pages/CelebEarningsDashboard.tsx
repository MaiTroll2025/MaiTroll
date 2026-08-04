import React, { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../lib/store'
import { toast } from 'sonner'
import { Crown, Wallet, TrendingUp, DollarSign, Clock, ShoppingBag, BarChart3 } from 'lucide-react'
import { isCelebApproved } from '../../lib/staff'

interface CelebDashboardData {
  success: boolean
  user_id: string
  celeb_role: string
  is_verified_celeb: boolean
  full_name?: string
  bio?: string
  category?: string
  verification_level: string
  subscriber_count: number
  monthly_earning_usd: number
  available_usd: number
  total_earned_usd: number
  pending_cashout_usd: number
  payout_percentage: number
}

interface CelebCashoutRequest {
  id: string
  tier_id: string
  earned_usd: number
  fee_amount: number
  payout_usd: number
  provider_type: string
  provider_username: string
  status: 'pending' | 'processing' | 'paid' | 'rejected'
  requested_at: string
  processed_at: string | null
}

interface CelebCashoutTier {
  id: string
  name: string
  min_earned_usd: number
  fee_percent: number
  is_active: boolean
}

interface CelebProduct {
  id: string
  title: string
  description: string | null
  price_coins: number
  is_active: boolean
  display_order: number
}

export default function CelebEarningsDashboard() {
  const { user, profile } = useAuthStore()
  const [dashboard, setDashboard] = useState<CelebDashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [cashoutRequests, setCashoutRequests] = useState<CelebCashoutRequest[]>([])
  const [cashoutTiers, setCashoutTiers] = useState<CelebCashoutTier[]>([])
  const [products, setProducts] = useState<CelebProduct[]>([])
  const [selectedTier, setSelectedTier] = useState<string>('')
  const [providerType, setProviderType] = useState('cash_app')
  const [providerUsername, setProviderUsername] = useState('')
  const [processing, setProcessing] = useState(false)
  const [activeTab, setActiveTab] = useState<'overview' | 'products' | 'cashout'>('overview')

  const isApproved = isCelebApproved(profile)
  const isCeleb = !!(profile && profile.celeb_role)

  const loadDashboard = useCallback(async () => {
    if (!user?.id) return

    try {
      const { data, error } = await supabase.rpc('get_celeb_dashboard_data', {
        p_user_id: user.id
      })

      if (error) throw error
      if (data?.success) {
        setDashboard(data)
      } else {
        toast.error(data?.error || 'Failed to load dashboard')
      }

      // Load cashout requests
      const { data: reqData, error: reqError } = await supabase
        .from('celeb_cashout_requests')
        .select('*')
        .eq('celeb_user_id', user.id)
        .order('requested_at', { ascending: false })

      if (!reqError) setCashoutRequests(reqData || [])

      // Load cashout tiers
      const { data: tierData, error: tierError } = await supabase
        .from('celeb_cashout_tiers')
        .select('*')
        .eq('is_active', true)
        .order('min_earned_usd', { ascending: true })

      if (!tierError) setCashoutTiers(tierData || [])

      // Load products
      const { data: productData, error: productError } = await supabase
        .from('celeb_products')
        .select('*')
        .eq('user_id', user.id)
        .order('display_order', { ascending: true })

      if (!productError) setProducts(productData || [])
    } catch (error: any) {
      console.error('Error loading celeb dashboard:', error)
      toast.error(error.message || 'Failed to load dashboard')
    } finally {
      setLoading(false)
    }
  }, [user?.id])

  useEffect(() => {
    if (!isCeleb) {
      setLoading(false)
      return
    }
    loadDashboard()
    const interval = setInterval(() => loadDashboard(), 60_000)
    return () => clearInterval(interval)
  }, [isCeleb, loadDashboard])

  const handleCashout = async () => {
    if (!user?.id || !selectedTier || !providerUsername.trim()) {
      toast.error('Please select a tier and enter payout details')
      return
    }

    const tier = cashoutTiers.find(t => t.id === selectedTier)
    if (!tier) {
      toast.error('Invalid tier selected')
      return
    }

    setProcessing(true)
    try {
      const { data, error } = await supabase.functions.invoke('celeb-cashout', {
        body: {
          action: 'request',
          tier_id: selectedTier,
          earned_usd: dashboard!.available_usd,
          provider_type: providerType,
          provider_username: providerUsername.trim(),
        }
      })

      if (error) throw error
      if (data?.error) throw new Error(data.error)
      if (!data?.success) throw new Error(data?.error || 'Cashout request failed')

      toast.success(`Cashout requested! You will receive $${data.payout_usd} after a $${data.fee_amount} fee.`)
      setProviderUsername('')
      setSelectedTier('')
      loadDashboard()
    } catch (error: any) {
      console.error('Cashout error:', error)
      toast.error(error.message || 'Failed to request cashout')
    } finally {
      setProcessing(false)
    }
  }

  const handleCreateProduct = async (title: string, description: string, priceCoins: number) => {
    const { data, error } = await supabase.functions.invoke('celeb-products', {
      body: {
        action: 'create',
        title,
        description,
        price_coins: priceCoins,
      }
    })

    if (error) throw error
    if (!data?.success) throw new Error(data?.error || 'Failed to create product')

    toast.success('Product created!')
    loadDashboard()
  }

  const handleUpdateProduct = async (productId: string, updates: Partial<CelebProduct>) => {
    const { data, error } = await supabase.functions.invoke('celeb-products', {
      body: {
        action: 'update',
        product_id: productId,
        ...updates,
      }
    })

    if (error) throw error
    if (!data?.success) throw new Error(data?.error || 'Failed to update product')

    toast.success('Product updated!')
  }

  const handleDeleteProduct = async (productId: string) => {
    const { data, error } = await supabase.functions.invoke('celeb-products', {
      body: { action: 'delete', product_id: productId }
    })

    if (error) throw error
    if (!data?.success) throw new Error(data?.error || 'Failed to delete product')

    toast.success('Product deleted!')
    loadDashboard()
  }

  if (!isCeleb) {
    return (
      <div className="p-6 text-center text-white min-h-screen">
        <Crown className="w-12 h-12 mx-auto mb-4 text-yellow-400/30" />
        <h1 className="text-2xl font-bold mb-2">Celeb Dashboard</h1>
        <p className="text-slate-400">
          You have not applied to be a Celebrity yet. Sign up for a Celeb Stream by checking <span className="text-yellow-300">“Sign up as a Celebrity”</span> on the Auth page.
        </p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="p-6 text-center text-white min-h-screen">
        Loading Celeb dashboard...
      </div>
    )
  }

  if (!isApproved) {
    return (
      <div className="p-6 text-center text-white min-h-screen">
        <Clock className="w-12 h-12 mx-auto mb-4 text-yellow-400/30" />
        <h1 className="text-2xl font-bold mb-2">Application Pending</h1>
        <p className="text-slate-400">
          Your Celeb application is under review. You will be notified when it is approved.
        </p>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-6xl mx-auto text-white min-h-screen">
      <div className="flex items-center gap-3 mb-6">
        <Crown className="w-8 h-8 text-yellow-400" />
        <h1 className="text-3xl font-bold">Celeb Dashboard</h1>
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && dashboard && (
        <div className="space-y-6">
          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-slate-900/50 border border-white/10 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <DollarSign className="w-4 h-4 text-green-400" />
                <span className="text-xs text-slate-400 uppercase tracking-wider">Available</span>
              </div>
              <p className="text-2xl font-bold text-green-400">${dashboard.available_usd.toFixed(2)}</p>
            </div>
            <div className="bg-slate-900/50 border border-white/10 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="w-4 h-4 text-cyan-400" />
                <span className="text-xs text-slate-400 uppercase tracking-wider">Total Earned</span>
              </div>
              <p className="text-2xl font-bold text-cyan-400">${dashboard.total_earned_usd.toFixed(2)}</p>
            </div>
            <div className="bg-slate-900/50 border border-white/10 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <Clock className="w-4 h-4 text-yellow-400" />
                <span className="text-xs text-slate-400 uppercase tracking-wider">Pending Payout</span>
              </div>
              <p className="text-2xl font-bold text-yellow-400">${dashboard.pending_cashout_usd.toFixed(2)}</p>
            </div>
            <div className="bg-slate-900/50 border border-white/10 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <Wallet className="w-4 h-4 text-purple-400" />
                <span className="text-xs text-slate-400 uppercase tracking-wider">Payout %</span>
              </div>
              <p className="text-2xl font-bold text-purple-400">{dashboard.payout_percentage.toFixed(1)}%</p>
            </div>
          </div>

          {/* Profile Info */}
          <div className="bg-slate-900/50 border border-white/10 rounded-xl p-6">
            <h2 className="text-xl font-bold mb-4">Celeb Profile</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-slate-400 uppercase">Full Name</label>
                <p className="text-white">{dashboard.full_name || 'Not set'}</p>
              </div>
              <div>
                <label className="text-xs text-slate-400 uppercase">Category</label>
                <p className="text-white">{dashboard.category || 'Not set'}</p>
              </div>
              <div>
                <label className="text-xs text-slate-400 uppercase">Verification Level</label>
                <p className="text-white capitalize">{dashboard.verification_level || 'Basic'}</p>
              </div>
              <div>
                <label className="text-xs text-slate-400 uppercase">Subscribers</label>
                <p className="text-white">{dashboard.subscriber_count}</p>
              </div>
            </div>
          </div>

          {/* Cashout Section */}
          <div className="bg-slate-900/50 border border-white/10 rounded-xl p-6">
            <h2 className="text-xl font-bold mb-4">Request Cashout</h2>
            <p className="text-sm text-slate-300 mb-4">
              Available for payout: ${dashboard.available_usd.toFixed(2)} (payout fee varies by tier)
            </p>

            {cashoutTiers.length > 0 ? (
              <div className="space-y-4">
                <select
                  value={selectedTier}
                  onChange={(e) => setSelectedTier(e.target.value)}
                  className="w-full bg-slate-800/50 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-yellow-500/50"
                >
                  <option value="">Select a cashout tier</option>
                  {cashoutTiers
                    .filter(t => dashboard.available_usd >= t.min_earned_usd)
                    .map(t => (
                      <option key={t.id} value={t.id}>
                        {t.name} — min ${t.min_earned_usd.toFixed(2)} | fee {t.fee_percent}%
                      </option>
                    ))}
                </select>

                {selectedTier && (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs text-slate-400 uppercase">Payout Method</label>
                        <select
                          value={providerType}
                          onChange={(e) => setProviderType(e.target.value)}
                          className="w-full bg-slate-800/50 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-yellow-500/50"
                        >
                          <option value="cash_app">Cash App</option>
                          <option value="paypal">PayPal</option>
                          <option value="venmo">Venmo</option>
                          <option value="zelle">Zelle</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-xs text-slate-400 uppercase">{providerType === 'paypal' ? 'Email' : 'Username/Handle'}</label>
                        <input
                          type="text"
                          value={providerUsername}
                          onChange={(e) => setProviderUsername(e.target.value)}
                          placeholder={
                            providerType === 'cash_app' ? '$cash.app.handle'
                            : providerType === 'paypal' ? 'you@example.com'
                            : providerType === 'venmo' ? '@username'
                            : providerType === 'zelle' ? 'phone or email'
                            : 'Handle'
                          }
                          className="w-full bg-slate-800/50 border border-white/10 rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-yellow-500/50"
                        />
                      </div>
                    </div>

                    <button
                      onClick={handleCashout}
                      disabled={processing || !providerUsername.trim()}
                      className="w-full py-3 bg-gradient-to-r from-yellow-400 to-amber-500 text-black font-bold rounded-xl hover:from-yellow-300 hover:to-amber-400 transition-all disabled:opacity-50"
                    >
                      {processing ? 'Processing...' : 'Request Cashout'}
                    </button>
                  </>
                )}
              </div>
            ) : (
              <p className="text-sm text-slate-400">No cashout tiers available. Check back later.</p>
            )}

            {/* Cashout History */}
            {cashoutRequests.length > 0 && (
              <div className="mt-6">
                <h3 className="text-sm font-semibold text-slate-300 mb-3">Cashout History</h3>
                <div className="space-y-2">
                  {cashoutRequests.map(req => (
                    <div key={req.id} className="flex justify-between items-center bg-slate-800/30 rounded-lg p-3">
                      <div>
                        <p className="text-sm font-medium">${req.payout_usd.toFixed(2)}</p>
                        <p className="text-xs text-slate-500">{req.provider_type} · {new Date(req.requested_at).toLocaleDateString()}</p>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded capitalize ${
                        req.status === 'paid' ? 'bg-green-500/20 text-green-400'
                        : req.status === 'processing' ? 'bg-blue-500/20 text-blue-400'
                        : req.status === 'rejected' ? 'bg-red-500/20 text-red-400'
                        : 'bg-yellow-500/20 text-yellow-400'
                      }`}>
                        {req.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Products Tab */}
      {activeTab === 'products' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold">Your Products</h2>
            <button
              onClick={async () => {
                const title = prompt('Product name:')
                if (!title) return
                const desc = prompt('Description (optional):')
                const priceStr = prompt('Price in coins:')
                const price = parseInt(priceStr || '0')
                if (!price || price <= 0) {
                  toast.error('Invalid price')
                  return
                }
                try {
                  await handleCreateProduct(title, desc || '', price)
                } catch (err: any) {
                  toast.error(err.message || 'Failed to create product')
                }
              }}
              className="px-4 py-2 bg-yellow-500/20 border border-yellow-400/50 text-yellow-300 rounded-lg hover:bg-yellow-500/30 transition-all"
            >
              <ShoppingBag className="w-4 h-4 inline mr-1" />
              Add Product
            </button>
          </div>

          {products.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              No products yet. Create one to offer exclusive merchandise in your Celeb Streams!
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {products.map(product => (
                <div key={product.id} className="bg-slate-900/50 border border-white/10 rounded-xl p-4">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-bold">{product.title}</h3>
                    <span className="text-xs text-slate-400 bg-slate-800/30 px-2 py-0.5 rounded">
                      {product.price_coins} coins
                    </span>
                  </div>
                  {product.description && (
                    <p className="text-sm text-slate-300 mb-2">{product.description}</p>
                  )}
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleUpdateProduct(product.id, { is_active: !product.is_active })}
                      className={`text-xs px-3 py-1 rounded ${
                        product.is_active
                          ? 'bg-red-500/20 text-red-300 hover:bg-red-500/30'
                          : 'bg-green-500/20 text-green-300 hover:bg-green-500/30'
                      }`}
                    >
                      {product.is_active ? 'Deactivate' : 'Activate'}
                    </button>
                    <button
                      onClick={() => handleDeleteProduct(product.id)}
                      className="text-xs px-3 py-1 rounded bg-slate-700/50 text-slate-300 hover:text-red-300"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab Navigation */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-slate-900/80 border border-white/10 rounded-xl px-2 py-1 shadow-[0_0_20px_rgba(0,0,0,0.3)]">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'overview'
              ? 'bg-yellow-500/20 text-yellow-300'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <BarChart3 className="w-4 h-4 inline mr-1" />
          Overview
        </button>
        <button
          onClick={() => setActiveTab('products')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'products'
              ? 'bg-yellow-500/20 text-yellow-300'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <ShoppingBag className="w-4 h-4 inline mr-1" />
          Products
        </button>
      </div>
    </div>
  )
}

