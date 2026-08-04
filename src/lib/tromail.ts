// Tromail - Internal Role-Based Email System for Mai Troll

import { supabase } from './supabase'
import { createNotification } from './notifications'
import { UserRole } from './supabase'
import { 
  TromailContract, 
  TromailContractTemplate, 
  OrganizationDocument,
  ContractFormData,
  ContractPreviewData
} from '../types/contracts'

// Type definitions for Tromail
export interface TromailAccount {
  id: string
  user_id: string
  role: string
  display_name: string | null
  email_address: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface TromailMessage {
  id: string
  sender_user_id: string
  sender_role: string
  sender_tromail_address: string
  subject: string
  body: string
  is_admin_email: boolean
  is_important: boolean
  related_meeting_id: string | null
  created_at: string
  updated_at: string
}

export interface TromailRecipient {
  id: string
  message_id: string
  recipient_user_id: string
  recipient_role: string
  recipient_tromail_address: string
  read_at: string | null
  archived_at: string | null
  deleted_at: string | null
  is_starred: boolean
  created_at: string
}

export interface TromailCalendarEvent {
  id: string
  created_by_user_id: string
  created_by_role: string
  title: string
  description: string | null
  event_type: string
  starts_at: string
  ends_at: string | null
  meeting_id: string | null
  status: string
  created_at: string
  updated_at: string
}

export interface TromailCalendarEventRecipient {
  id: string
  calendar_event_id: string
  recipient_user_id: string
  recipient_role: string
  created_at: string
}

// Approved roles for Tromail access
export const TRMAIL_APPROVED_ROLES = [
  'auctioneer',
  'prosecutor',
  'attorney',
  'tcnn_news_caster',
  'secretary',
  'tcnn_chief_news_caster',
  'troll_officer',
  'journalist',
  'lead_troll_officer',
  'troller',
  'agency_hr_manager',
  'agency_hr',
  'agency_leader',
  'troll_family_leader',
  'ceo_assistant',
  'noah_assistant',
  'admin',
  'noah_admin',
  'ceo',
  UserRole.ADMIN,
  UserRole.SECRETARY,
  UserRole.AGENCY_HR_MANAGER,
  UserRole.HR_ADMIN,
  UserRole.LEAD_TROLL_OFFICER,
  UserRole.TROLL_OFFICER,
  'ceo',
  'lead_officer',
  'troll_officer',
  'officer'
]

// Check if user can access Tromail
export const canAccessTromail = (profile: any): boolean => {
  if (!profile) return false
  const role = profile.role || profile.troll_role
  return (
    profile?.is_admin ||
    role === 'admin' ||
    role === 'ceo' ||
    profile?.is_ceo ||
    role === 'secretary' ||
    profile?.is_secretary ||
    role === 'prosecutor' ||
    profile?.is_prosecutor ||
    role === 'attorney' ||
    profile?.is_attorney ||
    role === 'auctioneer' ||
    profile?.is_auctioneer ||
    role === 'troll_officer' ||
    profile?.is_troll_officer ||
    role === 'lead_troll_officer' ||
    profile?.is_lead_officer ||
    role === 'troller' ||
    profile?.is_troller ||
    role === 'agency_hr_manager' ||
    role === 'agency_hr' ||
    role === 'agency_leader' ||
    role === 'troll_family_leader' ||
    role === 'ceo_assistant' ||
    role === 'noah_assistant' ||
    role === 'noah_admin' ||
    role === 'journalist' ||
    role === 'tcnn_news_caster' ||
    role === 'tcnn_chief_news_caster' ||
    role === 'pastor' ||
    role === 'hr_manager' ||
    role === 'hr_admin' ||
    profile?.is_hr_manager ||
    profile?.is_hr_admin ||
    role === 'academy_teacher' ||
    role === 'academy_student' ||
    role === 'academy_director' ||
    role === 'admissions_officer'
  )
}

// Check if user can send admin emails
export const canSendAdminEmail = (profile: any): boolean => {
  if (!profile) return false
  const role = profile.role || profile.troll_role
  return (
    profile?.is_admin ||
    role === 'admin' ||
    role === 'ceo' ||
    profile?.is_ceo ||
    role === 'admin_assistant' ||
    role === 'ceo_assistant' ||
    role === 'secretary' ||
    profile?.is_secretary
  )
}

// Generate Tromail address from role and username
export const generateTromailAddress = (role: string, username: string): string => {
  // Convert role to address format
  const roleSlug = role.toLowerCase().replace(/_/g, '-')
  return `${roleSlug}@tromail.Mai Troll`
}

// Create Tromail account for a user
export const createTromailAccount = async (
  userId: string,
  role: string,
  displayName: string
): Promise<{ success: boolean; address?: string; error?: string }> => {
  try {
    // Get username for the address
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('username')
      .eq('id', userId)
      .single()

    const username = profile?.username || 'user'
    const address = generateTromailAddress(role, username)

// Check for duplicate
     const { data: existing } = await supabase
      .from('tromail_accounts')
      .select('id')
      .eq('email_address', address)
      .single()

    if (existing) {
      // Try with username suffix
      const altAddress = `${role.toLowerCase().replace(/_/g, '-')}.${username.toLowerCase()}@tromail.Mai Troll`
      return await supabase.from('tromail_accounts').insert({
        user_id: userId,
        role,
        display_name: displayName,
        email_address: altAddress,
        is_active: true,
      }).select().single().then(({ data, error }) => {
        if (error) throw error
        return { success: true, address: altAddress }
      })
    }

    const { data, error } = await supabase
      .from('tromail_accounts')
      .insert({
        user_id: userId,
        role,
        display_name: displayName,
        email_address: address,
        is_active: true,
      })
      .select()
      .single()

    if (error) throw error
    return { success: true, address }
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to create Tromail account' }
  }
}

// Get user's Tromail account
export const getUserTromailAccount = async (userId: string): Promise<TromailAccount | null> => {
  const { data, error } = await supabase
    .from('tromail_accounts')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true)
    .single()

  if (error || !data) return null
  return data as TromailAccount
}

// Send Tromail message
export const sendTromailMessage = async (params: {
  sender_user_id: string
  sender_role: string
  sender_tromail_address: string
  subject: string
  body: string
  is_admin_email?: boolean
  is_important?: boolean
  related_meeting_id?: string | null
  recipient_user_ids: string[]
  recipient_roles: string[]
}): Promise<{ success: boolean; message_id?: string; error?: string }> => {
  try {
    // Create the message
    const { data: message, error: messageError } = await supabase
      .from('tromail_messages')
      .insert({
        sender_user_id: params.sender_user_id,
        sender_role: params.sender_role,
        sender_tromail_address: params.sender_tromail_address,
        subject: params.subject,
        body: params.body,
        is_admin_email: params.is_admin_email || false,
        is_important: params.is_important || false,
        related_meeting_id: params.related_meeting_id || null,
      })
      .select()
      .single()

    if (messageError) throw messageError

    // Create recipients
    const recipients = params.recipient_user_ids.map((userId, index) => ({
      message_id: message.id,
      recipient_user_id: userId,
      recipient_role: params.recipient_roles[index] || params.sender_role,
      recipient_tromail_address: params.sender_tromail_address,
    }))

    const { error: recipientError } = await supabase
      .from('tromail_recipients')
      .insert(recipients)

    if (recipientError) throw recipientError

    // Send notifications
    for (const userId of params.recipient_user_ids) {
      await notifyTromailReceived(userId, params.subject, params.is_important || false)
    }

    return { success: true, message_id: message.id }
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to send Tromail message' }
  }
}

// Notify user of received Tromail
export const notifyTromailReceived = async (
  userId: string,
  subject: string,
  isImportant: boolean
): Promise<void> => {
  const prefix = isImportant ? 'Important Tromail received' : 'New Tromail'
  await createNotification(
    userId,
    'new_private_message',
    isImportant ? '📧 Important Tromail Received' : '📧 New Tromail',
    `${prefix}: ${subject.substring(0, 50)}${subject.length > 50 ? '...' : ''}`,
    { sender_username: 'Tromail System', action_url: '/tromail' }
  )
}

// Notify about team meeting scheduled via Tromail
export const notifyTeamMeetingScheduled = async (
  userIds: string[],
  meetingTitle: string,
  meetingId: string,
  scheduledTime: string
): Promise<void> => {
  for (const userId of userIds) {
    await createNotification(
      userId,
      'team_meeting_scheduled',
      '📅 Team Meeting Scheduled',
      `${meetingTitle} scheduled for ${new Date(scheduledTime).toLocaleString()}`,
      { meeting_id: meetingId, meeting_title: meetingTitle, action_url: `/meeting/${meetingId}` }
    )
  }
}

// Get inbox messages for a user
export const getTromailInbox = async (userId: string): Promise<TromailRecipient[]> => {
  const { data, error } = await supabase
    .from('tromail_recipients')
    .select(`
      id,
      message_id,
      recipient_user_id,
      recipient_role,
      recipient_tromail_address,
      read_at,
      archived_at,
      deleted_at,
      is_starred,
      created_at,
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
        created_at,
        updated_at
      )
    `)
    .eq('recipient_user_id', userId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data as any
}

// Get sent messages for a user
export const getTromailSent = async (userId: string): Promise<TromailMessage[]> => {
  const { data, error } = await supabase
    .from('tromail_messages')
    .select('*')
    .eq('sender_user_id', userId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data as TromailMessage[]
}

// Get important messages for a user
export const getTromailImportant = async (userId: string): Promise<TromailRecipient[]> => {
  const { data, error } = await supabase
    .from('tromail_recipients')
    .select(`
      id,
      message_id,
      recipient_user_id,
      recipient_role,
      recipient_tromail_address,
      read_at,
      archived_at,
      deleted_at,
      is_starred,
      created_at,
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
        created_at,
        updated_at
      )
    `)
    .eq('recipient_user_id', userId)
    .or('is_starred.eq.true,tromail_messages.is_important.eq.true')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data as any
}

// Get admin emails for a user
export const getTromailAdminEmails = async (userId: string): Promise<TromailRecipient[]> => {
  const { data, error } = await supabase
    .from('tromail_recipients')
    .select(`
      id,
      message_id,
      recipient_user_id,
      recipient_role,
      recipient_tromail_address,
      read_at,
      archived_at,
      deleted_at,
      is_starred,
      created_at,
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
        created_at,
        updated_at
      )
    `)
    .eq('recipient_user_id', userId)
    .eq('tromail_messages.is_admin_email', true)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data as any
}

// Get role directory (all Tromail users)
export const getTromailRoleDirectory = async (): Promise<TromailAccount[]> => {
  const { data, error } = await supabase
    .from('tromail_accounts')
    .select('*')
    .eq('is_active', true)
    .order('role', { ascending: true })

  if (error) throw error
  return data as TromailAccount[]
}

// Create Tromail calendar event
export const createTromailCalendarEvent = async (params: {
  created_by_user_id: string
  created_by_role: string
  title: string
  description?: string
  event_type?: string
  starts_at: string
  ends_at?: string
  meeting_id?: string
  recipient_user_ids: string[]
  recipient_roles: string[]
}): Promise<{ success: boolean; event_id?: string; error?: string }> => {
  try {
    // Create the event
    const { data: event, error: eventError } = await supabase
      .from('tromail_calendar_events')
      .insert({
        created_by_user_id: params.created_by_user_id,
        created_by_role: params.created_by_role,
        title: params.title,
        description: params.description || null,
        event_type: params.event_type || 'meeting',
        starts_at: params.starts_at,
        ends_at: params.ends_at || null,
        meeting_id: params.meeting_id || null,
        status: 'scheduled',
      })
      .select()
      .single()

    if (eventError) throw eventError

    // Create recipients
    const recipients = params.recipient_user_ids.map((userId, index) => ({
      calendar_event_id: event.id,
      recipient_user_id: userId,
      recipient_role: params.recipient_roles[index] || params.created_by_role,
    }))

    const { error: recipientError } = await supabase
      .from('tromail_calendar_event_recipients')
      .insert(recipients)

    if (recipientError) throw recipientError

    return { success: true, event_id: event.id }
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to create calendar event' }
  }
}

// Schedule a team meeting and notify all recipients via Tromail + calendar
export const scheduleTeamMeeting = async (params: {
  title: string
  description?: string
  scheduled_at: string
  created_by: string
  created_by_role: string
  recipient_user_ids: string[]
  recipient_roles: string[]
  recipient_tromail_addresses: string[]
}): Promise<{ success: boolean; meeting_id?: string; error?: string }> => {
  try {
    const roomName = `staff-meeting-${Date.now()}`

    // Create the meeting
    const { data: meeting, error: meetingError } = await supabase
      .from('staff_meetings')
      .insert({
        title: params.title,
        description: params.description || null,
        room_name: roomName,
        status: 'scheduled',
        scheduled_at: params.scheduled_at,
        max_participants: 50,
        created_by: params.created_by,
      })
      .select()
      .single()

    if (meetingError) throw meetingError

    // Create calendar event
    await createTromailCalendarEvent({
      created_by_user_id: params.created_by,
      created_by_role: params.created_by_role,
      title: params.title,
      description: params.description,
      event_type: 'team_meeting',
      starts_at: params.scheduled_at,
      meeting_id: meeting.id,
      recipient_user_ids: params.recipient_user_ids,
      recipient_roles: params.recipient_roles,
    })

    // Send Tromail notifications from Mai Troll System
    const scheduledDate = new Date(params.scheduled_at)
    const formattedDate = scheduledDate.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
    const formattedTime = scheduledDate.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })

    await sendTromailMessage({
      sender_user_id: params.created_by,
      sender_role: 'system',
      sender_tromail_address: 'system@tromail.Mai Troll',
      subject: `📅 Team Meeting Scheduled: ${params.title}`,
      body: `A new team meeting has been scheduled by Mai Troll System.\n\n📋 Meeting: ${params.title}\n📅 Date: ${formattedDate}\n🕐 Time: ${formattedTime}\n\n${params.description ? `Description: ${params.description}\n\n` : ''}You will receive a notification when the meeting starts.\n\n— Mai Troll System`,
      is_admin_email: true,
      is_important: true,
      related_meeting_id: meeting.id,
      recipient_user_ids: params.recipient_user_ids,
      recipient_roles: params.recipient_roles,
    })

    // Create in-app notifications
    await notifyTeamMeetingScheduled(
      params.recipient_user_ids,
      params.title,
      meeting.id,
      params.scheduled_at
    )

    return { success: true, meeting_id: meeting.id }
  } catch (err: any) {
    console.error('[scheduleTeamMeeting] Failed:', err)
    return { success: false, error: err?.message || 'Failed to schedule meeting' }
  }
}

// Mark message as read
export const markTromailRead = async (recipientId: string): Promise<void> => {
  await supabase
    .from('tromail_recipients')
    .update({ read_at: new Date().toISOString() })
    .eq('id', recipientId)
}

// Mark message as important/starred
export const markTromailImportant = async (recipientId: string, isStarred: boolean): Promise<void> => {
  await supabase
    .from('tromail_recipients')
    .update({ is_starred: isStarred })
    .eq('id', recipientId)
}

// Archive message
export const archiveTromailMessage = async (recipientId: string): Promise<void> => {
  await supabase
    .from('tromail_recipients')
    .update({ archived_at: new Date().toISOString() })
    .eq('id', recipientId)
}

// Delete message
export const deleteTromailMessage = async (recipientId: string): Promise<void> => {
  await supabase
    .from('tromail_recipients')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', recipientId)
}
// Contract Template Functions
export const getContractTemplates = async (): Promise<TromailContractTemplate[]> => {
  try {
    const { data, error } = await supabase
      .from('tromail_contract_templates')
      .select('*')
      .eq('is_active', true)
      .order('role_label');

    if (error) throw error;
    return data as TromailContractTemplate[];
  } catch (err: any) {
    throw new Error(`Failed to fetch contract templates: ${err.message}`);
  }
};

export const getContractTemplateById = async (templateId: string): Promise<TromailContractTemplate | null> => {
  try {
    const { data, error } = await supabase
      .from('tromail_contract_templates')
      .select('*')
      .eq('id', templateId)
      .single();

    if (error) throw error;
    return data as TromailContractTemplate;
  } catch (err: any) {
    throw new Error(`Failed to fetch contract template: ${err.message}`);
  }
};

// Contract Functions
export const createContract = async (params: {
  template_id: string;
  recipient_user_id: string;
  recipient_tromail_address: string;
  role_key: string;
  role_label: string;
  title: string;
  body: string;
  sent_by: string;
}): Promise<{ success: boolean; contract_id?: string; error?: string }> => {
  try {
    const { data: contract, error: contractError } = await supabase
      .from('tromail_contracts')
      .insert({
        template_id: params.template_id,
        recipient_user_id: params.recipient_user_id,
        recipient_tromail_address: params.recipient_tromail_address,
        role_key: params.role_key,
        role_label: params.role_label,
        title: params.title,
        body: params.body,
        status: 'draft',
        sent_by: params.sent_by,
      })
      .select()
      .single();

    if (contractError) throw contractError;

    // Create audit event
    await supabase.from('contract_audit_events').insert({
      contract_id: contract.id,
      actor_user_id: params.sent_by,
      event_type: 'contract_created',
      event_note: 'Contract created from template'
    });

    return { success: true, contract_id: contract.id };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to create contract' };
  }
};

export const updateContract = async (contractId: string, updates: Partial<TromailContract>): Promise<{ success: boolean; error?: string }> => {
  try {
    const { data, error } = await supabase
      .from('tromail_contracts')
      .update(updates)
      .eq('id', contractId)
      .select()
      .single();

    if (error) throw error;

    // Create audit event
    await supabase.from('contract_audit_events').insert({
      contract_id: contractId,
      actor_user_id: updates.sent_by || '',
      event_type: 'contract_updated',
      event_note: 'Contract updated with changes'
    });

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to update contract' };
  }
};

export const getContractById = async (contractId: string): Promise<TromailContract | null> => {
  try {
    const { data, error } = await supabase
      .from('tromail_contracts')
      .select('*')
      .eq('id', contractId)
      .single();

    if (error) throw error;
    return data as TromailContract;
  } catch (err: any) {
    throw new Error(`Failed to fetch contract: ${err.message}`);
  }
};

export const getContractsByRecipient = async (recipientUserId: string): Promise<TromailContract[]> => {
  try {
    const { data, error } = await supabase
      .from('tromail_contracts')
      .select('*')
      .eq('recipient_user_id', recipientUserId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data as TromailContract[];
  } catch (err: any) {
    throw new Error(`Failed to fetch contracts for recipient: ${err.message}`);
  }
};

export const getContractsBySender = async (senderUserId: string): Promise<TromailContract[]> => {
  try {
    const { data, error } = await supabase
      .from('tromail_contracts')
      .select('*')
      .eq('sent_by', senderUserId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data as TromailContract[];
  } catch (err: any) {
    throw new Error(`Failed to fetch contracts for sender: ${err.message}`);
  }
};

export const sendContract = async (contractId: string, recipientUserIds: string[]): Promise<{ success: boolean; message_id?: string; error?: string }> => {
  try {
    // Get the contract
    const contract = await getContractById(contractId);
    if (!contract) throw new Error('Contract not found');

    // Update contract status to sent
    const { error: updateError } = await supabase
      .from('tromail_contracts')
      .update({ 
        status: 'sent',
        sent_at: new Date().toISOString()
      })
      .eq('id', contractId);

    if (updateError) throw updateError;

    // Create audit event
    await supabase.from('contract_audit_events').insert({
      contract_id: contractId,
      actor_user_id: contract.sent_by,
      event_type: 'contract_sent',
      event_note: `Contract sent to ${recipientUserIds.length} recipient(s)`
    });

    // Send Tromail notification
    const { success, message_id, error: sendError } = await sendTromailMessage({
      sender_user_id: contract.sent_by,
      sender_role: '', // We'll get this from the user's profile if needed
      sender_tromail_address: '', // We'll get this from the user's Tromail account
      subject: `Contract: ${contract.title}`,
      body: `You have received a contract for the position of ${contract.role_label}. Please review and sign it.`,
      is_admin_email: true,
      is_important: true,
      recipient_user_ids: recipientUserIds,
      recipient_roles: recipientUserIds.map(() => '') // We'll get actual roles if needed
    });

    if (sendError) throw sendError;

    return { success: true, message_id };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to send contract' };
  }
};

export const viewContract = async (contractId: string, viewerUserId: string): Promise<{ success: boolean; error?: string }> => {
  try {
    // Update viewed timestamp
    const { error: updateError } = await supabase
      .from('tromail_contracts')
      .update({ viewed_at: new Date().toISOString() })
      .eq('id', contractId);

    if (updateError) throw updateError;

    // Create audit event
    await supabase.from('contract_audit_events').insert({
      contract_id: contractId,
      actor_user_id: viewerUserId,
      event_type: 'contract_viewed',
      event_note: `Contract viewed by user ${viewerUserId}`
    });

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to mark contract as viewed' };
  }
};

export const signContract = async (params: {
  contractId: string;
  userId: string;
  legalName: string;
  signatureText: string;
}): Promise<{ success: boolean; error?: string }> => {
  try {
    // Update contract with signature info
    const { error: updateError } = await supabase
      .from('tromail_contracts')
      .update({ 
        status: 'signed',
        signed_at: new Date().toISOString(),
        signed_by_user_id: params.userId,
        signature_text: params.signatureText,
        legal_name: params.legalName
      })
      .eq('id', params.contractId);

    if (updateError) throw updateError;

    // Create audit event
    await supabase.from('contract_audit_events').insert({
      contract_id: params.contractId,
      actor_user_id: params.userId,
      event_type: 'contract_signed',
      event_note: `Contract signed by user ${params.userId}`
    });

    // Notify sender
    const contract = await getContractById(params.contractId);
    if (contract && contract.sent_by) {
      await createNotification(
        contract.sent_by,
        'contract_signed',
        '📝 Contract Signed',
        `The contract for ${contract.role_label} has been signed by ${params.legalName}`,
        { contract_id: params.contractId, action_url: `/tromail/contracts/${params.contractId}` }
      );
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to sign contract' };
  }
};

export const rejectContract = async (params: {
  contractId: string;
  userId: string;
  note?: string;
}): Promise<{ success: boolean; error?: string }> => {
  try {
    // Update contract status to rejected
    const { error: updateError } = await supabase
      .from('tromail_contracts')
      .update({ 
        status: 'rejected',
        // We could add a rejected_at field if needed
      })
      .eq('id', params.contractId);

    if (updateError) throw updateError;

    // Create audit event
    await supabase.from('contract_audit_events').insert({
      contract_id: params.contractId,
      actor_user_id: params.userId,
      event_type: 'contract_rejected',
      event_note: `Contract rejected by user ${params.userId}: ${params.note || 'No reason provided'}`
    });

    // Notify sender
    const contract = await getContractById(params.contractId);
    if (contract && contract.sent_by) {
      await createNotification(
        contract.sent_by,
        'contract_rejected',
        '📝 Contract Rejected',
        `The contract for ${contract.role_label} has been rejected`,
        { contract_id: params.contractId, action_url: `/tromail/contracts/${params.contractId}` }
      );
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to reject contract' };
  }
};

// Organization Document Functions
export const uploadOrganizationDocument = async (params: {
  user_id: string;
  uploaded_by: string | null;
  document_type: OrganizationDocument['document_type'];
  document_title: string;
  file_url: string;
  storage_path: string;
  source: string;
  related_contract_id: string | null;
  visibility: OrganizationDocument['visibility'];
  metadata?: Record<string, any>;
}): Promise<{ success: boolean; document_id?: string; error?: string }> => {
  try {
    const { data: document, error: documentError } = await supabase
      .from('organization_documents')
      .insert({
        user_id: params.user_id,
        uploaded_by: params.uploaded_by,
        document_type: params.document_type,
        document_title: params.document_title,
        file_url: params.file_url,
        storage_path: params.storage_path,
        source: params.source,
        related_contract_id: params.related_contract_id,
        visibility: params.visibility,
        metadata: params.metadata || {}
      })
      .select()
      .single();

    if (documentError) throw documentError;

    // Create audit event if related to contract
    if (params.related_contract_id) {
      await supabase.from('contract_audit_events').insert({
        contract_id: params.related_contract_id,
        actor_user_id: params.uploaded_by || '',
        event_type: 'document_uploaded',
        event_note: `Document uploaded: ${params.document_title}`
      });
    }

    return { success: true, document_id: document.id };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to upload document' };
  }
};

export const getUserDocuments = async (userId: string, filters?: {
  document_type?: OrganizationDocument['document_type'];
  visibility?: OrganizationDocument['visibility'];
  status?: string;
}): Promise<OrganizationDocument[]> => {
  try {
    let query = supabase
      .from('organization_documents')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (filters?.document_type) {
      query = query.eq('document_type', filters.document_type);
    }
    if (filters?.visibility) {
      query = query.eq('visibility', filters.visibility);
    }
    if (filters?.status) {
      query = query.eq('status', filters.status);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data as OrganizationDocument[];
  } catch (err: any) {
    throw new Error(`Failed to fetch user documents: ${err.message}`);
  }
};

export const getDocumentById = async (documentId: string): Promise<OrganizationDocument | null> => {
  try {
    const { data, error } = await supabase
      .from('organization_documents')
      .select('*')
      .eq('id', documentId)
      .single();

    if (error) throw error;
    return data as OrganizationDocument;
  } catch (err: any) {
    throw new Error(`Failed to fetch document: ${err.message}`);
  }
};

// Contract Audit Functions
export const getContractAuditEvents = async (contractId: string): Promise<ContractAuditEvent[]> => {
  try {
    const { data, error } = await supabase
      .from('contract_audit_events')
      .select('*')
      .eq('contract_id', contractId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data as ContractAuditEvent[];
  } catch (err: any) {
    throw new Error(`Failed to fetch contract audit events: ${err.message}`);
  }
};

export const getUserContractAuditEvents = async (userId: string): Promise<ContractAuditEvent[]> => {
  try {
    const { data, error } = await supabase
      .from('contract_audit_events')
      .select('*')
      .eq('actor_user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data as ContractAuditEvent[];
  } catch (err: any) {
    throw new Error(`Failed to fetch user contract audit events: ${err.message}`);
  }
};

// Helper function to generate contract preview with placeholders replaced
export const generateContractPreview = (template: TromailContractTemplate, formData: ContractFormData, userProfile: any): ContractPreviewData => {
  const replacements: Record<string, string> = {
    '{{user_name}}': userProfile?.display_name || userProfile?.username || 'User',
    '{{tromail_address}}': formData.recipient_tromail_address || '',
    '{{role_label}}': formData.role_key ? 
      (template.role_label || formData.role_key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())) : 
      '',
    '{{start_date}}': formData.start_date || '',
    '{{pay_terms}}': formData.pay_terms || '',
    '{{admin_name}}': 'MaiTroll Administration', // This could come from the sender's profile
    '{{company_name}}': 'MaiTroll / MAI Corp',
    '{{date}}': new Date().toLocaleDateString(),
    '{{duties_responsibilities}}': formData.duties_responsibilities || '',
    '{{confidentiality_clause}}': formData.confidentiality_clause || '',
    '{{platform_rules}}': formData.platform_rules || '',
    '{{payout_method_notes}}': formData.payout_method_notes || '',
    '{{custom_notes}}': formData.custom_notes || ''
  };

  let body = template.body_template;
  Object.keys(replacements).forEach(key => {
    body = body.replace(new RegExp(key, 'g'), replacements[key]);
  });

  return {
    user_name: replacements['{{user_name}}'],
    tromail_address: replacements['{{tromail_address}}'],
    role_label: replacements['{{role_label}}'],
    start_date: replacements['{{start_date}}'],
    pay_terms: replacements['{{pay_terms}}'],
    admin_name: replacements['{{admin_name}}'],
    company_name: replacements['{{company_name}}'],
    date: replacements['{{date}}'],
    duties_responsibilities: replacements['{{duties_responsibilities}}'],
    confidentiality_clause: replacements['{{confidentiality_clause}}'],
    platform_rules: replacements['{{platform_rules}}'],
    payout_method_notes: replacements['{{payout_method_notes}}'],
    custom_notes: replacements['{{custom_notes}}']
  };
};
