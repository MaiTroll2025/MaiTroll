import { useMemo, useState } from 'react'
import { CheckCircle, CircleDashed, ShieldAlert } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { calculateTromocodeDiscount, getTromocodePromotionLabel, normalizeTromocode } from '@/lib/tromocode'

interface TromocodeInputProps {
  productType: string
  originalAmount?: number
  disabled?: boolean
  onApplied?: (payload: any) => void
  onError?: (message: string) => void
  className?: string
}

export default function TromocodeInput({
  productType,
  originalAmount = 0,
  disabled = false,
  onApplied,
  onError,
  className = '',
}: TromocodeInputProps) {
  const [code, setCode] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [message, setMessage] = useState('')
  const [appliedPromo, setAppliedPromo] = useState<any>(null)

  const amount = useMemo(() => Number(originalAmount || 0), [originalAmount])

  const applyCode = async () => {
    const trimmedCode = normalizeTromocode(code)
    if (!trimmedCode || disabled) {
      return
    }

    setIsSubmitting(true)
    setStatus('idle')
    setMessage('')

    try {
      const { data: userData } = await supabase.auth.getUser()
      const userId = userData?.user?.id || null

      const { data, error } = await supabase.rpc('validate_tromocode', {
        p_code: trimmedCode,
        p_product_type: productType,
        p_original_amount: amount,
        p_user_id: userId,
      })

      if (error) {
        throw error
      }

      if (!data || !data.valid) {
        const safeMessage = data?.message || 'Invalid TromoCode.'
        setStatus('error')
        setMessage(safeMessage)
        onError?.(safeMessage)
        return
      }

      const discount = calculateTromocodeDiscount({
        promotionType: data.promotion_type,
        promotionValue: data.promotion_value,
        originalAmount: amount,
      })

      const promoPayload = {
        ...data,
        ...discount,
        code: data.code,
      }

      setAppliedPromo(promoPayload)
      setStatus('success')
      setMessage(`✓ TromoCode applied! ${data.code}`)
      onApplied?.(promoPayload)
    } catch (error: any) {
      const safeMessage = error?.message || 'Unable to validate TromoCode right now.'
      setStatus('error')
      setMessage(safeMessage)
      onError?.(safeMessage)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className={`rounded-2xl border border-purple-500/20 bg-black/20 p-4 ${className}`}>
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-zinc-200">
        <ShieldAlert className="h-4 w-4 text-purple-300" />
        Have a TromoCode?
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          value={code}
          onChange={(event) => setCode(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              void applyCode()
            }
          }}
          placeholder="Enter TromoCode"
          disabled={disabled || isSubmitting}
          className="flex-1 rounded-xl border border-white/10 bg-[#0b0d14] px-3 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:border-cyan-400 focus:outline-none"
        />
        <button
          type="button"
          onClick={() => void applyCode()}
          disabled={disabled || isSubmitting || !normalizeTromocode(code)}
          className="rounded-xl bg-gradient-to-r from-cyan-500 to-purple-600 px-4 py-2.5 text-sm font-bold text-white transition hover:from-cyan-400 hover:to-purple-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? 'Applying...' : 'Apply'}
        </button>
      </div>

      {status !== 'idle' && (
        <div className="mt-3 space-y-2">
          <div className={`rounded-xl border px-3 py-2 text-sm ${status === 'success' ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200' : 'border-red-500/40 bg-red-500/10 text-red-200'}`}>
            {status === 'success' ? <CheckCircle className="mr-2 inline-block h-4 w-4" /> : <CircleDashed className="mr-2 inline-block h-4 w-4" />}
            {message}
          </div>

          {status === 'success' && appliedPromo && (
            <div className="rounded-xl border border-cyan-500/30 bg-cyan-500/5 p-3 text-sm text-cyan-100">
              <div className="font-semibold text-white">{appliedPromo.code}</div>
              <div className="mt-1 text-cyan-200">{getTromocodePromotionLabel(appliedPromo.promotion_type, appliedPromo.promotion_value)}</div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
