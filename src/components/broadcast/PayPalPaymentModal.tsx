import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { CreditCard, Loader2, CheckCircle, Lock } from 'lucide-react'

declare global {
  interface Window {
    paypal?: any
  }
}

interface PayPalPaymentModalProps {
  isOpen: boolean
  onClose: () => void
  pkg: any
  userId: string
  profile: any
  onPaymentSuccess?: (data: any) => void
  onSaveCard?: boolean
  requireCardOnFile?: boolean
  onCardSaved?: () => void
  saveOnly?: boolean
  onProfileUpdate?: (profile: any) => void
  /** When false (e.g. MAI Pay Plus upgrade), coins are not required to render. */
  requireCoins?: boolean
}

type PaymentStep = 'select' | 'processing' | 'success'

export default function PayPalPaymentModal({
  isOpen,
  onClose,
  pkg,
  userId,
  profile,
  onPaymentSuccess,
  onSaveCard = false,
  requireCardOnFile = false,
  onCardSaved,
  saveOnly = false,
  onProfileUpdate,
  requireCoins = true,
}: PayPalPaymentModalProps) {
  const [step, setStep] = useState<PaymentStep>('select')
  const [paymentResult, setPaymentResult] = useState<any>(null)
  const [sdkReady, setSdkReady] = useState(false)
  const [forceCard, setForceCard] = useState(false)

  const paypalButtonsRef = useRef<HTMLDivElement | null>(null)
  const paypalOrderIdRef = useRef<string | null>(null)
  const paypalInstanceRef = useRef<any>(null)
  const renderKeyRef = useRef<string>('')
  // Track whether a PayPal checkout flow is actively in progress so we
  // can prevent the Dialog from closing (via onOpenChange) while the
  // user is completing the PayPal popup.
  const paypalFlowActiveRef = useRef(false)

  const coins = pkg?.coins ?? pkg?.coin_amount ?? pkg?.coinAmount ?? 0
  const rawPrice = pkg?.price_usd ?? pkg?.amount_usd ?? pkg?.price ?? 0
  const amountUsd =
    typeof rawPrice === 'number'
      ? rawPrice
      : Number(String(rawPrice ?? '').replace(/[^0-9.]/g, '').trim())

  const packageName = pkg?.name || `${Number(coins || 0).toLocaleString()} Troll Coins`
  const packageId = pkg?.id || pkg?.paypal_sku || 'coins'
  const purchaseType = pkg?.purchaseType || 'coins'

  const modalRenderKey = useMemo(() => {
    return `${packageId}:${coins}:${amountUsd}:${forceCard ? 'card' : 'paypal'}`
  }, [amountUsd, coins, forceCard, packageId])

  useEffect(() => {
    setForceCard(Boolean(pkg?.forceCard))
  }, [pkg?.forceCard])

  const safelyClosePayPalButtons = useCallback(() => {
    try {
      paypalInstanceRef.current?.close?.()
    } catch (err: any) {
      const message = String(err?.message || err || '')
      if (!message.includes('Detected container element removed from DOM')) {
        console.warn('[PayPalPaymentModal] Error closing PayPal instance:', err)
      }
    } finally {
      paypalInstanceRef.current = null
    }
  }, [])

  const clearPayPalContainer = useCallback(() => {
    if (!paypalButtonsRef.current) return

    try {
      paypalButtonsRef.current.innerHTML = ''
    } catch {
      // ignore DOM cleanup errors
    }
  }, [])

  const loadPayPalSDK = useCallback(async () => {
    if (window.paypal?.Buttons) {
      setSdkReady(true)
      return
    }

    const clientId = import.meta.env.VITE_PAYPAL_CLIENT_ID

    if (!clientId) {
      toast.error('PayPal client ID not configured')
      setSdkReady(false)
      return
    }

    const existingScript = document.querySelector<HTMLScriptElement>('script[data-tc-paypal-sdk="true"]')

    if (existingScript) {
      await new Promise<void>((resolve, reject) => {
        if (window.paypal?.Buttons) {
          resolve()
          return
        }

        existingScript.addEventListener('load', () => resolve(), { once: true })
        existingScript.addEventListener('error', () => reject(new Error('Failed to load PayPal SDK')), { once: true })
      })

      setSdkReady(Boolean(window.paypal?.Buttons))
      return
    }

    await new Promise<void>((resolve, reject) => {
      const script = document.createElement('script')
      script.dataset.tcPaypalSdk = 'true'
      script.src = `https://www.paypal.com/sdk/js?client-id=${clientId}&currency=USD&intent=capture`
      script.async = true

      script.onload = () => resolve()
      script.onerror = () => reject(new Error('Failed to load PayPal SDK'))

      document.head.appendChild(script)
    })

    setSdkReady(Boolean(window.paypal?.Buttons))
  }, [])

  const renderPayPalButtons = useCallback(async () => {
    if (!isOpen) return
    if (!pkg) return
    if (!paypalButtonsRef.current) return
    if (!window.paypal?.Buttons) return
    if (!Number.isFinite(amountUsd) || amountUsd <= 0) return
    if (requireCoins && (!Number.isFinite(Number(coins)) || Number(coins) <= 0)) return
    if (paypalFlowActiveRef.current) return

    safelyClosePayPalButtons()
    clearPayPalContainer()

    const container = paypalButtonsRef.current
    const localRenderKey = modalRenderKey
    renderKeyRef.current = localRenderKey

    const createOrder = async () => {
        // Mark flow as active so the Dialog won't auto-close
        paypalFlowActiveRef.current = true
        try {
          const { data, error } = await supabase.functions.invoke('create-paypal-order', {
            body: {
              userId,
              coins,
              amountUsd,
              packageId,
              packageName,
              purchaseType,
            },
          })

          if (error) throw new Error(error.message || 'Failed to create PayPal order')
          if (!data?.success) throw new Error(data?.error || 'Failed to create payment order')
          if (!data?.paypalOrderId) throw new Error('PayPal order ID missing')

          paypalOrderIdRef.current = data.paypalOrderId
          return data.paypalOrderId
        } catch (err: any) {
          console.error('[PayPalPaymentModal] PayPal order creation error:', err)
          toast.error(err?.message || 'Failed to create PayPal order')
          // Flow failed – allow dialog to close again
          paypalFlowActiveRef.current = false
          throw err
        }
      }

    const onApprove = async (data: any) => {
        setStep('processing')

        try {
          const { data: verifyData, error } = await supabase.functions.invoke('verify-paypal-payment', {
            body: {
              paypalOrderId: data.orderID,
              orderId: paypalOrderIdRef.current,
              expectedAmount: amountUsd,
              userId,
              packageId,
              coins,
              purchaseType,
            },
          })

          if (error) throw new Error(error.message || 'Payment verification failed')
          if (!verifyData?.verified) throw new Error(verifyData?.error || 'Payment not verified')

          setPaymentResult(verifyData)
          setStep('success')
          onPaymentSuccess?.(verifyData)
          toast.success('Payment successful! Coins have been added to your account.')
        } catch (err: any) {
          console.error('[PayPalPaymentModal] PayPal payment verification error:', err)
          const errorMessage = String(err?.message || '')
          // If the edge function returned a non-2xx status, show a clean message
          if (errorMessage.includes('Edge Function returned a non-2xx status code')) {
            toast.error('Payment verification failed')
          } else {
            toast.error(errorMessage || 'Payment verification failed')
          }
          setStep('select')
        } finally {
          // PayPal flow finished – re-enable dialog close
          paypalFlowActiveRef.current = false
        }
      }

    const onError = (err: any) => {
        const message = String(err?.message || err || '')

        if (message.includes('Detected container element removed from DOM')) {
          console.warn('[PayPalPaymentModal] PayPal container was removed during render. Ignoring SDK lifecycle warning.')
          return
        }

        console.error('[PayPalPaymentModal] PayPal error:', err)
        toast.error('PayPal payment failed. Please try again.')
        setStep('select')
        // Flow errored – allow dialog to close again
        paypalFlowActiveRef.current = false
      }

    const onCancel = () => {
        toast.info('Payment cancelled')
        setStep('select')
        // User cancelled – allow dialog to close again
        paypalFlowActiveRef.current = false
      }
    const buttonsConfig: any = { createOrder, onApprove, onError, onCancel }

    try {
      if (forceCard && window.paypal?.FUNDING?.CARD) {
        buttonsConfig.fundingSource = window.paypal.FUNDING.CARD
      }

      const buttons = window.paypal.Buttons(buttonsConfig)
      paypalInstanceRef.current = buttons

      if (buttons?.isEligible && !buttons.isEligible()) {
        toast.error('This PayPal payment method is not eligible.')
        return
      }

      if (!paypalButtonsRef.current.isConnected) return
      if (renderKeyRef.current !== localRenderKey) return

      await buttons.render(paypalButtonsRef.current)
    } catch (err: any) {
      const message = String(err?.message || err || '')

      if (message.includes('Detected container element removed from DOM')) {
        console.warn('[PayPalPaymentModal] PayPal render cancelled because container was removed.')
        return
      }

      console.error('[PayPalPaymentModal] Failed to render PayPal buttons:', err)
      toast.error('Unable to load PayPal checkout')
    }
  }, [
    amountUsd,
    clearPayPalContainer,
    coins,
    forceCard,
    isOpen,
    modalRenderKey,
    packageId,
    packageName,
    pkg,
    purchaseType,
    safelyClosePayPalButtons,
    userId,
    onPaymentSuccess,
  ])

  useEffect(() => {
    if (!isOpen || !pkg) return

    setStep('select')
    setPaymentResult(null)
    paypalOrderIdRef.current = null

    loadPayPalSDK().catch((err: any) => {
      console.error('[PayPalPaymentModal] SDK load failed:', err)
      toast.error(err?.message || 'Failed to load PayPal. Please try again.')
    })

    return () => {
      safelyClosePayPalButtons()
      clearPayPalContainer()
    }
  }, [clearPayPalContainer, isOpen, loadPayPalSDK, pkg, safelyClosePayPalButtons])

  useEffect(() => {
    if (!isOpen || !pkg || !sdkReady) return
    renderPayPalButtons()
  }, [isOpen, modalRenderKey, pkg, renderPayPalButtons, sdkReady])

  useEffect(() => {
    if (!isOpen) return

    const style = document.createElement('style')
    style.id = 'paypal-button-fix'
    style.textContent = `
      .paypal-buttons-container > * {
        margin-bottom: 0 !important;
        padding-bottom: 0 !important;
      }
      .paypal-buttons-container .paypal-button-container {
        margin: 0 auto !important;
      }
    `

    const existing = document.getElementById('paypal-button-fix')
    if (!existing) document.head.appendChild(style)

    return () => {
      const node = document.getElementById('paypal-button-fix')
      if (node) node.remove()
    }
  }, [isOpen])

  useEffect(() => {
    return () => {
      safelyClosePayPalButtons()
      clearPayPalContainer()
    }
  }, [clearPayPalContainer, safelyClosePayPalButtons])

  const [localOpen, setLocalOpen] = useState(isOpen)

  useEffect(() => {
    if (isOpen) {
      setLocalOpen(true)
    } else if (!paypalFlowActiveRef.current) {
      setLocalOpen(false)
    }
  }, [isOpen])

  const handleClose = useCallback(() => {
    if (paypalFlowActiveRef.current) {
      console.warn('[PayPalPaymentModal] Close requested during active PayPal flow – ignoring.')
      return
    }
    setStep('select')
    setPaymentResult(null)
    paypalOrderIdRef.current = null
    safelyClosePayPalButtons()
    clearPayPalContainer()
    setLocalOpen(false)
    onClose()
  }, [clearPayPalContainer, onClose, safelyClosePayPalButtons])

  if (!pkg) return null

  return (
    <Dialog open={localOpen} onOpenChange={(open) => { 
      if (!open && paypalFlowActiveRef.current) {
        console.warn('[PayPalPaymentModal] Close blocked during active PayPal flow')
        return
      }
      if (!open) handleClose() 
    }}>
      <DialogContent className="sm:max-w-md bg-zinc-900 border-zinc-800 text-white">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <CreditCard className="w-5 h-5 text-blue-400" />
            {saveOnly ? 'Save PayPal' : 'Pay with PayPal'}
          </DialogTitle>

          <DialogDescription className="text-zinc-400">
            {step === 'select'
              ? `Complete your purchase of ${Number(coins || 0).toLocaleString()} coins for $${Number(amountUsd || 0).toFixed(2)}`
              : step === 'processing'
                ? 'Verifying your PayPal payment...'
                : 'Payment completed successfully!'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="bg-zinc-800/50 p-4 rounded-lg border border-zinc-700 mb-4">
            <div className="flex justify-between items-center mb-2">
              <span className="text-zinc-400">Package</span>
              <span className="font-bold text-yellow-400">
                {Number(coins || 0).toLocaleString()} Coins
              </span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-zinc-400">Total</span>
              <span className="font-bold text-white text-xl">
                ${Number(amountUsd || 0).toFixed(2)}
              </span>
            </div>
          </div>

          {step === 'processing' ? (
            <div className="py-8 flex flex-col items-center justify-center">
              <Loader2 className="w-12 h-12 text-blue-400 animate-spin mb-4" />
              <p className="text-zinc-400">Verifying PayPal payment...</p>
            </div>
          ) : null}

          {step === 'success' ? (
            <div className="py-6 flex flex-col items-center justify-center">
              <CheckCircle className="w-16 h-16 text-green-400 mb-4" />
              <p className="text-lg font-semibold text-white mb-2">Payment Successful!</p>
              <p className="text-zinc-400 text-sm text-center mb-4">
                {Number(coins || 0).toLocaleString()} coins have been added to your account.
                Thank you for your purchase!
              </p>
              {paymentResult?.captureId ? (
                <p className="text-xs text-zinc-500">Transaction: {paymentResult.captureId}</p>
              ) : null}
            </div>
          ) : null}

          <div className={step === 'select' ? 'space-y-4' : 'pointer-events-none h-0 overflow-hidden opacity-0'}>
            <div className="text-center text-zinc-400 text-sm mb-2">
              Click the PayPal button below to complete your purchase securely
            </div>

            <div
              ref={paypalButtonsRef}
              className="paypal-buttons-container flex justify-center min-h-[48px]"
            />
          </div>

          <div className="flex items-center gap-2 text-xs text-zinc-500">
            <Lock className="w-3 h-3" />
            <span>Secure payment processed by PayPal</span>
          </div>
        </div>

        <DialogFooter>
          <div className="flex justify-end gap-2 w-full">
            {step === 'select' ? (
              <Button
                onClick={handleClose}
                variant="outline"
                className="border-zinc-600 text-zinc-300 hover:bg-zinc-800"
              >
                Cancel
              </Button>
            ) : (
              <Button
                onClick={handleClose}
                className="w-full bg-green-600 hover:bg-green-700 text-white"
              >
                Done
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}