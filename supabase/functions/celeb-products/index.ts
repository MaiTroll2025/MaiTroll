import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { withCors, handleCorsPreflight } from "../_shared/cors.ts"
import { supabase } from "../_shared/supabaseClient.ts"

Deno.serve(async (req: Request) => {
  const requestId = `celeb_products_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`

  if (req.method === "OPTIONS") {
    return handleCorsPreflight(req)
  }

  if (req.method !== "POST") {
    return withCors({ success: false, error: "Method not allowed" }, 405, req)
  }

  try {
    const authHeader = req.headers.get("Authorization")
    if (!authHeader) {
      return withCors({ success: false, error: "Missing Authorization" }, 401, req)
    }

    const { createClient } = await import("jsr:@supabase/supabase-js@2")
    const anonSupabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false, autoRefreshToken: false } },
    )

    const {
      data: { user },
      error: authError,
    } = await anonSupabase.auth.getUser()

    if (authError || !user) {
      return withCors({ success: false, error: "Unauthorized" }, 401, req)
    }

    const userId = user.id
    const body = await req.json()
    const { action, title, description, price_coins, product_id, is_active, display_order } = body

    // Verify user is an approved celeb
    const { data: profile, error: profileError } = await supabase
      .from("user_profiles")
      .select("celeb_role")
      .eq("id", userId)
      .maybeSingle()

    if (profileError || !profile) {
      return withCors({ success: false, error: "Profile not found" }, 404, req)
    }

    if (profile.celeb_role !== "approved") {
      return withCors({ success: false, error: "Only approved celebrities can manage products" }, 403, req)
    }

    // Validate price server-side — never trust frontend
    const validatePrice = (val: unknown): number => {
      const n = Math.floor(Number(val) || 0)
      if (Number.isNaN(n)) throw new Error("Invalid price")
      return Math.max(1, Math.min(100000, n))
    }

    if (action === "create") {
      if (!title) {
        return withCors({ success: false, error: "title is required" }, 400, req)
      }

      let price: number
      try {
        price = validatePrice(price_coins)
      } catch {
        return withCors({ success: false, error: "price_coins must be a positive number" }, 400, req)
      }

      const { data: inserted, error: insertError } = await supabase
        .from("celeb_products")
        .insert({
          celeb_user_id: userId,
          title,
          description: description || null,
          price_coins: price,
          is_active: is_active !== undefined ? is_active : true,
          display_order: display_order || 0,
        })
        .select()
        .maybeSingle()

      if (insertError) {
        return withCors({ success: false, error: "Failed to create product" }, 500, req)
      }

      await supabase.from("celeb_audit_logs").insert({
        user_id: userId,
        action: "product_created",
        entity_type: "celeb_products",
        entity_id: inserted.id,
        details: { price_coins: price },
      })

      return withCors({ success: true, product: inserted }, 200, req)
    } else if (action === "update") {
      if (!product_id) {
        return withCors({ success: false, error: "product_id is required" }, 400, req)
      }

      const updateData: Record<string, unknown> = {
        title,
        description: description || null,
        display_order: display_order || 0,
      }

      if (price_coins !== undefined) {
        try {
          updateData.price_coins = validatePrice(price_coins)
        } catch {
          return withCors({ success: false, error: "Invalid price_coins" }, 400, req)
        }
      }

      if (is_active !== undefined) {
        updateData.is_active = Boolean(is_active)
      }

      const { data: updated, error: updateError } = await supabase
        .from("celeb_products")
        .update(updateData)
        .eq("id", product_id)
        .eq("user_id", userId)
        .select()
        .maybeSingle()

      if (updateError || !updated) {
        return withCors({ success: false, error: "Product not found or update failed" }, 404, req)
      }

      await supabase.from("celeb_audit_logs").insert({
        user_id: userId,
        action: "product_updated",
        entity_type: "celeb_products",
        entity_id: product_id,
      })

      return withCors({ success: true, product: updated }, 200, req)
    } else if (action === "list") {
      const { data: products, error: listError } = await supabase
        .from("celeb_products")
        .select("*")
        .eq("user_id", userId)
        .order("display_order", { ascending: true })

      if (listError) {
        return withCors({ success: false, error: "Failed to list products" }, 500, req)
      }

      return withCors({ success: true, products }, 200, req)
    } else if (action === "delete") {
      if (!product_id) {
        return withCors({ success: false, error: "product_id is required" }, 400, req)
      }

      const { error: deleteError } = await supabase
        .from("celeb_products")
        .delete()
        .eq("id", product_id)
        .eq("user_id", userId)

      if (deleteError) {
        return withCors({ success: false, error: "Failed to delete product" }, 500, req)
      }

      await supabase.from("celeb_audit_logs").insert({
        user_id: userId,
        action: "product_deleted",
        entity_type: "celeb_products",
        entity_id: product_id,
      })

      return withCors({ success: true }, 200, req)
    } else if (action === "purchase") {
      if (!product_id) {
        return withCors({ success: false, error: "product_id is required" }, 400, req)
      }

      // Fetch the product with its owner
      const { data: product, error: productError } = await supabase
        .from("celeb_products")
        .select("id, title, price_coins, celeb_user_id")
        .eq("id", product_id)
        .eq("is_active", true)
        .maybeSingle()

      if (productError || !product) {
        return withCors({ success: false, error: "Product not found or inactive" }, 404, req)
      }

      const price = product.price_coins

      // Deduct coins from buyer
      const { data: buyerProfile, error: buyerError } = await supabase
        .from("user_profiles")
        .select("coin_balance")
        .eq("id", userId)
        .maybeSingle()

      if (buyerError || !buyerProfile) {
        return withCors({ success: false, error: "Buyer profile not found" }, 500, req)
      }

      if ((buyerProfile.coin_balance || 0) < price) {
        return withCors(
          { success: false, error: "Insufficient coins", required: price, available: buyerProfile.coin_balance },
          402,
          req,
        )
      }

      // Deduct from buyer
      const { error: deductError } = await supabase
        .from("user_profiles")
        .update({ coin_balance: (buyerProfile.coin_balance || 0) - price })
        .eq("id", userId)

      if (deductError) {
        return withCors({ success: false, error: "Failed to charge coins" }, 500, req)
      }

      // Credit to celeb
      const { data: celebProfile, error: celebError } = await supabase
        .from("user_profiles")
        .select("coin_balance")
        .eq("id", product.celeb_user_id)
        .maybeSingle()

      if (!celebError && celebProfile) {
        await supabase
          .from("user_profiles")
          .update({ coin_balance: (celebProfile.coin_balance || 0) + price })
          .eq("id", product.celeb_user_id)
      }

      // Record transactions
      await supabase.from("coin_transactions").insert([
        {
          user_id: userId,
          description: `Purchased "${product.title}" from celebrity`,
          amount: -price,
          type: "purchase",
          stream_id: null,
          balance_after: (buyerProfile.coin_balance || 0) - price,
        },
        {
          user_id: product.celeb_user_id,
          description: `Sale of "${product.title}"`,
          amount: price,
          type: "gift",
          stream_id: null,
          balance_after: (celebProfile?.coin_balance || 0) + price,
        },
      ])

      await supabase.from("celeb_audit_logs").insert({
        user_id: userId,
        action: "product_purchased",
        entity_type: "celeb_products",
        entity_id: product_id,
        details: { price_coins: price, celeb_user_id: product.celeb_user_id },
      })

      return withCors({ success: true, price_charged: price, product_title: product.title }, 200, req)
    } else {
      return withCors({ success: false, error: "Invalid action" }, 400, req)
    }
  } catch (error) {
    console.error(`[CelebProducts ${requestId}] Unexpected error:`, error)
    return withCors(
      { success: false, error: error instanceof Error ? error.message : "Product operation failed" },
      500,
      req,
    )
  }
})
