import React from 'react'
import { Link } from 'react-router-dom'
import {
  Radio, Gamepad2, Gavel, ShoppingCart, Mic, Landmark,
  Users, Church, MapPin, Car, Sparkles, Trophy, DollarSign,
  Building2, Swords, Headphones, Home
} from 'lucide-react'

const platformLinks = [
  { path: '/explore', label: 'Explore Live Streams', icon: Radio, description: 'Discover trending content' },
  { path: '/hytrogaming', label: 'HydroGaming', icon: Gamepad2, description: 'Watch gaming streams' },
  { path: '/auctions', label: 'Live Auctions', icon: Gavel, description: 'Bid on exclusive items' },
  { path: '/marketplace', label: 'Marketplace', icon: ShoppingCart, description: 'Buy and sell online' },
  { path: '/troll-wheel', label: 'Troll Wheel', icon: Sparkles, description: 'Spin for rewards' },
  { path: '/podcast', label: 'Podcasts', icon: Mic, description: 'Listen to creator podcasts' },
  { path: '/troll-court', label: 'Troll Court', icon: Landmark, description: 'Community justice system' },
  { path: '/government', label: 'Government', icon: Building2, description: 'Digital democracy' },
  { path: '/family/city', label: 'Families', icon: Users, description: 'Join social communities' },
  { path: '/neighborhood-map', label: 'Neighborhoods', icon: MapPin, description: 'Explore digital neighborhoods' },
  { path: '/garage', label: 'Garage', icon: Car, description: 'Virtual vehicle collection' },
  { path: '/church', label: 'Troll Church', icon: Church, description: 'Faith community' },
]

const creatorLinks = [
  { path: '/jobs', label: 'Jobs', icon: DollarSign, description: 'Make money online' },
  { path: '/sell', label: 'Sell on Mai Troll', icon: ShoppingCart, description: 'Become a seller' },
  { path: '/creators', label: 'Become a Creator', icon: Trophy, description: 'Start your journey' },
  { path: '/go-live', label: 'Go Live', icon: Radio, description: 'Start streaming now' },
]

export default function InternalLinkHub() {
  return (
    <div className="bg-slate-950 border-t border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <h2 className="text-2xl font-bold text-white mb-2">Explore Mai Troll</h2>
        <p className="text-slate-400 mb-10">Discover all the features and communities on our platform</p>

        <div className="grid md:grid-cols-2 gap-10">
          <div>
            <h3 className="text-lg font-semibold text-purple-300 mb-4">Platform</h3>
            <div className="grid sm:grid-cols-2 gap-3">
              {platformLinks.map(link => {
                const Icon = link.icon
                return (
                  <Link
                    key={link.path}
                    to={link.path}
                    className="flex items-start gap-3 p-3 rounded-xl bg-slate-900/50 border border-slate-800 hover:border-purple-500/30 hover:bg-slate-800/50 transition-all group"
                  >
                    <div className="w-9 h-9 rounded-lg bg-purple-600/20 flex items-center justify-center flex-shrink-0 group-hover:bg-purple-600/30 transition-colors">
                      <Icon className="w-4 h-4 text-purple-400" />
                    </div>
                    <div>
                      <span className="text-white text-sm font-medium group-hover:text-purple-300 transition-colors">{link.label}</span>
                      <p className="text-slate-500 text-xs mt-0.5">{link.description}</p>
                    </div>
                  </Link>
                )
              })}
            </div>
          </div>

          <div>
            <h3 className="text-lg font-semibold text-pink-300 mb-4">Creator Economy</h3>
            <div className="grid sm:grid-cols-2 gap-3">
              {creatorLinks.map(link => {
                const Icon = link.icon
                return (
                  <Link
                    key={link.path}
                    to={link.path}
                    className="flex items-start gap-3 p-3 rounded-xl bg-slate-900/50 border border-slate-800 hover:border-pink-500/30 hover:bg-slate-800/50 transition-all group"
                  >
                    <div className="w-9 h-9 rounded-lg bg-pink-600/20 flex items-center justify-center flex-shrink-0 group-hover:bg-pink-600/30 transition-colors">
                      <Icon className="w-4 h-4 text-pink-400" />
                    </div>
                    <div>
                      <span className="text-white text-sm font-medium group-hover:text-pink-300 transition-colors">{link.label}</span>
                      <p className="text-slate-500 text-xs mt-0.5">{link.description}</p>
                    </div>
                  </Link>
                )
              })}
            </div>

            <h3 className="text-lg font-semibold text-cyan-300 mb-4 mt-8">Discover More</h3>
            <div className="grid sm:grid-cols-2 gap-3">
              <Link
                to="/categories"
                className="flex items-start gap-3 p-3 rounded-xl bg-slate-900/50 border border-slate-800 hover:border-cyan-500/30 hover:bg-slate-800/50 transition-all group"
              >
                <div className="w-9 h-9 rounded-lg bg-cyan-600/20 flex items-center justify-center flex-shrink-0 group-hover:bg-cyan-600/30 transition-colors">
                  <Swords className="w-4 h-4 text-cyan-400" />
                </div>
                <div>
                  <span className="text-white text-sm font-medium group-hover:text-cyan-300 transition-colors">Categories</span>
                  <p className="text-slate-500 text-xs mt-0.5">Browse all content categories</p>
                </div>
              </Link>
              <Link
                to="/tcnn"
                className="flex items-start gap-3 p-3 rounded-xl bg-slate-900/50 border border-slate-800 hover:border-cyan-500/30 hover:bg-slate-800/50 transition-all group"
              >
                <div className="w-9 h-9 rounded-lg bg-cyan-600/20 flex items-center justify-center flex-shrink-0 group-hover:bg-cyan-600/30 transition-colors">
                  <Headphones className="w-4 h-4 text-cyan-400" />
                </div>
                <div>
                  <span className="text-white text-sm font-medium group-hover:text-cyan-300 transition-colors">TCNN News</span>
                  <p className="text-slate-500 text-xs mt-0.5">Latest platform news</p>
                </div>
              </Link>
              <Link
                to="/trending"
                className="flex items-start gap-3 p-3 rounded-xl bg-slate-900/50 border border-slate-800 hover:border-cyan-500/30 hover:bg-slate-800/50 transition-all group"
              >
                <div className="w-9 h-9 rounded-lg bg-cyan-600/20 flex items-center justify-center flex-shrink-0 group-hover:bg-cyan-600/30 transition-colors">
                  <Sparkles className="w-4 h-4 text-cyan-400" />
                </div>
                <div>
                  <span className="text-white text-sm font-medium group-hover:text-cyan-300 transition-colors">Trending</span>
                  <p className="text-slate-500 text-xs mt-0.5">What's hot right now</p>
                </div>
              </Link>
              <Link
                to="/top-creators"
                className="flex items-start gap-3 p-3 rounded-xl bg-slate-900/50 border border-slate-800 hover:border-cyan-500/30 hover:bg-slate-800/50 transition-all group"
              >
                <div className="w-9 h-9 rounded-lg bg-cyan-600/20 flex items-center justify-center flex-shrink-0 group-hover:bg-cyan-600/30 transition-colors">
                  <Trophy className="w-4 h-4 text-cyan-400" />
                </div>
                <div>
                  <span className="text-white text-sm font-medium group-hover:text-cyan-300 transition-colors">Top Creators</span>
                  <p className="text-slate-500 text-xs mt-0.5">Leaderboard rankings</p>
                </div>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export function SEOFooter() {
  const currentYear = new Date().getFullYear()
  return (
    <footer className="bg-slate-950 border-t border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8">
          <div>
            <h3 className="text-white font-semibold mb-4">Platform</h3>
            <ul className="space-y-2">
              <li><Link to="/about" className="text-slate-400 hover:text-purple-300 transition-colors text-sm">About</Link></li>
              <li><Link to="/explore" className="text-slate-400 hover:text-purple-300 transition-colors text-sm">Explore</Link></li>
              <li><Link to="/hytrogaming" className="text-slate-400 hover:text-purple-300 transition-colors text-sm">HydroGaming</Link></li>
              <li><Link to="/troll-wheel" className="text-slate-400 hover:text-purple-300 transition-colors text-sm">Troll Wheel</Link></li>
              <li><Link to="/auctions" className="text-slate-400 hover:text-purple-300 transition-colors text-sm">Auctions</Link></li>
              <li><Link to="/marketplace" className="text-slate-400 hover:text-purple-300 transition-colors text-sm">Marketplace</Link></li>
            </ul>
          </div>
          <div>
            <h3 className="text-white font-semibold mb-4">Community</h3>
            <ul className="space-y-2">
              <li><Link to="/categories" className="text-slate-400 hover:text-purple-300 transition-colors text-sm">Categories</Link></li>
              <li><Link to="/podcast" className="text-slate-400 hover:text-purple-300 transition-colors text-sm">Podcasts</Link></li>
              <li><Link to="/troll-court" className="text-slate-400 hover:text-purple-300 transition-colors text-sm">Troll Court</Link></li>
              <li><Link to="/government" className="text-slate-400 hover:text-purple-300 transition-colors text-sm">Government</Link></li>
              <li><Link to="/family/city" className="text-slate-400 hover:text-purple-300 transition-colors text-sm">Families</Link></li>
              <li><Link to="/neighborhood-map" className="text-slate-400 hover:text-purple-300 transition-colors text-sm">Neighborhoods</Link></li>
            </ul>
          </div>
          <div>
            <h3 className="text-white font-semibold mb-4">Creators</h3>
            <ul className="space-y-2">
              <li><Link to="/creators" className="text-slate-400 hover:text-purple-300 transition-colors text-sm">Become a Creator</Link></li>
              <li><Link to="/go-live" className="text-slate-400 hover:text-purple-300 transition-colors text-sm">Go Live</Link></li>
              <li><Link to="/sell" className="text-slate-400 hover:text-purple-300 transition-colors text-sm">Sell on Mai Troll</Link></li>
              <li><Link to="/jobs" className="text-slate-400 hover:text-purple-300 transition-colors text-sm">Jobs</Link></li>
              <li><Link to="/legal/creator-earnings" className="text-slate-400 hover:text-purple-300 transition-colors text-sm">Earnings</Link></li>
            </ul>
          </div>
          <div>
            <h3 className="text-white font-semibold mb-4">Watch</h3>
            <ul className="space-y-2">
              <li><Link to="/live-swipe" className="text-slate-400 hover:text-purple-300 transition-colors text-sm">Live Streams</Link></li>
              <li><Link to="/trending" className="text-slate-400 hover:text-purple-300 transition-colors text-sm">Trending</Link></li>
              <li><Link to="/top-creators" className="text-slate-400 hover:text-purple-300 transition-colors text-sm">Top Creators</Link></li>
              <li><Link to="/tcnn" className="text-slate-400 hover:text-purple-300 transition-colors text-sm">TCNN News</Link></li>
              <li><Link to="/academy" className="text-slate-400 hover:text-purple-300 transition-colors text-sm">Academy</Link></li>
            </ul>
          </div>
          <div>
            <h3 className="text-white font-semibold mb-4">Legal</h3>
            <ul className="space-y-2">
              <li><Link to="/legal/terms" className="text-slate-400 hover:text-purple-300 transition-colors text-sm">Terms of Service</Link></li>
              <li><Link to="/legal/privacy" className="text-slate-400 hover:text-purple-300 transition-colors text-sm">Privacy Policy</Link></li>
              <li><Link to="/legal/safety" className="text-slate-400 hover:text-purple-300 transition-colors text-sm">Safety Guidelines</Link></li>
              <li><Link to="/legal/payouts" className="text-slate-400 hover:text-purple-300 transition-colors text-sm">Payout Policy</Link></li>
              <li><Link to="/support" className="text-slate-400 hover:text-purple-300 transition-colors text-sm">Support</Link></li>
            </ul>
          </div>
        </div>
        <div className="mt-12 pt-8 border-t border-slate-800 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center">
              <Home className="w-4 h-4 text-white" />
            </div>
            <span className="text-slate-400 text-sm">© {currentYear} Mai Troll (MaiMaiTroll). All rights reserved.</span>
          </div>
          <div className="flex items-center gap-6 text-slate-400 text-sm">
            <Link to="/sitemap.xml" className="hover:text-purple-300 transition-colors">Sitemap</Link>
            <span>Trending Worldwide</span>
          </div>
        </div>
      </div>
    </footer>
  )
}
