import React from "react";
import { Link } from "react-router-dom";
import {
  Wallet,
  ArrowRight,
  ShieldCheck,
  Banknote,
} from "lucide-react";

/**
 * Mai Pay — public landing page.
 *
 * Rendered at /mai-pay when there is no authenticated session. It explains what
 * Mai Pay is and which financial features are actually available, without
 * exposing any wallet balances, transactions, or payment details.
 */
export default function MaiPayLanding() {
  return (
    <div className="min-h-screen bg-[#0A0814] text-white">
      <nav className="sticky top-0 z-40 border-b border-white/10 bg-[#0A0814]/80 backdrop-blur">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link
              to="/"
              className="flex items-center gap-2"
              aria-label="MaiTroll home"
            >
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center">
                <Wallet className="w-5 h-5 text-white" />
              </div>
              <span className="font-black text-xl tracking-tight">MaiTroll</span>
            </Link>
            <div className="flex items-center gap-3">
              <Link
                to="/auth"
                className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-white transition-colors"
              >
                Sign in
              </Link>
              <Link
                to="/auth"
                className="px-4 py-2 text-sm font-medium bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl hover:from-purple-500 hover:to-pink-500 transition-all"
              >
                Create account
              </Link>
            </div>
          </div>
        </div>
      </nav>

      <main className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl border border-amber-500/20 bg-amber-500/10 mb-4">
            <Wallet className="h-8 w-8 text-amber-400" />
          </div>
          <h1 className="text-4xl font-black tracking-tight text-white sm:text-5xl">
            Mai Pay
          </h1>
          <p className="mt-4 text-lg text-slate-300">
            Troll Coins, crowns, and cash-outs for MaiTroll members.
          </p>
        </div>

        <section className="space-y-10">
          <div className="rounded-2xl border border-white/10 bg-[#10121e] p-8 sm:p-10">
            <h2 className="text-2xl font-bold text-white mb-6">
              What is Mai Pay?
            </h2>
            <p className="text-slate-300 leading-relaxed mb-6">
              Mai Pay is MaiTroll&rsquo;s in-economy payout system. Members who
              earn Troll Coins and battle crowns through broadcasting, gifting,
              and community activity can redeem them for real-world payouts
              through supported providers.
            </p>
            <div className="grid md:grid-cols-3 gap-4">
              {[
                {
                  icon: <CoinsIcon className="h-5 w-5" />,
                  title: "Troll Coins",
                  body: "Earn coins through platform activity and redeem them for cash-outs.",
                },
                {
                  icon: <Banknote className="h-5 w-5" />,
                  title: "Cash-out requests",
                  body: "Request a payout to Cash App, PayPal, Venmo, or ACH bank transfer.",
                },
                {
                  icon: <ShieldCheck className="h-5 w-5" />,
                  title: "Member only",
                  body: "Balances, transactions, and payout details are visible only to the signed-in account owner.",
                },
              ].map((item) => (
                <div
                  key={item.title}
                  className="rounded-xl border border-white/5 bg-white/[0.02] p-4"
                >
                  <div className="h-9 w-9 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-400 mb-3">
                    {item.icon}
                  </div>
                  <h3 className="font-bold text-white">{item.title}</h3>
                  <p className="mt-2 text-sm text-slate-400 leading-relaxed">
                    {item.body}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-[#10121e] p-8 sm:p-10">
            <h2 className="text-2xl font-bold text-white mb-6">
              What you can do with Mai Pay
            </h2>
            <ul className="text-slate-300 leading-relaxed space-y-4 list-disc pl-6">
              <li>
                View your Troll Coin and battle crown balances.
              </li>
              <li>
                Request a cash-out to a supported payout provider.
              </li>
              <li>
                Review your cash-out history and request status.
              </li>
            </ul>
            <p className="mt-4 text-slate-300 leading-relaxed">
              Cash-out eligibility, verification requirements, and any fees are
              determined by your account status and the provider you choose.
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-[#10121e] p-8 sm:p-10">
            <h2 className="text-2xl font-bold text-white mb-6">
              Your data stays private
            </h2>
            <p className="text-slate-300 leading-relaxed mb-6">
              This public page never loads wallet balances, transaction history,
              payout details, or any other account owner&rsquo;s financial
              information. Those queries run only after you sign in, and only
              against your own records.
            </p>
            <p className="text-slate-300 leading-relaxed">
              When you sign out, your balances are cleared from the application
              state so they cannot be seen by the next visitor.
            </p>
          </div>
        </section>

        <section className="mt-12 rounded-2xl border border-white/10 bg-gradient-to-br from-amber-900/20 to-orange-900/20 p-8 sm:p-12 text-center">
          <h2 className="text-2xl font-bold text-white mb-4">Get started with Mai Pay</h2>
          <p className="text-slate-300 mb-6 max-w-md mx-auto">
            Sign in or create an account to view your balance and request a
            cash-out.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              to="/auth"
              className="px-8 py-3 font-semibold text-white rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 transition-all"
            >
              Sign in <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
            <Link
              to="/auth"
              className="px-8 py-3 font-semibold text-white rounded-xl border border-white/20 hover:bg-white/10 transition-all"
            >
              Create account
            </Link>
          </div>
          <p className="mt-6 text-xs text-slate-500">
            Already have an account?{" "}
            <Link to="/auth" className="text-amber-400 hover:text-amber-300 underline">
              Sign in here
            </Link>
          </p>
        </section>
      </main>

      <footer className="border-t border-white/10 bg-[#0A0814] mt-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
          <p className="text-xs text-slate-500 text-center">
            &copy; {new Date().getFullYear()} MaiTroll. Mai Pay balances and
            transactions are private to each signed-in account owner.
          </p>
        </div>
      </footer>
    </div>
  );
}

function CoinsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}
