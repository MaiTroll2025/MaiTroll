import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { format, startOfMonth, startOfWeek, addDays, addMonths, subMonths, isSameMonth, isSameDay, isToday } from 'date-fns'
import {
  Mail,
  Send,
  Inbox,
  Star,
  Calendar,
  Users,
  Plus,
  RefreshCw,
  X,
  Bell,
  AlertCircle,
  Reply,
  ChevronLeft,
  ChevronRight,
  Clock,
  FileText,
  Folder,
  CheckCircle2,
  UserCheck,
  Eye,
  ShieldCheck,
  Loader2,
  Trash2,
} from 'lucide-react'
import { toast } from 'sonner'

import { useAuthStore } from '@/lib/store'
import { supabase } from '@/lib/supabase'
import {
  createTromailAccount,
  getUserTromailAccount,
  canAccessTromail,
  canSendAdminEmail,
  sendTromailMessage,
  createTromailCalendarEvent,
  scheduleTeamMeeting,
} from '@/lib/tromail'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'

type TromailTab =
  | 'inbox'
  | 'sent'
  | 'important'
  | 'admin'
  | 'calendar'
  | 'meetings'
  | 'directory'
  | 'compose'
  | 'contracts'
  | 'file-cabinet'

interface TromailAccount {
  id: string
  user_id: string
  role: string
  display_name: string | null
  email_address: string
  is_active: boolean
  created_at?: string
  updated_at?: string
}

interface TromailMessage {
  id: string
  message_id?: string
  recipient_id?: string
  sender_user_id: string
  sender_role: string
  sender_tromail_address: string
  subject: string
  body: string
  is_admin_email: boolean
  is_important: boolean
  related_meeting_id: string | null
  created_at: string
  read_at?: string | null
  sender_username?: string
  tromail_messages?: any
}

interface StaffMeeting {
  id: string
  title: string
  description?: string | null
  room_name: string
  status: 'scheduled' | 'live' | 'ended' | 'cancelled'
  max_participants: number
  created_by: string
  scheduled_at: string
  started_at?: string | null
  ended_at?: string | null
  created_at: string
}

interface ContractTemplate {
  id: string
  role_key: string
  role_label: string
  title: string
  body_template: string
  is_active: boolean
  created_at?: string
}

interface FileCabinetDocument {
  id: string
  document_type_id?: string | null
  document_type_slug: string
  title: string
  status: string
  submitted_by?: string | null
  created_at: string
  version?: number | null
  storage_path?: string | null
  pdf_path?: string | null
  metadata?: Record<string, any>
}

interface TromailContract {
  id: string
  template_id: string
  recipient_user_id: string
  recipient_tromail_address: string
  role_key: string
  role_label: string
  title: string
  body: string
  status: string
  sent_by: string
  sent_at?: string | null
  viewed_at?: string | null
  signed_at?: string | null
  created_at: string
}

const tabs: Array<{ id: TromailTab; label: string; icon: any }> = [
  { id: 'inbox', label: 'Inbox', icon: Inbox },
  { id: 'sent', label: 'Sent', icon: Send },
  { id: 'important', label: 'Important', icon: Star },
  { id: 'admin', label: 'Admin Emails', icon: Bell },
  { id: 'calendar', label: 'Calendar', icon: Calendar },
  { id: 'meetings', label: 'Team Meetings', icon: Users },
  { id: 'directory', label: 'Role Directory', icon: Users },
  { id: 'contracts', label: 'Contracts', icon: FileText },
  { id: 'file-cabinet', label: 'File Cabinet', icon: Folder },
]

const panelClass = 'rounded-2xl border border-cyan-500/20 bg-slate-900/60 shadow-[0_0_35px_rgba(34,211,238,0.08)]'
const inputClass = 'border-cyan-500/30 bg-slate-950/80 text-white placeholder:text-slate-500'
const ghostButtonClass = 'text-slate-300 hover:bg-white/10 hover:text-white'

function normalizeRole(role?: string | null) {
  return String(role || '').trim().toLowerCase()
}

function roleLabel(role?: string | null) {
  return String(role || 'user')
    .replace(/_/g, ' ')
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

function normalizeMessage(row: any): TromailMessage {
  const nested = row?.tromail_messages

  if (nested) {
    return {
      id: row.id,
      message_id: row.message_id || nested.id,
      recipient_id: row.recipient_user_id,
      sender_user_id: nested.sender_user_id,
      sender_role: nested.sender_role,
      sender_tromail_address: nested.sender_tromail_address,
      subject: nested.subject,
      body: nested.body,
      is_admin_email: nested.is_admin_email,
      is_important: nested.is_important,
      related_meeting_id: nested.related_meeting_id,
      created_at: nested.created_at,
      read_at: row.read_at,
      tromail_messages: nested,
    }
  }

  return row as TromailMessage
}

function buildContractBody(template: ContractTemplate, recipient: TromailAccount | null, custom: {
  startDate: string
  payTerms: string
  duties: string
  confidentiality: string
  platformRules: string
  payoutNotes: string
  customNotes: string
}) {
  let body = template.body_template || ''

  const replacements: Record<string, string> = {
    '{{user_name}}': recipient?.display_name || roleLabel(recipient?.role) || 'User',
    '{{tromail_address}}': recipient?.email_address || '',
    '{{role_label}}': template.role_label || roleLabel(template.role_key),
    '{{start_date}}': custom.startDate || '',
    '{{pay_terms}}': custom.payTerms || '',
    '{{admin_name}}': 'MaiTroll Administration',
    '{{company_name}}': 'MaiTroll / MAI Corp',
    '{{date}}': new Date().toLocaleDateString(),
    '{{duties_responsibilities}}': custom.duties || '',
    '{{confidentiality_clause}}': custom.confidentiality || '',
    '{{platform_rules}}': custom.platformRules || '',
    '{{payout_method_notes}}': custom.payoutNotes || '',
    '{{custom_notes}}': custom.customNotes || '',
  }

  Object.entries(replacements).forEach(([key, value]) => {
    body = body.replaceAll(key, value)
  })

  return body
}

export default function TromailPage() {
  const { user, profile } = useAuthStore()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const [activeTab, setActiveTab] = useState<TromailTab>('inbox')
  const [messages, setMessages] = useState<TromailMessage[]>([])
  const [selectedMessageIds, setSelectedMessageIds] = useState<Set<string>>(new Set())
  const [isSelectingMessages, setIsSelectingMessages] = useState(false)
  const [directory, setDirectory] = useState<TromailAccount[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const [hasTromailAccount, setHasTromailAccount] = useState(false)
  const [isCheckingTromailAccount, setIsCheckingTromailAccount] = useState(false)
  const [currentAccount, setCurrentAccount] = useState<TromailAccount | null>(null)
  const [displayName, setDisplayName] = useState(profile?.full_name || profile?.username || '')
  const [isCreatingAccount, setIsCreatingAccount] = useState(false)

  const [recipients, setRecipients] = useState<string[]>([])
  const [recipientInput, setRecipientInput] = useState('')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [isImportant, setIsImportant] = useState(false)
  const [isAdminEmail, setIsAdminEmail] = useState(false)
  const [isSending, setIsSending] = useState(false)

  const [meetings, setMeetings] = useState<StaffMeeting[]>([])
  const [calendarMonth, setCalendarMonth] = useState(new Date())
  const [showMeetingModal, setShowMeetingModal] = useState(false)
  const [isSchedulingMeeting, setIsSchedulingMeeting] = useState(false)
  const [newMeetingTitle, setNewMeetingTitle] = useState('')
  const [newMeetingDescription, setNewMeetingDescription] = useState('')
  const [newMeetingDate, setNewMeetingDate] = useState('')
  const [newMeetingTime, setNewMeetingTime] = useState('12:00')
  const [meetingRecipientIds, setMeetingRecipientIds] = useState<string[]>([])

  const [contractTemplates, setContractTemplates] = useState<ContractTemplate[]>([])
  const [contracts, setContracts] = useState<TromailContract[]>([])
  const [selectedTemplateId, setSelectedTemplateId] = useState('')
  const [selectedContractRecipientId, setSelectedContractRecipientId] = useState('')
  const [contractStartDate, setContractStartDate] = useState('')
  const [contractPayTerms, setContractPayTerms] = useState('')
  const [contractDuties, setContractDuties] = useState('')
  const [contractConfidentiality, setContractConfidentiality] = useState('')
  const [contractPlatformRules, setContractPlatformRules] = useState('')
  const [contractPayoutNotes, setContractPayoutNotes] = useState('')
  const [contractCustomNotes, setContractCustomNotes] = useState('')
  const [isCreatingContract, setIsCreatingContract] = useState(false)

  const [fileCabinetDocuments, setFileCabinetDocuments] = useState<FileCabinetDocument[]>([])
  const [isFileCabinetLoading, setIsFileCabinetLoading] = useState(false)

  const messageIdFromUrl = searchParams.get('messageId') || searchParams.get('open')

  const profileRole = normalizeRole(profile?.role || profile?.troll_role || 'user')

  const selectedContractRecipient = useMemo(() => {
    return directory.find((account) => account.user_id === selectedContractRecipientId) || null
  }, [directory, selectedContractRecipientId])

  const selectedTemplate = useMemo(() => {
    return contractTemplates.find((template) => template.id === selectedTemplateId) || null
  }, [contractTemplates, selectedTemplateId])

  const meetingCanSubmit = Boolean(
    user?.id &&
      newMeetingTitle.trim() &&
      newMeetingDate &&
      newMeetingTime &&
      meetingRecipientIds.length > 0,
  )

  const contractCanSubmit = Boolean(
    user?.id &&
      selectedTemplate &&
      selectedContractRecipient &&
      selectedContractRecipient.user_id,
  )

  const checkTromailAccount = useCallback(async () => {
    if (!user?.id) return

    setIsCheckingTromailAccount(true)

    try {
      const account = await getUserTromailAccount(user.id)
      setCurrentAccount(account as TromailAccount | null)
      setHasTromailAccount(Boolean(account))
    } finally {
      setIsCheckingTromailAccount(false)
    }
  }, [user?.id])

  const fetchDirectory = useCallback(async () => {
    const { data, error } = await supabase
      .from('tromail_accounts')
      .select('id, user_id, role, display_name, email_address, is_active, created_at, updated_at')
      .eq('is_active', true)
      .order('role', { ascending: true })
      .order('display_name', { ascending: true })

    if (error) throw error

    setDirectory((data || []) as TromailAccount[])
  }, [])

  const fetchMessages = useCallback(async () => {
    if (!user?.id || !hasTromailAccount) return
    if (!['inbox', 'sent', 'important', 'admin', 'directory'].includes(activeTab)) return

    setIsLoading(true)

    try {
      if (activeTab === 'directory') {
        await fetchDirectory()
        setMessages([])
        return
      }

      let result: any[] = []

      if (activeTab === 'inbox') {
        const { data, error } = await supabase.rpc('get_tromail_inbox', { p_user_id: user.id })
        if (error) throw error
        result = data || []
      }

      if (activeTab === 'sent') {
        const { data, error } = await supabase.rpc('get_tromail_sent', { p_user_id: user.id })
        if (error) throw error
        result = data || []
      }

      if (activeTab === 'important') {
        const { data, error } = await supabase.rpc('get_tromail_important', { p_user_id: user.id })
        if (error) throw error
        result = data || []
      }

      if (activeTab === 'admin') {
        const { data, error } = await supabase.rpc('get_tromail_admin', { p_user_id: user.id })
        if (error) throw error
        result = data || []
      }

      setMessages(result.map(normalizeMessage))
    } catch (err: any) {
      console.error('[TromailPage] Error fetching messages:', err)
      toast.error(err?.message || 'Failed to load Tromail data.')
    } finally {
      setIsLoading(false)
    }
  }, [user?.id, hasTromailAccount, activeTab, fetchDirectory])

  const fetchMeetings = useCallback(async () => {
    if (!user?.id || !hasTromailAccount) return

    try {
      const { data, error } = await supabase
        .from('staff_meetings')
        .select('*')
        .in('status', ['scheduled', 'live'])
        .order('scheduled_at', { ascending: true })

      if (error) throw error

      setMeetings((data || []) as StaffMeeting[])
    } catch (err) {
      console.error('[TromailPage] Error fetching meetings:', err)
    }
  }, [user?.id, hasTromailAccount])

  const fetchContractTemplates = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('tromail_contract_templates')
        .select('*')
        .eq('is_active', true)
        .order('role_label', { ascending: true })

      if (error) throw error

      setContractTemplates((data || []) as ContractTemplate[])
    } catch (err: any) {
      console.error('[TromailPage] Error fetching contract templates:', err)
      toast.error(err?.message || 'Failed to load contract templates.')
    }
  }, [])

  const fetchContracts = useCallback(async () => {
    if (!user?.id) return

    try {
      const { data, error } = await supabase
        .from('tromail_contracts')
        .select('*')
        .or(`sent_by.eq.${user.id},recipient_user_id.eq.${user.id}`)
        .order('created_at', { ascending: false })

      if (error) throw error

      setContracts((data || []) as TromailContract[])
    } catch (err: any) {
      console.error('[TromailPage] Error fetching contracts:', err)
    }
  }, [user?.id])

  const fetchFileCabinetDocuments = useCallback(async () => {
    setIsFileCabinetLoading(true)

    try {
      const { data, error } = await supabase
        .from('documents')
        .select('id, document_type_id, document_type_slug, title, status, submitted_by, created_at, version, storage_path, pdf_path, metadata')
        .order('created_at', { ascending: false })

      if (error) throw error

      setFileCabinetDocuments((data || []) as FileCabinetDocument[])
    } catch (err: any) {
      console.error('[TromailPage] Error fetching file cabinet documents:', err)
      toast.error(err?.message || 'Failed to load file cabinet documents.')
    } finally {
      setIsFileCabinetLoading(false)
    }
  }, [])

  useEffect(() => {
    if (user && profile && !canAccessTromail(profile)) {
      toast.error('Access denied. Tromail requires an approved Mai Troll role.')
      navigate('/')
      return
    }

    if (user && profile) {
      checkTromailAccount()
    }
  }, [user, profile, navigate, checkTromailAccount])

  useEffect(() => {
    if (hasTromailAccount) {
      fetchDirectory().catch((err) => {
        console.error('[TromailPage] Directory preload failed:', err)
      })
    }
  }, [hasTromailAccount, fetchDirectory])

  useEffect(() => {
    fetchMessages()
  }, [fetchMessages])

  useEffect(() => {
    setSelectedMessageIds(new Set())
    setIsSelectingMessages(false)
  }, [activeTab])

  useEffect(() => {
    fetchMeetings()
  }, [fetchMeetings])

  useEffect(() => {
    if (activeTab === 'contracts') {
      fetchContractTemplates()
      fetchContracts()
      fetchDirectory()
    }
  }, [activeTab, fetchContractTemplates, fetchContracts, fetchDirectory])

  useEffect(() => {
    if (activeTab === 'file-cabinet') {
      fetchFileCabinetDocuments()
    }
  }, [activeTab, fetchFileCabinetDocuments])

  useEffect(() => {
    if (!messageIdFromUrl || !hasTromailAccount || !user?.id) return

    const openMessage = async () => {
      try {
        const { data, error } = await supabase
          .from('tromail_recipients')
          .select(`
            id,
            message_id,
            read_at,
            tromail_messages!inner(
              id,
              sender_user_id,
              sender_role,
              sender_tromail_address,
              subject,
              body,
              is_admin_email,
              is_important,
              related_meeting_id,
              created_at
            )
          `)
          .eq('message_id', messageIdFromUrl)
          .eq('recipient_user_id', user.id)
          .maybeSingle()

        if (error) throw error

        if (data) {
          setActiveTab('inbox')
          setMessages([normalizeMessage(data)])
        }
      } catch (err) {
        console.error('[TromailPage] Error opening URL message:', err)
      }
    }

    openMessage()
  }, [messageIdFromUrl, hasTromailAccount, user?.id])

  const handleCreateAccount = async () => {
    if (!user?.id || !profile) return

    setIsCreatingAccount(true)

    try {
      const role = profile.role || profile.troll_role || 'user'
      const result = await createTromailAccount(user.id, role, displayName || profile.username || roleLabel(role))

      if (!result.success) {
        throw new Error(result.error || 'Failed to create Tromail account.')
      }

      toast.success('Tromail account created.')
      await checkTromailAccount()
    } catch (err: any) {
      toast.error(err?.message || 'Failed to create Tromail account.')
    } finally {
      setIsCreatingAccount(false)
    }
  }

  const addRecipientEmail = (email: string) => {
    const clean = email.trim()
    if (!clean) return

    if (!recipients.includes(clean)) {
      setRecipients((prev) => [...prev, clean])
    }

    setRecipientInput('')
  }

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!user?.id || !profile) return

    if (recipients.length === 0 || !subject.trim() || !body.trim()) {
      toast.error('Add recipient, subject, and message body.')
      return
    }

    setIsSending(true)

    try {
      const { data: recipientAccounts, error: recipientError } = await supabase
        .from('tromail_accounts')
        .select('user_id, role, email_address')
        .in('email_address', recipients)
        .eq('is_active', true)

      if (recipientError) throw recipientError

      const validRecipients = recipientAccounts || []

      if (validRecipients.length === 0) {
        toast.error('No valid Tromail recipients found.')
        return
      }

      const senderAccount = currentAccount || (await getUserTromailAccount(user.id) as TromailAccount | null)

      if (!senderAccount) {
        toast.error('Sender Tromail account not found.')
        return
      }

      const result = await sendTromailMessage({
        sender_user_id: user.id,
        sender_role: profileRole,
        sender_tromail_address: senderAccount.email_address,
        subject: subject.trim(),
        body: body.trim(),
        is_admin_email: isAdminEmail,
        is_important: isImportant,
        recipient_user_ids: validRecipients.map((recipient) => recipient.user_id),
        recipient_roles: validRecipients.map((recipient) => recipient.role),
      })

      if (!result.success) {
        throw new Error(result.error || 'Failed to send message.')
      }

      toast.success('Message sent.')
      setSubject('')
      setBody('')
      setRecipients([])
      setRecipientInput('')
      setIsImportant(false)
      setIsAdminEmail(false)
      setActiveTab('inbox')
      fetchMessages()
    } catch (err: any) {
      toast.error(err?.message || 'Failed to send message.')
    } finally {
      setIsSending(false)
    }
  }

  const handleCreateScheduleMeeting = async () => {
    if (!meetingCanSubmit || !user?.id) {
      toast.error('Add a title, date, time, and at least one recipient.')
      return
    }

    setIsSchedulingMeeting(true)

    try {
      const scheduledDateTime = `${newMeetingDate}T${newMeetingTime}:00`
      const selectedAccounts = directory.filter((account) => meetingRecipientIds.includes(account.user_id))

      const result = await scheduleTeamMeeting({
        title: newMeetingTitle.trim(),
        description: newMeetingDescription.trim() || undefined,
        scheduled_at: scheduledDateTime,
        created_by: user.id,
        created_by_role: profileRole,
        recipient_user_ids: selectedAccounts.map((account) => account.user_id),
        recipient_roles: selectedAccounts.map((account) => account.role),
        recipient_tromail_addresses: selectedAccounts.map((account) => account.email_address),
      })

      if (!result.success) {
        throw new Error(result.error || 'Failed to schedule meeting.')
      }

      toast.success(`Meeting "${newMeetingTitle}" scheduled. All recipients notified via Tromail.`)
      setNewMeetingTitle('')
      setNewMeetingDescription('')
      setNewMeetingDate('')
      setNewMeetingTime('12:00')
      setMeetingRecipientIds([])
      setShowMeetingModal(false)
      fetchMeetings()
    } catch (err: any) {
      toast.error(err?.message || 'Failed to schedule meeting.')
    } finally {
      setIsSchedulingMeeting(false)
    }
  }

  const handleCreateContract = async () => {
    if (!contractCanSubmit || !selectedTemplate || !selectedContractRecipient || !user?.id) {
      toast.error('Choose a contract template and recipient.')
      return
    }

    setIsCreatingContract(true)

    try {
      const contractBody = buildContractBody(selectedTemplate, selectedContractRecipient, {
        startDate: contractStartDate,
        payTerms: contractPayTerms,
        duties: contractDuties,
        confidentiality: contractConfidentiality,
        platformRules: contractPlatformRules,
        payoutNotes: contractPayoutNotes,
        customNotes: contractCustomNotes,
      })

      const { data: contract, error } = await supabase
        .from('tromail_contracts')
        .insert({
          template_id: selectedTemplate.id,
          recipient_user_id: selectedContractRecipient.user_id,
          recipient_tromail_address: selectedContractRecipient.email_address,
          role_key: selectedTemplate.role_key,
          role_label: selectedTemplate.role_label,
          title: selectedTemplate.title,
          body: contractBody,
          status: 'draft',
          sent_by: user.id,
        })
        .select()
        .single()

      if (error) throw error

      await supabase.from('contract_audit_events').insert({
        contract_id: contract.id,
        actor_user_id: user.id,
        event_type: 'contract_created',
        event_note: `Contract created for ${selectedContractRecipient.email_address}`,
      })

      toast.success('Contract draft created.')
      setSelectedTemplateId('')
      setSelectedContractRecipientId('')
      setContractStartDate('')
      setContractPayTerms('')
      setContractDuties('')
      setContractConfidentiality('')
      setContractPlatformRules('')
      setContractPayoutNotes('')
      setContractCustomNotes('')
      fetchContracts()
    } catch (err: any) {
      toast.error(err?.message || 'Failed to create contract.')
    } finally {
      setIsCreatingContract(false)
    }
  }

  const handleSendContract = async (contract: TromailContract) => {
    if (!user?.id) return

    try {
      const { error } = await supabase
        .from('tromail_contracts')
        .update({
          status: 'sent',
          sent_at: new Date().toISOString(),
        })
        .eq('id', contract.id)

      if (error) throw error

      const senderAccount = currentAccount || (await getUserTromailAccount(user.id) as TromailAccount | null)

      await sendTromailMessage({
        sender_user_id: user.id,
        sender_role: profileRole,
        sender_tromail_address: senderAccount?.email_address || 'admin@tromail.Mai Troll',
        subject: `Contract: ${contract.title}`,
        body: `You received a Mai Troll contract for ${contract.role_label}. Please review it in Tromail Contracts.`,
        is_admin_email: true,
        is_important: true,
        recipient_user_ids: [contract.recipient_user_id],
        recipient_roles: [contract.role_key],
      })

      await supabase.from('contract_audit_events').insert({
        contract_id: contract.id,
        actor_user_id: user.id,
        event_type: 'contract_sent',
        event_note: 'Contract sent through Tromail.',
      })

      toast.success('Contract sent.')
      fetchContracts()
    } catch (err: any) {
      toast.error(err?.message || 'Failed to send contract.')
    }
  }

  const openContractPdf = async (contract: TromailContract) => {
    try {
      await supabase
        .from('tromail_contracts')
        .update({ viewed_at: new Date().toISOString() })
        .eq('id', contract.id)

      const { jsPDF } = await import('jspdf')
      const doc = new jsPDF()

      doc.setFontSize(18)
      doc.text(doc.splitTextToSize(contract.title, 180), 14, 20)

      doc.setFontSize(10)
      const metadataLines = [
        `Role: ${contract.role_label}`,
        `Recipient: ${contract.recipient_tromail_address}`,
        `Status: ${contract.status}`,
        `Created: ${contract.created_at ? new Date(contract.created_at).toLocaleString() : ''}`,
      ]
      let y = 34
      metadataLines.forEach((line) => {
        doc.text(line, 14, y)
        y += 7
      })

      y += 8
      doc.line(14, y - 4, 196, y - 4)
      y += 14

      const bodyLines = doc.splitTextToSize(contract.body || '', 180)
      for (const line of bodyLines) {
        if (y > 275) {
          doc.addPage()
          y = 20
        }
        doc.text(line, 14, y)
        y += 7
      }

      const blob = doc.output('blob')
      const pdfUrl = URL.createObjectURL(blob)
      window.open(pdfUrl, '_blank', 'noopener,noreferrer')
      setTimeout(() => URL.revokeObjectURL(pdfUrl), 60000)
    } catch (err: any) {
      toast.error(err?.message || 'Failed to open contract PDF.')
    }
  }

  const toggleMessageSelection = (messageId: string) => {
    setSelectedMessageIds((prev) => {
      const next = new Set(prev)
      if (next.has(messageId)) {
        next.delete(messageId)
      } else {
        next.add(messageId)
      }
      return next
    })
  }

  const toggleAllMessages = () => {
    const ids = messages.map((message) => message.id)
    setSelectedMessageIds((prev) => {
      if (prev.size === ids.length && ids.every((id) => prev.has(id))) {
        return new Set()
      }
      return new Set(ids)
    })
  }

  const deleteTromailMessages = async (messageIds: string[]) => {
    if (messageIds.length === 0) return

    const confirmed = window.confirm(`Delete ${messageIds.length} message${messageIds.length === 1 ? '' : 's'}?`)
    if (!confirmed) return

    try {
      if (activeTab === 'sent') {
        const { error } = await supabase
          .from('tromail_messages')
          .update({ sender_deleted_at: new Date().toISOString() })
          .in('id', messageIds)

        if (error) throw error
      } else {
        const { error } = await supabase
          .from('tromail_recipients')
          .update({ deleted_at: new Date().toISOString() })
          .in('id', messageIds)

        if (error) throw error
      }

      toast.success('Messages deleted.')
      setSelectedMessageIds(new Set())
      setIsSelectingMessages(false)
      fetchMessages()
    } catch (err: any) {
      toast.error(err?.message || 'Failed to delete messages.')
    }
  }

  const deleteAllTromailMessages = () => {
    const ids = messages.map((message) => message.id)
    void deleteTromailMessages(ids)
  }

  const deleteSelectedTromailMessages = () => {
    void deleteTromailMessages(Array.from(selectedMessageIds))
  }

  const allMessagesSelected = messages.length > 0 && messages.every((message) => selectedMessageIds.has(message.id))

  const toggleMeetingRecipient = (account: TromailAccount) => {
    const realUserId = account.user_id

    if (!realUserId) {
      toast.error('This Tromail account is missing user_id.')
      return
    }

    setMeetingRecipientIds((prev) => {
      if (prev.includes(realUserId)) {
        return prev.filter((id) => id !== realUserId)
      }

      return [...prev, realUserId]
    })
  }

  if (!user || !profile) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0A0814] text-white">
        <Loader2 className="h-6 w-6 animate-spin text-cyan-400" />
      </div>
    )
  }

  if (isCheckingTromailAccount) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0A0814] text-white">
        <Loader2 className="h-6 w-6 animate-spin text-cyan-400" />
      </div>
    )
  }

  if (!hasTromailAccount) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.94 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md rounded-2xl border border-cyan-500/30 bg-slate-950 p-6 shadow-[0_0_50px_rgba(34,211,238,0.15)]"
        >
          <div className="mb-5 text-center">
            <Mail className="mx-auto mb-3 h-12 w-12 text-cyan-400" />
            <h2 className="text-xl font-bold text-white">Welcome to Tromail</h2>
            <p className="text-sm text-slate-400">Create your official Mai Troll role email.</p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-xs font-bold uppercase tracking-wide text-slate-400">Display Name</label>
              <Input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Your Tromail display name"
                className={`mt-1 ${inputClass}`}
              />
            </div>

            <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/10 p-3 text-xs text-cyan-100">
              Role detected: <span className="font-bold">{roleLabel(profileRole)}</span>
            </div>

            <Button
              onClick={handleCreateAccount}
              disabled={isCreatingAccount}
              className="w-full bg-cyan-600 hover:bg-cyan-500"
            >
              {isCreatingAccount ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Tromail Account'
              )}
            </Button>
          </div>
        </motion.div>
      </div>
    )
  }

  const renderCalendarGrid = () => (
    <div className={`${panelClass} p-4`}>
      <div className="mb-2 grid grid-cols-7 gap-1">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
          <div key={day} className="py-2 text-center text-xs font-semibold text-slate-400">
            {day}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: 42 }).map((_, i) => {
          const monthStart = startOfMonth(calendarMonth)
          const startDate = startOfWeek(monthStart)
          const day = addDays(startDate, i)
          const dayMeetings = meetings.filter((meeting) => isSameDay(new Date(meeting.scheduled_at), day))

          return (
            <div
              key={i}
              className={`min-h-24 rounded-xl border p-1.5 ${
                isSameMonth(day, calendarMonth)
                  ? 'border-cyan-500/20 bg-slate-950/50'
                  : 'border-slate-700/20 bg-slate-900/30'
              } ${isToday(day) ? 'border-cyan-300 shadow-[0_0_20px_rgba(34,211,238,0.16)]' : ''}`}
            >
              <div
                className={`mb-1 text-xs font-semibold ${
                  isSameMonth(day, calendarMonth) ? 'text-white' : 'text-slate-600'
                } ${isToday(day) ? 'text-cyan-300' : ''}`}
              >
                {format(day, 'd')}
              </div>

              <div className="space-y-1">
                {dayMeetings.slice(0, 2).map((meeting) => (
                  <button
                    key={meeting.id}
                    onClick={() => navigate(`/meeting/${meeting.id}`)}
                    className="block w-full truncate rounded bg-cyan-500/20 px-1 py-0.5 text-left text-[10px] text-cyan-200 hover:bg-cyan-500/30"
                  >
                    {format(new Date(meeting.scheduled_at), 'h:mm a')} {meeting.title}
                  </button>
                ))}

                {dayMeetings.length > 2 && (
                  <div className="text-[10px] text-slate-400">+{dayMeetings.length - 2} more</div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-[#0A0814] text-white">
      <div className="pointer-events-none fixed inset-0 opacity-80">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(34,211,238,0.16),transparent_35%),radial-gradient(circle_at_80%_20%,rgba(168,85,247,0.14),transparent_40%),radial-gradient(circle_at_50%_90%,rgba(236,72,153,0.09),transparent_35%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.035)_1px,transparent_1px)] bg-[size:42px_42px] opacity-20" />
      </div>

      <div className="relative mx-auto max-w-7xl p-4 md:p-8">
        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500 via-purple-600 to-pink-500 shadow-[0_0_25px_rgba(34,211,238,0.25)]">
              <Mail className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-white">Tromail</h1>
              <p className="text-xs text-cyan-300">{currentAccount?.email_address || 'MaiTroll internal mail'}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={() => fetchMessages()} variant="ghost" className={ghostButtonClass}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
            <Button onClick={() => setActiveTab('compose')} className="bg-gradient-to-r from-cyan-600 to-purple-600">
              <Plus className="mr-2 h-4 w-4" />
              Compose
            </Button>
            <Button onClick={() => navigate('/tromail/office')} variant="ghost" className="border border-cyan-500/20 text-cyan-200 hover:bg-cyan-500/20">
              <FileText className="mr-2 h-4 w-4" />
              Office
            </Button>
          </div>
        </div>

        <div className="mb-6 flex flex-wrap gap-2 border-b border-cyan-500/20 pb-4">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-all ${
                activeTab === tab.id
                  ? 'border border-cyan-400/30 bg-cyan-500/20 text-cyan-200 shadow-[0_0_20px_rgba(34,211,238,0.13)]'
                  : 'border border-white/5 bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white'
              }`}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'compose' && (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className={`${panelClass} p-6`}>
            <form onSubmit={handleSendMessage} className="space-y-4">
              <div>
                <label className="text-xs font-bold uppercase tracking-wide text-slate-400">To</label>
                <div className="mt-1 flex flex-wrap gap-2 rounded-xl border border-cyan-500/30 bg-slate-950/80 p-2">
                  {recipients.map((recipient) => (
                    <span key={recipient} className="flex items-center gap-1 rounded-lg bg-cyan-500/20 px-2 py-1 text-xs text-cyan-100">
                      {recipient}
                      <button type="button" onClick={() => setRecipients((prev) => prev.filter((item) => item !== recipient))}>
                        <X className="h-3 w-3 text-slate-300 hover:text-white" />
                      </button>
                    </span>
                  ))}

                  <input
                    value={recipientInput}
                    onChange={(e) => setRecipientInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && recipientInput.trim()) {
                        e.preventDefault()
                        addRecipientEmail(recipientInput)
                      }
                    }}
                    placeholder={recipients.length === 0 ? 'recipient@tromail.Mai Troll — press Enter' : ''}
                    className="min-w-[220px] flex-1 border-0 bg-transparent p-1 text-white outline-none placeholder:text-slate-500"
                  />
                </div>

                {directory.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {directory.slice(0, 8).map((account) => (
                      <button
                        key={account.id}
                        type="button"
                        onClick={() => addRecipientEmail(account.email_address)}
                        className="rounded-full border border-cyan-500/20 bg-cyan-500/10 px-2 py-1 text-xs text-cyan-200 hover:bg-cyan-500/20"
                      >
                        + {account.display_name || roleLabel(account.role)}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wide text-slate-400">Subject</label>
                <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Message subject" className={`mt-1 ${inputClass}`} />
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wide text-slate-400">Message</label>
                <Textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Type your Tromail..." rows={7} className={`mt-1 ${inputClass}`} />
              </div>

              <div className="flex flex-wrap gap-4">
                {canSendAdminEmail(profile) && (
                  <label className="flex items-center gap-2 text-sm text-slate-300">
                    <input type="checkbox" checked={isAdminEmail} onChange={(e) => setIsAdminEmail(e.target.checked)} />
                    Admin Email
                  </label>
                )}

                <label className="flex items-center gap-2 text-sm text-slate-300">
                  <input type="checkbox" checked={isImportant} onChange={(e) => setIsImportant(e.target.checked)} />
                  Mark Important
                </label>
              </div>

              <div className="flex gap-3">
                <Button type="submit" disabled={isSending} className="bg-cyan-600 hover:bg-cyan-500">
                  {isSending ? 'Sending...' : 'Send Tromail'}
                </Button>
                <Button type="button" variant="ghost" onClick={() => setActiveTab('inbox')} className={ghostButtonClass}>
                  Cancel
                </Button>
              </div>
            </form>
          </motion.div>
        )}

        {['inbox', 'sent', 'important', 'admin'].includes(activeTab) && (
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="ghost"
                onClick={() => {
                  setIsSelectingMessages((value) => !value)
                  setSelectedMessageIds(new Set())
                }}
                className={ghostButtonClass}
              >
                {isSelectingMessages ? 'Done' : 'Select'}
              </Button>
              {isSelectingMessages && (
                <>
                  <Button
                    variant="ghost"
                    onClick={toggleAllMessages}
                    disabled={messages.length === 0}
                    className={`${ghostButtonClass} disabled:opacity-40`}
                  >
                    {allMessagesSelected ? 'Unselect All' : 'Select All'}
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={deleteSelectedTromailMessages}
                    disabled={selectedMessageIds.size === 0}
                    className={`${ghostButtonClass} disabled:opacity-40`}
                  >
                    <Trash2 className="mr-1 h-4 w-4" />
                    Delete Selected
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={deleteAllTromailMessages}
                    disabled={messages.length === 0}
                    className={`${ghostButtonClass} text-red-300 hover:text-red-200 disabled:opacity-40`}
                  >
                    Delete All
                  </Button>
                  <span className="text-xs text-slate-400">{selectedMessageIds.size} selected</span>
                </>
              )}
            </div>

            {isLoading ? (
              <div className={`${panelClass} flex items-center justify-center py-12`}>
                <RefreshCw className="h-6 w-6 animate-spin text-cyan-400" />
              </div>
            ) : messages.length === 0 ? (
              <div className={`${panelClass} p-8 text-center`}>
                <Mail className="mx-auto mb-3 h-12 w-12 text-slate-600" />
                <p className="text-slate-400">No messages in {activeTab}.</p>
              </div>
            ) : (
              messages.map((msg) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className={`rounded-xl border bg-slate-900/60 p-4 hover:bg-slate-900/80 ${
                    selectedMessageIds.has(msg.id)
                      ? 'border-red-400/40 bg-red-500/10'
                      : msg.is_important
                        ? 'border-yellow-500/40 bg-yellow-500/5'
                        : 'border-cyan-500/20'
                  }`}
                  onClick={() => {
                    if (isSelectingMessages) {
                      toggleMessageSelection(msg.id)
                    }
                  }}
                >
                  <div className="flex items-start gap-3">
                    {isSelectingMessages && (
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation()
                          toggleMessageSelection(msg.id)
                        }}
                        className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border ${
                          selectedMessageIds.has(msg.id)
                            ? 'border-red-400 bg-red-500 text-white'
                            : 'border-white/20 text-transparent hover:border-white/50'
                        }`}
                      >
                        <CheckCircle2 className="h-4 w-4" />
                      </button>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-bold text-white">{msg.subject}</h3>
                        {msg.is_important && <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />}
                        {msg.is_admin_email && <Bell className="h-4 w-4 text-cyan-400" />}
                      </div>

                      <p className="text-xs text-slate-400">
                        From: {msg.sender_role || 'unknown'} — {msg.sender_username || msg.sender_tromail_address || 'unknown'}
                      </p>

                      <p className="mt-2 whitespace-pre-wrap text-sm text-slate-300">{msg.body}</p>
                      <p className="mt-2 text-xs text-slate-500">{msg.created_at ? new Date(msg.created_at).toLocaleString() : ''}</p>

                      <div className="mt-3">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setRecipients([msg.sender_tromail_address])
                            setSubject(`Re: ${msg.subject}`)
                            setBody(`\n\n-------- Original Message --------\nFrom: ${msg.sender_username || msg.sender_tromail_address}\n${msg.body}`)
                            setActiveTab('compose')
                          }}
                          className="h-8 px-2 text-xs text-cyan-300 hover:text-cyan-200"
                        >
                          <Reply className="mr-1 h-3 w-3" />
                          Reply
                        </Button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        )}

        {activeTab === 'calendar' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Button variant="ghost" size="sm" onClick={() => setCalendarMonth(subMonths(calendarMonth, 1))} className={ghostButtonClass}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <h2 className="text-xl font-bold">{format(calendarMonth, 'MMMM yyyy')}</h2>
                <Button variant="ghost" size="sm" onClick={() => setCalendarMonth(addMonths(calendarMonth, 1))} className={ghostButtonClass}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {renderCalendarGrid()}
          </div>
        )}

        {activeTab === 'meetings' && (
          <div className="space-y-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-3">
                <Button variant="ghost" size="sm" onClick={() => setCalendarMonth(subMonths(calendarMonth, 1))} className={ghostButtonClass}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <h2 className="text-xl font-bold">{format(calendarMonth, 'MMMM yyyy')}</h2>
                <Button variant="ghost" size="sm" onClick={() => setCalendarMonth(addMonths(calendarMonth, 1))} className={ghostButtonClass}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>

              <Button onClick={() => setShowMeetingModal(true)} className="bg-cyan-600 hover:bg-cyan-500">
                <Plus className="mr-2 h-4 w-4" />
                Schedule Meeting
              </Button>
            </div>

            {showMeetingModal && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
                <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-cyan-500/30 bg-slate-950 p-6">
                  <div className="mb-4 flex items-center justify-between">
                    <h3 className="text-lg font-bold">Schedule Team Meeting</h3>
                    <button onClick={() => setShowMeetingModal(false)} className="text-slate-400 hover:text-white">
                      <X className="h-5 w-5" />
                    </button>
                  </div>

                  <div className="space-y-4">
                    <Input value={newMeetingTitle} onChange={(e) => setNewMeetingTitle(e.target.value)} placeholder="Meeting title" className={inputClass} />
                    <Textarea value={newMeetingDescription} onChange={(e) => setNewMeetingDescription(e.target.value)} placeholder="Optional description" rows={3} className={inputClass} />

                    <div className="grid gap-4 md:grid-cols-2">
                      <Input type="date" value={newMeetingDate} onChange={(e) => setNewMeetingDate(e.target.value)} className={inputClass} />
                      <Input type="time" value={newMeetingTime} onChange={(e) => setNewMeetingTime(e.target.value)} className={inputClass} />
                    </div>

                    <div>
                      <div className="mb-2 flex items-center justify-between">
                        <label className="text-xs font-bold uppercase tracking-wide text-slate-400">Recipients</label>
                        <span className="text-xs text-cyan-300">{meetingRecipientIds.length} selected</span>
                      </div>

                      <div className="max-h-60 space-y-2 overflow-y-auto rounded-xl border border-cyan-500/20 bg-slate-900/50 p-2">
                        {directory.length === 0 ? (
                          <p className="p-3 text-sm text-slate-400">No Tromail users found.</p>
                        ) : (
                          directory.map((account) => {
                            const checked = meetingRecipientIds.includes(account.user_id)

                            return (
                              <button
                                key={account.id}
                                type="button"
                                onClick={() => toggleMeetingRecipient(account)}
                                className={`flex w-full items-center justify-between rounded-lg border p-3 text-left ${
                                  checked
                                    ? 'border-cyan-400/40 bg-cyan-500/20'
                                    : 'border-white/5 bg-white/5 hover:bg-white/10'
                                }`}
                              >
                                <div>
                                  <p className="font-semibold text-white">{account.display_name || roleLabel(account.role)}</p>
                                  <p className="text-xs text-slate-400">{account.email_address}</p>
                                </div>
                                {checked && <CheckCircle2 className="h-5 w-5 text-cyan-300" />}
                              </button>
                            )
                          })
                        )}
                      </div>
                    </div>

                    <div className="flex gap-3 pt-2">
                      <Button onClick={handleCreateScheduleMeeting} disabled={!meetingCanSubmit || isSchedulingMeeting} className="flex-1 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50">
                        {isSchedulingMeeting ? 'Scheduling...' : 'Schedule'}
                      </Button>
                      <Button variant="ghost" onClick={() => setShowMeetingModal(false)} className={ghostButtonClass}>
                        Cancel
                      </Button>
                    </div>

                    {!meetingCanSubmit && (
                      <p className="text-xs text-yellow-300">
                        Add title, date, time, and at least one recipient to enable Schedule.
                      </p>
                    )}
                  </div>
                </motion.div>
              </div>
            )}

            {renderCalendarGrid()}

            <div className={`${panelClass} p-4`}>
              <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-300">
                <Clock className="h-4 w-4" />
                Scheduled Meetings
              </h3>

              {meetings.length === 0 ? (
                <p className="py-4 text-center text-slate-500">No scheduled meetings.</p>
              ) : (
                <div className="space-y-2">
                  {meetings.map((meeting) => (
                    <div key={meeting.id} className="flex items-center justify-between rounded-xl border border-cyan-500/20 bg-slate-950/50 p-3">
                      <div>
                        <p className="font-bold text-white">{meeting.title}</p>
                        <p className="text-xs text-slate-400">{format(new Date(meeting.scheduled_at), 'PPPP p')}</p>
                      </div>
                      <Button size="sm" onClick={() => navigate(`/meeting/${meeting.id}`)} className="bg-cyan-600 hover:bg-cyan-500">
                        View
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'directory' && (
          <div className="space-y-3">
            {directory.length === 0 ? (
              <div className={`${panelClass} p-8 text-center`}>
                <Users className="mx-auto mb-3 h-12 w-12 text-slate-600" />
                <p className="text-slate-400">No users in directory.</p>
              </div>
            ) : (
              directory.map((account) => (
                <div key={account.id} className="rounded-xl border border-cyan-500/20 bg-slate-900/60 p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div className="flex items-center gap-3">
                      <UserCheck className="h-5 w-5 text-cyan-300" />
                      <div>
                        <p className="font-bold text-white">{account.display_name || roleLabel(account.role)}</p>
                        <p className="text-xs text-slate-400">{account.role} — {account.email_address}</p>
                      </div>
                    </div>

                    <Button
                      size="sm"
                      onClick={() => {
                        setRecipients([account.email_address])
                        setActiveTab('compose')
                      }}
                      className="bg-cyan-600 hover:bg-cyan-500"
                    >
                      Message
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'contracts' && (
          <div className="grid gap-4 lg:grid-cols-[420px_1fr]">
            <div className={`${panelClass} p-5`}>
              <h2 className="mb-4 flex items-center gap-2 text-lg font-bold">
                <FileText className="h-5 w-5 text-cyan-300" />
                Create Contract
              </h2>

              <div className="space-y-4">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wide text-slate-400">Template</label>
                  <select value={selectedTemplateId} onChange={(e) => setSelectedTemplateId(e.target.value)} className={`mt-1 w-full rounded-lg p-2 ${inputClass}`}>
                    <option value="">Select contract template</option>
                    {contractTemplates.map((template) => (
                      <option key={template.id} value={template.id}>
                        {template.role_label} — {template.title}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold uppercase tracking-wide text-slate-400">Recipient</label>
                  <select value={selectedContractRecipientId} onChange={(e) => setSelectedContractRecipientId(e.target.value)} className={`mt-1 w-full rounded-lg p-2 ${inputClass}`}>
                    <option value="">Select Tromail user</option>
                    {directory.map((account) => (
                      <option key={account.id} value={account.user_id}>
                        {account.display_name || roleLabel(account.role)} — {account.email_address}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <Input type="date" value={contractStartDate} onChange={(e) => setContractStartDate(e.target.value)} className={inputClass} />
                  <Input value={contractPayTerms} onChange={(e) => setContractPayTerms(e.target.value)} placeholder="Pay terms" className={inputClass} />
                </div>

                <Textarea value={contractDuties} onChange={(e) => setContractDuties(e.target.value)} placeholder="Duties / responsibilities" rows={3} className={inputClass} />
                <Textarea value={contractConfidentiality} onChange={(e) => setContractConfidentiality(e.target.value)} placeholder="Confidentiality clause" rows={2} className={inputClass} />
                <Textarea value={contractPlatformRules} onChange={(e) => setContractPlatformRules(e.target.value)} placeholder="Platform rules" rows={2} className={inputClass} />
                <Textarea value={contractPayoutNotes} onChange={(e) => setContractPayoutNotes(e.target.value)} placeholder="Treasury perk notes" rows={2} className={inputClass} />
                <Textarea value={contractCustomNotes} onChange={(e) => setContractCustomNotes(e.target.value)} placeholder="Custom notes" rows={2} className={inputClass} />

                <Button onClick={handleCreateContract} disabled={!contractCanSubmit || isCreatingContract} className="w-full bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50">
                  {isCreatingContract ? 'Creating...' : 'Create Draft Contract'}
                </Button>

                {contractTemplates.length === 0 && (
                  <p className="rounded-lg border border-yellow-500/20 bg-yellow-500/10 p-3 text-xs text-yellow-200">
                    No active templates found. Add rows to <strong>tromail_contract_templates</strong> with <strong>is_active = true</strong>.
                  </p>
                )}
              </div>
            </div>

            <div className={`${panelClass} p-5`}>
              <h2 className="mb-4 flex items-center gap-2 text-lg font-bold">
                <ShieldCheck className="h-5 w-5 text-purple-300" />
                Contracts
              </h2>

              {contracts.length === 0 ? (
                <p className="py-8 text-center text-slate-500">No contracts yet.</p>
              ) : (
                <div className="space-y-3">
                  {contracts.map((contract) => (
                    <div key={contract.id} className="rounded-xl border border-white/10 bg-slate-950/50 p-4">
                      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div>
                          <p className="font-bold text-white">{contract.title}</p>
                          <p className="text-xs text-slate-400">
                            {contract.role_label} • {contract.recipient_tromail_address}
                          </p>
                          <p className="mt-1 text-xs text-cyan-300">Status: {contract.status}</p>
                        </div>

                        <div className="flex gap-2">
                          {contract.status === 'draft' && (
                            <Button size="sm" onClick={() => handleSendContract(contract)} className="bg-cyan-600 hover:bg-cyan-500">
                              Send
                            </Button>
                          )}
                          <Button size="sm" variant="ghost" onClick={() => openContractPdf(contract)} className={ghostButtonClass}>
                            <Eye className="mr-1 h-4 w-4" />
                            View
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'file-cabinet' && (
          <div className={`${panelClass} p-5`}>
            <div className="flex items-start gap-3">
              <Folder className="mt-1 h-6 w-6 text-cyan-300" />
              <div className="flex-1">
                <h2 className="text-lg font-bold">File Cabinet</h2>
                <p className="mt-2 text-sm text-slate-400">
                  Role and staff documents for Tromail.
                </p>

                <div className="mt-4 flex items-center justify-between gap-3">
                  <p className="text-xs text-slate-400">
                    {fileCabinetDocuments.length} {fileCabinetDocuments.length === 1 ? 'document' : 'documents'} available
                  </p>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => void fetchFileCabinetDocuments()}
                    disabled={isFileCabinetLoading}
                    className={ghostButtonClass}
                  >
                    {isFileCabinetLoading ? 'Loading...' : 'Refresh'}
                  </Button>
                </div>

                {isFileCabinetLoading ? (
                  <div className="mt-5 flex items-center gap-2 text-sm text-slate-400">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading file cabinet...
                  </div>
                ) : fileCabinetDocuments.length === 0 ? (
                  <div className="mt-5 rounded-xl border border-white/10 bg-black/20 p-4 text-center text-sm text-slate-500">
                    No role or staff documents found.
                  </div>
                ) : (
                  <div className="mt-5 space-y-3">
                    {fileCabinetDocuments.map((document) => (
                      <div key={document.id} className="rounded-xl border border-white/10 bg-slate-950/50 p-4">
                        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                          <div>
                            <p className="font-bold text-white">{document.title || 'Untitled document'}</p>
                            <p className="mt-1 text-xs text-slate-400">
                              {roleLabel(document.document_type_slug)} • {roleLabel(document.status)} • Version {document.version || 1}
                            </p>
                            <p className="mt-1 text-[11px] text-white/35">
                              Submitted {document.created_at ? new Date(document.created_at).toLocaleString() : 'recently'}
                            </p>
                          </div>
                          {(document.pdf_path || document.storage_path) ? (
                            <a
                              href={document.pdf_path || document.storage_path || ''}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex h-9 items-center justify-center rounded-lg border border-cyan-300/25 bg-cyan-500/10 px-3 text-xs font-bold text-cyan-100 transition hover:bg-cyan-500/20"
                            >
                              Open file
                            </a>
                          ) : (
                            <span className="inline-flex h-9 items-center justify-center rounded-lg border border-white/10 px-3 text-xs font-bold text-white/40">
                              No file link
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}