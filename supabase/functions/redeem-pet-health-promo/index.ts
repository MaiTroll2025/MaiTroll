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

    if (!authHeader) {
      return unauthorizedResponse('Missing authorization', requestOrigin)
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
      global: { headers: { Authorization: authHeader } },
    })

    const {
      data: { user: authUser },
      error: userError,
    } = await supabase.auth.getUser()
    if (userError || !authUser) {
      return unauthorizedResponse('Unauthorized', requestOrigin)
    }

    const body = await req.json().catch(() => null)
    if (!body || typeof body.code !== 'string' || !body.code.trim()) {
      return new Response(
        JSON.stringify({ success: false, error: 'Promo code is required', code: 'INVALID_REQUEST' }),
        { status: 400, headers: { ...corsHeaders(requestOrigin), 'Content-Type': 'application/json' } },
      )
    }

    const code = body.code.trim().toLowerCase()

    if (code !== 'ceopet1') {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid promo code', code: 'INVALID_CODE' }),
        { status: 200, headers: { ...corsHeaders(requestOrigin), 'Content-Type': 'application/json' } },
      )
    }

    const { data: result, error: rpcError } = await supabase.rpc('apply_pet_health_promo', {
      p_user_id: authUser.id,
      p_promo_code: code,
      p_duration_hours: 24,
    })

    if (rpcError) {
      throw new Error(rpcError.message)
    }

    const resultData = result as { success: boolean; error?: string; message?: string; pet_id?: string; pet_name?: string; expires_at?: string; redemption_id?: string }

    if (!resultData.success) {
      return new Response(
        JSON.stringify({
          success: false,
          error: resultData.error || 'Failed to apply promo code',
          code: 'PROMO_FAILED',
        }),
        { status: 200, headers: { ...corsHeaders(requestOrigin), 'Content-Type': 'application/json' } },
      )
    }

    return new Response(
      JSON.stringify({
        success: true,
        code,
        message: resultData.message,
        pet_id: resultData.pet_id,
        pet_name: resultData.pet_name,
        expires_at: resultData.expires_at,
        redemption_id: resultData.redemption_id,
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