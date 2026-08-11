// Contract Templates Types
export interface TromailContractTemplate {
  id: string
  role_key: string
  role_label: string
  title: string
  body_template: string
  required_fields: Record<string, any>
  is_active: boolean
  created_by: string | null
  created_at: string
  updated_at: string
}

// Contract Types
export interface TromailContract {
  id: string
  template_id: string | null
  recipient_user_id: string
  recipient_tromail_address: string
  role_key: string
  role_label: string
  title: string
  body: string
  status: 'draft' | 'sent' | 'viewed' | 'signed' | 'rejected' | 'expired' | 'voided'
  sent_by: string | null
  sent_at: string | null
  viewed_at: string | null
  signed_at: string | null
  signed_by_user_id: string | null
  signature_text: string | null
  legal_name: string | null
  pdf_document_id: string | null
  metadata: Record<string, any>
  created_at: string
  updated_at: string
}

// Organization Documents Types
export interface OrganizationDocument {
  id: string
  user_id: string
  uploaded_by: string | null
  document_type: 
    | 'contract_unsigned'
    | 'contract_signed'
    | 'id_verification'
    | 'tax_1099'
    | 'onboarding'
    | 'policy_acknowledgment'
    | 'admin_upload'
    | 'user_upload'
    | 'other'
  document_title: string
  file_url: string
  storage_path: string
  source: string
  related_contract_id: string | null
  visibility: 'admin_only' | 'user_and_admin'
  status: string
  metadata: Record<string, any>
  created_at: string
  updated_at: string
}

// Contract Audit Events Types
export interface ContractAuditEvent {
  id: string
  contract_id: string
  actor_user_id: string | null
  event_type: string
  event_note: string | null
  ip_address: string | null
  user_agent: string | null
  created_at: string
}

// Contract Form Types
export interface ContractFormData {
  recipient_user_id: string
  recipient_tromail_address?: string | null
  role_key: string
  pay_terms: string
  start_date: string
  contract_type: string
  expiration_date: string | null
  duties_responsibilities: string
  confidentiality_clause: string
  platform_rules: string
  payout_method_notes: string
  custom_notes: string
}

// Contract Preview Types
export interface ContractPreviewData {
  user_name: string
  tromail_address: string
  role_label: string
  start_date: string
  pay_terms: string
  admin_name: string
  company_name: string
  date: string
  duties_responsibilities: string
  confidentiality_clause: string
  platform_rules: string
  payout_method_notes: string
  custom_notes: string
}