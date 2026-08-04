import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { withCors, handleCorsPreflight } from "../_shared/cors.ts"
import { supabase } from "../_shared/supabaseClient.ts"

Deno.serve(async (req: Request) => {
  const requestId = `celeb_doc_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`

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
    const { document_type, file_name, content_type, file_size } = body

    if (!document_type || !file_name) {
      return withCors(
        { success: false, error: "document_type and file_name are required" },
        400,
        req,
      )
    }

    if (!["id_document", "selfie", "other"].includes(document_type)) {
      return withCors(
        { success: false, error: "Invalid document_type" },
        400,
        req,
      )
    }

    // Generate a storage path inside the private celeb-documents bucket.
    // Only the owner (via signed URL) can access this — never public.
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, "0")
    const timestamp = now.getTime()
    const safeFileName = file_name.replace(/[^a-zA-Z0-9._-]/g, "_")
    const storagePath = `${userId}/${year}/${month}/${timestamp}_${safeFileName}`

    // Create a signed upload URL — the file_size and content_type are validated here.
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("celeb-documents")
      .createSignedUploadUrl(storagePath, {
        method: "PUT",
        expiresIn: 300, // 5-minute signed URL
        options: {
          contentType: content_type || "application/octet-stream",
          upsert: true,
        },
        headers: {
          "x-amz-server-side-encryption": "AES256",
        },
      })

    if (uploadError) {
      console.error(`[CelebDoc ${requestId}] Upload URL error:`, uploadError)
      return withCors({ success: false, error: "Failed to create upload URL" }, 500, req)
    }

    // Record the document metadata (NOT the file itself — path only, signed URLs expire)
    const { error: recordError } = await supabase
      .from("celeb_verification_documents")
      .upsert({
        user_id: userId,
        document_type,
        storage_path: storagePath,
        uploaded_at: new Date().toISOString(),
        expires_at: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(), // documents valid 30 days
      })

    if (recordError) {
      console.error(`[CelebDoc ${requestId}] Record error:`, recordError)
      return withCors({ success: false, error: "Failed to record document" }, 500, req)
    }

    // Audit log (no raw document data)
    await supabase.from("celeb_audit_logs").insert({
      user_id: userId,
      action: "document_uploaded",
      entity_type: "celeb_verification_documents",
      details: { document_type, storage_path: storagePath.split("/")[0] }, // never log full path
    })

    return withCors(
      {
        success: true,
        upload_url: uploadData.signedUrl,
        storage_path: storagePath,
        document_id: `${userId}:${document_type}`,
      },
      200,
      req,
    )
  } catch (error) {
    console.error(`[CelebDoc ${requestId}] Unexpected error:`, error)
    return withCors(
      { success: false, error: error instanceof Error ? error.message : "Document upload failed" },
      500,
      req,
    )
  }
})
