import { supabase } from '@/lib/supabase';
import type {
  MaiCamDevice,
  MaiCamPairingCode,
  MaiCamSession,
  MaiCamPreferences,
  MaiCamGenerateResult,
  MaiCamConsumeResult,
  MaiCamQuality,
  MaiCamFps,
} from './types';

const FUNCTIONS_URL = import.meta.env.VITE_EDGE_FUNCTIONS_URL
  ? `${import.meta.env.VITE_EDGE_FUNCTIONS_URL}/`
  : '/functions/v1/';

async function invokeFunction(name: string, body: unknown): Promise<any> {
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (error) throw error;
  return data;
}

export const maicamSessionService = {
  async generatePairingCode(
    intendedRole: 'phone' | 'desktop',
    deviceName?: string,
    deviceType?: 'phone' | 'desktop' | 'tablet',
    browserName?: string,
  ): Promise<MaiCamGenerateResult> {
    try {
      const data = await invokeFunction('maicam-generate-code', {
        intended_role: intendedRole,
        device_name: deviceName || 'MaiCam Device',
        device_type: deviceType || intendedRole,
        browser_name: browserName,
      });

      if (!data?.success) {
        return { success: false, error: data?.error || 'Failed to generate code' };
      }

      return {
        success: true,
        code: data.code,
        sessionId: data.pairing_code_id,
        expires_at: data.expires_at,
        ttl_seconds: data.ttl_seconds,
      };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Failed to generate pairing code' };
    }
  },

  async consumePairingCode(code: string): Promise<MaiCamConsumeResult> {
    try {
      const data = await invokeFunction('maicam-consume-code', { code });

      if (!data?.success) {
        return { success: false, error: data?.error || 'Invalid pairing code' };
      }

      return {
        success: true,
        sessionId: data.pairing_code_id,
        intended_role: data.intended_role,
      };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Invalid pairing code' };
    }
  },

  async revokePairingCode(codeId: string): Promise<boolean> {
    try {
      const data = await invokeFunction('maicam-revoke-code', { code_id: codeId });
      return Boolean(data?.success);
    } catch {
      return false;
    }
  },

  async revokeDevice(deviceId: string): Promise<boolean> {
    try {
      const data = await invokeFunction('maicam-revoke-code', { device_id: deviceId });
      return Boolean(data?.success);
    } catch {
      return false;
    }
  },

  async deleteDevice(deviceId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('maicam_devices')
        .delete()
        .eq('id', deviceId);
      if (error) throw error;
      return true;
    } catch {
      return false;
    }
  },

  async revokeSession(sessionId: string): Promise<boolean> {
    try {
      const data = await invokeFunction('maicam-revoke-code', { session_id: sessionId });
      return Boolean(data?.success);
    } catch {
      return false;
    }
  },

  async listDevices(): Promise<MaiCamDevice[]> {
    try {
      const { data, error } = await supabase
        .from('maicam_devices')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as MaiCamDevice[];
    } catch {
      return [];
    }
  },

  async listSessions(): Promise<MaiCamSession[]> {
    try {
      const { data, error } = await supabase
        .from('maicam_sessions')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as MaiCamSession[];
    } catch {
      return [];
    }
  },

  async getPreferences(): Promise<MaiCamPreferences | null> {
    try {
      const { data } = await supabase
        .from('maicam_preferences')
        .select('*')
        .maybeSingle();
      return data as MaiCamPreferences | null;
    } catch {
      return null;
    }
  },

  async savePreferences(prefs: Partial<MaiCamPreferences> & { user_id: string }): Promise<boolean> {
    try {
      const existing = await this.getPreferences();
      if (existing) {
        const { error } = await supabase
          .from('maicam_preferences')
          .update({ ...prefs, updated_at: new Date().toISOString() })
          .eq('user_id', prefs.user_id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('maicam_preferences')
          .insert({ ...prefs, updated_at: new Date().toISOString() });
        if (error) throw error;
      }
      return true;
    } catch {
      return false;
    }
  },

  async markDeviceConnected(deviceId: string): Promise<void> {
    try {
      await supabase
        .from('maicam_devices')
        .update({ last_connected_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('id', deviceId);
    } catch {
      // non-fatal
    }
  },

  qualityPresets: ['480p', '720p', '1080p'] as MaiCamQuality[],
  fpsPresets: [15, 24, 30, 60] as MaiCamFps[],
};

export default maicamSessionService;
