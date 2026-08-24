import { useEffect, useState, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { useAuthStore } from "../lib/store";
import { toast } from "sonner";
import { TIERS } from '../config/coinConfig';

export default function Withdraw() {
  const { user } = useAuthStore();
  const [balance, setBalance] = useState(0);
  const [amount, setAmount] = useState("");
  const [payoutMethod, setPayoutMethod] = useState('paypal');
  const [providerUsername, setProviderUsername] = useState('');

  const availableCoins = balance;

  const isFeeProvider = payoutMethod === 'venmo' || payoutMethod === 'cash_app';
  const isPayPal = payoutMethod === 'paypal';
  const getFeeCoins = (coins: number) => {
    if (isFeeProvider) return Math.round(coins * 0.05);
    if (isPayPal) return 50;
    return 0;
  };
  const getTotalCoins = (coins: number) => coins + getFeeCoins(coins);

  const loadBalance = useCallback(async () => {
    if (!user) return;

    const { data } = await supabase
      .from("user_profiles")
      .select("troll_coins, paypal_email, cashapp_handle, venmo_handle")
      .eq("id", user.id)
      .maybeSingle();

    if (data) {
      setBalance(data?.troll_coins ?? 0);
      if (data.paypal_email) {
        setPayoutMethod('paypal');
        setProviderUsername(data.paypal_email);
      } else if (data.cashapp_handle) {
        setPayoutMethod('cash_app');
        setProviderUsername(data.cashapp_handle);
      } else if (data.venmo_handle) {
        setPayoutMethod('venmo');
        setProviderUsername(data.venmo_handle);
      }
    }
  }, [user]);

  useEffect(() => {
    loadBalance();
  }, [loadBalance]);

  const requestPayout = async () => {
    if (!user) {
      toast.error("You must be logged in");
      return;
    }

    const coinAmount = parseInt(amount, 10);
    const validCoins = new Set(TIERS.map(t => t.coins));

    if (!validCoins.has(coinAmount as any)) {
      toast.error(`Select a valid Cashout tier: ${TIERS.map(t => (t.coins / 1000).toFixed(1) + 'k').join(', ')}`);
      return;
    }

    const feeCoins = getFeeCoins(coinAmount);
    const totalNeeded = coinAmount + feeCoins;

    if (totalNeeded > availableCoins) {
      toast.error(`Insufficient balance. You need ${totalNeeded.toLocaleString()} coins (including ${feeCoins} fee) but only have ${availableCoins.toLocaleString()} available.`);
      return;
    }

    if (!providerUsername.trim()) {
      toast.error("Please enter your payout username/email");
      return;
    }

    // Check for payment holds
    const { data: holds } = await supabase
      .from('payment_holds')
      .select('id')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .in('hold_type', ['all', 'cashout', 'payout', 'withdrawal'])
      .maybeSingle();

    if (holds) {
      toast.error('Your account has an active payout hold. Please contact support.');
      return;
    }

    const tier = TIERS.find(t => t.coins === coinAmount);
    if (!tier) {
      toast.error("Select a valid Cashout tier.");
      return;
    }

    if (tier.manualReview) {
       toast.info("This amount requires manual review and may take longer to process.");
    }

    // Use the unified Fast Pay cashout RPC
    const { data, error } = await supabase.rpc('request_cashout', {
      p_user_id: user.id,
      p_coins_to_redeem: tier.coins,
      p_provider_type: payoutMethod,
      p_provider_username: providerUsername.trim(),
      p_user_tag: null,
      p_id_verification_url: null,
    });

    if (error) {
      console.error("Payout request error:", error);
      return toast.error("Error submitting request: " + error.message);
    }

    if (!data?.success) {
      return toast.error(data?.error || "Cashout request failed");
    }

    toast.success(`Cashout request submitted! Payout ID: ${data.payout_id}`);
    setAmount("");
    loadBalance();
  };

  const selectedTier = TIERS.find(t => t.coins === parseInt(amount));

  return (
    <div className="min-h-screen bg-[#0A0814] p-6">
      <div className="max-w-md mx-auto text-white">
        <h2 className="text-2xl font-bold mb-4">Withdraw Earnings</h2>

        <div className="mb-3 rounded-lg border border-green-500/30 bg-green-900/10 px-3 py-2 text-xs text-green-200">
           PayPal and ACH have no cashout fee. Venmo and Cash App charge a 5% fee (in coins) per cashout. 1 cashout per day.
        </div>

        <p className="mb-2">
          <strong>Available Balance:</strong> {availableCoins.toLocaleString()} coins
        </p>

        <div className="mb-3">
          <label className="text-xs text-gray-400 block mb-1">Payout Method</label>
          <select
            value={payoutMethod}
            onChange={(e) => setPayoutMethod(e.target.value)}
            className="w-full p-2 rounded bg-zinc-800 text-white border border-zinc-700"
          >
            <option value="paypal">PayPal</option>
            <option value="cash_app">Cash App</option>
            <option value="venmo">Venmo</option>
          </select>
        </div>

        <div className="mb-3">
          <label className="text-xs text-gray-400 block mb-1">Provider Username/Email</label>
          <input
            type="text"
            className="w-full p-2 rounded bg-zinc-800 text-white placeholder-gray-400 border border-zinc-700"
            placeholder="Enter username or email"
            value={providerUsername}
            onChange={(e) => setProviderUsername(e.target.value)}
          />
        </div>

        <div className="mb-3">
          <label className="text-xs text-gray-400 block mb-1">Cashout Tier</label>
          <select
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full p-2 rounded bg-zinc-800 text-white border border-zinc-700"
          >
            <option value="">Select a tier...</option>
            {TIERS.map(t => {
              return (
                <option key={t.coins} value={t.coins}>
                  {t.coins.toLocaleString()} coins → ${t.usd} ({t.name})
                </option>
              );
            })}
          </select>
        </div>

        {selectedTier && (
          <div className="mb-3 rounded-lg border border-green-500/30 bg-green-900/10 px-3 py-2 text-xs text-green-200">
            <div>You receive: ${selectedTier.usd.toFixed(2)}</div>
            {getFeeCoins(selectedTier.coins) > 0 && (
              <>
                <div>Fee: {getFeeCoins(selectedTier.coins).toLocaleString()} coins{isFeeProvider && ' (5%)'}</div>
                <div>Total: {getTotalCoins(selectedTier.coins).toLocaleString()} coins charged</div>
              </>
            )}
          </div>
        )}

        <button
          onClick={requestPayout}
          className="bg-green-500 hover:bg-green-600 w-full mt-3 py-2 rounded font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={!amount || !selectedTier || getTotalCoins(selectedTier.coins) > availableCoins || !providerUsername.trim()}
        >
          Request Cashout
        </button>
      </div>
    </div>
  );
}


