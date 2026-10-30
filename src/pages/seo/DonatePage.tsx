import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  Code2,
  Heart,
  Loader2,
  Megaphone,
  ShieldCheck,
  Users,
} from "lucide-react";
import SEOLayout from "./SEOLayout";
import { supabase } from "@/lib/supabase";

const donationAmounts = ["5", "10", "25", "50", "100"] as const;
const seoTitle = "Support MaiTroll City | Help Our Live Streaming Community Grow";
const seoDescription =
  "Help MaiTroll City grow! Support live-streaming infrastructure, platform development, future hiring, and community expansion through secure PayPal contributions.";
const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "MaiTroll",
  url: "https://www.maitroll.com",
  logo: "https://www.maitroll.com/assets/maitrolllogo.png",
};

const contributionAreas = [
  {
    title: "Infrastructure & Technology",
    icon: Building2,
    items: ["Live-streaming servers", "Database infrastructure", "Bandwidth and hosting", "Security and platform reliability"],
  },
  {
    title: "Future Payroll & Hiring",
    icon: Users,
    items: ["Future paid employment opportunities", "Developers and engineers", "Community moderators", "Customer support and marketing staff"],
  },
  {
    title: "Platform Development",
    icon: Code2,
    items: ["Broadcasting improvements", "Live battle enhancements", "Mobile optimization", "New city features"],
  },
  {
    title: "Community Growth",
    icon: Megaphone,
    items: ["Creator recruitment", "College outreach", "Marketing campaigns", "Community events"],
  },
];

type CheckoutState =
  | { kind: "idle" }
  | { kind: "starting" }
  | { kind: "verifying" }
  | { kind: "success"; amount: string; transactionId: string }
  | { kind: "canceled" }
  | { kind: "error"; message: string };

interface RecentDonation {
  displayName: string;
  amountUsd: number;
}

type RecentDonationsState =
  | { kind: "loading" }
  | { kind: "loaded"; donations: RecentDonation[] }
  | { kind: "error" };

function parseRecentDonation(value: unknown): RecentDonation | null {
  if (typeof value !== "object" || value === null) return null;
  const row = value as { display_name?: unknown; amount_usd?: unknown };
  const amountUsd = typeof row.amount_usd === "number" ? row.amount_usd : Number(row.amount_usd);
  if (
    typeof row.display_name !== "string"
    || !row.display_name.trim()
    || !Number.isFinite(amountUsd)
    || amountUsd < 1
  ) {
    return null;
  }
  return { displayName: row.display_name, amountUsd };
}

async function getErrorMessage(error: unknown, fallback: string): Promise<string> {
  if (error && typeof error === "object" && "context" in error) {
    const context = error.context;
    if (context instanceof Response) {
      try {
        const body = await context.clone().json() as { error?: unknown };
        if (typeof body.error === "string" && body.error) return body.error;
      } catch {
        // Keep the generic message for non-JSON function errors.
      }
    }
  }
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

export default function DonatePage() {
  const [selectedAmount, setSelectedAmount] = useState<string>("25");
  const [customAmount, setCustomAmount] = useState("");
  const [donorName, setDonorName] = useState("");
  const [checkoutState, setCheckoutState] = useState<CheckoutState>({ kind: "idle" });
  const [recentDonations, setRecentDonations] = useState<RecentDonationsState>({ kind: "loading" });
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const processedOrderRef = useRef<string | null>(null);

  const loadRecentDonations = useCallback(async () => {
    setRecentDonations({ kind: "loading" });
    try {
      const { data, error } = await supabase.rpc("get_recent_platform_donations");
      if (error) throw error;
      if (!Array.isArray(data)) throw new Error("Recent donations response was invalid.");
      const donations: RecentDonation[] = [];
      for (const row of data) {
        const donation = parseRecentDonation(row);
        if (!donation) throw new Error("Recent donations response was invalid.");
        donations.push(donation);
      }
      setRecentDonations({ kind: "loaded", donations });
    } catch (error) {
      console.error("[donate] Could not load recent donations:", error);
      setRecentDonations({ kind: "error" });
    }
  }, []);

  useEffect(() => {
    void loadRecentDonations();
  }, [loadRecentDonations]);

  const isCustomAmount = selectedAmount === "custom";
  const donationAmount = isCustomAmount ? customAmount.trim() : selectedAmount;
  const parsedAmount = Number(donationAmount);
  const amountValid =
    /^\d{1,6}(?:\.\d{1,2})?$/.test(donationAmount)
    && Number.isFinite(parsedAmount)
    && parsedAmount >= 1
    && parsedAmount <= 10000;

  useEffect(() => {
    const paymentState = searchParams.get("payment");
    const orderId = searchParams.get("token");
    if (!paymentState) return;

    if (paymentState === "cancelled" && !orderId) {
      setCheckoutState({ kind: "canceled" });
      navigate("/donate", { replace: true });
      return;
    }

    if ((paymentState !== "return" && paymentState !== "cancelled") || !orderId) {
      setCheckoutState({
        kind: "error",
        message: "We could not confirm the PayPal order. If PayPal charged you, contact support before trying again.",
      });
      navigate("/donate", { replace: true });
      return;
    }
    if (processedOrderRef.current === orderId) return;
    processedOrderRef.current = orderId;

    const confirmPayment = async () => {
      setCheckoutState({ kind: "verifying" });
      try {
        if (paymentState === "cancelled") {
          const cancellation = await supabase.functions.invoke("paypal-donation-cancel", {
            body: { orderId },
          });
          if (cancellation.error) throw cancellation.error;
          if (cancellation.data?.canceled === true) {
            setCheckoutState({ kind: "canceled" });
            return;
          }
          setCheckoutState({
            kind: "error",
            message: "PayPal did not confirm that checkout was canceled. If you were charged, contact support before trying again.",
          });
          return;
        }

        const { data, error } = await supabase.functions.invoke("paypal-donation-capture", {
          body: { orderId },
        });
        if (error) throw error;
        if (!data?.success || !data?.transactionId || !data?.amount) {
          throw new Error(data?.error || "PayPal has not confirmed this payment.");
        }
        setCheckoutState({
          kind: "success",
          amount: String(data.amount),
          transactionId: String(data.transactionId),
        });
        void loadRecentDonations();
      } catch (error) {
        if (paymentState === "cancelled") {
          setCheckoutState({
            kind: "error",
            message: await getErrorMessage(error, "Could not verify the canceled PayPal checkout. Contact support if you were charged."),
          });
        } else {
          setCheckoutState({
            kind: "error",
            message: await getErrorMessage(error, "PayPal could not confirm this payment. Contact support if you were charged."),
          });
        }
      } finally {
        navigate("/donate", { replace: true });
      }
    };

    void confirmPayment();
  }, [loadRecentDonations, navigate, searchParams]);

  const startCheckout = async () => {
    if (!amountValid || checkoutState.kind === "starting" || checkoutState.kind === "verifying") return;
    setCheckoutState({ kind: "starting" });
    try {
      const { data, error } = await supabase.functions.invoke("paypal-donation-create-order", {
        body: { amount: donationAmount, donorName: donorName.trim() },
      });
      if (error) throw error;
      if (!data?.orderId || !data?.approvalUrl) {
        throw new Error(data?.error || "PayPal could not start checkout.");
      }
      window.location.assign(data.approvalUrl);
    } catch (error) {
      setCheckoutState({
        kind: "error",
        message: await getErrorMessage(error, "PayPal could not start checkout. Please try again."),
      });
    }
  };

  return (
    <SEOLayout
      title={seoTitle}
      titleIsExact
      description={seoDescription}
      canonical="https://www.maitroll.com/donate"
      ogImage="https://www.maitroll.com/assets/maitrolllogo.png"
      structuredData={organizationSchema}
    >
      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-16">
        <section className="relative overflow-hidden rounded-3xl border border-purple-400/20 bg-gradient-to-br from-purple-950/80 via-slate-950 to-orange-950/50 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.35)] sm:p-10 lg:p-14">
          <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-purple-500/10 blur-3xl" />
          <div className="relative max-w-4xl">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-orange-300/25 bg-orange-300/10 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.16em] text-orange-200">
              <Heart className="h-4 w-4 fill-current" aria-hidden="true" />
              Support MaiTroll City
            </div>
            <h1 className="text-4xl font-black leading-tight tracking-tight text-white sm:text-5xl lg:text-6xl">
              Help Build the Future of MaiTroll City
            </h1>
            <p className="mt-5 text-lg font-semibold leading-relaxed text-purple-100 sm:text-xl">
              A New Era of Live Broadcasting. A City Built Around Its Community.
            </p>
            <p className="mt-5 max-w-3xl leading-7 text-slate-300">
              MaiTroll is more than a live-streaming platform. We&apos;re building an interactive digital city where people can broadcast, compete in live battles, connect, create content, and build communities.
            </p>
            <p className="mt-3 max-w-3xl leading-7 text-slate-300">
              As an independently growing platform, we welcome voluntary financial contributions from people who believe in our vision.
            </p>
          </div>
        </section>

        <section className="py-12 sm:py-16" aria-labelledby="contributions-heading">
          <div className="mb-7 max-w-2xl">
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-purple-300">Built with the community</p>
            <h2 id="contributions-heading" className="mt-2 text-3xl font-black text-white sm:text-4xl">
              Where Your Contributions Go
            </h2>
            <p className="mt-3 leading-6 text-slate-400">
              Contributions support the platform as a whole. They are not restricted to any individual category.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {contributionAreas.map(({ title, icon: Icon, items }) => (
              <article key={title} className="rounded-2xl border border-slate-800 bg-slate-900/65 p-5 sm:p-6">
                <div className="flex items-center gap-3">
                  <span className="grid h-11 w-11 place-items-center rounded-xl border border-purple-400/20 bg-purple-500/10 text-purple-300">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <h3 className="text-lg font-bold text-white">{title}</h3>
                </div>
                <ul className="mt-4 grid gap-2 text-sm text-slate-300 sm:grid-cols-2">
                  {items.map((item) => (
                    <li key={item} className="flex gap-2">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" aria-hidden="true" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </section>

        <section className="grid gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]" aria-label="Make a contribution">
          <div className="rounded-3xl border border-slate-800 bg-slate-900/55 p-6 sm:p-8">
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-orange-300">Choose an amount</p>
            <h2 className="mt-2 text-2xl font-black text-white sm:text-3xl">Support MaiTroll City</h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              Secure checkout is handled by PayPal. You can contribute as a guest; a MaiTroll account is not required.
            </p>

            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3" role="group" aria-label="Donation amount">
              {donationAmounts.map((amount) => (
                <button
                  key={amount}
                  type="button"
                  aria-pressed={selectedAmount === amount}
                  onClick={() => setSelectedAmount(amount)}
                  className={`min-h-14 rounded-xl border px-4 py-3 text-lg font-extrabold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-300 ${
                    selectedAmount === amount
                      ? "border-orange-300 bg-orange-400/15 text-orange-100 shadow-[0_0_24px_rgba(251,146,60,0.12)]"
                      : "border-slate-700 bg-slate-950/65 text-slate-200 hover:border-purple-400/60"
                  }`}
                >
                  ${amount}
                </button>
              ))}
              <button
                type="button"
                aria-pressed={isCustomAmount}
                onClick={() => setSelectedAmount("custom")}
                className={`min-h-14 rounded-xl border px-4 py-3 text-base font-bold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-300 ${
                  isCustomAmount
                    ? "border-orange-300 bg-orange-400/15 text-orange-100"
                    : "border-slate-700 bg-slate-950/65 text-slate-200 hover:border-purple-400/60"
                }`}
              >
                Custom amount
              </button>
            </div>

            {isCustomAmount && (
              <div className="mt-4">
                <label htmlFor="custom-donation-amount" className="mb-2 block text-sm font-semibold text-slate-200">
                  Custom amount in USD
                </label>
                <div className="flex max-w-sm items-center rounded-xl border border-slate-700 bg-slate-950 px-4 focus-within:border-orange-300/70">
                  <span className="text-slate-400" aria-hidden="true">$</span>
                  <input
                    id="custom-donation-amount"
                    type="number"
                    inputMode="decimal"
                    min="1"
                    max="10000"
                    step="0.01"
                    value={customAmount}
                    onChange={(event) => setCustomAmount(event.target.value)}
                    placeholder="Enter an amount"
                    className="min-h-12 w-full bg-transparent px-2 text-white outline-none placeholder:text-slate-600"
                    aria-describedby="custom-amount-help"
                  />
                </div>
                <p id="custom-amount-help" className="mt-2 text-xs text-slate-500">
                  Minimum $1.00. The maximum is securely enforced by the donation service.
                </p>
              </div>
            )}

            <div className="mt-5">
              <label htmlFor="donor-display-name" className="mb-2 block text-sm font-semibold text-slate-200">
                Public display name <span className="font-normal text-slate-400">(optional)</span>
              </label>
              <input
                id="donor-display-name"
                type="text"
                autoComplete="nickname"
                maxLength={80}
                value={donorName}
                onChange={(event) => setDonorName(event.target.value)}
                placeholder="Name to show with your contribution"
                aria-describedby="donor-display-name-help"
                className="min-h-12 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 text-white outline-none placeholder:text-slate-600 focus:border-orange-300/70"
              />
              <p id="donor-display-name-help" className="mt-2 text-xs leading-5 text-slate-500">
                This name and your contribution amount will appear in the recent donations list. Leave blank to appear as MaiTroll Supporter. No account is required.
              </p>
            </div>

            <div className="mt-6 rounded-xl border border-purple-400/15 bg-purple-500/5 p-4">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm text-slate-300">Selected contribution</span>
                <strong className="text-2xl font-black text-white" aria-live="polite">
                  {amountValid ? `$${parsedAmount.toFixed(2)} USD` : "Enter an amount"}
                </strong>
              </div>
            </div>

            <button
              type="button"
              onClick={() => void startCheckout()}
              disabled={!amountValid || checkoutState.kind === "starting" || checkoutState.kind === "verifying"}
              className="mt-5 flex min-h-14 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-amber-400 px-5 py-3 font-extrabold text-slate-950 shadow-lg shadow-orange-950/30 transition hover:from-orange-400 hover:to-amber-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-200 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {checkoutState.kind === "starting" || checkoutState.kind === "verifying" ? (
                <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
              ) : (
                <ShieldCheck className="h-5 w-5" aria-hidden="true" />
              )}
              {checkoutState.kind === "starting"
                ? "Opening PayPal…"
                : checkoutState.kind === "verifying"
                  ? "Confirming payment…"
                  : "Donate Securely with PayPal"}
            </button>
            <p className="mt-3 text-center text-xs text-slate-500">
              PayPal is our only payment provider. No Troll Coins or other platform balance are awarded.
            </p>

            {checkoutState.kind === "success" && (
              <div className="mt-5 rounded-xl border border-emerald-400/30 bg-emerald-500/10 p-4" role="status" aria-live="polite">
                <h3 className="flex items-center gap-2 font-bold text-emerald-200">
                  <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
                  Thank you for supporting MaiTroll City!
                </h3>
                <p className="mt-2 text-sm text-emerald-100/90">
                  Your ${checkoutState.amount} USD contribution has been confirmed.
                </p>
                <p className="mt-2 break-all text-xs text-emerald-100/70">
                  PayPal transaction reference: {checkoutState.transactionId}
                </p>
              </div>
            )}
            {checkoutState.kind === "canceled" && (
              <div className="mt-5 rounded-xl border border-slate-600 bg-slate-800/60 p-4 text-sm text-slate-200" role="status" aria-live="polite">
                PayPal checkout was canceled. No donation was recorded as completed.
              </div>
            )}
            {checkoutState.kind === "error" && (
              <div className="mt-5 rounded-xl border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-100" role="alert">
                <p>{checkoutState.message}</p>
                <Link to="/contact" className="mt-2 inline-flex items-center gap-1 font-semibold underline underline-offset-2">
                  Contact support <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </div>
            )}
          </div>

          <aside className="space-y-4">
            <section className="rounded-2xl border border-purple-400/20 bg-slate-900/65 p-5 sm:p-6" aria-labelledby="recent-donations-heading">
              <h2 id="recent-donations-heading" className="text-lg font-extrabold text-white">Recent donations</h2>
              <p className="mt-1 text-xs text-slate-400">Public display names and contribution amounts only.</p>
              {recentDonations.kind === "loading" && (
                <p className="mt-4 text-sm text-slate-400" role="status">Loading recent donations…</p>
              )}
              {recentDonations.kind === "error" && (
                <div className="mt-4 text-sm text-red-200" role="alert">
                  <p>Recent donations could not be loaded.</p>
                  <button
                    type="button"
                    onClick={() => void loadRecentDonations()}
                    className="mt-2 font-semibold underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-orange-300"
                  >
                    Try again
                  </button>
                </div>
              )}
              {recentDonations.kind === "loaded" && recentDonations.donations.length === 0 && (
                <p className="mt-4 text-sm text-slate-400">No completed donations yet. Be the first to support MaiTroll City.</p>
              )}
              {recentDonations.kind === "loaded" && recentDonations.donations.length > 0 && (
                <ul className="mt-4 divide-y divide-slate-800">
                  {recentDonations.donations.map((donation, index) => (
                    <li key={`${donation.displayName}-${index}`} className="flex items-center justify-between gap-4 py-3 text-sm">
                      <span className="min-w-0 truncate font-medium text-slate-200">{donation.displayName}</span>
                      <span className="shrink-0 font-bold text-emerald-300">${donation.amountUsd.toFixed(2)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <div className="rounded-2xl border border-amber-300/20 bg-amber-300/5 p-5 sm:p-6">
              <h2 className="text-lg font-extrabold text-amber-100">Important contribution disclosure</h2>
              <p className="mt-3 text-sm leading-6 text-slate-200">
                Contributions to MaiTroll are voluntary and support the development, operation, and growth of our platform. MaiTroll is a commercial platform, not a charitable organization. Contributions are not tax-deductible charitable donations and do not provide ownership, investment returns, or guaranteed benefits.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900/55 p-5 sm:p-6">
              <h2 className="text-lg font-extrabold text-white">Refunds and support</h2>
              <p className="mt-3 text-sm leading-6 text-slate-300">
                Because contributions are voluntary, they are generally non-refundable. We will review requests involving duplicate, unauthorized, or accidental payments and any refund required by law. Contact us promptly through the support center or at{" "}
                <a className="font-semibold text-purple-300 underline underline-offset-2" href="mailto:ceo@maitroll.com">
                  ceo@maitroll.com
                </a>
                . Refunds, when approved, are returned through PayPal to the original payment method.
              </p>
              <nav className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-sm" aria-label="Donation policies">
                <Link to="/legal/privacy" className="text-purple-300 underline underline-offset-2 hover:text-purple-200">Privacy Policy</Link>
                <Link to="/legal/terms" className="text-purple-300 underline underline-offset-2 hover:text-purple-200">Terms of Service</Link>
                <Link to="/support" className="text-purple-300 underline underline-offset-2 hover:text-purple-200">Support Center</Link>
                <Link to="/legal/refunds" className="text-purple-300 underline underline-offset-2 hover:text-purple-200">Refund & Purchase Policy</Link>
              </nav>
            </div>
          </aside>
        </section>
      </main>
    </SEOLayout>
  );
}
