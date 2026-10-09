import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { DollarSign, Clock, RefreshCw, TrendingUp, Award } from 'lucide-react';

interface PayrollLog {
  id: string
  pay_period_start: string | null
  pay_period_end: string | null
  base_pay: number
  bonus_pay: number
  total_paid: number
  status: string | null
  reason: string | null
  created_at: string | null
}

interface WorkSession {
  id: string
  clock_in: string
  clock_out: string | null
  hours_worked: number
}

interface PayrollPanelProps {
  isHRAdmin: boolean
  currentUserId: string | undefined
}

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(amount || 0)
}

const statusTone = (status?: string | null) => {
  const s = (status || '').toLowerCase()
  if (['paid', 'completed', 'approved'].includes(s)) return 'bg-emerald-500/10 text-emerald-100 border-emerald-300/20'
  if (['pending', 'processing'].includes(s)) return 'bg-amber-500/10 text-amber-100 border-amber-300/20'
  if (['rejected', 'failed', 'cancelled'].includes(s)) return 'bg-red-500/10 text-red-100 border-red-300/20'
  return 'bg-cyan-500/10 text-cyan-100 border-cyan-300/20'
}

export default function PayrollPanel({ isHRAdmin, currentUserId }: PayrollPanelProps) {
  const [payrollLogs, setPayrollLogs] = useState<PayrollLog[]>([])
  const [workSessions, setWorkSessions] = useState<WorkSession[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedPeriod, setSelectedPeriod] = useState<'week' | 'month' | 'all'>('week')

  const loadPayrollData = useCallback(async () => {
    if (!currentUserId) return
    setLoading(true)
    try {
      const now = new Date()
      let startDate: Date

      switch (selectedPeriod) {
        case 'week':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
          break
        case 'month':
          startDate = new Date(now.getFullYear(), now.getMonth(), 1)
          break
        case 'all':
          startDate = new Date(2024, 0, 1)
          break
      }

      const { data: logs } = await supabase
        .from('officer_payroll_logs')
        .select('id, pay_period_start, pay_period_end, base_pay, bonus_pay, total_paid, status, reason, created_at')
        .eq('officer_id', currentUserId)
        .gte('pay_period_start', startDate.toISOString().split('T')[0])
        .order('pay_period_start', { ascending: false })
        .limit(100)

      setPayrollLogs((logs as PayrollLog[]) || [])

      const { data: sessions } = await supabase
        .from('officer_work_sessions')
        .select('id, clock_in, clock_out, hours_worked')
        .eq('officer_id', currentUserId)
        .gte('clock_in', startDate.toISOString())
        .order('clock_in', { ascending: false })
        .limit(200)

      const sessionsData = (sessions as WorkSession[]) || []
      sessionsData.forEach((s: any) => {
        if (s.clock_in && s.clock_out) {
          const start = new Date(s.clock_in).getTime()
          const end = new Date(s.clock_out).getTime()
          s.hours_worked = Math.max(0, (end - start) / (1000 * 60 * 60))
        } else {
          s.hours_worked = 0
        }
      })
      setWorkSessions(sessionsData)
    } catch (err: any) {
      console.error('[HR] Payroll load error:', err)
      toast.error(err?.message || 'Failed to load payroll data')
    } finally {
      setLoading(false)
    }
  }, [currentUserId, selectedPeriod])

  useEffect(() => {
    loadPayrollData()
  }, [loadPayrollData])

  const totals = useMemo(() => {
    const basePay = payrollLogs.reduce((sum, log) => sum + (log.base_pay || 0), 0)
    const bonusPay = payrollLogs.reduce((sum, log) => sum + (log.bonus_pay || 0), 0)
    const totalPaid = payrollLogs.reduce((sum, log) => sum + (log.total_paid || 0), 0)
    const totalHours = workSessions.reduce((sum, s) => sum + (s.hours_worked || 0), 0)
    return { basePay, bonusPay, totalPaid, totalHours }
  }, [payrollLogs, workSessions])

  if (loading) {
    return (
      <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-8 text-center text-sm text-slate-400">
        Loading payroll data...
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-lg font-black text-white">Payroll</h3>
          <p className="text-xs text-slate-400">
            {isHRAdmin ? 'Payroll overview for all staff.' : 'Your payroll summary and payment history.'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-2xl border border-white/10 bg-white/5 p-1">
            {(['week', 'month', 'all'] as const).map(p => (
              <button
                key={p}
                type="button"
                onClick={() => setSelectedPeriod(p)}
                className={`rounded-xl px-3 py-1.5 text-xs font-bold uppercase transition ${
                  selectedPeriod === p ? 'bg-cyan-500/15 text-cyan-50' : 'text-slate-400 hover:text-white'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={loadPayrollData}
            className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-white transition hover:bg-white/10"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur-xl">
          <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
            <Clock className="h-3.5 w-3.5" />
            Hours Worked
          </div>
          <p className="mt-2 text-2xl font-black text-white">{totals.totalHours.toFixed(1)}h</p>
        </div>
        <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur-xl">
          <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
            <DollarSign className="h-3.5 w-3.5" />
            Base Pay
          </div>
          <p className="mt-2 text-2xl font-black text-cyan-300">{formatCurrency(totals.basePay)}</p>
        </div>
        <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur-xl">
          <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
            <Award className="h-3.5 w-3.5" />
            Bonuses
          </div>
          <p className="mt-2 text-2xl font-black text-purple-300">{formatCurrency(totals.bonusPay)}</p>
        </div>
        <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur-xl">
          <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
            <TrendingUp className="h-3.5 w-3.5" />
            Total Paid
          </div>
          <p className="mt-2 text-2xl font-black text-emerald-300">{formatCurrency(totals.totalPaid)}</p>
        </div>
      </div>

      <div>
        <h4 className="mb-2 text-sm font-bold text-slate-300">Payment History</h4>
        {payrollLogs.length === 0 ? (
          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 text-center text-sm text-slate-400">
            No payroll records found for this period. Payroll is processed by HR/Admin.
          </div>
        ) : (
          <div className="space-y-2">
            {payrollLogs.map(log => (
              <div key={log.id} className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
                <div className="flex items-center gap-3">
                  <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase ${statusTone(log.status)}`}>
                    {log.status || 'pending'}
                  </span>
                  <div>
                    <p className="text-xs font-bold text-white">
                      {log.pay_period_start ? new Date(log.pay_period_start).toLocaleDateString() : '—'}
                      {log.pay_period_end ? ` → ${new Date(log.pay_period_end).toLocaleDateString()}` : ''}
                    </p>
                    {log.reason && <p className="text-[10px] text-slate-500">{log.reason}</p>}
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-white">{formatCurrency(log.total_paid)}</p>
                  <p className="text-[10px] text-slate-500">
                    Base: {formatCurrency(log.base_pay)} · Bonus: {formatCurrency(log.bonus_pay)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
