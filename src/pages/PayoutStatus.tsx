import React from 'react'
import { ExternalLink, DollarSign, Shield } from 'lucide-react'
import MAIPayCard from '../components/MAIPayCard'
import { useAuthStore } from '../lib/store'

export default function PayoutStatus() {
  const { user } = useAuthStore()

  return (
    <div className="min-h-screen bg-[#0A0814] text-white px-6 py-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold mb-2">Payout Status</h1>
          <p className="text-gray-400">Centralized payouts powered by MAI Pay</p>
        </div>

        <div className="bg-gradient-to-r from-cyan-950/50 to-purple-950/50 border border-cyan-500/20 rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-300/25 bg-cyan-400/10">
              <Shield className="h-5 w-5 text-cyan-300" />
            </div>
            <div>
              <h2 className="text-xl font-black text-white">MAI Pay Integration</h2>
              <p className="text-sm text-slate-400">Secure, centralized payout processing</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="bg-slate-900/50 border border-slate-700/50 rounded-xl p-4">
              <h3 className="text-lg font-bold text-white mb-2">How It Works</h3>
              <ul className="text-sm text-slate-300 space-y-1">
                <li>• Earn coins through streaming, battles, and city activities</li>
                <li>• Coins are held securely until payout</li>
                <li>• Payouts processed on request through MAI Pay</li>
                <li>• All transactions powered by PayPal for security</li>
              </ul>
            </div>

            <div className="bg-slate-900/50 border border-slate-700/50 rounded-xl p-4">
              <h3 className="text-lg font-bold text-white mb-2">Payout Process</h3>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-sm">
                <div className="text-center">
                  <div className="text-cyan-400 font-bold mb-1">1. Earn</div>
                  <div className="text-slate-400">Accumulate coins</div>
                </div>
                <div className="text-center">
                  <div className="text-cyan-400 font-bold mb-1">2. Reserve</div>
                  <div className="text-slate-400">Coins held for payout</div>
                </div>
                <div className="text-center">
                  <div className="text-cyan-400 font-bold mb-1">3. Process</div>
                  <div className="text-slate-400">MAI Pay handles payout</div>
                </div>
                <div className="text-center">
                  <div className="text-cyan-400 font-bold mb-1">4. Receive</div>
                  <div className="text-slate-400">Funds delivered</div>
                </div>
              </div>
            </div>

            <div className="bg-slate-900/50 border border-slate-700/50 rounded-xl p-4">
              <h3 className="text-lg font-bold text-white mb-2">Payout Statuses</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                <div className="text-center">
                  <div className="text-blue-400 font-bold">Pending</div>
                  <div className="text-slate-400">Awaiting review</div>
                </div>
                <div className="text-center">
                  <div className="text-yellow-400 font-bold">Processing</div>
                  <div className="text-slate-400">Being processed</div>
                </div>
                <div className="text-center">
                  <div className="text-green-400 font-bold">Completed</div>
                  <div className="text-slate-400">Paid successfully</div>
                </div>
                <div className="text-center">
                  <div className="text-red-400 font-bold">Rejected</div>
                  <div className="text-slate-400">Payout declined</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {user && <MAIPayCard />}

        <div className="text-center">
          <a
            href="https://maicorp.online/mai-pay"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-cyan-400 hover:text-cyan-300 underline"
          >
            Visit MAI Pay for more information
            <ExternalLink className="h-4 w-4" />
          </a>
        </div>
      </div>
    </div>
  )
}