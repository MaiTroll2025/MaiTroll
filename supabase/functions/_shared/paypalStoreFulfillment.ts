import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";

export type PaypalFulfillmentResult = {
  success: true;
  coinsAdded: number;
  repay: number | null;
  newLoanBalance: number | null;
  loanStatus: string | null;
  alreadyProcessed?: boolean;
};

function pickNumeric(val: unknown): number {
  const n = Number(val);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** Resolve coin amount + purchasable_items row where possible ($1 ⇒ 100 coins fallback). */
export async function resolveCoinPackWithUsdHint(
  supabase: SupabaseClient,
  packageId: string | undefined,
  paidUsdHint: number,
): Promise<{ coinsToCredit: number; dbItem: Record<string, unknown> | null }> {
  let coinsToCredit = 0;
  let dbItem: Record<string, unknown> | null = null;

  if (packageId) {
    const { data: itemByKey } = await supabase
      .from("purchasable_items")
      .select("*")
      .eq("item_key", packageId)
      .maybeSingle();

    let item =
      itemByKey as Record<string, unknown> | null | undefined;

    if (!item) {
      const isUUID =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          String(packageId),
        );
      if (isUUID) {
        const { data: itemById } = await supabase
          .from("purchasable_items")
          .select("*")
          .eq("id", packageId)
          .maybeSingle();
        item = itemById as Record<string, unknown> | null | undefined;
      }
    }

    if (item) {
      dbItem = item;
      const meta = (item.metadata as Record<string, unknown> | null) ?? {};
      coinsToCredit =
        pickNumeric(meta.coins) ||
        pickNumeric(meta.coins_received) ||
        pickNumeric(item.coin_price) ||
        pickNumeric(item.coins);
    } else if (String(packageId).startsWith("custom_")) {
      const raw = String(packageId).split("_")[1];
      const parsed = raw ? parseInt(raw, 10) : NaN;
      if (Number.isFinite(parsed) && parsed > 0) {
        coinsToCredit = parsed;
      }
    } else {
      const { data: pkg } = await supabase
        .from("coin_packages")
        .select("coins")
        .eq("id", packageId)
        .maybeSingle();
      if (pkg?.coins) {
        coinsToCredit = pkg.coins;
      }
    }
  }

  if ((!coinsToCredit || coinsToCredit <= 0) && paidUsdHint > 0) {
    coinsToCredit = Math.max(1, Math.round(paidUsdHint * 100));
  }

  if (!dbItem && coinsToCredit > 0) {
    const { data: packs } = await supabase
      .from("purchasable_items")
      .select("*")
      .eq("is_coin_pack", true);
    for (const row of packs || []) {
      const r = row as Record<string, unknown>;
      const m = (r.metadata as Record<string, unknown> | null) ?? {};
      const coinFromMeta =
        pickNumeric(m.coins) ||
        pickNumeric(m.coins_received) ||
        pickNumeric(r.coin_price);

      const usdNear =
        paidUsdHint > 0 &&
        Number(r.usd_price) > 0 &&
        Math.abs(Number(r.usd_price) - paidUsdHint) <= 0.05;

      if (coinFromMeta === coinsToCredit || usdNear) {
        dbItem = r;
        const cap = paidUsdHint > 0 ? Math.ceil(paidUsdHint * 250) : 500_000_000;
        if (coinFromMeta > 0 && coinFromMeta <= cap) coinsToCredit = coinFromMeta;
        break;
      }
    }
  }

  return { coinsToCredit, dbItem };
}

export async function fulfillPaypalCoinStorePurchase(
  supabase: SupabaseClient,
  params: {
    userId: string;
    orderId: string;
    captureId: string | null;
    verifiedAmount: number;
    verifiedCurrency: string;
    packageId?: string | null | undefined;
    status?: string;
    purchaseType?: string;
  },
): Promise<PaypalFulfillmentResult | { success: false; error: string }> {
  const {
    userId,
    orderId,
    captureId,
    verifiedAmount,
    verifiedCurrency,
    packageId,
    status = "",
    purchaseType = "coins",
  } = params;

  // ── MAI Pay Plus paid upgrade ───────────────────────────────────────────
  // Sets the mai_pay_plus flag on the user profile. No coins are granted.
  if (purchaseType === "mai_pay_plus") {
    const { error: txErr } = await supabase.from("coin_transactions").insert({
      user_id: userId,
      amount: 0,
      type: "mai_pay_plus_purchase",
      description: `MAI Pay Plus upgrade ($${verifiedAmount.toFixed(2)})`,
      platform_profit: verifiedAmount,
      usd_amount: verifiedAmount,
      external_id: orderId,
      paypal_order_id: orderId,
      paypal_capture_id: captureId,
      source: "purchase",
      metadata: {
        paypal_order_id: orderId,
        paypal_capture_id: captureId,
        package_id: packageId ?? null,
        amount_paid: verifiedAmount,
        purchase_kind: "mai_pay_plus",
      },
    });

    if (txErr && txErr.code !== "23505") {
      console.error("[fulfill] mai_pay_plus tx insert error:", txErr);
    }

    const { error: profileErr } = await supabase
      .from("user_profiles")
      .update({
        mai_pay_plus: true,
        mai_pay_plus_expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq("id", userId);

    if (profileErr) {
      console.error("[fulfill] mai_pay_plus profile update error:", profileErr);
      return { success: false, error: profileErr.message || "Failed to activate MAI Pay Plus" };
    }

    return {
      success: true,
      coinsAdded: 0,
      repay: null,
      newLoanBalance: null,
      loanStatus: null,
    };
  }

  let { coinsToCredit, dbItem } = await resolveCoinPackWithUsdHint(
    supabase,
    packageId ?? undefined,
    verifiedAmount,
  );

  if (!coinsToCredit || coinsToCredit <= 0) {
    return { success: false, error: "Could not determine coin amount for package" };
  }

  const maxCoinsForUsd =
    verifiedAmount > 0 ? Math.max(250, Math.ceil(verifiedAmount * 250)) : 500_000_000;
  if (coinsToCredit > maxCoinsForUsd) {
    coinsToCredit = Math.max(1, Math.round(verifiedAmount * 100));
    dbItem = null;
  }

  await supabase.from("paypal_transactions").upsert({
    user_id: userId,
    paypal_order_id: orderId,
    paypal_capture_id: captureId,
    amount: verifiedAmount,
    currency: verifiedCurrency,
    coins: coinsToCredit,
    status: "completed",
  });

  if (dbItem?.id) {
    const { error: ledgerErr } = await supabase.from("purchase_ledger").insert({
      user_id: userId,
      item_id: dbItem.id,
      usd_amount: verifiedAmount,
      coin_amount: coinsToCredit,
      payment_method: "card",
      source_context: "CoinStore",
      metadata: {
        paypal_order_id: orderId,
        paypal_capture_id: captureId,
        paypal_status: status,
      },
    });
    if (ledgerErr && ledgerErr.code !== "23505") {
      console.warn("purchase_ledger insert:", ledgerErr.message);
    }
  } else {
    console.warn(
      `purchase_ledger skipped: no purchasable_items match order=${orderId} coins=${coinsToCredit}`,
    );
  }

  const refId = captureId || orderId;

  const { error: txError } = await supabase.from("coin_transactions").insert({
    user_id: userId,
    amount: coinsToCredit,
    type: "store_purchase",
    description: `PayPal Purchase ${orderId}`,
    platform_profit: verifiedAmount,
    usd_amount: verifiedAmount,
    external_id: orderId,
    paypal_order_id: orderId,
    paypal_capture_id: captureId,
    source: "purchase",
    coins_awarded: coinsToCredit,
    metadata: {
      paypal_order_id: orderId,
      paypal_capture_id: captureId,
      package_id: packageId ?? null,
      amount_paid: verifiedAmount,
      amount: verifiedAmount,
      coins_awarded: coinsToCredit,
      payment_id: orderId,
      purchase_kind: "coin_store_usd",
    },
  });

  if (txError) {
    console.warn("coin_transactions insert:", txError);
    if (txError.code === "23505") {
      await supabase
        .from("paypal_transactions")
        .update({ status: "credited" })
        .eq("paypal_order_id", orderId);

      return {
        success: true,
        coinsAdded: coinsToCredit,
        repay: null,
        newLoanBalance: null,
        loanStatus: null,
        alreadyProcessed: true,
      };
    }
  }

  const { data: bankResult, error: bankError } = await supabase.rpc(
    "troll_bank_credit_coins",
    {
      p_user_id: userId,
      p_coins: coinsToCredit,
      p_bucket: "paid",
      p_source: "paypal_purchase",
      p_ref_id: refId,
    },
  );

  if (bankError) {
    console.error("troll_bank_credit_coins error:", bankError);
    return {
      success: false,
      error: bankError.message || "Failed to credit coins",
    };
  }

  await supabase
    .from("paypal_transactions")
    .update({ status: "credited" })
    .eq("paypal_order_id", orderId);

  let repay: number | null = null;
  let newLoanBalance: number | null = null;
  let loanStatus: string | null = null;
  if (bankResult && typeof bankResult === "object") {
    const br = bankResult as Record<string, unknown>;
    if (typeof br.repay === "number") repay = br.repay as number;
    if (typeof br.new_loan_balance === "number") {
      newLoanBalance = br.new_loan_balance as number;
    }
    if (typeof br.loan_status === "string") {
      loanStatus = br.loan_status as string;
    }
  }

  const userGets = bankResult &&
      typeof bankResult === "object" &&
      typeof (bankResult as Record<string, unknown>).user_gets === "number"
    ? Number((bankResult as Record<string, unknown>).user_gets)
    : coinsToCredit;

  return {
    success: true,
    coinsAdded: userGets,
    repay,
    newLoanBalance,
    loanStatus,
  };
}
