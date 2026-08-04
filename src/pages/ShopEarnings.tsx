import React, { useEffect, useState, useCallback } from 'react'
import { useAuthStore } from '../lib/store'
import { supabase } from '../lib/supabase'

export default function ShopEarnings() {
  const { user } = useAuthStore()
  const [stats, setStats] = useState({ sales: 0, coins: 0, orders: 0 })
  const [orders, setOrders] = useState<any[]>([])

  const load = useCallback(async () => {
    const { data: shops } = await supabase
      .from('MaiTroll_shops')
      .select('id')
      .eq('owner_id', user!.id)
    const shopIds = (shops || []).map(s => s.id)
    if (shopIds.length === 0) {
      setStats({ sales: 0, coins: 0, orders: 0 })
      setOrders([])
      return
    }
    const { data } = await supabase
      .from('MaiTroll_orders')
      .select('*, MaiTroll_products(name)')
      .in('shop_id', shopIds)
      .order('created_at', { ascending: false })
    const list = data || []
    const totalCoins = list.reduce((sum, o: any) => sum + (o.coins_paid || 0), 0)
    setStats({ sales: list.length, coins: totalCoins, orders: list.length })
    setOrders(list)
  }, [user])

  useEffect(() => {
    if (!user) return
    load()
  }, [user, load])

  if (!user) return <div className="p-6 text-white">Please log in</div>

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <h1 className="text-3xl font-bold">Shop Earnings</h1>

        <div className="grid md:grid-cols-3 gap-4">
          <div className="bg-[#1A1A1A] rounded-xl p-4 border border-[#2C2C2C]">
            <div className="text-sm text-gray-400">Total Sales</div>
            <div className="text-2xl font-bold">{stats.sales}</div>
          </div>
          <div className="bg-[#1A1A1A] rounded-xl p-4 border border-[#2C2C2C]">
            <div className="text-sm text-gray-400">Total Troll Coins</div>
            <div className="text-2xl font-bold text-yellow-400">{stats.coins.toLocaleString()}</div>
          </div>
          <div className="bg-[#1A1A1A] rounded-xl p-4 border border-[#2C2C2C]">
            <div className="text-sm text-gray-400">Orders</div>
            <div className="text-2xl font-bold">{stats.orders}</div>
          </div>
        </div>

        <div className="bg-[#1A1A1A] rounded-xl p-4 border border-[#2C2C2C]">
          <h2 className="text-xl font-semibold mb-3">Recent Orders</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr>
                  <th className="text-left py-2">Date</th>
                  <th className="text-left py-2">Product</th>
                  <th className="text-right py-2">Troll Coins</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id} className="border-t border-[#2C2C2C]">
                    <td className="py-2">{new Date(o.created_at).toLocaleString()}</td>
                    <td className="py-2">{(o as any).MaiTroll_products?.name || 'Product'}</td>
                    <td className="py-2 text-right">{(o.coins_paid || 0).toLocaleString()}</td>
                  </tr>
                ))}
                {orders.length === 0 && (
                  <tr>
                    <td colSpan={3} className="py-4 text-center text-gray-400">No orders yet</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}

