import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { withCors, handleCorsPreflight } from "../_shared/cors.ts"
import { supabase } from "../_shared/supabaseClient.ts"

Deno.serve(async (req: Request) => {
  const requestId = `celebrity_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`

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

    // Load profile once for role checks
    const { data: profile, error: profileError } = await supabase
      .from("user_profiles")
      .select("role, is_admin, celeb_role, username")
      .eq("id", userId)
      .maybeSingle()

    if (profileError || !profile) {
      return withCors({ success: false, error: "Profile not found" }, 404, req)
    }

    const isApprovedCeleb = profile.celeb_role === "approved"
    const isStaff = profile.role === "admin" || profile.is_admin === true

    const body = await req.json()
    const { action } = body

    if (!action) {
      return withCors({ success: false, error: "action is required" }, 400, req)
    }

    // ---------------------------------------------------------------------------
    // Public / lightly-authed actions
    // ---------------------------------------------------------------------------

    // Public directory of active celeb streams (any authenticated viewer)
    if (action === "list_streams") {
      const result = await supabase.rpc("get_celeb_streams")
      if (result.error) {
        console.error(`[Celebrity ${requestId}] get_celeb_streams error:`, result.error)
        return withCors({ success: false, error: "Failed to load celeb streams" }, 500, req)
      }
      return withCors({ success: true, streams: result.data?.streams || [] }, 200, req)
    }

    // Public list of active cashout tiers (info for celebs)
    if (action === "cashout_tiers") {
      const { data: tiers, error: tiersError } = await supabase
        .from("celeb_cashout_tiers")
        .select("*")
        .eq("is_active", true)
        .order("min_earned_usd", { ascending: true })

      if (tiersError) {
        return withCors({ success: false, error: "Failed to load tiers" }, 500, req)
      }
      return withCors({ success: true, tiers }, 200, req)
    }

    // Anyone can view their own application / submit one
    if (action === "get_application") {
      const { data: app, error: appError } = await supabase
        .from("celeb_applications")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle()

      if (appError && appError.code !== "PGRST116") {
        return withCors({ success: false, error: "Failed to load application" }, 500, req)
      }

      return withCors({ success: true, application: app || null }, 200, req)
    }

    if (action === "apply") {
      const { full_name, phone_number, email, social_media = {} } = body

      if (!full_name || !phone_number) {
        return withCors(
          { success: false, error: "full_name and phone_number are required" },
          400,
          req,
        )
      }

      // Only one pending/in_review application per user
      const { data: existing, error: checkError } = await supabase
        .from("celeb_applications")
        .select("id, status")
        .eq("user_id", userId)
        .in("status", ["pending", "in_review"])
        .maybeSingle()

      if (checkError) {
        console.error(`[Celebrity ${requestId}] apply check error:`, checkError)
        return withCors({ success: false, error: "Failed to check existing application" }, 500, req)
      }

      let appId = existing?.id

      if (appId) {
        const { error: updateError } = await supabase
          .from("celeb_applications")
          .update({
            full_name,
            phone_number,
            email,
            social_media,
            status: existing.status === "denied" ? "pending" : existing.status,
            updated_at: new Date().toISOString(),
          })
          .eq("id", appId)

        if (updateError) {
          console.error(`[Celebrity ${requestId}] apply update error:`, updateError)
          return withCors({ success: false, error: "Failed to update application" }, 500, req)
        }
      } else {
        const { data: anyExisting } = await supabase
          .from("celeb_applications")
          .select("id")
          .eq("user_id", userId)
          .maybeSingle()

        if (anyExisting) {
          const { error: resubmitError } = await supabase
            .from("celeb_applications")
            .update({
              full_name,
              phone_number,
              email,
              social_media,
              status: "pending",
              reviewer_id: null,
              admin_note: null,
              reviewed_at: null,
              updated_at: new Date().toISOString(),
            })
            .eq("id", anyExisting.id)

          if (resubmitError) {
            console.error(`[Celebrity ${requestId}] apply resubmit error:`, resubmitError)
            return withCors({ success: false, error: "Failed to resubmit application" }, 500, req)
          }
          appId = anyExisting.id
        } else {
          const { data: inserted, error: insertError } = await supabase
            .from("celeb_applications")
            .insert({
              user_id: userId,
              full_name,
              phone_number,
              email,
              social_media,
              status: "pending",
            })
            .select("id")
            .maybeSingle()

          if (insertError) {
            console.error(`[Celebrity ${requestId}] apply insert error:`, insertError)
            return withCors({ success: false, error: "Failed to submit application" }, 500, req)
          }
          appId = inserted?.id
        }
      }

      await supabase.from("celeb_audit_logs").insert({
        user_id: userId,
        action: existing?.id ? "application_updated" : "application_submitted",
        entity_type: "celeb_applications",
        entity_id: appId,
        details: { email, has_social_media: Object.keys(social_media).length > 0 },
      })

      // Notify the applicant (application_id + status only — no documents)
      await supabase.rpc("create_notification", {
        p_user_id: userId,
        p_type: "celeb_application",
        p_title: "Celeb Application Received",
        p_message: "Your Celeb application has been submitted and is pending review.",
        p_metadata: { application_id: appId },
      })

      return withCors({ success: true, application_id: appId, status: "pending" }, 200, req)
    }

    // Upload an identity-verification document to the PRIVATE bucket
    if (action === "upload_document") {
      const { document_type, file_name, content_type } = body

      if (!document_type || !file_name) {
        return withCors(
          { success: false, error: "document_type and file_name are required" },
          400,
          req,
        )
      }

      if (!["id_document", "selfie", "other"].includes(document_type)) {
        return withCors({ success: false, error: "Invalid document_type" }, 400, req)
      }

      const now = new Date()
      const year = now.getFullYear()
      const month = String(now.getMonth() + 1).padStart(2, "0")
      const timestamp = now.getTime()
      const safeFileName = file_name.replace(/[^a-zA-Z0-9._-]/g, "_")
      const storagePath = `${userId}/${year}/${month}/${timestamp}_${safeFileName}`

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("celeb-documents")
        .createSignedUploadUrl(storagePath, {
          method: "PUT",
          expiresIn: 300,
          options: {
            contentType: content_type || "application/octet-stream",
            upsert: true,
          },
        })

      if (uploadError) {
        console.error(`[Celebrity ${requestId}] upload error:`, uploadError)
        return withCors({ success: false, error: "Failed to create upload URL" }, 500, req)
      }

      await supabase
        .from("celeb_verification_documents")
        .upsert({
          user_id: userId,
          document_type,
          storage_path: storagePath,
          uploaded_at: new Date().toISOString(),
          expires_at: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        })

      await supabase.from("celeb_audit_logs").insert({
        user_id: userId,
        action: "document_uploaded",
        entity_type: "celeb_verification_documents",
        details: { document_type },
      })

      return withCors(
        {
          success: true,
          upload_url: uploadData.signedUrl,
          storage_path: storagePath,
        },
        200,
        req,
      )
    }

    // Get signed download URL for the applicant's own document
    if (action === "get_document_url") {
      const { document_type } = body
      if (!document_type) {
        return withCors({ success: false, error: "document_type is required" }, 400, req)
      }

      const { data: doc, error: docError } = await supabase
        .from("celeb_verification_documents")
        .select("storage_path")
        .eq("user_id", userId)
        .eq("document_type", document_type)
        .maybeSingle()

      if (docError || !doc) {
        return withCors({ success: false, error: "Document not found" }, 404, req)
      }

      const { data: signed, error: signedError } = await supabase.storage
        .from("celeb-documents")
        .createSignedUrl(doc.storage_path, 120)

      if (signedError) {
        return withCors({ success: false, error: "Failed to generate signed URL" }, 500, req)
      }

      return withCors({ success: true, url: signed.signedUrl }, 200, req)
    }

    // ---------------------------------------------------------------------------
    // Celeb-only actions
    // ---------------------------------------------------------------------------

    const requireCeleb = () => {
      if (!isApprovedCeleb) {
        return withCors(
          { success: false, error: "Only approved celebrities can perform this action" },
          403,
          req,
        )
      }
      return null
    }

    // Dashboard data
    if (action === "dashboard") {
      const err = requireCeleb()
      if (err) return err

      const result = await supabase.rpc("get_celeb_dashboard_data", { p_user_id: userId })
      if (result.error) {
        console.error(`[Celebrity ${requestId}] dashboard RPC error:`, result.error)
        return withCors({ success: false, error: "Failed to load dashboard" }, 500, req)
      }
      return withCors({ success: true, data: result.data }, 200, req)
    }

    // Create a Celeb Stream
    if (action === "create_stream") {
      const err = requireCeleb()
      if (err) return err

      const { title, category, pricing_type, pricing_value } = body

      let isPaid = false
      let priceCoins = 0
      if (pricing_type === "paid" && Number(pricing_value) > 0) {
        isPaid = true
        priceCoins = Math.max(1, Math.min(1000, Math.floor(Number(pricing_value))))
      }

      const streamId = crypto.randomUUID()

      const insertData: Record<string, unknown> = {
        id: streamId,
        user_id: userId,
        broadcaster_id: userId,
        streamer_id: userId,
        owner_id: userId,
        title: title || `${profile.username || "Celeb"}'s Live`,
        category,
        stream_type: "celeb_stream",
        camera_ready: true,
        status: "starting",
        is_live: false,
        started_at: null,
        box_count: 1,
        seat_count: 0,
        layout_mode: "spotlight",
        livekit_room_name: streamId,
        agora_channel: streamId,
        broadcast_disclaimer_accepted: true,
        broadcast_disclaimer_accepted_at: new Date().toISOString(),
        broadcast_disclaimer_user_id: userId,
        is_paid: isPaid,
        pricing_type: isPaid ? "paid" : "free",
        pricing_value: priceCoins,
      }

      const { data, error } = await supabase.from("streams").insert(insertData).select().maybeSingle()

      if (error) {
        console.error(`[Celebrity ${requestId}] create_stream error:`, error)
        return withCors({ success: false, error: "Failed to create Celeb stream" }, 500, req)
      }

      await supabase.from("celeb_audit_logs").insert({
        user_id: userId,
        action: "stream_created",
        entity_type: "streams",
        entity_id: streamId,
        details: { title, is_paid, price_coins: priceCoins },
      })

      return withCors(
        {
          success: true,
          stream_id: streamId,
          stream_type: "celeb_stream",
          is_paid: isPaid,
          pricing_value: priceCoins,
        },
        200,
        req,
      )
    }

    // --- Products ---
    if (action === "products_list") {
      const err = requireCeleb()
      if (err) return err

      const { data: products, error: listError } = await supabase
        .from("celeb_products")
        .select("*")
        .eq("celeb_user_id", userId)
        .order("display_order", { ascending: true })

      if (listError) {
        return withCors({ success: false, error: "Failed to list products" }, 500, req)
      }
      return withCors({ success: true, products }, 200, req)
    }

    if (action === "products_create") {
      const err = requireCeleb()
      if (err) return err

      const { title, description, price_coins, is_active, display_order } = body
      if (!title) {
        return withCors({ success: false, error: "title is required" }, 400, req)
      }

      const price = Math.max(1, Math.min(100000, Math.floor(Number(price_coins) || 0)))

      const { data: inserted, error: insertError } = await supabase
        .from("celeb_products")
        .insert({
          celeb_user_id: userId,
          title,
          description: description || null,
          price_coins: price,
          is_active: is_active !== undefined ? Boolean(is_active) : true,
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
    }

    if (action === "products_update") {
      const err = requireCeleb()
      if (err) return err

      const { product_id, title, description, price_coins, is_active, display_order } = body
      if (!product_id) {
        return withCors({ success: false, error: "product_id is required" }, 400, req)
      }

      const updateData: Record<string, unknown> = {
        title,
        description: description || null,
        display_order: display_order || 0,
      }

      if (price_coins !== undefined) {
        updateData.price_coins = Math.max(1, Math.min(100000, Math.floor(Number(price_coins) || 0)))
      }
      if (is_active !== undefined) {
        updateData.is_active = Boolean(is_active)
      }

      const { data: updated, error: updateError } = await supabase
        .from("celeb_products")
        .update(updateData)
        .eq("id", product_id)
        .eq("celeb_user_id", userId)
        .select()
        .maybeSingle()

      if (updateError || !updated) {
        return withCors({ success: false, error: "Product not found or update failed" }, 404, req)
      }

      return withCors({ success: true, product: updated }, 200, req)
    }

    if (action === "products_delete") {
      const err = requireCeleb()
      if (err) return err

      const { product_id } = body
      if (!product_id) {
        return withCors({ success: false, error: "product_id is required" }, 400, req)
      }

      const { error: deleteError } = await supabase
        .from("celeb_products")
        .delete()
        .eq("id", product_id)
        .eq("celeb_user_id", userId)

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
    }

    if (action === "products_purchase") {
      // Any authenticated viewer may purchase an active celeb product
      const { product_id } = body
      if (!product_id) {
        return withCors({ success: false, error: "product_id is required" }, 400, req)
      }

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

      await supabase
        .from("user_profiles")
        .update({ coin_balance: (buyerProfile.coin_balance || 0) - price })
        .eq("id", userId)

      const { data: celebProfile } = await supabase
        .from("user_profiles")
        .select("coin_balance")
        .eq("id", product.celeb_user_id)
        .maybeSingle()

      if (celebProfile) {
        await supabase
          .from("user_profiles")
          .update({ coin_balance: (celebProfile.coin_balance || 0) + price })
          .eq("id", product.celeb_user_id)
      }

      await supabase.from("coin_transactions").insert([
        {
          user_id: userId,
          stream_id: null,
          type: "purchase",
          amount: -price,
          balance_after: (buyerProfile.coin_balance || 0) - price,
          description: `Purchased "${product.title}" from celebrity`,
        },
        {
          user_id: product.celeb_user_id,
          stream_id: null,
          type: "gift",
          amount: price,
          balance_after: (celebProfile?.coin_balance || 0) + price,
          description: `Sale of "${product.title}"`,
        },
      ])

      await supabase.from("celeb_audit_logs").insert({
        user_id: userId,
        action: "product_purchased",
        entity_type: "celeb_products",
        entity_id: product_id,
        details: { price_coins: price, celeb_user_id: product.celeb_user_id },
      })

      return withCors(
        { success: true, price_charged: price, product_title: product.title },
        200,
        req,
      )
    }

    // --- Paid chat ---
    if (action === "paid_chat") {
      const { stream_id, message, price_coins } = body
      if (!stream_id || !message) {
        return withCors(
          { success: false, error: "stream_id and message are required" },
          400,
          req,
        )
      }

      const { data: stream, error: streamError } = await supabase
        .from("streams")
        .select("id, stream_type, user_id")
        .eq("id", stream_id)
        .eq("stream_type", "celeb_stream")
        .maybeSingle()

      if (streamError || !stream) {
        return withCors({ success: false, error: "Celeb stream not found" }, 404, req)
      }

      // Must be a viewer of this stream
      const { data: viewer, error: viewerError } = await supabase
        .from("stream_viewers")
        .select("id")
        .eq("stream_id", stream_id)
        .eq("user_id", userId)
        .maybeSingle()

      if (viewerError || !viewer) {
        return withCors({ success: false, error: "You must be a viewer to send paid chat" }, 403, req)
      }

      const price = Math.max(1, Math.min(10000, Math.floor(Number(price_coins) || 0)))

      const { data: settings } = await supabase
        .from("celeb_paid_chat_settings")
        .select("enabled, price_coins, whitelist")
        .eq("stream_id", stream_id)
        .maybeSingle()

      if (settings && settings.enabled) {
        const isWhitelisted = settings.whitelist && settings?.whitelist?.includes(userId)

        if (!isWhitelisted) {
          const { data: chatProfile, error: profileErr } = await supabase
            .from("user_profiles")
            .select("coin_balance")
            .eq("id", userId)
            .maybeSingle()

          if (profileErr || !chatProfile) {
            return withCors({ success: false, error: "Profile not found" }, 500, req)
          }

          if ((chatProfile.coin_balance || 0) < price) {
            return withCors(
              { success: false, error: "Insufficient coins", required: price, available: chatProfile.coin_balance },
              402,
              req,
            )
          }

          await supabase
            .from("user_profiles")
            .update({ coin_balance: (chatProfile.coin_balance || 0) - price })
            .eq("id", userId)

          await supabase.from("coin_transactions").insert({
            user_id: userId,
            stream_id: stream_id,
            type: "purchase",
            amount: -price,
            balance_after: (chatProfile.coin_balance || 0) - price,
            description: "Paid chat message in Celeb Stream",
          })

          try {
            await supabase.rpc("increment_stream_earnings", {
              p_stream_id: stream_id,
              p_coins: price,
            })
          } catch {
            // earnings increment is best-effort; message still records
          }
        }
      }

      const { data: msg, error: msgError } = await supabase
        .from("celeb_paid_chat_messages")
        .insert({
          stream_id,
          user_id: userId,
          message,
          price_coins: price,
        })
        .select()
        .maybeSingle()

      if (msgError) {
        console.error(`[Celebrity ${requestId}] paid_chat insert error:`, msgError)
        return withCors({ success: false, error: "Failed to send message" }, 500, req)
      }

      const charged = settings?.enabled && !settings.whitelist?.includes(userId) ? price : 0

      return withCors(
        { success: true, message_id: msg.id, price_charged: charged },
        200,
        req,
      )
    }

    // --- Paid chat settings (stream owner only) ---
    if (action === "paid_chat_settings_get" || action === "paid_chat_settings_update") {
      const { stream_id, enabled, price_coins, whitelist } = body
      if (!stream_id) {
        return withCors({ success: false, error: "stream_id is required" }, 400, req)
      }

      const { data: stream, error: streamError } = await supabase
        .from("streams")
        .select("id, stream_type, user_id")
        .eq("id", stream_id)
        .eq("user_id", userId)
        .maybeSingle()

      if (streamError || !stream) {
        return withCors({ success: false, error: "Not authorized for this stream" }, 403, req)
      }

      if (stream.stream_type !== "celeb_stream") {
        return withCors({ success: false, error: "Paid chat settings only apply to Celeb Streams" }, 400, req)
      }

      if (action === "paid_chat_settings_get") {
        const { data: settings, error: fetchError } = await supabase
          .from("celeb_paid_chat_settings")
          .select("*")
          .eq("stream_id", stream_id)
          .maybeSingle()

        if (fetchError && fetchError.code !== "PGRST116") {
          return withCors({ success: false, error: "Failed to load settings" }, 500, req)
        }

        return withCors(
          { success: true, settings: settings || { enabled: false, price_coins: 0, whitelist: [] } },
          200,
          req,
        )
      }

      // update
      const price = enabled ? Math.max(0, Math.min(10000, Math.floor(Number(price_coins) || 0))) : 0

      const { data: updated, error: updateError } = await supabase
        .from("celeb_paid_chat_settings")
        .upsert({
          stream_id,
          enabled: Boolean(enabled),
          price_coins: price,
          whitelist: Array.isArray(whitelist) ? whitelist : [],
        })
        .select()
        .maybeSingle()

      if (updateError) {
        return withCors({ success: false, error: "Failed to update settings" }, 500, req)
      }

      await supabase.from("celeb_audit_logs").insert({
        user_id: userId,
        action: "paid_chat_settings_updated",
        entity_type: "celeb_paid_chat_settings",
        entity_id: stream_id,
        details: { enabled, price_coins: price },
      })

      return withCors({ success: true, settings: updated }, 200, req)
    }

    // --- External links (approved celeb only) ---
    if (action === "external_links_list") {
      const err = requireCeleb()
      if (err) return err

      const { data: links, error: listError } = await supabase
        .from("celeb_external_links")
        .select("*")
        .eq("user_id", userId)
        .order("display_order", { ascending: true })

      if (listError) {
        return withCors({ success: false, error: "Failed to list links" }, 500, req)
      }
      return withCors({ success: true, links }, 200, req)
    }

    if (action === "external_links_add" || action === "external_links_update") {
      const err = requireCeleb()
      if (err) return err

      const { platform, url, link_id, display_order } = body
      if (!platform || !url) {
        return withCors({ success: false, error: "platform and url are required" }, 400, req)
      }

      let cleanUrl: string
      try {
        cleanUrl = new URL(url).toString()
      } catch {
        return withCors({ success: false, error: "Invalid URL" }, 400, req)
      }

      if (action === "external_links_add") {
        const { data: inserted, error: insertError } = await supabase
          .from("celeb_external_links")
          .insert({
            user_id: userId,
            platform,
            url: cleanUrl,
            is_verified: false,
            display_order: display_order || 0,
          })
          .select()
          .maybeSingle()

        if (insertError) {
          return withCors({ success: false, error: "Failed to add link" }, 500, req)
        }

        await supabase.from("celeb_audit_logs").insert({
          user_id: userId,
          action: "link_added",
          entity_type: "celeb_external_links",
          entity_id: inserted.id,
          details: { platform },
        })

        return withCors({ success: true, link: inserted }, 200, req)
      }

      const { data: updated, error: updateError } = await supabase
        .from("celeb_external_links")
        .update({ url: cleanUrl, display_order: display_order ?? 0 })
        .eq("id", link_id)
        .eq("user_id", userId)
        .select()
        .maybeSingle()

      if (updateError || !updated) {
        return withCors({ success: false, error: "Failed to update link or link not found" }, 404, req)
      }
      return withCors({ success: true, link: updated }, 200, req)
    }

    if (action === "external_links_delete") {
      const err = requireCeleb()
      if (err) return err

      const { link_id } = body
      if (!link_id) {
        return withCors({ success: false, error: "link_id is required" }, 400, req)
      }

      const { error: deleteError } = await supabase
        .from("celeb_external_links")
        .delete()
        .eq("id", link_id)
        .eq("user_id", userId)

      if (deleteError) {
        return withCors({ success: false, error: "Failed to delete link" }, 500, req)
      }

      await supabase.from("celeb_audit_logs").insert({
        user_id: userId,
        action: "link_deleted",
        entity_type: "celeb_external_links",
        entity_id: link_id,
      })

      return withCors({ success: true }, 200, req)
    }

    // --- Battle queue (approved celeb, own stream) ---
    if (action === "battle_join" || action === "battle_leave" || action === "battle_status") {
      const { stream_id } = body
      if (!stream_id) {
        return withCors({ success: false, error: "stream_id is required" }, 400, req)
      }

      const { data: stream, error: streamError } = await supabase
        .from("streams")
        .select("id, stream_type, user_id, is_live")
        .eq("id", stream_id)
        .eq("stream_type", "celeb_stream")
        .eq("user_id", userId)
        .maybeSingle()

      if (streamError || !stream) {
        return withCors({ success: false, error: "Not a Celeb stream or not owned by you" }, 403, req)
      }

      if (action === "battle_join") {
        if (!stream.is_live) {
          return withCors({ success: false, error: "Stream is not live" }, 400, req)
        }

        const now = new Date()
        const expiry = new Date(now.getTime() + 120000)

        await supabase
          .from("celeb_battle_queue")
          .upsert({
            stream_id: stream_id,
            is_open: true,
            match_expires_at: expiry.toISOString(),
            status: "open",
            matched_stream_id: null,
            matched_at: null,
          })

        const { data: match, error: matchError } = await supabase
          .from("celeb_battle_queue")
          .select("stream_id")
          .eq("status", "open")
          .eq("is_open", true)
          .neq("stream_id", stream_id)
          .gt("match_expires_at", now.toISOString())
          .order("queued_at", { ascending: true })
          .limit(1)
          .maybeSingle()

        let matchedWith: string | null = null
        if (match) {
          matchedWith = match.stream_id
          const matchedAt = new Date().toISOString()

          await supabase
            .from("celeb_battle_queue")
            .update({ status: "matched", matched_stream_id: match.stream_id, matched_at: matchedAt, is_open: false })
            .eq("stream_id", stream_id)

          await supabase
            .from("celeb_battle_queue")
            .update({ status: "matched", matched_stream_id: stream_id, matched_at: matchedAt, is_open: false })
            .eq("stream_id", match.stream_id)
        }

        if (matchError) {
          console.error(`[Celebrity ${requestId}] battle match error:`, matchError)
        }

        await supabase.from("celeb_audit_logs").insert({
          user_id: userId,
          action: "battle_queue_join",
          entity_type: "celeb_battle_queue",
          entity_id: stream_id,
          details: { matched_with: matchedWith },
        })

        return withCors(
          { success: true, queue_status: matchedWith ? "matched" : "queued", matched_stream_id: matchedWith },
          200,
          req,
        )
      }

      if (action === "battle_leave") {
        await supabase
          .from("celeb_battle_queue")
          .update({ status: "cancelled", is_open: false, matched_stream_id: null, matched_at: null })
          .eq("stream_id", stream_id)

        await supabase.from("celeb_audit_logs").insert({
          user_id: userId,
          action: "battle_queue_leave",
          entity_type: "celeb_battle_queue",
          entity_id: stream_id,
        })

        return withCors({ success: true, queue_status: "cancelled" }, 200, req)
      }

      // battle_status
      const { data: statusData, error: statusError } = await supabase
        .from("celeb_battle_queue")
        .select("status, matched_stream_id, matched_at")
        .eq("stream_id", stream_id)
        .maybeSingle()

      if (statusError && statusError.code !== "PGRST116") {
        return withCors({ success: false, error: "Failed to get queue status" }, 500, req)
      }

      return withCors(
        {
          success: true,
          queue_status: statusData?.status || "not_queued",
          matched_stream_id: statusData?.matched_stream_id || null,
        },
        200,
        req,
      )
    }

    // --- Cashout (approved celeb only) ---
    if (action === "cashout_list") {
      const err = requireCeleb()
      if (err) return err

      const { data: requests, error: listError } = await supabase
        .from("celeb_cashout_requests")
        .select("*, celeb_cashout_tiers(name, min_earned_usd, fee_percent)")
        .eq("celeb_user_id", userId)
        .order("requested_at", { ascending: false })

      if (listError) {
        return withCors({ success: false, error: "Failed to list cashout requests" }, 500, req)
      }
      return withCors({ success: true, requests }, 200, req)
    }

    if (action === "cashout_request") {
      const err = requireCeleb()
      if (err) return err

      const { tier_id, earned_usd, provider_type, provider_username } = body

      const result = await supabase.rpc("create_celeb_cashout_request", {
        p_user_id: userId,
        p_tier_id: tier_id,
        p_earned_usd: earned_usd,
        p_provider_type: provider_type,
        p_provider_username: provider_username,
      })

      if (result.error) {
        console.error(`[Celebrity ${requestId}] cashout RPC error:`, result.error)
        return withCors(
          { success: false, error: result.error.message || "Cashout request failed" },
          400,
          req,
        )
      }

      return withCors({ success: true, result: result.data }, 200, req)
    }

    return withCors(
      {
        success: false,
        error:
          "Invalid action. Available: list_streams, cashout_tiers, get_application, apply, upload_document, get_document_url, dashboard, create_stream, products_list, products_create, products_update, products_delete, products_purchase, paid_chat, paid_chat_settings_get, paid_chat_settings_update, external_links_list, external_links_add, external_links_update, external_links_delete, battle_join, battle_leave, battle_status, cashout_list, cashout_request",
      },
      400,
      req,
    )
  } catch (error) {
    console.error(`[Celebrity ${requestId}] Unexpected error:`, error)
    return withCors(
      { success: false, error: error instanceof Error ? error.message : "Operation failed" },
      500,
      req,
    )
  }
})
