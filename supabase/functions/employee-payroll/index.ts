import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeaders } from "../_shared/cors.ts"

// ---------------------------------------------------------------------------
// employee-payroll edge function
//
// Backs the Employee Workspace "Payroll" tab (src/features/employees/tabs/
// PayrollTab.tsx). All money movement is server-side: the browser never sees
// PayPal secrets and can never mark a payout paid without verified PayPal
// status. Every action requires an authorized actor (secretary/ceo/assistant/
// admin) via the SECURITY DEFINER employee_can() RPC.
//
// Actions:
//   create_run            -> draft a payroll run
//   calculate_run         -> compute stubs from approved time records
//   approve_run           -> lock run for payment
//   send_paypal_payouts   -> push net pay to PayPal Payouts batch
//   sync_paypal_status    -> refresh payout statuses from PayPal
//   retry_failed_payouts  -> re-send failed/returned/unclaimed items
//   cancel_run            -> drop a draft run and its stubs
// ---------------------------------------------------------------------------

const PAYOUT_WINDOW = { days: [5, 6, 0], startHour: 1, endHour: 19, tz: 'America/Denver' }

function jsonError(message: string, status = 400) {
  return new Response(
    JSON.stringify({ error: message }),
    { status, headers: { ...corsHeaders(null), 'Content-Type': 'application/json' } },
  )
}

function jsonOk(payload: Record<string, unknown>) {
  return new Response(
    JSON.stringify(payload),
    { headers: { ...corsHeaders(null), 'Content-Type': 'application/json' } },
  )
}

function isPayrollWindow(now = new Date()): boolean {
  const mt = new Date(now.toLocaleString('en-US', { timeZone: PAYOUT_WINDOW.tz }))
  const day = mt.getDay()
  const hour = mt.getHours()
  return (
    PAYOUT_WINDOW.days.includes(day) &&
    hour >= PAYOUT_WINDOW.startHour &&
    hour < PAYOUT_WINDOW.endHour
  )
}

interface PayPalToken {
  access_token: string
}

async function getPayPalToken(): Promise<PayPalToken> {
  const clientId = Deno.env.get('PAYPAL_CLIENT_ID')
  const clientSecret = Deno.env.get('PAYPAL_CLIENT_SECRET')
  const isSandbox = Deno.env.get('PAYPAL_MODE') === 'sandbox'
  const baseUrl = isSandbox
    ? 'https://api-m.sandbox.paypal.com'
    : 'https://api-m.paypal.com'

  if (!clientId || !clientSecret) {
    throw new Error('PayPal credentials are not configured')
  }

  const auth = btoa(`${clientId}:${clientSecret}`)
  const res = await fetch(`${baseUrl}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Failed to authenticate with PayPal: ${text}`)
  }

  const data = (await res.json()) as PayPalToken
  return data
}

function paypalBaseUrl(): string {
  const isSandbox = Deno.env.get('PAYPAL_MODE') === 'sandbox'
  return isSandbox
    ? 'https://api-m.sandbox.paypal.com'
    : 'https://api-m.paypal.com'
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders(null) })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return jsonError('Missing authorization header', 401)
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    // Anon client to verify the caller (service role bypasses RLS, so we
    // authenticate first, then use the service client for data writes).
    const authClient = createClient(supabaseUrl, serviceKey)
    const {
      data: { user },
      error: authError,
    } = await authClient.auth.getUser(authHeader.replace('Bearer ', ''))

    if (authError || !user) {
      return jsonError('Unauthorized', 401)
    }

    const { data: actor, error: actorErr } = await authClient
      .from('user_profiles')
      .select('id, role, is_admin')
      .eq('id', user.id)
      .single()

    if (actorErr || !actor) {
      return jsonError('Actor profile not found', 403)
    }

    const { data: canEdit, error: canErr } = await authClient.rpc(
      'employee_can',
      { p_user: actor.id, p_action: 'edit_payroll' },
    )

    if (canErr || !canEdit) {
      return jsonError('Forbidden: payroll permission required', 403)
    }

    const body = (await req.json()) as Record<string, unknown>
    const action = String(body.action ?? '')

    const supabase = authClient

    switch (action) {
      // ---------------------------------------------------------------------
      case 'create_run': {
        const periodStart = String(body.period_start ?? '')
        const periodEnd = String(body.period_end ?? '')
        const payDate = String(body.pay_date ?? '') || null
        const notes = body.notes ? String(body.notes) : null

        if (!periodStart || !periodEnd) {
          return jsonError('period_start and period_end are required')
        }
        if (periodStart > periodEnd) {
          return jsonError('period_start cannot be after period_end')
        }

        const { data: run, error: insertErr } = await supabase
          .from('employee_payroll_runs')
          .insert({
            period_start: periodStart,
            period_end: periodEnd,
            pay_date: payDate,
            status: 'draft',
            notes,
            created_by: actor.id,
          })
          .select('id')
          .single()

        if (insertErr) {
          return jsonError(insertErr.message)
        }

        return jsonOk({
          message: 'Payroll run created.',
          run_id: run.id,
        })
      }

      // ---------------------------------------------------------------------
      case 'calculate_run': {
        const runId = String(body.payroll_run_id ?? '')
        if (!runId) return jsonError('payroll_run_id is required')

        const { data: run, error: runErr } = await supabase
          .from('employee_payroll_runs')
          .select('*')
          .eq('id', runId)
          .single()

        if (runErr || !run) return jsonError('Payroll run not found')
        if (!['draft', 'ready', 'failed'].includes(run.status)) {
          return jsonError(`Cannot calculate a run in status '${run.status}'`)
        }

        // Mark calculating.
        await supabase
          .from('employee_payroll_runs')
          .update({ status: 'calculating' })
          .eq('id', runId)

        // Remove any prior stubs so recalculation is clean.
        await supabase.from('employee_paystubs').delete().eq('run_id', runId)

        const periodStart = run.period_start
        const periodEnd = run.period_end

        // Active employees with an approved role.
        const { data: employees, error: empErr } = await supabase
          .from('user_profiles')
          .select(
            `id, role,
             record:employee_records (location_city, location_state)`,
          )
          .in('role', [
            'troll_officer',
            'lead_troll_officer',
            'secretary',
            'ceo_assistant',
            'noah_assistant',
            'ceo',
            'pastor',
            'attorney',
            'prosecutor',
            'journalist',
            'auctioneer',
            'troller',
            'agency_hr_manager',
            'agency_leader',
            'agency_hr',
            'hr_admin',
            'hr_manager',
            'president',
            'vice_president',
            'troll_city_secretary',
            'troll_city_treasurer',
            'executive_secretary',
            'academy_teacher',
            'admissions_officer',
          ])

        if (empErr) {
          await supabase
            .from('employee_payroll_runs')
            .update({ status: 'draft' })
            .eq('id', runId)
          return jsonError(empErr.message)
        }

        const stubRows: Array<Record<string, unknown>> = []
        let grossTotal = 0
        let taxTotal = 0
        let deductionTotal = 0
        let netTotal = 0

        for (const emp of employees ?? []) {
          const statusRec = await supabase
            .from('employee_records')
            .select('employment_status')
            .eq('user_id', emp.id)
            .maybeSingle()

          if (statusRec.data?.employment_status === 'inactive') continue

          const { data: perk } = await supabase
            .from('employee_perk_pay')
            .select('amount')
            .eq('role', emp.role)
            .maybeSingle()

          const rate = Number(perk?.amount ?? 0)
          if (rate <= 0) continue

          const { data: sessions } = await supabase
            .from('officer_work_sessions')
            .select('clock_in, clock_out')
            .eq('officer_id', emp.id)
            .gte('clock_in', periodStart)
            .lte('clock_in', periodEnd)

          let hours = 0
          for (const s of sessions ?? []) {
            const start = new Date(s.clock_in)
            const end = s.clock_out ? new Date(s.clock_out) : new Date()
            const h = (end.getTime() - start.getTime()) / 3600000
            if (h > 0) hours += h
          }
          hours = Math.round(hours * 100) / 100

          const regularHours = hours
          const regularPay = Math.round(regularHours * rate * 100) / 100
          const gross = regularPay

          const fed = Math.round(gross * 0.12 * 100) / 100
          const stateTax = Math.round(gross * 0.05 * 100) / 100
          const fica = Math.round(gross * 0.062 * 100) / 100
          const medicare = Math.round(gross * 0.0145 * 100) / 100
          const taxes = fed + stateTax + fica + medicare
          const net = Math.round((gross - taxes) * 100) / 100

          grossTotal += gross
          taxTotal += taxes
          netTotal += net

          const record = Array.isArray(emp.record) ? emp.record[0] : emp.record

          stubRows.push({
            run_id: runId,
            user_id: emp.id,
            pay_period_start: periodStart,
            pay_period_end: periodEnd,
            pay_date: run.pay_date ?? periodEnd,
            regular_hours: regularHours,
            overtime_hours: 0,
            hours: regularHours,
            rate,
            regular_pay: regularPay,
            gross_pay: gross,
            federal_tax: fed,
            state_tax: stateTax,
            fica,
            social_security_tax: fica,
            medicare,
            net_pay: net,
            location_city: record?.location_city ?? null,
            location_state: record?.location_state ?? null,
            payout_status: 'pending',
          })
        }

        if (stubRows.length) {
          const { error: stubErr } = await supabase
            .from('employee_paystubs')
            .insert(stubRows)
          if (stubErr) {
            await supabase
              .from('employee_payroll_runs')
              .update({ status: 'draft' })
              .eq('id', runId)
            return jsonError(stubErr.message)
          }
        }

        const { error: finalErr } = await supabase
          .from('employee_payroll_runs')
          .update({
            status: 'ready',
            employee_count: stubRows.length,
            gross_total: Math.round(grossTotal * 100) / 100,
            tax_total: Math.round(taxTotal * 100) / 100,
            net_total: Math.round(netTotal * 100) / 100,
            deduction_total: Math.round(deductionTotal * 100) / 100,
          })
          .eq('id', runId)

        if (finalErr) return jsonError(finalErr.message)

        return jsonOk({
          message: `Calculated ${stubRows.length} pay statements.`,
          employee_count: stubRows.length,
        })
      }

      // ---------------------------------------------------------------------
      case 'approve_run': {
        const runId = String(body.payroll_run_id ?? '')
        if (!runId) return jsonError('payroll_run_id is required')

        const { data: run, error: runErr } = await supabase
          .from('employee_payroll_runs')
          .select('status')
          .eq('id', runId)
          .single()

        if (runErr || !run) return jsonError('Payroll run not found')
        if (run.status !== 'ready') {
          return jsonError(`Only 'ready' runs can be approved (current: ${run.status})`)
        }

        const { error: updErr } = await supabase
          .from('employee_payroll_runs')
          .update({
            status: 'approved',
            approved_by: actor.id,
            approved_at: new Date().toISOString(),
          })
          .eq('id', runId)

        if (updErr) return jsonError(updErr.message)

        return jsonOk({ message: 'Payroll run approved.' })
      }

      // ---------------------------------------------------------------------
      case 'send_paypal_payouts': {
        const runId = String(body.payroll_run_id ?? '')
        if (!runId) return jsonError('payroll_run_id is required')

        if (!isPayrollWindow() && Deno.env.get('PAYPAL_MODE') !== 'sandbox') {
          return jsonError(
            'Payouts may only be submitted Fri–Sun, 1:00 AM–7:00 PM MT.',
          )
        }

        const { data: run, error: runErr } = await supabase
          .from('employee_payroll_runs')
          .select('status, net_total')
          .eq('id', runId)
          .single()

        if (runErr || !run) return jsonError('Payroll run not found')
        if (run.status !== 'approved') {
          return jsonError(`Run must be 'approved' before payout (current: ${run.status})`)
        }

        // Fetch pending stubs with recipient PayPal emails.
        const { data: stubs, error: stubErr } = await supabase
          .from('employee_paystubs')
          .select('id, user_id, net_pay, paypal_email, payout_status')
          .eq('run_id', runId)

        if (stubErr) return jsonError(stubErr.message)

        // Resolve missing paypal_email from user_profiles.
        for (const stub of stubs ?? []) {
          if (!stub.paypal_email) {
            const { data: prof } = await supabase
              .from('user_profiles')
              .select('payout_paypal_email')
              .eq('id', stub.user_id)
              .maybeSingle()
            stub.paypal_email = prof?.payout_paypal_email ?? null
            if (stub.paypal_email) {
              await supabase
                .from('employee_paystubs')
                .update({ paypal_email: stub.paypal_email })
                .eq('id', stub.id)
            }
          }
        }

        const payable = (stubs ?? []).filter(
          (s) =>
            Number(s.net_pay ?? 0) > 0 &&
            s.paypal_email &&
            s.payout_status !== 'success' &&
            s.payout_status !== 'processing',
        )

        if (!payable.length) {
          return jsonError('No payable statements with a valid PayPal email.')
        }

        const token = await getPayPalToken()
        const baseUrl = paypalBaseUrl()

        const items = payable.map((s) => ({
          recipient_type: 'EMAIL',
          amount: {
            value: Number(s.net_pay).toFixed(2),
            currency: 'USD',
          },
          note: 'Mai Troll employee payroll',
          sender_item_id: s.id,
          receiver: s.paypal_email,
          notification_language: 'en-US',
        }))

        const payoutRes = await fetch(`${baseUrl}/v1/payments/payouts`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            sender_batch_header: {
              sender_batch_id: `payroll_${runId}_${Date.now()}`,
              email_subject: 'You have a payout from Mai Troll',
              email_message: 'Your Mai Troll payroll payment is here.',
            },
            items,
          }),
        })

        const payoutData = await payoutRes.json()

        if (!payoutRes.ok) {
          return jsonError(`PayPal payout failed: ${JSON.stringify(payoutData)}`)
        }

        const batchId =
          payoutData.batch_header?.payout_batch_id ?? null

        // Record PayPal item ids per stub and mark processing.
        const itemsOut = payoutData.items ?? []
        for (const item of itemsOut) {
          const senderItemId = item.payout_item?.sender_item_id ?? item.sender_item_id
          if (senderItemId) {
            await supabase
              .from('employee_paystubs')
              .update({
                paypal_item_id: item.payout_item_id ?? null,
                payout_status: 'processing',
              })
              .eq('id', senderItemId)
          }
        }

        await supabase
          .from('employee_payroll_runs')
          .update({
            status: 'processing',
            paypal_batch_id: batchId,
            submitted_by: actor.id,
            submitted_at: new Date().toISOString(),
          })
          .eq('id', runId)

        return jsonOk({
          message: `Submitted ${payable.length} payouts to PayPal.`,
          paypal_batch_id: batchId,
        })
      }

      // ---------------------------------------------------------------------
      case 'sync_paypal_status': {
        const runId = String(body.payroll_run_id ?? '')
        if (!runId) return jsonError('payroll_run_id is required')

        const { data: run, error: runErr } = await supabase
          .from('employee_payroll_runs')
          .select('paypal_batch_id, status')
          .eq('id', runId)
          .single()

        if (runErr || !run) return jsonError('Payroll run not found')
        if (!run.paypal_batch_id) {
          return jsonError('No PayPal batch associated with this run.')
        }

        const token = await getPayPalToken()
        const baseUrl = paypalBaseUrl()

        const statusRes = await fetch(
          `${baseUrl}/v1/payments/payouts/${run.paypal_batch_id}`,
          {
            method: 'GET',
            headers: { Authorization: `Bearer ${token.access_token}` },
          },
        )

        if (!statusRes.ok) {
          const text = await statusRes.text()
          return jsonError(`PayPal status lookup failed: ${text}`)
        }

        const statusData = await statusRes.json()
        const items = statusData.items ?? []

        let successCount = 0
        let failedCount = 0

        for (const item of items) {
          const senderItemId =
            item.payout_item?.sender_item_id ?? item.sender_item_id
          const rawStatus =
            item.transaction_status ?? item.status ?? 'UNKNOWN'
          const mapped = mapPayPalStatus(rawStatus)
          const errorMsg =
            item.errors?.message ?? item.error?.message ?? null

          if (senderItemId) {
            await supabase
              .from('employee_paystubs')
              .update({
                payout_status: mapped,
                payment_error: errorMsg,
                paid_at:
                  mapped === 'success'
                    ? new Date().toISOString()
                    : null,
              })
              .eq('id', senderItemId)
          }

          if (mapped === 'success') successCount++
          else if (['failed', 'returned', 'blocked'].includes(mapped))
            failedCount++
        }

        // Derive run status.
        const { data: stubs } = await supabase
          .from('employee_paystubs')
          .select('payout_status')
          .eq('run_id', runId)

        const statuses = (stubs ?? []).map((s) => s.payout_status)
        let runStatus = run.status
        if (statuses.length && statuses.every((s) => s === 'success')) {
          runStatus = 'paid'
        } else if (successCount > 0 && (failedCount > 0 || statuses.some((s) => s !== 'success' && s !== 'processing'))) {
          runStatus = 'partially_paid'
        }

        await supabase
          .from('employee_payroll_runs')
          .update({ status: runStatus })
          .eq('id', runId)

        return jsonOk({
          message: `Synced ${items.length} payout items.`,
          run_status: runStatus,
        })
      }

      // ---------------------------------------------------------------------
      case 'retry_failed_payouts': {
        const runId = String(body.payroll_run_id ?? '')
        if (!runId) return jsonError('payroll_run_id is required')

        const { data: run, error: runErr } = await supabase
          .from('employee_payroll_runs')
          .select('status, paypal_batch_id')
          .eq('id', runId)
          .single()

        if (runErr || !run) return jsonError('Payroll run not found')

        const { data: stubs, error: stubErr } = await supabase
          .from('employee_paystubs')
          .select('id, user_id, net_pay, paypal_email, payout_status')
          .eq('run_id', runId)
          .in('payout_status', ['failed', 'returned', 'unclaimed', 'blocked'])

        if (stubErr) return jsonError(stubErr.message)

        for (const stub of stubs ?? []) {
          if (!stub.paypal_email) {
            const { data: prof } = await supabase
              .from('user_profiles')
              .select('payout_paypal_email')
              .eq('id', stub.user_id)
              .maybeSingle()
            stub.paypal_email = prof?.payout_paypal_email ?? null
          }
        }

        const retryable = (stubs ?? []).filter(
          (s) => Number(s.net_pay ?? 0) > 0 && s.paypal_email,
        )

        if (!retryable.length) {
          return jsonError('No failed items with a valid PayPal email to retry.')
        }

        const token = await getPayPalToken()
        const baseUrl = paypalBaseUrl()

        const items = retryable.map((s) => ({
          recipient_type: 'EMAIL',
          amount: {
            value: Number(s.net_pay).toFixed(2),
            currency: 'USD',
          },
          note: 'Mai Troll employee payroll (retry)',
          sender_item_id: s.id,
          receiver: s.paypal_email,
          notification_language: 'en-US',
        }))

        const payoutRes = await fetch(`${baseUrl}/v1/payments/payouts`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            sender_batch_header: {
              sender_batch_id: `payroll_retry_${runId}_${Date.now()}`,
              email_subject: 'You have a payout from Mai Troll',
              email_message: 'Your Mai Troll payroll payment is here.',
            },
            items,
          }),
        })

        const payoutData = await payoutRes.json()
        if (!payoutRes.ok) {
          return jsonError(`PayPal retry failed: ${JSON.stringify(payoutData)}`)
        }

        const itemsOut = payoutData.items ?? []
        for (const item of itemsOut) {
          const senderItemId = item.payout_item?.sender_item_id ?? item.sender_item_id
          if (senderItemId) {
            await supabase
              .from('employee_paystubs')
              .update({
                payout_status: 'processing',
                paypal_item_id: item.payout_item_id ?? null,
                payment_error: null,
              })
              .eq('id', senderItemId)
          }
        }

        await supabase
          .from('employee_payroll_runs')
          .update({ status: 'processing' })
          .eq('id', runId)

        return jsonOk({
          message: `Retried ${retryable.length} payouts.`,
        })
      }

      // ---------------------------------------------------------------------
      case 'cancel_run': {
        const runId = String(body.payroll_run_id ?? '')
        if (!runId) return jsonError('payroll_run_id is required')

        const { data: run, error: runErr } = await supabase
          .from('employee_payroll_runs')
          .select('status')
          .eq('id', runId)
          .single()

        if (runErr || !run) return jsonError('Payroll run not found')
        if (!['draft', 'ready'].includes(run.status)) {
          return jsonError(`Only draft/ready runs can be cancelled (current: ${run.status})`)
        }

        // Delete stubs (FK cascade) then the run.
        await supabase.from('employee_paystubs').delete().eq('run_id', runId)
        const { error: delErr } = await supabase
          .from('employee_payroll_runs')
          .delete()
          .eq('id', runId)

        if (delErr) return jsonError(delErr.message)

        return jsonOk({ message: 'Payroll run cancelled.' })
      }

      // ---------------------------------------------------------------------
      default:
        return jsonError(`Unknown payroll action: ${action}`, 400)
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('employee-payroll error:', message)
    return jsonError(message)
  }
})

function mapPayPalStatus(status: string): string {
  switch ((status || '').toUpperCase()) {
    case 'SUCCESS':
      return 'success'
    case 'PENDING':
    case 'PROCESSING':
    case 'UNCLAIMED':
      return 'processing'
    case 'ONHOLD':
    case 'NEW':
    case 'CREATED':
      return 'pending'
    case 'RETURNED':
      return 'returned'
    case 'REFUNDED':
    case 'BLOCKED':
    case 'DENIED':
    case 'FAILED':
      return 'failed'
    case 'UNCLAIMED_EXPIRED':
    case 'RETURNED_EXPIRED':
      return 'unclaimed'
    default:
      return 'pending'
  }
}
