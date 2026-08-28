import { supabase } from '@/lib/supabase';
import { sendMessage } from '@/services/utromailService';

export interface JailRequest {
  id: string;
  jailId: string;
  userId: string;
  requestType: 'attorney' | 'admin';
  message: string;
  status: string;
  assignedTo?: string;
  quoteAmount: number;
  quoteMessage: string;
  inmateResponse: string;
  respondedAt?: string;
  createdAt: string;
  updatedAt: string;
  inmateUsername?: string;
  inmateDisplayName?: string;
  jailReason?: string;
  jailSeverity?: string;
  jailBondAmount?: number;
}

export const jailAttorneyService = {
  async requestAttorney(jailId: string, message = 'I am requesting an attorney.'): Promise<{ success: boolean; data?: JailRequest; error?: string }> {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return { success: false, error: 'Not authenticated' };

    const { data: attorneys } = await supabase
      .from('user_profiles')
      .select('id')
      .or('is_attorney.eq.true,role.eq.attorney')
      .limit(1);

    if (!attorneys || attorneys.length === 0) {
      return { success: false, error: 'No attorney is currently available. Please try again later or contact administration.' };
    }

    const { data, error } = await supabase
      .from('jail_requests')
      .insert({
        jail_id: jailId,
        user_id: auth.user.id,
        request_type: 'attorney',
        message,
        status: 'pending',
      })
      .select()
      .single();

    if (error) return { success: false, error: error.message };
    void this.notifyAttorneysOfRequest(data.id);
    return { success: true, data: data as JailRequest };
  },

  async notifyAttorneysOfRequest(requestId: string): Promise<void> {
    const { data: attorneys } = await supabase
      .from('user_profiles')
      .select('id, utromail_address')
      .or('is_attorney.eq.true,role.eq.attorney');

    if (!attorneys || attorneys.length === 0) return;

    const { data: request } = await supabase
      .from('jail_requests')
      .select('*, jail(reason, severity, bond_amount), user_profiles!inner(username, display_name)')
      .eq('id', requestId)
      .single();

    if (!request) return;

    const inmateName = request.user_profiles?.display_name || request.user_profiles?.username || 'An inmate';
    const subject = `New Inmate Case: ${inmateName}`;
    const body = `You have a new inmate case request.\n\nInmate: ${inmateName}\nReason: ${request.jail?.reason || 'Unknown'}\n\nPlease accept or decline this case from your attorney dashboard.`;

    for (const attorney of attorneys) {
      try {
        await sendMessage({
          senderId: request.user_id,
          senderMail: 'system@tromail.mai',
          recipientId: attorney.id,
          recipientMail: attorney.utromail_address || `attorney@tromail`,
          subject,
          body,
          messageType: 'government',
        });
      } catch (e) {
        console.error('Failed to send attorney notification:', e);
      }
    }
  },

  async requestAdmin(jailId: string, message = 'I am requesting assistance from administration.'): Promise<{ success: boolean; data?: JailRequest; error?: string }> {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return { success: false, error: 'Not authenticated' };

    const { data, error } = await supabase
      .from('jail_requests')
      .insert({
        jail_id: jailId,
        user_id: auth.user.id,
        request_type: 'admin',
        message,
        status: 'pending',
      })
      .select()
      .single();

    if (error) return { success: false, error: error.message };
    return { success: true, data: data as JailRequest };
  },

  async acceptAttorneyQuote(requestId: string): Promise<{ success: boolean; message?: string; error?: string }> {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return { success: false, error: 'Not authenticated' };

    const { data, error } = await supabase.rpc('accept_attorney_quote', {
      p_request_id: requestId,
      p_payer_id: auth.user.id,
    });

    if (error) return { success: false, error: error.message };
    return { success: data?.success || false, message: data?.message };
  },

  async denyAttorneyQuote(requestId: string): Promise<{ success: boolean; message?: string; error?: string }> {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return { success: false, error: 'Not authenticated' };

    const { data, error } = await supabase.rpc('deny_attorney_quote', {
      p_request_id: requestId,
      p_payer_id: auth.user.id,
    });

    if (error) return { success: false, error: error.message };
    return { success: data?.success || false, message: data?.message };
  },

  async acceptAdminBondQuote(requestId: string): Promise<{ success: boolean; message?: string; error?: string }> {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return { success: false, error: 'Not authenticated' };

    const { data, error } = await supabase.rpc('accept_admin_bond_quote', {
      p_request_id: requestId,
      p_user_id: auth.user.id,
    });

    if (error) return { success: false, error: error.message };
    return { success: data?.success || false, message: data?.message };
  },

  async denyAdminBondQuote(requestId: string): Promise<{ success: boolean; message?: string; error?: string }> {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return { success: false, error: 'Not authenticated' };

    const { data, error } = await supabase.rpc('deny_admin_bond_quote', {
      p_request_id: requestId,
      p_user_id: auth.user.id,
    });

    if (error) return { success: false, error: error.message };
    return { success: data?.success || false, message: data?.message };
  },

  async loadMyRequest(jailId: string, requestType: 'attorney' | 'admin'): Promise<JailRequest | null> {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return null;

    const { data, error } = await supabase
      .from('jail_requests')
      .select('*')
      .eq('jail_id', jailId)
      .eq('user_id', auth.user.id)
      .eq('request_type', requestType)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !data) return null;
    return data as JailRequest;
  },

  subscribeToJailUpdates(jailId: string, onUpdate: (jailId: string) => void): () => void {
    const channel = supabase
      .channel(`jail-updates:${jailId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'jail',
        filter: `id=eq.${jailId}`,
      }, (payload) => {
        if (payload.new && (payload.new as any).status === 'released') {
          onUpdate(jailId);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  },

  subscribeToRequestUpdates(jailId: string, userId: string, onUpdate: () => void): () => void {
    const channel = supabase
      .channel(`jail-request-updates:${jailId}:${userId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'jail_requests',
        filter: `jail_id=eq.${jailId}`,
      }, () => {
        onUpdate();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  },
};
