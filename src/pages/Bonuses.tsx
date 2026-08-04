import { Link } from 'react-router-dom'
import { useAuthStore } from '../lib/store'
import { COINS_PER_USD } from '../config/coinConfig'

export default function BonusesPage() {
  const { profile } = useAuthStore()

  return (
    <div className="min-h-screen bg-slate-950 text-white px-4 py-6 lg:px-10">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="rounded-[2rem] border border-cyan-400/20 bg-slate-950/80 p-8 shadow-[0_0_40px_rgba(45,212,191,0.12)] backdrop-blur-2xl">
          <h1 className="text-4xl font-black text-white">Bonuses, Coin Rewards & Fees</h1>
          <p className="mt-3 max-w-2xl text-slate-300">
            Learn how new user bonuses, coin purchase rewards, and platform fees work in Mai Troll.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <section className="rounded-3xl border border-slate-700/80 bg-slate-900/80 p-6 shadow-lg">
            <h2 className="text-2xl font-semibold text-cyan-200">Coin Value</h2>
            <p className="mt-4 text-slate-300">
              Coins are valued at <span className="font-semibold text-white">{COINS_PER_USD} coins = $1.00</span> across the platform.
            </p>
            <p className="mt-2 text-slate-400">
              Every dollar spent gives you {COINS_PER_USD} coins, applied at checkout at the standard platform rate.
            </p>
          </section>

          <section className="rounded-3xl border border-slate-700/80 bg-slate-900/80 p-6 shadow-lg">
            <h2 className="text-2xl font-semibold text-cyan-200">Cashout Fees</h2>
            <p className="mt-4 text-slate-300">
              Mai Troll does not charge any fees to cash out your earnings.
            </p>
            <p className="mt-2 text-slate-400">
              The full USD value of your selected cashout tier is paid out. Minimum cashout is 2,000 coins.
            </p>
          </section>
        </div>

        <div className="rounded-[2rem] border border-cyan-500/20 bg-slate-900/90 p-8 shadow-[0_0_32px_rgba(45,212,191,0.14)]">
          <h2 className="text-3xl font-semibold text-white">Other Fees & Agency Charges</h2>
          <ul className="mt-4 space-y-3 text-slate-300">
            <li>
              <span className="font-semibold text-white">Agency startup fee:</span> 25,000 Troll Coins.
            </li>
            <li>
              <span className="font-semibold text-white">Agency monthly subscription fee:</span> 10,000 Troll Coins.
            </li>
            <li>
              <span className="font-semibold text-white">Cashout requests:</span> no platform fees; the full selected tier value is paid out.
            </li>
          </ul>
          <p className="mt-4 text-slate-400">
            These values are platform defaults and are enforced during checkout and approval flows.
          </p>
        </div>

        <div className="flex flex-col gap-3 rounded-3xl border border-slate-700/80 bg-slate-900/80 p-6 shadow-lg">
          {profile ? (
            <p className="text-slate-300">
              Welcome back, <span className="font-semibold text-white">{profile.display_name || profile.username}</span>. Use the bonuses page to understand how coins and fees affect your balance.
            </p>
          ) : (
            <p className="text-slate-300">Sign in to see your personalized bonus eligibility and rewards.</p>
          )}
          <Link to="/coins" className="inline-flex w-fit rounded-full bg-cyan-500 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400">
            Buy Coins
          </Link>
        </div>
      </div>
    </div>
  )
}
