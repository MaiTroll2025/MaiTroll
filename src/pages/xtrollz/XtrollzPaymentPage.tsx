import React, { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, Loader2, Shield } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/lib/store'

type PaymentLocationState = {
  applicationId?: string
}

type XtrollzPaymentResult = {
  success?: boolean
  message?: string
  application_id?: string
  amount_deducted?: number
  new_balance?: number
  status?: string
}

export default function XtrollzPaymentPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuthStore()

  const [isProcessing, setIsProcessing] = useState(false)
  const [isCompleted, setIsCompleted] = useState(false)
  const [error, setError] = useState('')
  const [applicationId, setApplicationId] = useState<string | null>(null)

  useEffect(() => {
    const state = location.state as PaymentLocationState | null

    if (state?.applicationId) {
      setApplicationId(state.applicationId)
      return
    }

    const searchParams = new URLSearchParams(location.search)
    const applicationIdFromQuery = searchParams.get('applicationId')

    if (applicationIdFromQuery) {
      setApplicationId(applicationIdFromQuery)
    }
  }, [location.search, location.state])

  const feeAmount = 1000

  const handlePay = async () => {
    if (isProcessing || isCompleted) return

    if (!user?.id) {
      setError('You must be signed in to submit your XTrollz application.')
      return
    }

    if (!applicationId) {
      setError('Your XTrollz application could not be found. Please return to the application page.')
      return
    }

    setIsProcessing(true)
    setError('')

    try {
      /*
        * This RPC must perform the full transaction on the backend:
        *
        * 1. Verify auth.uid() matches p_user_id.
        * 2. Verify the application belongs to the authenticated user.
        * 3. Lock the application and wallet/balance rows.
        * 4. Confirm the application has not already been paid.
        * 5. Charge 1000 Troll Coins for streamers, 800 for viewers.
        * 6. Record the transaction in the coin ledger.
        * 7. Set payment_status to "completed".
        * 8. Set application status to "submitted".
        * 9. Return a JSON result.
        *
        * The fee amount is enforced inside the RPC.
        */
      const { data, error: rpcError } = await supabase.rpc(
        'xtrollz_pay_application_fee',
        {
          p_application_id: applicationId,
          p_user_id: user.id,
        },
      )

      if (rpcError) {
        throw rpcError
      }

      const result = data as XtrollzPaymentResult | null

      if (!result?.success) {
        throw new Error(result?.message || 'The XTrollz application fee could not be processed.')
      }

      setIsCompleted(true)

      window.setTimeout(() => {
        navigate('/xtrollz', {
          replace: true,
          state: {
            applicationSubmitted: true,
            applicationId,
          },
        })
      }, 1200)
    } catch (paymentError) {
      console.warn('[XTrollzPayment] RPC payment error:', paymentError)

      const message =
        paymentError instanceof Error
          ? paymentError.message
          : 'The XTrollz application fee could not be processed.'

      const normalizedMessage = message.toLowerCase()

      if (
        normalizedMessage.includes('insufficient') ||
        normalizedMessage.includes('not enough') ||
        normalizedMessage.includes('balance')
      ) {
        setError(`You need at least ${feeAmount} Troll Coins to submit this application.`)
      } else if (
        normalizedMessage.includes('already paid') ||
        normalizedMessage.includes('already completed') ||
        normalizedMessage.includes('already submitted')
      ) {
        setIsCompleted(true)

        window.setTimeout(() => {
          navigate('/xtrollz', {
            replace: true,
            state: {
              applicationSubmitted: true,
              applicationId,
            },
          })
        }, 1200)
      } else if (
        normalizedMessage.includes('not found') ||
        normalizedMessage.includes('does not exist')
      ) {
        setError('The XTrollz application could not be found.')
      } else if (
        normalizedMessage.includes('unauthorized') ||
        normalizedMessage.includes('permission') ||
        normalizedMessage.includes('does not belong')
      ) {
        setError('You are not authorized to pay for this application.')
      } else {
        setError(message || 'Payment processing failed. Please try again or contact support.')
      }
    } finally {
      setIsProcessing(false)
    }
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950/40 to-slate-950 text-white">
        <div className="mx-auto max-w-4xl p-4">
          <button
            type="button"
            onClick={() => navigate('/xtrollz')}
            className="mt-4 inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-bold text-white transition hover:bg-white/10"
          >
            <ArrowLeft size={16} />
            Back
          </button>

          <p className="mt-6 text-sm text-white/60">
            Please sign in to complete your XTrollz application.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950/40 to-slate-950 text-white">
      <div className="mx-auto max-w-4xl p-4">
        <button
          type="button"
          disabled={isProcessing}
          onClick={() => navigate('/xtrollz/apply')}
          className="mt-4 inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-bold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <ArrowLeft size={16} />
          Back
        </button>

        <div className="mt-6 rounded-3xl border border-white/10 bg-black/20 p-4 md:p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-amber-300/20 bg-amber-500/10">
              <Shield size={18} />
            </div>

            <div>
              <h1 className="text-2xl font-black tracking-tight">
                XTrollz Application Fee
              </h1>

              <p className="text-xs text-white/60">
                Submit your application with Troll Coins
              </p>
            </div>
          </div>

          <div className="mt-6 rounded-2xl border border-white/10 bg-black/25 p-4">
            <p className="text-sm font-black">Application Fee</p>

            <p className="mt-1 text-3xl font-black text-amber-300">
              {feeAmount} Troll Coins
            </p>

            <p className="mt-2 text-xs leading-relaxed text-white/60">
              The application fee is deducted from your Troll Coin balance.
              Paying the fee does not guarantee approval. It covers identity
              verification and application review.
            </p>
          </div>

          {!applicationId && !error ? (
            <div className="mt-4 rounded-xl border border-amber-400/30 bg-amber-950/40 p-3 text-xs text-amber-200">
              No application was selected. Return to the application page and
              submit your application again.
            </div>
          ) : null}

          {error ? (
            <div className="mt-4 rounded-xl border border-red-400/30 bg-red-950/70 p-3 text-xs text-red-200">
              {error}
            </div>
          ) : null}

          {isCompleted ? (
            <div className="mt-4 flex items-center gap-3 rounded-xl border border-emerald-400/30 bg-emerald-950/60 p-4 text-emerald-200">
              <CheckCircle2 className="shrink-0" size={22} />

              <div>
                <p className="text-sm font-black">Application submitted</p>
                <p className="mt-1 text-xs text-emerald-200/70">
                  Your {feeAmount} Troll Coin fee was processed successfully.
                </p>
              </div>
            </div>
          ) : null}

          <button
            type="button"
            disabled={isProcessing || isCompleted || !applicationId}
            onClick={handlePay}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-3 text-sm font-black text-slate-950 transition hover:from-amber-400 hover:to-orange-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isProcessing ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                Processing…
              </>
            ) : isCompleted ? (
              <>
                <CheckCircle2 size={18} />
                Application Submitted
              </>
            ) : (
              `Pay ${feeAmount} Troll Coins`
            )}
          </button>

          <p className="mt-3 text-center text-[11px] text-white/50">
            The fee and application submission are processed securely by the
            Mai Troll backend.
          </p>
        </div>
      </div>
    </div>
  )
}
