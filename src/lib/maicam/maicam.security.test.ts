import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { maicamSessionService } from './MaiCamSessionService';
import { MaiCamConnectionManager } from './MaiCamConnectionManager';
import { supabase } from '@/lib/supabase';

const mockInvoke = vi.fn();
beforeEach(() => {
  vi.resetAllMocks();
  (supabase as any).functions = { invoke: mockInvoke };
});
afterEach(() => {
  vi.restoreAllMocks();
});

function resp(data: unknown) {
  return { data, error: null };
}

describe('maicamSessionService — pairing security', () => {
  it('generatePairingCode returns code on success', async () => {
    mockInvoke.mockResolvedValueOnce(resp({
      success: true,
      code: 'ABC123',
      pairing_code_id: 'code-id-1',
      expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      ttl_seconds: 300,
    }));

    const result = await maicamSessionService.generatePairingCode('desktop', "User's PC", 'desktop', 'Chrome');

    expect(result.success).toBe(true);
    expect(result.code).toBe('ABC123');
    expect(mockInvoke).toHaveBeenCalledWith('maicam-generate-code', expect.any(Object));
  });

  it('generatePairingCode returns error on failure', async () => {
    mockInvoke.mockResolvedValueOnce(resp({ success: false, error: 'authentication_required' }));

    const result = await maicamSessionService.generatePairingCode('phone');

    expect(result.success).toBe(false);
    expect(result.error).toBe('authentication_required');
    expect(mockInvoke).toHaveBeenCalled();
  });

  it('consumePairingCode returns success on valid code', async () => {
    mockInvoke.mockResolvedValueOnce(resp({
      success: true,
      pairing_code_id: 'code-id-1',
      intended_role: 'phone',
    }));

    const result = await maicamSessionService.consumePairingCode('ABC123');

    expect(result.success).toBe(true);
    expect(result.intended_role).toBe('phone');
    expect(mockInvoke).toHaveBeenCalledWith('maicam-consume-code', { body: { code: 'ABC123' } });
  });

  it('consumePairingCode rejects invalid/expired/consumed code', async () => {
    mockInvoke.mockResolvedValueOnce(resp({
      success: false,
      error: 'Invalid, expired, consumed, or revoked pairing code',
      code: 'code_invalid',
    }));

    const result = await maicamSessionService.consumePairingCode('ABC123');

    expect(result.success).toBe(false);
    expect(result.error).toBe('Invalid, expired, consumed, or revoked pairing code');
  });

  it('revokeDevice returns boolean', async () => {
    mockInvoke.mockResolvedValueOnce(resp({ success: true }));
    expect(await maicamSessionService.revokeDevice('dev-1')).toBe(true);

    mockInvoke.mockResolvedValueOnce(resp({ success: false }));
    expect(await maicamSessionService.revokeDevice('dev-2')).toBe(false);
  });
});

describe('MaiCamConnectionManager — state transitions', () => {
  it('generateCode moves state to generating-code then waiting-for-pairing', async () => {
    mockInvoke.mockResolvedValueOnce(resp({
      success: true,
      code: 'ABC123',
      pairing_code_id: 'session-id-1',
      expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
    }));

    const states: string[] = [];
    const mgr = new MaiCamConnectionManager({
      userId: 'user-1',
      role: 'desktop',
      deviceName: 'Test PC',
      onStateChange: () => {},
      onLocalStream: () => {},
      onRemoteStream: () => {},
      onError: () => {},
    });
    mgr.subscribe((s) => states.push(s.connectionState));

    const result = await mgr.generateCode();
    expect(result.success).toBe(true);
    expect(result.code).toBe('ABC123');
    expect(states).toContain('generating-code');
    expect(states).toContain('waiting-for-pairing');
    expect(mgr.getState().connectionState).toBe('waiting-for-pairing');

    mgr.destroy();
  });

  it('consumeCode failure sets connection-failed state', async () => {
    mockInvoke.mockResolvedValueOnce(resp({ success: false, error: 'Invalid pairing code' }));

    const errors: string[] = [];
    const mgr = new MaiCamConnectionManager({
      userId: 'user-1',
      role: 'phone',
      deviceName: 'Test Phone',
      onStateChange: () => {},
      onLocalStream: () => {},
      onRemoteStream: () => {},
      onError: (e) => errors.push(e),
    });

    const result = await mgr.consumeCode('BAD');
    expect(result.success).toBe(false);
    expect(errors).toContain('Invalid pairing code');
    expect(mgr.getState().connectionState).toBe('connection-failed');

    mgr.destroy();
  });
});
