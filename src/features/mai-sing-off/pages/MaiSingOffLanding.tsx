import React from "react";
import { Link } from "react-router-dom";
import {
  Mic2,
  Trophy,
  Users,
  ArrowRight,
  Play,
} from "lucide-react";

/**
 * Mai Sing Off — public landing page.
 *
 * Rendered at /mai-sing-off when there is no authenticated session. It explains
 * the singing competition using only capabilities supported by the current
 * implementation, without accessing user-specific data or starting any
 * authenticated stage, queue, contestant, judge, or session workflow.
 */
export default function MaiSingOffLanding() {
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
                <Mic2 className="w-5 h-5 text-white" />
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
            <Mic2 className="h-8 w-8 text-purple-400" />
          </div>
          <h1 className="text-4xl font-black tracking-tight text-white sm:text-5xl">
            Mai Sing Off
          </h1>
          <p className="mt-4 text-lg text-slate-300">
            MaiTroll&rsquo;s live singing competition and stage experience.
          </p>
        </div>

        <section className="space-y-10">
          <div className="rounded-2xl border border-white/10 bg-[#10121e] p-8 sm:p-10">
            <h2 className="text-2xl font-bold text-white mb-6">
              How Mai Sing Off works
            </h2>
            <p className="text-slate-300 leading-relaxed mb-6">
              Mai Sing Off is a live singing competition inside MaiTroll.
              Eligible members take the stage in supported positions &mdash;
              challenger, host, judge, CEO seat, or audience &mdash; while the
              community watches and participates in real time.
            </p>
            <div className="grid md:grid-cols-3 gap-4">
              {[
                {
                  icon: <Play className="h-5 w-5" />,
                  title: "Stage positions",
                  body: "Challenger, host, judge, and CEO seats supported by the current implementation.",
                },
                {
                  icon: <Users className="h-5 w-5" />,
                  title: "Queues &amp; participation",
                  body: "Eligible members can join the queue or take a stage role when a show is active.",
                },
                {
                  icon: <Trophy className="h-5 w-5" />,
                  title: "Live shows",
                  body: "Scheduled and live singing shows with hosts, judges, and an audience.",
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
              Who can participate
            </h2>
            <p className="text-slate-300 leading-relaxed mb-6">
              Participation is for signed-in MaiTroll members who are eligible
              for a stage position. Host and judge roles require the
              corresponding permissions. Audience viewing is available during
              live shows.
            </p>
            <p className="text-slate-300 leading-relaxed">
              Private participant information &mdash; including stage assignments,
              queue status, and session details &mdash; is not shown on this
              public page and is only accessible to the signed-in participants
              of a show.
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-[#10121e] p-8 sm:p-10">
            <h2 className="text-2xl font-bold text-white mb-6">
              What is not shown here
            </h2>
            <ul className="text-slate-300 leading-relaxed space-y-4 list-disc pl-6">
              <li>Current stage lineups and contestant details.</li>
              <li>Active show queues and session state.</li>
              <li>Judge rulings and scoring.</li>
              <li>Private participant contact or profile information.</li>
            </ul>
            <p className="mt-4 text-slate-300 leading-relaxed">
              No authenticated stage participation, queue, contestant, judge, or
              session workflow is started on this page. Those workflows require
              a logged-in user.
            </p>
          </div>
        </section>

        <section className="mt-12 rounded-2xl border border-white/10 bg-gradient-to-br from-purple-900/20 to-pink-900/20 p-8 sm:p-12 text-center">
          <h2 className="text-2xl font-bold text-white mb-4">Join Mai Sing Off</h2>
          <p className="text-slate-300 mb-6 max-w-md mx-auto">
            Sign in or create an account to check your eligibility and take the
            stage when a show is live.
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
            &copy; {new Date().getFullYear()} MaiTroll. Mai Sing Off stage,
            queue, and participant data are private to signed-in participants.
          </p>
        </div>
      </footer>
    </div>
  );
}
