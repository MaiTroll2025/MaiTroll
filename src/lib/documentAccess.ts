/**
 * Document access control, sensitivity classification, and PII masking helpers
 * for the Mai Troll employee Documents system.
 *
 * These helpers back the UI-level RBAC that mirrors (and never replaces) the
 * server-side RLS. RLS remains the real enforcement; this module guarantees the
 * UI never renders sensitive data (SSN, tax, banking, identity documents) to
 * viewers who are not admins.
 */

export type SensitiveLevel =
  | 'public'
  | 'employee_only'
  | 'sensitive'
  | 'admin_only'

/** Minimal profile shape used for access decisions. */
export interface AccessProfileLike {
  role?: string | null
  troll_role?: string | null
  is_admin?: boolean | null
  is_lead_officer?: boolean | null
  is_troll_officer?: boolean | null
  is_secretary?: boolean | null
  is_ceo_assistant?: boolean | null
  is_noah_assistant?: boolean | null
  is_pastor?: boolean | null
  [key: string]: unknown
}

const ADMIN_ROLES = new Set(['admin', 'superadmin', 'ceo', 'owner'])
const LEAD_ROLES = new Set(['lead_troll_officer'])
const SECRETARY_ROLES = new Set(['secretary'])

/**
 * Sensitivity classification per document_key.
 *
 * sensitive  -> contains admin-only data (SSN / tax / banking / identity).
 * employee_only -> non-sensitive employment docs (reviewable by lead/secretary).
 *
 * Both snake_case and the legacy mixed-case keys used by existing packets are
 * mapped so callers never fall through to an unknown default.
 */
export const DOCUMENT_SENSITIVITY: Record<string, SensitiveLevel> = {
  // --- sensitive (admin-only data inside) ---
  form_i9: 'sensitive', // contains SSN
  i9_identity_documents: 'sensitive', // identity documents
  form_w4: 'sensitive', // tax
  state_withholding: 'sensitive', // tax
  direct_deposit: 'sensitive', // banking

  // --- employee_only (non-sensitive, reviewable by lead/secretary) ---
  offer_letter: 'employee_only',
  emergency_contact: 'employee_only',
  handbook_acknowledgement: 'employee_only',
  code_of_conduct: 'employee_only',
  confidentiality: 'employee_only',
  confidentiality_nda: 'employee_only',
  acceptable_use: 'employee_only',
  harassment_policy: 'employee_only',
  anti_harassment: 'employee_only',
  background_authorization: 'employee_only',
  tc_enrollment: 'employee_only',
  TC_enrollment: 'employee_only',
  role_training: 'employee_only',
}

/** Resolve the sensitivity level for a document_key (defaults to employee_only). */
export function getDocumentSensitivity(documentKey?: string | null): SensitiveLevel {
  if (!documentKey) return 'employee_only'
  const direct = DOCUMENT_SENSITIVITY[documentKey]
  if (direct) return direct
  const lower = DOCUMENT_SENSITIVITY[documentKey.toLowerCase()]
  if (lower) return lower
  return 'employee_only'
}

export function isAdmin(profile?: AccessProfileLike | null): boolean {
  if (!profile) return false
  return (
    Boolean(profile.is_admin) ||
    ADMIN_ROLES.has((profile.role ?? '').toLowerCase()) ||
    (profile.troll_role ?? '').toLowerCase() === 'admin'
  )
}

/** Lead troll officer OR secretary — may review non-sensitive employment docs. */
export function isLeadOrSecretary(profile?: AccessProfileLike | null): boolean {
  if (!profile) return false
  return (
    Boolean(profile.is_lead_officer) ||
    LEAD_ROLES.has((profile.role ?? '').toLowerCase()) ||
    Boolean(profile.is_secretary) ||
    SECRETARY_ROLES.has((profile.role ?? '').toLowerCase())
  )
}

/**
 * Can this viewer see a document of the given sensitivity level?
 *
 * - Admins: everything.
 * - Lead / secretary: 'public' + 'employee_only' only. NEVER 'sensitive' or
 *   'admin_only'.
 * - Everyone else (e.g. the employee): the caller is responsible for scoping to
 *   the employee's OWN row; this function grants public/employee_only to them.
 */
export function canViewDocument(
  profile: AccessProfileLike | null | undefined,
  level: SensitiveLevel,
): boolean {
  if (isAdmin(profile)) return true

  if (level === 'admin_only' || level === 'sensitive') {
    // Only admins ever see sensitive/admin-only data.
    // (Employees see their OWN sensitive docs — the caller handles own-row
    // scoping and passes through this function only for non-owner viewers.)
    return false
  }

  // public + employee_only are visible to lead/secretary and to the employee.
  return true
}

/** True ONLY for admins. Gate every real sensitive-data render behind this. */
export function canViewSensitiveData(profile?: AccessProfileLike | null): boolean {
  return isAdmin(profile)
}

/**
 * Mask an SSN so only the last 4 digits remain, e.g. '*-*-1234'.
 * Returns '—' when the value is missing or too short to have a meaningful last4.
 */
export function maskSSN(value?: string | null): string {
  if (!value) return '—'
  const digits = String(value).replace(/\D/g, '')
  if (digits.length < 4) return '—'
  return `*-*-${digits.slice(-4)}`
}

/**
 * Mask a bank account (or routing) number showing only the last 4 digits,
 * e.g. '****1234'. Returns '—' when missing/too short.
 */
export function maskAccountNumber(value?: string | null): string {
  if (!value) return '—'
  const digits = String(value).replace(/\D/g, '')
  if (digits.length < 4) return '—'
  return `****${digits.slice(-4)}`
}
