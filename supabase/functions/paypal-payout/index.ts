import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeaders } from "../_shared/cors.ts"

const LIVE_PAYPAL_BASE_URL = 'https://api-m.paypal.com'
const PAYPAL_MODE = (Deno.env.get('PAYPAL_ENV') || Deno.env.get('PAYPAL_MODE') || 'live').toLowerCase()

const getPayPalAccessToken = async (clientId: string, clientSecret: string) => {
  const auth = btoa(`${clientId}:${clientSecret}`)
  const tokenRes = await fetch(`${LIVE_PAYPAL_BASE_URL}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  })

  if (!tokenRes.ok) {
    const raw = await tokenRes.text()
    throw new Error(`Failed to authenticate with PayPal: ${raw}`)
  }

  const tokenData = await tokenRes.json() as { access_token?: string }
  if (!tokenData.access_token) {
    throw new Error('PayPal auth response did not include access_token')
  }

  return tokenData.access_token
}

const getPayoutBatchStatus = async (accessToken: string, batchId: string) => {
  const res = await fetch(`${LIVE_PAYPAL_BASE_URL}/v1/payments/payouts/${batchId}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`PayPal payout status lookup failed: ${body}`)
  }

  return await res.json() as {
    batch_header?: {
      batch_status?: string;
    };
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders(req.headers.get('origin')) })
  }

  try {
    const authHeader = req.headers.get('Authorization') || ''
    if (!authHeader.toLowerCase().startsWith('bearer ')) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing or invalid Authorization header' }),
        { status: 401, headers: { ...corsHeaders(req.headers.get('origin')), 'Content-Type': 'application/json' } },
      )
    }

    const body = await req.json().catch(() => ({})) as Record<string, unknown>
    const payoutRequestId = typeof body.payoutRequestId === 'string' ? body.payoutRequestId : ''
    const force = Boolean(body.force)

    if (!payoutRequestId) {
      throw new Error('payoutRequestId is required')
    }

    if (PAYPAL_MODE === 'sandbox') {
      throw new Error('Production payout function cannot use Sandbox mode or Sandbox credentials')
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const token = authHeader.replace(/^Bearer\s+/i, '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders(req.headers.get('origin')), 'Content-Type': 'application/json' } },
      )
    }

    const { data: actorProfile, error: actorError } = await supabase
      .from('user_profiles')
      .select('id, role, is_admin')
      .eq('id', user.id)
      .maybeSingle()

    if (actorError || !actorProfile) {
      return new Response(
        JSON.stringify({ success: false, error: 'Admin profile not found' }),
        { status: 403, headers: { ...corsHeaders(req.headers.get('origin')), 'Content-Type': 'application/json' } },
      )
    }

    const isAuthorizedAdmin = Boolean(
      actorProfile.is_admin === true || actorProfile.role === 'admin' || actorProfile.role === 'lead_troll_officer',
    )

    if (!isAuthorizedAdmin) {
      return new Response(
        JSON.stringify({ success: false, error: 'Forbidden: MaiTroll admin required' }),
        { status: 403, headers: { ...corsHeaders(req.headers.get('origin')), 'Content-Type': 'application/json' } },
      )
    }

    const trustedInternal = req.headers.get('x-maitroll-internal') === 'true'
    const allowForce = isAuthorizedAdmin && force && trustedInternal

    const { data: request, error: fetchError } = await supabase
      .from('payout_requests')
      .select('*')
      .eq('id', payoutRequestId)
      .maybeSingle()

    if (fetchError || !request) {
      throw new Error('Payout request not found')
    }

    if (request.payment_reference && request.payment_reference !== '') {
      if (request.status === 'paid') {
        return new Response(
          JSON.stringify({ success: true, payoutRequestId, status: 'paid', paymentReference: request.payment_reference }),
          { headers: { ...corsHeaders(req.headers.get('origin')), 'Content-Type': 'application/json' } },
        )
      }

      if (['pending', 'processing', 'failed', 'denied', 'canceled', 'cancelled'].includes(String(request.status).toLowerCase())) {
        return new Response(
          JSON.stringify({ success: false, payoutRequestId, status: request.status, paymentReference: request.payment_reference, alreadySubmitted: true }),
          { status: 409, headers: { ...corsHeaders(req.headers.get('origin')), 'Content-Type': 'application/json' } },
        )
      }
    }

    const now = new Date()
    const mtDateString = now.toLocaleString('en-US', { timeZone: 'America/Denver' })
    const mtDate = new Date(mtDateString)
    const day = mtDate.getDay()
    const hour = mtDate.getHours()
    if (!([5, 6, 0].includes(day) && hour >= 1 && hour < 19) && !allowForce) {
      throw new Error('Payouts are only processed on Fridays, Saturdays, and Sundays between 1:00 AM and 7:00 PM MT')
    }

    let amount = request.net_amount || request.cash_amount
    if (!amount && request.usd_estimate) {
      amount = Number.parseFloat(String(request.usd_estimate))
    }

    const email = request.paypal_email || request.payout_address

    if (!amount || Number(amount) <= 0) {
      throw new Error('Invalid payout amount')
    }

    if (!email) {
      throw new Error('No PayPal email found for this request')
    }

    if (request.status === 'processing') {
      return new Response(
        JSON.stringify({
          success: false,
          payoutRequestId,
          status: 'processing',
          paymentReference: request.payment_reference || null,
          alreadySubmitted: true,
          message: 'This payout request is already being processed',
        }),
        { status: 409, headers: { ...corsHeaders(req.headers.get('origin')), 'Content-Type': 'application/json' } },
      )
    }

    const claimResult = await supabase
      .from('payout_requests')
      .update({
        status: 'processing',
        updated_at: new Date().toISOString(),
      })
      .eq('id', payoutRequestId)
      .eq('status', 'pending')
      .select('id')

    if (!claimResult.data || claimResult.data.length === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          payoutRequestId,
          status: request.status,
          paymentReference: request.payment_reference || null,
          alreadySubmitted: true,
          message: 'Payout request is already locked or already in progress',
        }),
        { status: 409, headers: { ...corsHeaders(req.headers.get('origin')), 'Content-Type': 'application/json' } },
      )
    }

    const clientId = Deno.env.get('PAYPAL_CLIENT_ID')
    const clientSecret = Deno.env.get('PAYPAL_CLIENT_SECRET')
    if (!clientId || !clientSecret) {
      throw new Error('PayPal credentials not configured')
    }

    const accessToken = await getPayPalAccessToken(clientId, clientSecret)

    if (request.payment_reference) {
      try {
        const existingBatch = await getPayoutBatchStatus(accessToken, String(request.payment_reference))
        const existingStatus = String(existingBatch.batch_header?.batch_status || 'PENDING').toUpperCase()

        if (['PENDING', 'PROCESSING'].includes(existingStatus)) {
          return new Response(
            JSON.stringify({
              success: false,
              payoutRequestId,
              status: existingStatus.toLowerCase(),
              paymentReference: request.payment_reference,
              alreadySubmitted: true,
              message: 'Payout already exists in PayPal and is still pending or processing',
            }),
            { status: 409, headers: { ...corsHeaders(req.headers.get('origin')), 'Content-Type': 'application/json' } },
          )
        }

        if (existingStatus === 'SUCCESS') {
          if (request.status !== 'paid') {
            const { error: rpcError } = await supabase.rpc('troll_bank_finalize_cashout', {
              p_request_id: payoutRequestId,
              p_admin_id: actorProfile.id,
            })

            if (rpcError) {
              console.error('[paypal-payout] RPC Finalize Error after existing success', rpcError)
              throw new Error(`Failed to finalize existing successful payout: ${rpcError.message}`)
            }
          }

          return new Response(
            JSON.stringify({
              success: true,
              payoutRequestId,
              status: 'paid',
              paymentReference: request.payment_reference,
              message: 'Existing PayPal payout already succeeded',
            }),
            { headers: { ...corsHeaders(req.headers.get('origin')), 'Content-Type': 'application/json' } },
          )
        }

        if (['DENIED', 'FAILED', 'CANCELED', 'CANCELLED'].includes(existingStatus)) {
          const { error: updateError } = await supabase
            .from('payout_requests')
            .update({
              status: 'failed',
              payment_reference: request.payment_reference,
              updated_at: new Date().toISOString(),
            })
            .eq('id', payoutRequestId)

          if (updateError) {
            console.error('[paypal-payout] Failed to mark existing failed payout', updateError)
          }

          return new Response(
            JSON.stringify({
              success: false,
              payoutRequestId,
              status: 'failed',
              paymentReference: request.payment_reference,
              alreadySubmitted: true,
              message: 'Existing PayPal payout is not successful',
            }),
            { status: 409, headers: { ...corsHeaders(req.headers.get('origin')), 'Content-Type': 'application/json' } },
          )
        }
      } catch (existingError) {
        console.error('[paypal-payout] Existing PayPal batch status lookup failed', existingError)
        throw new Error('Existing PayPal payout batch could not be verified; creation was blocked to prevent duplicate payouts')
      }
    }

    const payoutPayload = {
      sender_batch_header: {
        sender_batch_id: `payout_${payoutRequestId}`,
        email_subject: 'You have a payout from Mai Troll!',
        email_message: 'You have received a payout for your Mai Troll earnings.',
      },
      items: [
        {
          recipient_type: 'EMAIL',
          amount: {
            value: Number(amount).toFixed(2),
            currency: 'USD',
          },
          note: 'Mai Troll Payout',
          sender_item_id: payoutRequestId,
          receiver: email,
          notification_language: 'en-US',
        },
      ],
    }

    const payoutRes = await fetch(`${LIVE_PAYPAL_BASE_URL}/v1/payments/payouts`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payoutPayload),
    })

    if (!payoutRes.ok) {
      const errText = await payoutRes.text()
      let paypalBody: Record<string, unknown> | null = null
      try {
        paypalBody = JSON.parse(errText) as Record<string, unknown>
      } catch {
        paypalBody = null
      }

      const paypalError = Object.assign(new Error(`PayPal Payout failed: HTTP ${payoutRes.status} ${errText}`), {
        paypal_http_status: payoutRes.status,
        paypal_name: paypalBody && typeof paypalBody.name === 'string' ? paypalBody.name : null,
        paypal_message: paypalBody && typeof paypalBody.message === 'string' ? paypalBody.message : null,
        paypal_debug_id: paypalBody && typeof paypalBody.debug_id === 'string' ? paypalBody.debug_id : null,
        paypal_details: paypalBody,
      })

      console.error('[paypal-payout] PayPal payout failed', {
        httpStatus: payoutRes.status,
        debugId: paypalError.paypal_debug_id,
        name: paypalError.paypal_name,
        message: paypalError.paypal_message,
        details: paypalError.paypal_details,
      })

      await supabase
        .from('payout_requests')
        .update({
          status: 'pending',
          updated_at: new Date().toISOString(),
        })
        .eq('id', payoutRequestId)

      throw paypalError
    }

    const payoutData = await payoutRes.json() as {
      batch_header?: {
        payout_batch_id?: string;
        batch_status?: string;
      };
    }

    const batchId = payoutData.batch_header?.payout_batch_id
    const initialBatchStatus = String(payoutData.batch_header?.batch_status || 'PENDING').toUpperCase()

    let finalBatchStatus = initialBatchStatus
    let paypalStatusLookupFailed = false

    if (batchId) {
      try {
        const checkedBatch = await getPayoutBatchStatus(accessToken, batchId)
        finalBatchStatus = String(checkedBatch.batch_header?.batch_status || initialBatchStatus).toUpperCase()
      } catch {
        console.warn('[paypal-payout] Paypal payout status lookup failed')
        paypalStatusLookupFailed = true
      }
    }

    const payoutSucceeded = finalBatchStatus === 'SUCCESS'

    if (request.payment_reference && request.payment_reference !== batchId) {
      throw new Error('Payout request already has a payment reference and should not be reprocessed')
    }

    if (['PENDING', 'PROCESSING'].includes(finalBatchStatus)) {
      const { error: updateError } = await supabase
        .from('payout_requests')
        .update({
          status: 'pending',
          payment_reference: batchId || request.payment_reference || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', payoutRequestId)

      if (updateError) {
        console.error('[paypal-payout] Failed to persist pending batch id', updateError)
      }

      return new Response(
        JSON.stringify({
          success: false,
          payoutRequestId,
          batchId,
          payoutStatus: 'pending',
          paypalStatus: finalBatchStatus,
          paymentReference: batchId || request.payment_reference || null,
          statusLookupFailed: paypalStatusLookupFailed,
          message: 'Payout batch was accepted by PayPal but is still pending or processing; do not resubmit',
        }),
        { status: 409, headers: { ...corsHeaders(req.headers.get('origin')), 'Content-Type': 'application/json' } },
      )
    }

    if (!payoutSucceeded) {
      const { error: updateError } = await supabase
        .from('payout_requests')
        .update({
          status: finalBatchStatus === 'FAILED' || finalBatchStatus === 'DENIED' ? 'failed' : 'pending',
          payment_reference: batchId || request.payment_reference || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', payoutRequestId)

      if (updateError) {
        console.error('[paypal-payout] Failed to update pending/failed payout status', updateError)
      }

      return new Response(
        JSON.stringify({
          success: false,
          payoutRequestId,
          batchId,
          payoutStatus: finalBatchStatus === 'FAILED' || finalBatchStatus === 'DENIED' ? 'failed' : 'pending',
          paypalStatus: finalBatchStatus,
          paymentReference: batchId || request.payment_reference || null,
          statusLookupFailed: paypalStatusLookupFailed,
        }),
        { headers: { ...corsHeaders(req.headers.get('origin')), 'Content-Type': 'application/json' } },
      )
    }

    const { error: rpcError } = await supabase.rpc('troll_bank_finalize_cashout', {
      p_request_id: payoutRequestId,
      p_admin_id: actorProfile.id,
    })

    if (rpcError) {
      console.error('[paypal-payout] RPC Finalize Error:', rpcError)
      throw new Error(`Failed to finalize payout: ${rpcError.message}`)
    }

    const { error: updateError } = await supabase
      .from('payout_requests')
      .update({
        status: 'paid',
        payment_reference: batchId,
        paid_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', payoutRequestId)

    if (updateError) {
      console.error('[paypal-payout] Failed to update payout status in DB:', updateError)
      throw new Error(`Failed to update payout status: ${updateError.message}`)
    }

    if (request.escrowed_coins > 0) {
      await supabase.from('coin_ledger').insert({
        user_id: request.user_id,
        delta: -request.escrowed_coins,
        bucket: 'escrow',
        source: 'cashout_finalized',
        ref_id: payoutRequestId,
        reason: 'Cashout Paid via PayPal',
      })

      await supabase.from('payout_requests')
        .update({ escrowed_coins: 0 })
        .eq('id', payoutRequestId)
    }

    return new Response(
      JSON.stringify({
        success: true,
        payoutRequestId,
        batchId,
        payoutStatus: 'paid',
        paypalStatus: finalBatchStatus,
        paymentReference: batchId,
      }),
      { headers: { ...corsHeaders(req.headers.get('origin')), 'Content-Type': 'application/json' } },
    )
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    const paypalHttpStatus = error && typeof error === 'object' && 'paypal_http_status' in error ? Number((error as { paypal_http_status?: number }).paypal_http_status ?? 400) : 400
    const paypalName = error && typeof error === 'object' && 'paypal_name' in error ? (error as { paypal_name?: string | null }).paypal_name ?? null : null
    const paypalMessage = error && typeof error === 'object' && 'paypal_message' in error ? (error as { paypal_message?: string | null }).paypal_message ?? null : null
    const paypalDebugId = error && typeof error === 'object' && 'paypal_debug_id' in error ? (error as { paypal_debug_id?: string | null }).paypal_debug_id ?? null : null
    const paypalDetails = error && typeof error === 'object' && 'paypal_details' in error ? (error as { paypal_details?: Record<string, unknown> | null }).paypal_details ?? null : null

    return new Response(
      JSON.stringify({
        success: false,
        error: message,
        paypal_http_status: paypalHttpStatus,
        paypal_name: paypalName,
        paypal_message: paypalMessage,
        paypal_debug_id: paypalDebugId,
        paypal_details: paypalDetails,
      }),
      { status: paypalHttpStatus || 400, headers: { ...corsHeaders(req.headers.get('origin')), 'Content-Type': 'application/json' } },
    )
  }
})
