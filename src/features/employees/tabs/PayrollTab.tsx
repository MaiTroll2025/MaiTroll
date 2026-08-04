import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Download,
  Loader2,
  Play,
  RefreshCw,
  Send,
  ShieldCheck,
  Users,
  WalletCards,
  XCircle,
} from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import { useAuthStore } from '../../../lib/store'
import {
  canEmployee,
  EMPLOYEE_CORP,
  EMPLOYEE_BUSINESS,
} from '../permissions'

type PayrollStatus =
  | 'draft'
  | 'calculating'
  | 'ready'
  | 'approved'
  | 'processing'
  | 'paid'
  | 'partially_paid'
  | 'failed'
  | 'cancelled'

type PayoutStatus =
  | 'pending'
  | 'processing'
  | 'success'
  | 'failed'
  | 'unclaimed'
  | 'returned'
  | 'blocked'

type PayrollRun = {
  id: string
  period_start: string
  period_end: string
  pay_date: string | null
  status: PayrollStatus
  employee_count: number | null
  gross_total: number | null
  deduction_total: number | null
  tax_total: number | null
  net_total: number | null
  employer_tax_total: number | null
  paypal_batch_id: string | null
  approved_by: string | null
  approved_at: string | null
  submitted_by: string | null
  submitted_at: string | null
  created_at: string
  notes: string | null
}

type Paystub = {
  id: string
  payroll_run_id: string | null
  user_id: string
  pay_period_start: string
  pay_period_end: string
  pay_date: string | null
  location_city: string | null
  location_state: string | null
  regular_hours: number | null
  overtime_hours: number | null
  hours: number | null
  rate: number | null
  overtime_rate: number | null
  regular_pay: number | null
  overtime_pay: number | null
  bonus_pay: number | null
  commission_pay: number | null
  reimbursement_pay: number | null
  gross_pay: number | null
  federal_tax: number | null
  state_tax: number | null
  local_tax: number | null
  social_security_tax: number | null
  medicare: number | null
  fica: number | null
  other_deductions: number | null
  net_pay: number | null
  payout_status: PayoutStatus | null
  payout_method: string | null
  paypal_email: string | null
  paypal_item_id: string | null
  payment_error: string | null
  paid_at: string | null
  user?: {
    username?: string | null
    full_name?: string | null
    email?: string | null
  } | null
}

type PayrollSummary = {
  employees: number
  gross: number
  taxes: number
  deductions: number
  net: number
}

type PayrollTabProps = {
  profile?: any
  realProfile?: any
}

const money = (value: unknown) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(Number(value || 0))

const dateLabel = (value?: string | null) => {
  if (!value) return '—'

  const parsed = new Date(`${value}T12:00:00`)
  if (Number.isNaN(parsed.getTime())) return value

  return parsed.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

const timestampLabel = (value?: string | null) => {
  if (!value) return '—'

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value

  return parsed.toLocaleString()
}

const statusClasses: Record<string, string> = {
  draft: 'border-slate-500/30 bg-slate-500/10 text-slate-300',
  calculating: 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300',
  ready: 'border-blue-500/30 bg-blue-500/10 text-blue-300',
  approved: 'border-violet-500/30 bg-violet-500/10 text-violet-300',
  pending: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
  processing: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
  paid: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
  success: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
  partially_paid: 'border-orange-500/30 bg-orange-500/10 text-orange-300',
  failed: 'border-red-500/30 bg-red-500/10 text-red-300',
  blocked: 'border-red-500/30 bg-red-500/10 text-red-300',
  returned: 'border-orange-500/30 bg-orange-500/10 text-orange-300',
  unclaimed: 'border-yellow-500/30 bg-yellow-500/10 text-yellow-300',
  cancelled: 'border-slate-500/30 bg-slate-500/10 text-slate-400',
}

function StatusBadge({ status }: { status?: string | null }) {
  const normalized = status || 'pending'

  return (
    <span
      className={[
        'inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide',
        statusClasses[normalized] ||
          'border-white/10 bg-white/5 text-slate-300',
      ].join(' ')}
    >
      {normalized.replaceAll('_', ' ')}
    </span>
  )
}

function MetricCard({
  label,
  value,
  hint,
  icon,
}: {
  label: string
  value: string
  hint?: string
  icon: React.ReactNode
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            {label}
          </p>
          <p className="mt-1 text-xl font-black text-white">{value}</p>
          {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
        </div>

        <div className="rounded-xl border border-fuchsia-400/20 bg-fuchsia-500/10 p-2 text-fuchsia-300">
          {icon}
        </div>
      </div>
    </div>
  )
}

export default function PayrollTab({
  profile,
  realProfile,
}: PayrollTabProps) {
  const { user } = useAuthStore()

  const canEditPayroll = canEmployee(realProfile, 'edit_payroll')
  const canApprovePayroll =
    canEmployee(realProfile, 'approve_payroll') || canEditPayroll
  const canSendPayroll =
    canEmployee(realProfile, 'send_payroll') || canEditPayroll

  const isMgmt = canEditPayroll || canApprovePayroll || canSendPayroll

  const [stubs, setStubs] = useState<Paystub[]>([])
  const [runs, setRuns] = useState<PayrollRun[]>([])
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null)

  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [periodStart, setPeriodStart] = useState('')
  const [periodEnd, setPeriodEnd] = useState('')
  const [payDate, setPayDate] = useState('')
  const [runNotes, setRunNotes] = useState('')

  const selectedRun = useMemo(
    () => runs.find((run) => run.id === selectedRunId) || null,
    [runs, selectedRunId],
  )

  const visibleStubs = useMemo(() => {
    if (!selectedRunId) return stubs

    return stubs.filter((stub) => stub.payroll_run_id === selectedRunId)
  }, [selectedRunId, stubs])

  const summary = useMemo<PayrollSummary>(() => {
    return visibleStubs.reduce(
      (total, stub) => {
        const taxes =
          Number(stub.federal_tax || 0) +
          Number(stub.state_tax || 0) +
          Number(stub.local_tax || 0) +
          Number(stub.social_security_tax || stub.fica || 0) +
          Number(stub.medicare || 0)

        total.employees += 1
        total.gross += Number(stub.gross_pay || 0)
        total.taxes += taxes
        total.deductions += Number(stub.other_deductions || 0)
        total.net += Number(stub.net_pay || 0)

        return total
      },
      {
        employees: 0,
        gross: 0,
        taxes: 0,
        deductions: 0,
        net: 0,
      },
    )
  }, [visibleStubs])

  const clearMessages = () => {
    setError('')
    setSuccess('')
  }

  const load = useCallback(async () => {
    setLoading(true)
    clearMessages()

    try {
      if (isMgmt) {
        const [stubResult, runResult] = await Promise.all([
          supabase
            .from('employee_paystubs')
            .select(`
              *,
              user:user_profiles (
                username,
                full_name,
                email
              )
            `)
            .order('pay_period_end', { ascending: false })
            .limit(500),

          supabase
            .from('employee_payroll_runs')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(50),
        ])

        if (stubResult.error) throw stubResult.error
        if (runResult.error) throw runResult.error

        const loadedStubs = (stubResult.data || []) as Paystub[]
        const loadedRuns = (runResult.data || []) as PayrollRun[]

        setStubs(loadedStubs)
        setRuns(loadedRuns)

        setSelectedRunId((current) => {
          if (current && loadedRuns.some((run) => run.id === current)) {
            return current
          }

          return loadedRuns[0]?.id || null
        })
      } else {
        if (!user?.id) {
          setStubs([])
          return
        }

        const { data, error: stubError } = await supabase
          .from('employee_paystubs')
          .select('*')
          .eq('user_id', user.id)
          .order('pay_period_end', { ascending: false })
          .limit(100)

        if (stubError) throw stubError
        setStubs((data || []) as Paystub[])
      }
    } catch (loadError: any) {
      console.error('Unable to load payroll:', loadError)
      setError(loadError?.message || 'Unable to load payroll.')
    } finally {
      setLoading(false)
    }
  }, [isMgmt, user?.id])

  useEffect(() => {
    void load()
  }, [load])

  const invokePayrollFunction = async (
    action: string,
    body: Record<string, unknown>,
  ) => {
    clearMessages()
    setActionLoading(action)

    try {
      const { data, error: functionError } = await supabase.functions.invoke(
        'employee-payroll',
        {
          body: {
            action,
            ...body,
          },
        },
      )

      if (functionError) throw functionError

      if (data?.error) {
        throw new Error(data.error)
      }

      setSuccess(data?.message || 'Payroll action completed.')
      await load()

      return data
    } catch (actionError: any) {
      console.error(`Payroll action failed: ${action}`, actionError)
      setError(actionError?.message || 'Payroll action failed.')
      return null
    } finally {
      setActionLoading(null)
    }
  }

  const createPayrollRun = async () => {
    if (!periodStart || !periodEnd || !payDate) {
      setError('Select the pay-period start, end, and pay date.')
      return
    }

    if (periodStart > periodEnd) {
      setError('The pay-period start cannot be after the end date.')
      return
    }

    const result = await invokePayrollFunction('create_run', {
      period_start: periodStart,
      period_end: periodEnd,
      pay_date: payDate,
      notes: runNotes.trim() || null,
    })

    if (result?.run_id) {
      setSelectedRunId(result.run_id)
      setRunNotes('')
    }
  }

  const calculatePayroll = async (runId: string) => {
    await invokePayrollFunction('calculate_run', {
      payroll_run_id: runId,
    })
  }

  const approvePayroll = async (runId: string) => {
    const confirmed = window.confirm(
      'Approve this payroll run? Pay records will be locked for payment.',
    )

    if (!confirmed) return

    await invokePayrollFunction('approve_run', {
      payroll_run_id: runId,
    })
  }

  const sendPayroll = async (runId: string) => {
    const run = runs.find((item) => item.id === runId)
    const amount = money(run?.net_total || summary.net)

    const confirmed = window.confirm(
      `Send ${amount} in employee net-pay payouts through PayPal? This action can move real money and cannot be safely undone after recipients claim it.`,
    )

    if (!confirmed) return

    await invokePayrollFunction('send_paypal_payouts', {
      payroll_run_id: runId,
    })
  }

  const refreshPayoutStatus = async (runId: string) => {
    await invokePayrollFunction('sync_paypal_status', {
      payroll_run_id: runId,
    })
  }

  const retryFailedPayouts = async (runId: string) => {
    const confirmed = window.confirm(
      'Retry only failed, returned, or unclaimed payroll items for this run?',
    )

    if (!confirmed) return

    await invokePayrollFunction('retry_failed_payouts', {
      payroll_run_id: runId,
    })
  }

  const cancelDraftRun = async (runId: string) => {
    const confirmed = window.confirm(
      'Cancel this payroll run? Draft paystubs for the run will be removed.',
    )

    if (!confirmed) return

    await invokePayrollFunction('cancel_run', {
      payroll_run_id: runId,
    })
  }

  const downloadStub = (stub: Paystub) => {
    const employeeName =
      stub.user?.full_name ||
      stub.user?.username ||
      profile?.full_name ||
      profile?.username ||
      stub.user_id

    const socialSecurity =
      Number(stub.social_security_tax || 0) || Number(stub.fica || 0)

    const totalTaxes =
      Number(stub.federal_tax || 0) +
      Number(stub.state_tax || 0) +
      Number(stub.local_tax || 0) +
      socialSecurity +
      Number(stub.medicare || 0)

    const doc = new jsPDF()

    doc.setFontSize(18)
    doc.text(EMPLOYEE_CORP, 14, 18)

    doc.setFontSize(11)
    doc.text(EMPLOYEE_BUSINESS, 14, 25)

    doc.setFontSize(8)
    doc.text('PAY STATEMENT — CONFIDENTIAL', 14, 31)

    doc.setFontSize(9)
    doc.text(`Statement ID: ${stub.id}`, 14, 36)

    autoTable(doc, {
      startY: 42,
      head: [['Employee Information', 'Value']],
      body: [
        ['Employee', employeeName],
        ['Pay period', `${stub.pay_period_start} to ${stub.pay_period_end}`],
        ['Pay date', stub.pay_date || '—'],
        [
          'Work location',
          [stub.location_city, stub.location_state]
            .filter(Boolean)
            .join(', ') || '—',
        ],
        ['Payment method', stub.payout_method || 'PayPal'],
        ['Payment status', stub.payout_status || 'pending'],
      ],
      theme: 'grid',
      styles: {
        fontSize: 9,
      },
      headStyles: {
        fontStyle: 'bold',
      },
    })

    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 6,
      head: [['Earnings', 'Hours', 'Rate', 'Amount']],
      body: [
        [
          'Regular',
          Number(stub.regular_hours ?? stub.hours ?? 0).toFixed(2),
          money(stub.rate),
          money(stub.regular_pay),
        ],
        [
          'Overtime',
          Number(stub.overtime_hours || 0).toFixed(2),
          money(stub.overtime_rate),
          money(stub.overtime_pay),
        ],
        ['Bonus', '—', '—', money(stub.bonus_pay)],
        ['Commission', '—', '—', money(stub.commission_pay)],
        ['Reimbursement', '—', '—', money(stub.reimbursement_pay)],
        ['Gross pay', '', '', money(stub.gross_pay)],
      ],
      theme: 'grid',
      styles: {
        fontSize: 9,
      },
    })

    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 6,
      head: [['Taxes and deductions', 'Amount']],
      body: [
        ['Federal income tax', money(stub.federal_tax)],
        ['State income tax', money(stub.state_tax)],
        ['Local income tax', money(stub.local_tax)],
        ['Social Security', money(socialSecurity)],
        ['Medicare', money(stub.medicare)],
        ['Other deductions', money(stub.other_deductions)],
        ['Total taxes', money(totalTaxes)],
        ['Net pay', money(stub.net_pay)],
      ],
      theme: 'grid',
      styles: {
        fontSize: 9,
      },
    })

    const finalY = (doc as any).lastAutoTable.finalY + 10

    doc.setFontSize(8)
    doc.text(
      'This statement records payroll calculated by the employer. Payment delivery status is shown above.',
      14,
      finalY,
    )

    doc.save(
      `paystub_${stub.pay_period_end}_${stub.user?.username || stub.user_id}.pdf`,
    )
  }

  const downloadRunReport = () => {
    if (!selectedRun) return

    const doc = new jsPDF({
      orientation: 'landscape',
    })

    doc.setFontSize(18)
    doc.text(`${EMPLOYEE_CORP} Payroll Register`, 14, 18)

    doc.setFontSize(10)
    doc.text(
      `${selectedRun.period_start} through ${selectedRun.period_end}`,
      14,
      25,
    )

    autoTable(doc, {
      startY: 32,
      head: [
        [
          'Employee',
          'Regular hrs',
          'OT hrs',
          'Gross',
          'Taxes',
          'Deductions',
          'Net',
          'Payout',
        ],
      ],
      body: visibleStubs.map((stub) => {
        const taxes =
          Number(stub.federal_tax || 0) +
          Number(stub.state_tax || 0) +
          Number(stub.local_tax || 0) +
          Number(stub.social_security_tax || stub.fica || 0) +
          Number(stub.medicare || 0)

        return [
          stub.user?.full_name ||
            stub.user?.username ||
            stub.user_id,
          Number(stub.regular_hours ?? stub.hours ?? 0).toFixed(2),
          Number(stub.overtime_hours || 0).toFixed(2),
          money(stub.gross_pay),
          money(taxes),
          money(stub.other_deductions),
          money(stub.net_pay),
          stub.payout_status || 'pending',
        ]
      }),
      foot: [
        [
          'TOTAL',
          '',
          '',
          money(summary.gross),
          money(summary.taxes),
          money(summary.deductions),
          money(summary.net),
          '',
        ],
      ],
      theme: 'grid',
      styles: {
        fontSize: 8,
      },
    })

    doc.save(
      `payroll_register_${selectedRun.period_start}_${selectedRun.period_end}.pdf`,
    )
  }

  if (loading) {
    return (
      <div className="flex min-h-[320px] items-center justify-center rounded-2xl border border-white/10 bg-black/30">
        <div className="flex items-center gap-3 text-slate-400">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading payroll…
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-fuchsia-400/20 bg-gradient-to-br from-fuchsia-500/10 via-black/40 to-cyan-500/5 p-5">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
          <div>
            <div className="flex items-center gap-2">
              <WalletCards className="h-5 w-5 text-fuchsia-300" />
              <h1 className="text-xl font-black text-white">
                Mai Troll Payroll
              </h1>
            </div>

            <p className="mt-1 max-w-3xl text-sm text-slate-400">
              {isMgmt
                ? 'Prepare employee payroll, review calculations, approve pay, generate statements, and distribute net pay through PayPal Payouts.'
                : 'Review your earnings, deductions, payment status, and downloadable pay statements.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {isMgmt && (
              <span className="inline-flex items-center gap-2 rounded-xl border border-emerald-400/20 bg-emerald-500/10 px-3 py-2 text-xs font-bold text-emerald-300">
                <ShieldCheck className="h-4 w-4" />
                Admin/Secretary controls
              </span>
            )}

            <button
              type="button"
              onClick={() => void load()}
              disabled={Boolean(actionLoading)}
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-bold text-slate-200 hover:bg-white/10 disabled:opacity-50"
            >
              <RefreshCw
                className={[
                  'h-4 w-4',
                  actionLoading ? 'animate-spin' : '',
                ].join(' ')}
              />
              Refresh
            </button>
          </div>
        </div>
      </section>

      {error && (
        <div className="flex items-start gap-3 rounded-2xl border border-red-400/20 bg-red-500/10 p-4 text-sm text-red-200">
          <XCircle className="mt-0.5 h-5 w-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="flex items-start gap-3 rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-4 text-sm text-emerald-200">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {isMgmt && (
        <section className="rounded-2xl border border-white/10 bg-black/30 p-5">
          <div className="mb-4">
            <h2 className="text-lg font-black text-white">
              Create payroll run
            </h2>
            <p className="text-sm text-slate-500">
              Create the period first, then calculate employee earnings from
              approved time records.
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <label className="space-y-1">
              <span className="text-xs font-bold uppercase tracking-wide text-slate-500">
                Period start
              </span>
              <input
                type="date"
                value={periodStart}
                onChange={(event) => setPeriodStart(event.target.value)}
                className="w-full rounded-xl border border-white/10 bg-slate-950/80 px-3 py-2.5 text-sm text-white outline-none focus:border-fuchsia-400/50"
              />
            </label>

            <label className="space-y-1">
              <span className="text-xs font-bold uppercase tracking-wide text-slate-500">
                Period end
              </span>
              <input
                type="date"
                value={periodEnd}
                onChange={(event) => setPeriodEnd(event.target.value)}
                className="w-full rounded-xl border border-white/10 bg-slate-950/80 px-3 py-2.5 text-sm text-white outline-none focus:border-fuchsia-400/50"
              />
            </label>

            <label className="space-y-1">
              <span className="text-xs font-bold uppercase tracking-wide text-slate-500">
                Pay date
              </span>
              <input
                type="date"
                value={payDate}
                onChange={(event) => setPayDate(event.target.value)}
                className="w-full rounded-xl border border-white/10 bg-slate-950/80 px-3 py-2.5 text-sm text-white outline-none focus:border-fuchsia-400/50"
              />
            </label>

            <label className="space-y-1">
              <span className="text-xs font-bold uppercase tracking-wide text-slate-500">
                Internal notes
              </span>
              <input
                value={runNotes}
                onChange={(event) => setRunNotes(event.target.value)}
                placeholder="Optional notes"
                className="w-full rounded-xl border border-white/10 bg-slate-950/80 px-3 py-2.5 text-sm text-white outline-none placeholder:text-slate-600 focus:border-fuchsia-400/50"
              />
            </label>
          </div>

          <button
            type="button"
            onClick={() => void createPayrollRun()}
            disabled={Boolean(actionLoading)}
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-fuchsia-600 to-violet-600 px-4 py-2.5 text-sm font-black text-white shadow-lg shadow-fuchsia-950/40 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {actionLoading === 'create_run' ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Play className="h-4 w-4" />
            )}
            Create payroll run
          </button>
        </section>
      )}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard
          label="Employees"
          value={String(summary.employees)}
          hint={selectedRun ? 'Included in selected run' : 'Visible statements'}
          icon={<Users className="h-5 w-5" />}
        />

        <MetricCard
          label="Gross payroll"
          value={money(summary.gross)}
          icon={<WalletCards className="h-5 w-5" />}
        />

        <MetricCard
          label="Employee taxes"
          value={money(summary.taxes)}
          icon={<ShieldCheck className="h-5 w-5" />}
        />

        <MetricCard
          label="Other deductions"
          value={money(summary.deductions)}
          icon={<AlertTriangle className="h-5 w-5" />}
        />

        <MetricCard
          label="Net payouts"
          value={money(summary.net)}
          hint="Amount delivered to employees"
          icon={<Send className="h-5 w-5" />}
        />
      </section>

      {isMgmt && (
        <section className="rounded-2xl border border-white/10 bg-black/30 p-5">
          <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
            <div>
              <h2 className="text-lg font-black text-white">
                Payroll runs
              </h2>
              <p className="text-sm text-slate-500">
                Select a run to review its employees and payment activity.
              </p>
            </div>

            {selectedRun && (
              <button
                type="button"
                onClick={downloadRunReport}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-bold text-slate-200 hover:bg-white/10"
              >
                <Download className="h-4 w-4" />
                Payroll register
              </button>
            )}
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[1000px] text-sm">
              <thead className="text-xs uppercase tracking-wide text-slate-500">
                <tr className="border-b border-white/10">
                  <th className="px-3 py-3 text-left">Period</th>
                  <th className="px-3 py-3 text-left">Pay date</th>
                  <th className="px-3 py-3 text-right">Employees</th>
                  <th className="px-3 py-3 text-right">Gross</th>
                  <th className="px-3 py-3 text-right">Net</th>
                  <th className="px-3 py-3 text-left">Status</th>
                  <th className="px-3 py-3 text-right">Actions</th>
                </tr>
              </thead>

              <tbody>
                {runs.length === 0 && (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-3 py-10 text-center text-slate-500"
                    >
                      No payroll runs have been created.
                    </td>
                  </tr>
                )}

                {runs.map((run) => {
                  const selected = selectedRunId === run.id
                  const busy = Boolean(actionLoading)

                  return (
                    <tr
                      key={run.id}
                      onClick={() => setSelectedRunId(run.id)}
                      className={[
                        'cursor-pointer border-b border-white/5 transition',
                        selected
                          ? 'bg-fuchsia-500/10'
                          : 'hover:bg-white/[0.03]',
                      ].join(' ')}
                    >
                      <td className="px-3 py-3 font-bold text-slate-200">
                        {dateLabel(run.period_start)} –{' '}
                        {dateLabel(run.period_end)}
                      </td>

                      <td className="px-3 py-3 text-slate-400">
                        {dateLabel(run.pay_date)}
                      </td>

                      <td className="px-3 py-3 text-right text-slate-300">
                        {run.employee_count || 0}
                      </td>

                      <td className="px-3 py-3 text-right text-slate-200">
                        {money(run.gross_total)}
                      </td>

                      <td className="px-3 py-3 text-right font-bold text-emerald-300">
                        {money(run.net_total)}
                      </td>

                      <td className="px-3 py-3">
                        <StatusBadge status={run.status} />
                      </td>

                      <td className="px-3 py-3">
                        <div className="flex justify-end gap-2">
                          {['draft', 'failed'].includes(run.status) &&
                            canEditPayroll && (
                              <button
                                type="button"
                                disabled={busy}
                                onClick={(event) => {
                                  event.stopPropagation()
                                  void calculatePayroll(run.id)
                                }}
                                className="rounded-lg border border-cyan-400/20 bg-cyan-500/10 px-2.5 py-1.5 text-xs font-bold text-cyan-300 hover:bg-cyan-500/20 disabled:opacity-50"
                              >
                                Calculate
                              </button>
                            )}

                          {run.status === 'ready' &&
                            canApprovePayroll && (
                              <button
                                type="button"
                                disabled={busy}
                                onClick={(event) => {
                                  event.stopPropagation()
                                  void approvePayroll(run.id)
                                }}
                                className="rounded-lg border border-violet-400/20 bg-violet-500/10 px-2.5 py-1.5 text-xs font-bold text-violet-300 hover:bg-violet-500/20 disabled:opacity-50"
                              >
                                Approve
                              </button>
                            )}

                          {run.status === 'approved' && canSendPayroll && (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={(event) => {
                                event.stopPropagation()
                                void sendPayroll(run.id)
                              }}
                              className="rounded-lg bg-gradient-to-r from-fuchsia-600 to-violet-600 px-3 py-1.5 text-xs font-black text-white hover:brightness-110 disabled:opacity-50"
                            >
                              Send PayPal
                            </button>
                          )}

                          {[
                            'processing',
                            'paid',
                            'partially_paid',
                            'failed',
                          ].includes(run.status) &&
                            canSendPayroll && (
                              <button
                                type="button"
                                disabled={busy}
                                onClick={(event) => {
                                  event.stopPropagation()
                                  void refreshPayoutStatus(run.id)
                                }}
                                className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs font-bold text-slate-300 hover:bg-white/10 disabled:opacity-50"
                              >
                                Sync
                              </button>
                            )}

                          {['partially_paid', 'failed'].includes(
                            run.status,
                          ) &&
                            canSendPayroll && (
                              <button
                                type="button"
                                disabled={busy}
                                onClick={(event) => {
                                  event.stopPropagation()
                                  void retryFailedPayouts(run.id)
                                }}
                                className="rounded-lg border border-orange-400/20 bg-orange-500/10 px-2.5 py-1.5 text-xs font-bold text-orange-300 hover:bg-orange-500/20 disabled:opacity-50"
                              >
                                Retry failed
                              </button>
                            )}

                          {['draft', 'ready'].includes(run.status) &&
                            canEditPayroll && (
                              <button
                                type="button"
                                disabled={busy}
                                onClick={(event) => {
                                  event.stopPropagation()
                                  void cancelDraftRun(run.id)
                                }}
                                className="rounded-lg border border-red-400/20 bg-red-500/10 px-2.5 py-1.5 text-xs font-bold text-red-300 hover:bg-red-500/20 disabled:opacity-50"
                              >
                                Cancel
                              </button>
                            )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {selectedRun && (
            <div className="mt-4 grid gap-3 rounded-xl border border-white/5 bg-white/[0.025] p-4 text-xs text-slate-400 md:grid-cols-2 xl:grid-cols-4">
              <div>
                <span className="block text-slate-600">Created</span>
                {timestampLabel(selectedRun.created_at)}
              </div>

              <div>
                <span className="block text-slate-600">Approved</span>
                {timestampLabel(selectedRun.approved_at)}
              </div>

              <div>
                <span className="block text-slate-600">Submitted</span>
                {timestampLabel(selectedRun.submitted_at)}
              </div>

              <div>
                <span className="block text-slate-600">
                  PayPal batch ID
                </span>
                <span className="break-all">
                  {selectedRun.paypal_batch_id || 'Not submitted'}
                </span>
              </div>
            </div>
          )}
        </section>
      )}

      <section className="rounded-2xl border border-white/10 bg-black/30 p-5">
        <div className="flex flex-col justify-between gap-2 md:flex-row md:items-center">
          <div>
            <h2 className="text-lg font-black text-white">
              {isMgmt ? 'Employee pay statements' : 'My pay statements'}
            </h2>

            <p className="text-sm text-slate-500">
              {selectedRun
                ? `${dateLabel(selectedRun.period_start)} through ${dateLabel(selectedRun.period_end)}`
                : 'All available pay periods'}
            </p>
          </div>

          {isMgmt && selectedRun && (
            <StatusBadge status={selectedRun.status} />
          )}
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[1100px] text-sm">
            <thead className="text-xs uppercase tracking-wide text-slate-500">
              <tr className="border-b border-white/10">
                {isMgmt && (
                  <th className="px-3 py-3 text-left">Employee</th>
                )}
                <th className="px-3 py-3 text-left">Period</th>
                <th className="px-3 py-3 text-right">Hours</th>
                <th className="px-3 py-3 text-right">Gross</th>
                <th className="px-3 py-3 text-right">Taxes</th>
                <th className="px-3 py-3 text-right">Deductions</th>
                <th className="px-3 py-3 text-right">Net</th>
                <th className="px-3 py-3 text-left">Payout</th>
                <th className="px-3 py-3 text-right">Statement</th>
              </tr>
            </thead>

            <tbody>
              {visibleStubs.length === 0 && (
                <tr>
                  <td
                    colSpan={isMgmt ? 9 : 8}
                    className="px-3 py-10 text-center text-slate-500"
                  >
                    No pay statements are available.
                  </td>
                </tr>
              )}

              {visibleStubs.map((stub) => {
                const taxes =
                  Number(stub.federal_tax || 0) +
                  Number(stub.state_tax || 0) +
                  Number(stub.local_tax || 0) +
                  Number(
                    stub.social_security_tax || stub.fica || 0,
                  ) +
                  Number(stub.medicare || 0)

                const hours =
                  Number(stub.regular_hours ?? stub.hours ?? 0) +
                  Number(stub.overtime_hours || 0)

                return (
                  <tr
                    key={stub.id}
                    className="border-b border-white/5 hover:bg-white/[0.025]"
                  >
                    {isMgmt && (
                      <td className="px-3 py-3">
                        <div className="font-bold text-slate-200">
                          {stub.user?.full_name ||
                            stub.user?.username ||
                            stub.user_id}
                        </div>
                        <div className="text-xs text-slate-600">
                          {stub.paypal_email ||
                            stub.user?.email ||
                            'No PayPal email'}
                        </div>
                      </td>
                    )}

                    <td className="px-3 py-3 text-slate-400">
                      {dateLabel(stub.pay_period_start)} –{' '}
                      {dateLabel(stub.pay_period_end)}
                    </td>

                    <td className="px-3 py-3 text-right text-slate-300">
                      {hours.toFixed(2)}
                    </td>

                    <td className="px-3 py-3 text-right text-slate-200">
                      {money(stub.gross_pay)}
                    </td>

                    <td className="px-3 py-3 text-right text-red-300">
                      {money(taxes)}
                    </td>

                    <td className="px-3 py-3 text-right text-orange-300">
                      {money(stub.other_deductions)}
                    </td>

                    <td className="px-3 py-3 text-right font-black text-emerald-300">
                      {money(stub.net_pay)}
                    </td>

                    <td className="px-3 py-3">
                      <StatusBadge status={stub.payout_status} />

                      {stub.payment_error && (
                        <p
                          className="mt-1 max-w-[260px] truncate text-xs text-red-300"
                          title={stub.payment_error}
                        >
                          {stub.payment_error}
                        </p>
                      )}
                    </td>

                    <td className="px-3 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => downloadStub(stub)}
                        className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs font-bold text-slate-200 hover:bg-white/10"
                      >
                        <Download className="h-3.5 w-3.5" />
                        PDF
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>

      {isMgmt && (
        <section className="rounded-2xl border border-amber-400/20 bg-amber-500/5 p-4">
          <div className="flex items-start gap-3">
            <Clock3 className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" />

            <div>
              <h3 className="font-bold text-amber-200">
                Payroll control requirements
              </h3>

              <p className="mt-1 text-sm leading-6 text-amber-100/70">
                Payroll calculation, approval, tax records, and PayPal
                submission must be completed by protected server-side
                functions. The browser should never receive PayPal secrets or
                be allowed to mark a payout paid without verified PayPal
                status.
              </p>
            </div>
          </div>
        </section>
      )}
    </div>
  )
}