import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders, unauthorizedResponse } from '../_shared/cors.ts'

serve(async (req) => {
  const requestOrigin = req.headers.get('origin')

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders(requestOrigin) })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    const apiKey = req.headers.get('x-api-key')
    const promoSecret =
      Deno.env.get('TROLL_CITY_PROMO_SECRET') ||
      Deno.env.get('Mai Troll_PROMO_API_KEY') ||
      Deno.env.get('Mai Troll_SERVICE_TOKEN')

    const hasUserAuth = Boolean(authHeader)
    const hasApiKeyAuth = Boolean(apiKey && promoSecret && apiKey === promoSecret)

    if (!hasUserAuth && !hasApiKeyAuth) {
      return unauthorizedResponse('Missing or invalid authorization', requestOrigin)
    }

    const supabaseUrl =
      Deno.env.get('SB_URL') ||
      Deno.env.get('SUPABASE_URL') ||
      Deno.env.get('MAITALENT_SUPABASE_URL')
    const serviceRoleKey =
      Deno.env.get('SB_SERVICE_ROLE_KEY') ||
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ||
      Deno.env.get('MAITALENT_SERVICE_ROLE_KEY')

    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'Server configuration is incomplete', code: 'SERVER_ERROR' }),
        { status: 500, headers: { ...corsHeaders(requestOrigin), 'Content-Type': 'application/json' } },
      )
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      global: { headers: { Authorization: authHeader ?? '' } },
    })

    const body = await req.json().catch(() => null)
    if (!body || typeof body.code !== 'string' || !body.code.trim()) {
      return new Response(
        JSON.stringify({ success: false, error: 'Promo code is required', code: 'INVALID_REQUEST' }),
        { status: 400, headers: { ...corsHeaders(requestOrigin), 'Content-Type': 'application/json' } },
      )
    }

    const code = body.code.trim()
    const requestor = {
      platform: body.requestor?.platform || 'maitalent.fun',
      accountId: body.requestor?.accountId,
    }

    let user
    if (hasUserAuth) {
      const {
        data: { user: authUser },
        error: userError,
      } = await supabase.auth.getUser()
      if (userError || !authUser) {
        return unauthorizedResponse('Unauthorized', requestOrigin)
      }
      user = authUser
    } else if (hasApiKeyAuth && requestor.accountId) {
      const { data: profileUser, error: userError } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('id', requestor.accountId)
        .single()
      if (userError || !profileUser) {
        return unauthorizedResponse('Unauthorized', requestOrigin)
      }
      user = profileUser
    } else {
      return unauthorizedResponse('Unauthorized', requestOrigin)
    }

    const trollVerifyUrl =
      Deno.env.get('TROLL_CITY_PROMO_VERIFY_URL') ||
      Deno.env.get('TROLL_CITY_PROMO_REDEEM_URL')

    if (!trollVerifyUrl || !promoSecret) {
      return new Response(
        JSON.stringify({ success: false, error: 'Promo provider is not configured', code: 'SERVER_ERROR' }),
        { status: 500, headers: { ...corsHeaders(requestOrigin), 'Content-Type': 'application/json' } },
      )
    }

    const trollResponse = await fetch(trollVerifyUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${promoSecret}`,
        'x-api-key': promoSecret,
        'Content-Type': 'application/json',
        'X-Client-Platform': 'maitalent.fun',
      },
      body: JSON.stringify({ code, requestor }),
    })

    const trollData = await trollResponse.json().catch(() => ({}))

    if (!trollResponse.ok || !trollData?.success) {
      return new Response(
        JSON.stringify({
          success: false,
          error: trollData?.error || 'Promo redemption failed',
          code: trollData?.code || 'SERVER_ERROR',
        }),
        { status: 200, headers: { ...corsHeaders(requestOrigin), 'Content-Type': 'application/json' } },
      )
    }

    const tokenAmount = Number(trollData.tokenAmount || 0)
    const promoId = trollData.promoId || null
    const redeemedAt = trollData.redeemedAt || new Date().toISOString()

    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('tokens')
      .eq('id', user.id)
      .single()

    if (profileError) {
      throw new Error(profileError.message)
    }

    const currentTokens = Number(profile?.tokens || 0)
    const nextTokens = currentTokens + tokenAmount

    const { error: updateError } = await supabase
      .from('user_profiles')
      .update({ tokens: nextTokens })
      .eq('id', user.id)

    if (updateError) {
      throw new Error(updateError.message)
    }

    const { error: txError } = await supabase.from('token_transactions').insert({
      user_id: user.id,
      type: 'bonus',
      amount: tokenAmount,
      source: 'free',
      reference_id: promoId,
      created_at: redeemedAt,
    })

    if (txError) {
      throw new Error(txError.message)
    }

    return new Response(
      JSON.stringify({
        success: true,
        code,
        tokenAmount,
        promoId,
        status: 'redeemed',
        redeemedAt,
      }),
      { status: 200, headers: { ...corsHeaders(requestOrigin), 'Content-Type': 'application/json' } },
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ success: false, error: message, code: 'SERVER_ERROR' }),
      { status: 500, headers: { ...corsHeaders(requestOrigin), 'Content-Type': 'application/json' } },
    )
  }
})
