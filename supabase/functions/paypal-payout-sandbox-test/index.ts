import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { corsHeaders } from "../_shared/cors.ts"

const LIVE_PAYPAL_BASE_URL = 'https://api-m.paypal.com'

const getAccessToken = async () => {
  const clientId = Deno.env.get('PAYPAL_CLIENT_ID')
  const clientSecret = Deno.env.get('PAYPAL_CLIENT_SECRET')
  if (!clientId || !clientSecret) {
    throw new Error('PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET must be configured in the environment')
  }

  const auth = btoa(`${clientId}:${clientSecret}`)
  const res = await fetch(`${LIVE_PAYPAL_BASE_URL}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  })

  const text = await res.text()
  if (!res.ok) {
    throw new Error(`PayPal auth failed (${res.status}): ${text}`)
  }

  const data = JSON.parse(text) as { access_token?: string; app_id?: string; scope?: string }
  if (!data.access_token) {
    throw new Error(`No access token returned: ${text}`)
  }

  return {
    accessToken: data.access_token,
    appId: data.app_id || null,
    scope: data.scope || null,
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders(req.headers.get('origin')) })
  }

  try {
    const mode = (Deno.env.get('PAYPAL_ENV') || Deno.env.get('PAYPAL_MODE') || 'live').toLowerCase()
    if (mode !== 'live') {
      throw new Error('This smoke test must run in LIVE mode only. Sandbox is not allowed for production validation.')
    }

    const body = await req.json().catch(() => ({})) as Record<string, unknown>
    const amount = Number(body.amount ?? '0.01')
    const recipient = String(body.recipient_email ?? 'invalid-email-for-testing@example.com')

    const tokenInfo = await getAccessToken()

    const payoutPayload = {
      sender_batch_header: {
        sender_batch_id: `live_smoke_${Date.now()}`,
        email_subject: 'Mai Troll Live Smoke Test',
        email_message: 'This is a test only. No real funds should be transferred.',
      },
      items: [
        {
          recipient_type: 'EMAIL',
          amount: {
            value: Number(amount).toFixed(2),
            currency: 'USD',
          },
          note: 'Live smoke test only',
          sender_item_id: `smoke_${Date.now()}`,
          receiver: recipient,
          notification_language: 'en-US',
        },
      ],
    }

    const payoutRes = await fetch(`${LIVE_PAYPAL_BASE_URL}/v1/payments/payouts`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${tokenInfo.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payoutPayload),
    })

    const rawResponseText = await payoutRes.text()
    let parsedResponse: Record<string, unknown> | null = null
    try {
      parsedResponse = JSON.parse(rawResponseText) as Record<string, unknown>
    } catch {
      // ignore invalid JSON; raw text still returned below
    }

    return new Response(
      JSON.stringify({
        success: false,
        mode: 'live',
        dryRun: true,
        appId: tokenInfo.appId,
        hasPayoutScope: Boolean(tokenInfo.scope && tokenInfo.scope.includes('https://uri.paypal.com/payments/payouts')),
        scope: tokenInfo.scope,
        payoutHttpStatus: payoutRes.status,
        paypalResponse: parsedResponse ?? rawResponseText,
        recipient,
        amount,
        note: 'This smoke test never writes to the payout ledger or burns any coins.',
      }),
      {
        status: payoutRes.ok ? 200 : payoutRes.status,
        headers: { ...corsHeaders(req.headers.get('origin')), 'Content-Type': 'application/json' },
      },
    )
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ success: false, error: message, mode: 'live', dryRun: true }),
      { status: 400, headers: { ...corsHeaders(req.headers.get('origin')), 'Content-Type': 'application/json' } },
    )
  }
})
