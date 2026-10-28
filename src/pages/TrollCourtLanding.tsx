import React from "react";
import { Link } from "react-router-dom";
import {
  Gavel,
  Shield,
  Scale,
  ArrowRight,
  Users,
} from "lucide-react";

/**
 * Troll Court — public information page.
 *
 * Rendered at /troll-court when there is no authenticated session. It explains
 * the virtual court system without exposing dockets, case lists, case details,
 * evidence, or any personal information.
 */
export default function TrollCourtLanding() {
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
                <Gavel className="w-5 h-5 text-white" />
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
          <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl border border-yellow-500/20 bg-yellow-500/10 mb-4">
            <Gavel className="h-8 w-8 text-yellow-400" />
          </div>
          <h1 className="text-4xl font-black tracking-tight text-white sm:text-5xl">
            Troll Court
          </h1>
          <p className="mt-4 text-lg text-slate-300">
            MaiTroll&rsquo;s virtual court and community justice system.
          </p>
        </div>

        <section className="space-y-10">
          <div className="rounded-2xl border border-white/10 bg-[#10121e] p-8 sm:p-10">
            <h2 className="text-2xl font-bold text-white mb-6">
              What is Troll Court?
            </h2>
            <p className="text-slate-300 leading-relaxed mb-6">
              Troll Court is MaiTroll&rsquo;s community-driven court system.
              Members can bring disputes before the court, and authorized
              participants review and rule on cases in a virtual courtroom
              setting. It is a social feature of the platform, not a real court
              of law, and its rulings apply only within MaiTroll.
            </p>
            <div className="grid md:grid-cols-3 gap-4">
              {[
                {
                  icon: <Scale className="h-5 w-5" />,
                  title: "Case filing",
                  body: "Members can file civil cases related to platform disputes.",
                },
                {
                  icon: <Users className="h-5 w-5" />,
                  title: "Community rulings",
                  body: "Authorized roles review cases and participate in proceedings.",
                },
                {
                  icon: <Shield className="h-5 w-5" />,
                  title: "Restricted records",
                  body: "Dockets, evidence, and case details are visible only to authorized participants.",
                },
              ].map((item) => (
                <div
                  key={item.title}
                  className="rounded-xl border border-white/5 bg-white/[0.02] p-4"
                >
                  <div className="h-9 w-9 rounded-lg bg-yellow-500/10 flex items-center justify-center text-yellow-400 mb-3">
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
              What visitors can and cannot see
            </h2>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
                <p className="flex items-center gap-2 mb-3 text-emerald-400 text-sm font-bold">
                  <span className="h-3 w-3 rounded-full bg-emerald-400" />
                  Visible publicly
                </p>
                <ul className="text-slate-300 text-sm leading-relaxed space-y-2 list-disc pl-6">
                  <li>The purpose of the court system.</li>
                  <li>How cases and rulings work in general terms.</li>
                  <li>How to participate once signed in and authorized.</li>
                </ul>
              </div>
              <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
                <p className="flex items-center gap-2 mb-3 text-red-400 text-sm font-bold">
                  <span className="h-3 w-3 rounded-full bg-red-400" />
                  Not available publicly
                </p>
                <ul className="text-slate-300 text-sm leading-relaxed space-y-2 list-disc pl-6">
                  <li>Court dockets and case lists.</li>
                  <li>Individual case details and filings.</li>
                  <li>Private evidence or personal information.</li>
                  <li>Other members&rsquo; case involvement.</li>
                </ul>
              </div>
            </div>
            <p className="mt-4 text-slate-300 leading-relaxed">
              Access to cases, evidence, and docket data is controlled by the
              backend and is restricted to the parties and authorized roles for
              each case. Hiding a docket in the interface is not the only
              protection &mdash; server-side authorization enforces it.
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-[#10121e] p-8 sm:p-10">
            <h2 className="text-2xl font-bold text-white mb-6">
              How to participate
            </h2>
            <ol className="text-slate-300 leading-relaxed space-y-4 list-decimal pl-6">
              <li>
                Sign in to your MaiTroll account.
              </li>
              <li>
                Open Troll Court from the navigation once your account meets the
                participation requirements for your role.
              </li>
              <li>
                File a case or join a proceeding only if your role authorizes
                it. Judges, officers, secretaries, and administrators have
                different permissions.
              </li>
            </ol>
          </div>
        </section>

        <section className="mt-12 rounded-2xl border border-white/10 bg-gradient-to-br from-yellow-900/20 to-amber-900/20 p-8 sm:p-12 text-center">
          <h2 className="text-2xl font-bold text-white mb-4">Ready to use Troll Court?</h2>
          <p className="text-slate-300 mb-6 max-w-md mx-auto">
            Sign in or create an account to access court features available to
            your role.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              to="/auth"
              className="px-8 py-3 font-semibold text-white rounded-xl bg-gradient-to-r from-yellow-500 to-amber-600 hover:from-yellow-400 hover:to-amber-500 text-black transition-all"
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
            <Link to="/auth" className="text-yellow-400 hover:text-yellow-300 underline">
              Sign in here
            </Link>
          </p>
        </section>
      </main>

      <footer className="border-t border-white/10 bg-[#0A0814] mt-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
          <p className="text-xs text-slate-500 text-center">
            &copy; {new Date().getFullYear()} MaiTroll. Troll Court is a
            virtual, platform-only court system. Case records are restricted to
            authorized participants.
          </p>
        </div>
      </footer>
    </div>
  );
}
