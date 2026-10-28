import React from "react";
import { Link } from "react-router-dom";
import {
  Mail,
  ArrowRight,
  Lock,
  ShieldCheck,
  Send,
} from "lucide-react";

/**
 * MaiTroll Post Office — public landing page.
 *
 * Rendered at /utromail when there is no authenticated session. It explains the
 * mail/messaging features actually implemented in MaiTroll without accessing any
 * user-specific data or requiring a user ID.
 */
export default function PostOfficeLanding() {
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
                <Mail className="w-5 h-5 text-white" />
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
          <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl border border-purple-500/20 bg-purple-500/10 mb-4">
            <Mail className="h-8 w-8 text-purple-400" />
          </div>
          <h1 className="text-4xl font-black tracking-tight text-white sm:text-5xl">
            MaiTroll Post Office
          </h1>
          <p className="mt-4 text-lg text-slate-300">
            Private messaging inside MaiTroll, powered by UtroMail.
          </p>
        </div>

        <section className="space-y-10">
          <div className="rounded-2xl border border-white/10 bg-[#10121e] p-8 sm:p-10">
            <h2 className="text-2xl font-bold text-white mb-6">
              What is MaiTroll Post Office?
            </h2>
            <p className="text-slate-300 leading-relaxed mb-6">
              MaiTroll Post Office is the platform&rsquo;s private messaging
              system. Members can send and receive direct messages, follow
              conversation threads, and stay in touch with other MaiTroll users
              without leaving the app.
            </p>
            <div className="grid md:grid-cols-3 gap-4">
              {[
                {
                  icon: <Send className="h-5 w-5" />,
                  title: "Direct messages",
                  body: "Send private messages to other members in threaded conversations.",
                },
                {
                  icon: <Lock className="h-5 w-5" />,
                  title: "Private by design",
                  body: "Messages belong to their participants. The public landing page never shows message content.",
                },
                {
                  icon: <ShieldCheck className="h-5 w-5" />,
                  title: "Signed-in access",
                  body: "Reading, writing, and managing your inbox requires a MaiTroll account.",
                },
              ].map((item) => (
                <div
                  key={item.title}
                  className="rounded-xl border border-white/5 bg-white/[0.02] p-4"
                >
                  <div className="h-9 w-9 rounded-lg bg-purple-500/10 flex items-center justify-center text-purple-400 mb-3">
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
              What does UtroMail do?
            </h2>
            <p className="text-slate-300 leading-relaxed mb-6">
              UtroMail is the messaging backend behind MaiTroll Post Office. It
              handles conversation threads, message requests, read receipts,
              typing indicators, and real-time delivery so members can chat
              while using MaiTroll&rsquo;s live and social features.
            </p>
            <p className="text-slate-300 leading-relaxed">
              UtroMail is a signed-in feature. Visitors browsing this page cannot
              read or send messages, and no conversation data is loaded unless
              you authenticate.
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-[#10121e] p-8 sm:p-10">
            <h2 className="text-2xl font-bold text-white mb-6">
              How to access Post Office
            </h2>
            <ol className="text-slate-300 leading-relaxed space-y-4 list-decimal pl-6">
              <li>
                Create a MaiTroll account or sign in to an existing one.
              </li>
              <li>
                Once signed in, open <strong>UTroMail</strong> from the main
                navigation to view your inbox and start a conversation.
              </li>
              <li>
                Select a thread to read messages, or compose a new message to any
                member you can message.
              </li>
            </ol>
            <p className="mt-4 text-sm text-slate-400">
              Some messaging actions (blocking, reporting, deleting threads) are
              available to the participants of a conversation after signing in.
            </p>
          </div>
        </section>

        <section className="mt-12 rounded-2xl border border-white/10 bg-gradient-to-br from-purple-900/20 to-pink-900/20 p-8 sm:p-12 text-center">
          <h2 className="text-2xl font-bold text-white mb-4">Ready to send your first message?</h2>
          <p className="text-slate-300 mb-6 max-w-md mx-auto">
            Sign in or create an account to unlock MaiTroll Post Office and your
            private inbox.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              to="/auth"
              className="px-8 py-3 font-semibold text-white rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 transition-all"
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
            <Link to="/auth" className="text-purple-400 hover:text-purple-300 underline">
              Sign in here
            </Link>
          </p>
        </section>
      </main>

      <footer className="border-t border-white/10 bg-[#0A0814] mt-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
          <p className="text-xs text-slate-500 text-center">
            &copy; {new Date().getFullYear()} MaiTroll. MaiTroll Post Office is
            a signed-in messaging feature of MaiTroll.
          </p>
        </div>
      </footer>
    </div>
  );
}
