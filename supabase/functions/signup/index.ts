import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { withCors, handleCorsPreflight } from "../_shared/cors.ts"
import { supabase } from "../_shared/supabaseClient.ts"

Deno.serve(async (req: Request) => {
  const requestId =
    `signup_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`

  console.log(`[Signup ${requestId}] Request received`)

  if (req.method === "OPTIONS") {
    return handleCorsPreflight(req)
  }

  if (req.method !== "POST") {
    return withCors(
      {
        success: false,
        error: "Method not allowed",
      },
      405,
      req,
    )
  }

  try {
    const body = await req.json()

    const {
      email,
      password,
      username,
      role,
      referral_code,
      data,
    } = body

    if (!email || !password || !username) {
      return withCors(
        {
          success: false,
          error: "Email, password, and username are required",
        },
        400,
        req,
      )
    }

    const cleanEmail = String(email).trim().toLowerCase()
    const cleanUsername = String(username).trim()
    const cleanPassword = String(password)

    // Get client IP address from request headers
    const clientIP =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      null

    // Check for duplicate account on same IP (non-exempt users only)
    if (clientIP) {
      const { data: dupCheck, error: dupCheckError } = await supabase.rpc(
        "check_duplicate_account_on_ip",
        {
          p_ip_address: clientIP,
          p_email: cleanEmail,
        },
      )

      if (dupCheckError) {
        console.error(
          `[Signup ${requestId}] Duplicate IP check error:`,
          dupCheckError,
        )
      } else if (dupCheck?.is_duplicate) {
        console.warn(
          `[Signup ${requestId}] Duplicate account blocked for email ${cleanEmail} from IP ${clientIP}: ${dupCheck.message}`,
        )
        return withCors(
          {
            success: false,
            error:
              "An account already exists for this IP address. " +
              "Each household member must use a different network. " +
              "If you believe this is an error, please contact support.",
            ip_blocked: true,
            existing_username: dupCheck.existing_username,
          },
          403,
          req,
        )
      }
    }

    const { data: emailUser, error: emailCheckError } =
      await supabase
        .from("user_profiles")
        .select("id")
        .eq("email", cleanEmail)
        .maybeSingle()

    if (emailCheckError) {
      console.error(
        `[Signup ${requestId}] Email check error:`,
        emailCheckError,
      )

      return withCors(
        {
          success: false,
          error: "Failed to validate email",
          details: emailCheckError.message,
        },
        500,
        req,
      )
    }

    if (emailUser) {
      return withCors(
        {
          success: false,
          error: "An account with this email already exists",
        },
        409,
        req,
      )
    }

    const { data: usernameUser, error: usernameCheckError } =
      await supabase
        .from("user_profiles")
        .select("id")
        .eq("username", cleanUsername)
        .maybeSingle()

    if (usernameCheckError) {
      console.error(
        `[Signup ${requestId}] Username check error:`,
        usernameCheckError,
      )

      return withCors(
        {
          success: false,
          error: "Failed to validate username",
          details: usernameCheckError.message,
        },
        500,
        req,
      )
    }

    if (usernameUser) {
      return withCors(
        {
          success: false,
          error: "This username is already taken",
        },
        409,
        req,
      )
    }

    const { data: authUser, error: authError } =
      await supabase.auth.admin.createUser({
        email: cleanEmail,
        password: cleanPassword,
        email_confirm: true,
        user_metadata: {
          username: cleanUsername,
          full_name: cleanUsername,
        },
      })

    if (authError || !authUser?.user) {
      console.error(
        `[Signup ${requestId}] Auth error:`,
        authError,
      )

      return withCors(
        {
          success: false,
          error:
            authError?.message ||
            "Failed to create account",
        },
        400,
        req,
      )
    }

    const newUserId = authUser.user.id
    const now = new Date().toISOString()

    const profileData: Record<string, unknown> = {
      id: newUserId,
      username: cleanUsername,
      email: cleanEmail,
      role: role || "user",
      terms_accepted: data?.terms_accepted === true,
      terms_accepted_at: data?.accepted_at || now,
      platform: data?.platform || null,
      updated_at: now,
    }

    if (referral_code) {
      profileData.referred_by =
        String(referral_code).trim()
    }

    // The auth.users trigger already creates user_profiles.
    // Upsert updates that trigger-created row instead of inserting a duplicate.
    const { error: profileError } = await supabase
      .from("user_profiles")
      .upsert(profileData, {
        onConflict: "id",
      })

    if (profileError) {
      console.error(
        `[Signup ${requestId}] Profile sync error:`,
        profileError
      )

      return withCors(
        {
          success: false,
          error: "Failed to sync user profile",
          details: profileError.message,
        },
        500,
        req,
      )
    }

    console.log(
      `[Signup ${requestId}] Success: user ${newUserId} created`,
    )

    // Record the signup IP address for future duplicate detection
    if (clientIP) {
      const { error: ipRecordError } = await supabase
        .from("user_signup_ips")
        .insert({
          user_id: newUserId,
          ip_address: clientIP,
          source: "signup",
        })

      if (ipRecordError) {
        console.error(
          `[Signup ${requestId}] Failed to record signup IP:`,
          ipRecordError,
        )
      }
    }

    return withCors(
      {
        success: true,
        user: {
          id: newUserId,
          email: cleanEmail,
          username: cleanUsername,
          role: profileData.role,
        },
      },
      200,
      req,
    )
  } catch (error) {
    console.error(
      `[Signup ${requestId}] Unexpected error:`,
      error,
    )

    return withCors(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Signup failed",
      },
      500,
      req,
    )
  }
})
