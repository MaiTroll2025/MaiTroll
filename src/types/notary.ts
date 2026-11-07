// Notary & Document Management System Types

export interface DocumentType {
  id: string
  slug: string
  name: string
  description: string | null
  category: string
  template_content: string | null
  required_roles: string[]
  is_active: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

export interface NotaryDocument {
  id: string
  document_type_id: string | null
  document_type_slug: string
  title: string
  content: string
  status: 'draft' | 'pending' | 'approved' | 'rejected' | 'expired' | 'archived'
  priority: 'low' | 'normal' | 'high' | 'urgent'
  submitted_by: string | null
  submitted_at: string | null
  reviewed_by: string | null
  reviewed_at: string | null
  approved_by: string | null
  approved_at: string | null
  rejected_by: string | null
  rejected_at: string | null
  rejection_reason: string | null
  assigned_to: string | null
  assigned_at: string | null
  due_date: string | null
  tags: string[]
  metadata: Record<string, any>
  parent_document_id: string | null
  is_template: boolean
  template_id: string | null
  version: number
  storage_path: string | null
  pdf_path: string | null
  checksum: string | null
  is_locked: boolean
  created_at: string
  updated_at: string
}

export interface NotaryDocumentVersion {
  id: string
  document_id: string
  version: number
  content: string
  title: string
  changed_by: string | null
  change_summary: string | null
  checksum: string
  created_at: string
}

export interface DocumentSignature {
  id: string
  document_id: string
  user_id: string
  username: string
  legal_name: string
  typed_signature: string
  ip_address: string | null
  browser_user_agent: string | null
  signed_at: string
  agreement_version: number
  signature_hash: string
  document_type: string
  is_revoked: boolean
  revoked_at: string | null
  revocation_reason: string | null
  created_at: string
}

export interface DocumentApproval {
  id: string
  document_id: string
  approver_id: string
  approver_username: string
  approver_role: string
  approval_type: 'initial' | 'secondary' | 'final' | 'override'
  decision: 'approved' | 'rejected' | 'returned'
  comments: string | null
  required_role: string | null
  approval_order: number
  created_at: string
}

export interface DocumentStamp {
  id: string
  document_id: string
  approval_id: string | null
  stamp_id: string
  seal_text: string
  approver_id: string
  approver_username: string
  approver_role: string
  approval_date: string
  expiry_date: string | null
  stamp_hash: string
  verification_code: string
  ip_address: string | null
  is_valid: boolean
  document_checksum: string
  created_at: string
}

export interface DocumentAuditLog {
  id: string
  document_id: string
  actor_id: string | null
  actor_username: string
  actor_role: string | null
  action: string
  details: Record<string, any>
  ip_address: string | null
  user_agent: string | null
  created_at: string
}

export interface DocumentAccess {
  id: string
  document_id: string
  user_id: string
  access_level: 'view' | 'sign' | 'approve' | 'admin'
  granted_by: string | null
  granted_at: string
  expires_at: string | null
  is_active: boolean
}

export interface NotaryStats {
  total: number
  pending: number
  approved: number
  rejected: number
  draft: number
  byType: Record<string, number>
}

export type NotaryTab =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'archive'
  | 'user_search'
  | 'approval_logs'
  | 'payroll'
  | 'loans'
  | 'staff_apps'
  | 'my_documents'
  | 'create'
