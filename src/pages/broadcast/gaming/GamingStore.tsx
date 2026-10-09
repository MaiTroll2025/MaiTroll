import React from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, ShoppingBag, Coins, Gift } from 'lucide-react';

const STORE_ITEMS = [
  { name: 'GG Pack', icon: '👋', coins: 100, price: '$0.99', desc: '10 GG gifts' },
  { name: 'Headshot Pack', icon: '🎯', coins: 250, price: '$2.49', desc: '10 Headshot gifts' },
  { name: 'MVP Pack', icon: '🏆', coins: 1000, price: '$9.99', desc: '10 MVP gifts' },
]

const COIN_PACKS = [
  { coins: 100, price: '$0.99', bonus: '' },
  { coins: 500, price: '$4.99', bonus: '+10%' },
  { coins: 1000, price: '$9.99', bonus: '+15%' },
  { coins: 5000, price: '$49.99', bonus: '+25%' },
  { coins: 10000, price: '$99.99', bonus: '+30%' },
]

export default function GamingStore() {
  return (
    <div className="min-h-screen bg-[#05080f] p-4 sm:p-6 text-white">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex items-center gap-3">
          <Link to={`/broadcast/setup/gaming`} className="rounded-lg border border-white/10 bg-white/5 p-2 text-slate-400 hover:text-white">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <ShoppingBag className="h-5 w-5 text-cyan-300" />
          <h1 className="text-xl font-black">Gaming Store</h1>
        </div>

        <div className="mb-8">
          <h3 className="mb-4 flex items-center gap-2 text-sm font-black text-amber-300">
            <Coins className="h-4 w-4" />
            Coin Packs
          </h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {COIN_PACKS.map((pack) => (
              <button
                key={pack.coins}
                className="rounded-2xl border border-amber-400/30 bg-amber-500/10 p-4 text-left transition hover:border-amber-400/50 hover:bg-amber-500/15"
              >
                <div className="flex items-center justify-between">
                  <span className="text-lg font-black text-amber-200">{pack.coins.toLocaleString()} coins</span>
                  {pack.bonus && (
                    <span className="rounded-lg bg-emerald-500/20 px-2 py-0.5 text-[10px] font-black text-emerald-300">{pack.bonus}</span>
                  )}
                </div>
                <p className="mt-2 text-lg font-black text-white">{pack.price}</p>
              </button>
            ))}
          </div>
        </div>

        <div>
          <h3 className="mb-4 flex items-center gap-2 text-sm font-black text-purple-300">
            <Gift className="h-4 w-4" />
            Gaming Gift Packs
          </h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {STORE_ITEMS.map((item) => (
              <button
                key={item.name}
                className="rounded-2xl border border-purple-400/30 bg-purple-500/10 p-4 text-left transition hover:border-purple-400/50 hover:bg-purple-500/15"
              >
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{item.icon}</span>
                  <div>
                    <p className="text-sm font-black text-white">{item.name}</p>
                    <p className="text-xs text-slate-400">{item.desc}</p>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-xs text-purple-300">{item.coins} coins</span>
                  <span className="text-sm font-black text-white">{item.price}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
