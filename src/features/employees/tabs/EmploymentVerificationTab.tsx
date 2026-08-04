import React, { useEffect, useMemo, useState } from 'react'
import {
  BadgeCheck,
  Check,
  ChevronDown,
  Download,
  Loader2,
  Search,
  UserRound,
} from 'lucide-react'
import { jsPDF } from 'jspdf'
import { supabase } from '../../../lib/supabase'

/**
 * Assumptions:
 * - profiles: id, username
 * - employee_records: user_id, employee_number, legal_name, job_title,
 *   department, employment_status, start_date, pay_type, hourly_rate,
 *   annual_salary, approved_weekly_hours
 * - This page is protected by an admin/HR route and matching Supabase RLS.
 *
 * Install PDF support:
 *   npm install jspdf
 */

interface EmployeeRecordRow {
  user_id: string
  employee_number: string
  legal_name: string
  job_title: string
  department: string | null
  employment_status: string
  start_date: string
  pay_type: string | null
  hourly_rate: number | null
  annual_salary: number | null
  approved_weekly_hours: number | null
}

interface EmployeeOption extends EmployeeRecordRow {
  username: string
}

interface VerificationData {
  username: string
  employeeNumber: string
  legalName: string
  jobTitle: string
  department: string
  employmentStatus: string
  hireDate: string
  payRate: string
  approvedWeeklyHours: number
  generatedAt: string
}

const DEFAULT_APPROVED_WEEKLY_HOURS = 26

function formatDate(value: string) {
  const date = new Date(`${value}T00:00:00`)

  if (Number.isNaN(date.getTime())) return value

  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(date)
}

function formatStatus(value: string) {
  return value
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function formatPayRate(employee: EmployeeOption) {
  const money = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  })

  if (employee.pay_type === 'salary' && employee.annual_salary !== null) {
    return `${money.format(employee.annual_salary)} annually`
  }

  if (employee.hourly_rate !== null) {
    return `${money.format(employee.hourly_rate)} per hour`
  }

  if (employee.annual_salary !== null) {
    return `${money.format(employee.annual_salary)} annually`
  }

  return 'Not specified'
}

export default function EmploymentVerificationAdminPage() {
  const [employees, setEmployees] = useState<EmployeeOption[]>([])
  const [selectedUserId, setSelectedUserId] = useState('')
  const [search, setSearch] = useState('')
  const [dropdownOpen, setDropdownOpen] = useState(false)

  const [loading, setLoading] = useState(true)
  const [downloading, setDownloading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true

    const loadEmployees = async () => {
      setLoading(true)
      setError(null)

      try {
        const { data: employeeRows, error: employeeError } = await supabase
          .from('employee_records')
          .select(`
            user_id,
            employee_number,
            legal_name,
            job_title,
            department,
            employment_status,
            start_date,
            pay_type,
            hourly_rate,
            annual_salary,
            approved_weekly_hours
          `)
          .neq('employment_status', 'terminated')
          .order('legal_name')

        if (employeeError) throw employeeError

        const rows = (employeeRows ?? []) as EmployeeRecordRow[]
        const userIds = rows.map((row) => row.user_id)

        if (userIds.length === 0) {
          if (active) setEmployees([])
          return
        }

        const { data: profiles, error: profileError } = await supabase
          .from('profiles')
          .select('id, username')
          .in('id', userIds)

        if (profileError) throw profileError

        const usernameById = new Map(
          (profiles ?? []).map((profile) => [
            profile.id as string,
            (profile.username as string | null) || 'unknown-user',
          ])
        )

        const merged = rows.map((row) => ({
          ...row,
          username: usernameById.get(row.user_id) ?? 'unknown-user',
        }))

        if (active) setEmployees(merged)
      } catch (caught) {
        if (active) {
          setError(
            caught instanceof Error
              ? caught.message
              : 'Employees could not be loaded.'
          )
        }
      } finally {
        if (active) setLoading(false)
      }
    }

    void loadEmployees()

    return () => {
      active = false
    }
  }, [])

  const filteredEmployees = useMemo(() => {
    const term = search.trim().toLowerCase()

    if (!term) return employees

    return employees.filter((employee) => {
      return (
        employee.username.toLowerCase().startsWith(term) ||
        employee.legal_name.toLowerCase().includes(term) ||
        employee.employee_number.toLowerCase().includes(term)
      )
    })
  }, [employees, search])

  const selectedEmployee = useMemo(
    () => employees.find((employee) => employee.user_id === selectedUserId) ?? null,
    [employees, selectedUserId]
  )

  const verification = useMemo<VerificationData | null>(() => {
    if (!selectedEmployee) return null

    return {
      username: selectedEmployee.username,
      employeeNumber: selectedEmployee.employee_number,
      legalName: selectedEmployee.legal_name,
      jobTitle: selectedEmployee.job_title,
      department: selectedEmployee.department || 'Not assigned',
      employmentStatus: formatStatus(selectedEmployee.employment_status),
      hireDate: formatDate(selectedEmployee.start_date),
      payRate: formatPayRate(selectedEmployee),
      approvedWeeklyHours:
        selectedEmployee.approved_weekly_hours ??
        DEFAULT_APPROVED_WEEKLY_HOURS,
      generatedAt: new Intl.DateTimeFormat('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      }).format(new Date()),
    }
  }, [selectedEmployee])

  const selectEmployee = (employee: EmployeeOption) => {
    setSelectedUserId(employee.user_id)
    setSearch(employee.username)
    setDropdownOpen(false)
    setError(null)
  }

  const downloadPdf = async () => {
    if (!verification) return

    setDownloading(true)
    setError(null)

    try {
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'pt',
        format: 'letter',
      })

      const left = 54
      const right = 558
      let y = 62

      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(11)
      pdf.text('MAI CORP / Mai Troll', left, y)

      y += 28
      pdf.setFontSize(22)
      pdf.text('Employment Verification', left, y)

      y += 16
      pdf.setDrawColor(35)
      pdf.line(left, y, right, y)

      y += 34
      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(11)
      pdf.text(`Date: ${verification.generatedAt}`, left, y)

      y += 34
      pdf.text('To whom it may concern:', left, y)

      y += 28
      const intro =
        `This letter verifies the current employment information for ` +
        `${verification.legalName} (@${verification.username}), employee ` +
        `number ${verification.employeeNumber}, as maintained in the official ` +
        `Mai Troll employee records system.`

      const introLines = pdf.splitTextToSize(intro, right - left)
      pdf.text(introLines, left, y)
      y += introLines.length * 15 + 24

      const rows: Array<[string, string]> = [
        ['Employee name', verification.legalName],
        ['Username', `@${verification.username}`],
        ['Employee number', verification.employeeNumber],
        ['Job title', verification.jobTitle],
        ['Department', verification.department],
        ['Employment status', verification.employmentStatus],
        ['Hire date', verification.hireDate],
        ['Pay rate', verification.payRate],
        [
          'Hours approved to work',
          `${verification.approvedWeeklyHours} hours per week`,
        ],
      ]

      const labelWidth = 190
      const rowHeight = 34

      rows.forEach(([label, value]) => {
        pdf.setFillColor(242, 242, 242)
        pdf.rect(left, y, labelWidth, rowHeight, 'F')
        pdf.rect(left, y, right - left, rowHeight)

        pdf.setFont('helvetica', 'bold')
        pdf.text(label, left + 10, y + 21)

        pdf.setFont('helvetica', 'normal')
        pdf.text(value, left + labelWidth + 10, y + 21)

        y += rowHeight
      })

      y += 30
      const disclaimer =
        'This verification reflects the employee record as of the date above. ' +
        'It does not guarantee continued employment, future hours, or future compensation.'

      pdf.setFontSize(9)
      pdf.setTextColor(80)
      pdf.text(pdf.splitTextToSize(disclaimer, right - left), left, y)

      y += 58
      pdf.setTextColor(0)
      pdf.setFontSize(10)
      pdf.text('Human Resources', left, y)
      pdf.text('MAI Corp / Mai Troll', left, y + 16)

      const safeName = verification.legalName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')

      pdf.save(`employment-verification-${safeName}.pdf`)
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'The PDF could not be generated.'
      )
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-4xl space-y-5">
      <section className="rounded-2xl border border-white/10 bg-black/30 p-6">
        <div className="flex items-start gap-3">
          <BadgeCheck className="mt-1 h-7 w-7 text-cyan-300" />

          <div>
            <h1 className="text-2xl font-black text-white">
              Employee Verification
            </h1>
            <p className="mt-1 text-sm text-slate-400">
              Search by the first characters of a username, select an employee,
              verify the official record, and download a PDF.
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-black/30 p-6">
        <label className="block text-sm font-bold text-slate-200">
          Employee
        </label>

        <div className="relative mt-2">
          <div className="flex items-center rounded-xl border border-white/10 bg-black/40 focus-within:border-cyan-400/50">
            <Search className="ml-3 h-4 w-4 text-slate-500" />

            <input
              value={search}
              onFocus={() => setDropdownOpen(true)}
              onChange={(event) => {
                setSearch(event.target.value)
                setSelectedUserId('')
                setDropdownOpen(true)
              }}
              placeholder="Type the first few characters of a username"
              autoComplete="off"
              className="w-full bg-transparent px-3 py-3 text-sm text-white outline-none"
            />

            <button
              type="button"
              onClick={() => setDropdownOpen((open) => !open)}
              className="p-3 text-slate-400"
              aria-label="Toggle employee list"
            >
              <ChevronDown className="h-4 w-4" />
            </button>
          </div>

          {dropdownOpen && (
            <div className="absolute z-20 mt-2 max-h-72 w-full overflow-y-auto rounded-xl border border-white/10 bg-slate-950 p-1 shadow-2xl">
              {loading ? (
                <div className="flex items-center gap-2 p-3 text-sm text-slate-400">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading employees…
                </div>
              ) : filteredEmployees.length === 0 ? (
                <p className="p-3 text-sm text-slate-500">
                  No employee matches that search.
                </p>
              ) : (
                filteredEmployees.map((employee) => {
                  const selected = employee.user_id === selectedUserId

                  return (
                    <button
                      key={employee.user_id}
                      type="button"
                      onClick={() => selectEmployee(employee)}
                      className="flex w-full items-center justify-between rounded-lg px-3 py-3 text-left hover:bg-white/5"
                    >
                      <span className="flex items-center gap-3">
                        <UserRound className="h-4 w-4 text-cyan-300" />
                        <span>
                          <span className="block text-sm font-bold text-white">
                            @{employee.username}
                          </span>
                          <span className="block text-xs text-slate-500">
                            {employee.legal_name} · {employee.job_title}
                          </span>
                        </span>
                      </span>

                      {selected && <Check className="h-4 w-4 text-cyan-300" />}
                    </button>
                  )
                })
              )}
            </div>
          )}
        </div>

        {error && (
          <div className="mt-4 rounded-xl border border-red-400/20 bg-red-500/10 p-3 text-sm text-red-200">
            {error}
          </div>
        )}
      </section>

      {verification && (
        <section className="rounded-2xl border border-white/10 bg-black/30 p-6">
          <h2 className="text-lg font-black text-white">
            Verification preview
          </h2>

          <dl className="mt-4 grid gap-3 sm:grid-cols-2">
            <VerificationLine label="Employee" value={verification.legalName} />
            <VerificationLine
              label="Username"
              value={`@${verification.username}`}
            />
            <VerificationLine
              label="Hire date"
              value={verification.hireDate}
            />
            <VerificationLine label="Pay rate" value={verification.payRate} />
            <VerificationLine
              label="Hours approved"
              value={`${verification.approvedWeeklyHours} hours per week`}
            />
            <VerificationLine
              label="Status"
              value={verification.employmentStatus}
            />
          </dl>

          <button
            type="button"
            onClick={downloadPdf}
            disabled={downloading}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-500 px-4 py-3 text-sm font-black text-black transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {downloading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            {downloading ? 'Creating PDF…' : 'Download employee verification PDF'}
          </button>
        </section>
      )}
    </div>
  )
}

function VerificationLine({
  label,
  value,
}: {
  label: string
  value: React.ReactNode
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4">
      <dt className="text-xs font-bold uppercase tracking-wide text-slate-500">
        {label}
      </dt>
      <dd className="mt-1 text-sm font-semibold text-slate-100">{value}</dd>
    </div>
  )
}