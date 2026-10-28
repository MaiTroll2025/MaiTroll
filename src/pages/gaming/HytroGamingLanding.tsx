import React from "react";
import { Link } from "react-router-dom";
import {
  Gamepad2,
  MonitorPlay,
  ArrowRight,
  Users,
  Crown,
} from "lucide-react";

/**
 * HytroGaming — public landing page.
 *
 * Rendered at /hytrogaming when there is no authenticated session. It explains
 * the gaming and game-streaming features actually supported by MaiTroll without
 * accessing any user-specific data.
 */
export default function HytroGamingLanding() {
  return (
    <div className="min-h-screen bg-[#050714] text-white">
      <nav className="sticky top-0 z-40 border-b border-white/10 bg-[#050714]/80 backdrop-blur">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link
              to="/"
              className="flex items-center gap-2"
              aria-label="MaiTroll home"
            >
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center">
                <Gamepad2 className="w-5 h-5 text-white" />
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
                className="px-4 py-2 text-sm font-medium bg-gradient-to-r from-cyan-400 to-blue-500 text-white rounded-xl hover:from-cyan-300 hover:to-blue-400 transition-all"
              >
                Create account
              </Link>
            </div>
          </div>
        </div>
      </nav>

      <main className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl border border-cyan-500/20 bg-cyan-500/10 mb-4">
            <MonitorPlay className="h-8 w-8 text-cyan-400" />
          </div>
          <h1 className="text-4xl font-black tracking-tight text-white sm:text-5xl">
            HytroGaming
          </h1>
          <p className="mt-4 text-lg text-slate-300">
            Live game streaming and screen sharing inside MaiTroll.
          </p>
        </div>

        <section className="space-y-10">
          <div className="rounded-2xl border border-white/10 bg-[#0a0c16] p-8 sm:p-10">
            <h2 className="text-2xl font-bold text-white mb-6">
              What is HytroGaming?
            </h2>
            <p className="text-slate-300 leading-relaxed mb-6">
              HytroGaming is MaiTroll&rsquo;s live game streaming experience.
              Broadcasters share their screen and gameplay while the MaiTroll
              community watches, reacts, and joins in real time.
            </p>
            <div className="grid md:grid-cols-3 gap-4">
              {[
                {
                  icon: <MonitorPlay className="h-5 w-5" />,
                  title: "Live game streams",
                  body: "Watch broadcasters stream games and share their screen live.",
                },
                {
                  icon: <Users className="h-5 w-5" />,
                  title: "Community",
                  body: "Chat and interact with the streamer and other viewers.",
                },
                {
                  icon: <Crown className="h-5 w-5" />,
                  title: "Member access",
                  body: "Streaming your own games requires a signed-in MaiTroll account.",
                },
              ].map((item) => (
                <div
                  key={item.title}
                  className="rounded-xl border border-white/5 bg-white/[0.02] p-4"
                >
                  <div className="h-9 w-9 rounded-lg bg-cyan-500/10 flex items-center justify-center text-cyan-400 mb-3">
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

          <div className="rounded-2xl border border-white/10 bg-[#0a0c16] p-8 sm:p-10">
            <h2 className="text-2xl font-bold text-white mb-6">
              How to access HytroGaming
            </h2>
            <ol className="text-slate-300 leading-relaxed space-y-4 list-decimal pl-6">
              <li>
                Sign in to your MaiTroll account or create one.
              </li>
              <li>
                Open HytroGaming from the navigation to browse live game streams.
              </li>
              <li>
                To stream your own games, go live through the broadcaster tools
                available after signing in.
              </li>
            </ol>
          </div>
        </section>

        <section className="mt-12 rounded-2xl border border-white/10 bg-gradient-to-br from-cyan-900/20 to-blue-900/20 p-8 sm:p-12 text-center">
          <h2 className="text-2xl font-bold text-white mb-4">Start watching game streams</h2>
          <p className="text-slate-300 mb-6 max-w-md mx-auto">
            Sign in or create an account to browse live streams and go live
            yourself.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              to="/auth"
              className="px-8 py-3 font-semibold text-white rounded-xl bg-gradient-to-r from-cyan-400 to-blue-500 hover:from-cyan-300 hover:to-blue-400 transition-all"
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
            <Link to="/auth" className="text-cyan-400 hover:text-cyan-300 underline">
              Sign in here
            </Link>
          </p>
        </section>
      </main>

      <footer className="border-t border-white/10 bg-[#050714] mt-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
          <p className="text-xs text-slate-500 text-center">
            &copy; {new Date().getFullYear()} MaiTroll. HytroGaming streaming
            features require a signed-in MaiTroll account.
          </p>
        </div>
      </footer>
    </div>
  );
}
