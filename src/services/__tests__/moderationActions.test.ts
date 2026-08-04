import {
  resolveModerationAuthority,
  canPerformModerationAction,
  requiresProof,
  hasValidProof,
  canRepeatLicenseSuspension,
  getVisibleActions,
} from '@/services/moderationActions';

describe('moderationActions', () => {
  describe('resolveModerationAuthority', () => {
    it('returns ceo for CEO role', () => {
      const result = resolveModerationAuthority({ role: 'ceo' });
      expect(result).toBe('ceo');
    });

    it('returns admin for admin role', () => {
      const result = resolveModerationAuthority({ role: 'admin' });
      expect(result).toBe('admin');
    });

    it('returns lead_troll_officer for lead_troll_officer role', () => {
      const result = resolveModerationAuthority({ role: 'lead_troll_officer' });
      expect(result).toBe('lead_troll_officer');
    });

    it('returns troll_officer for troll_officer role', () => {
      const result = resolveModerationAuthority({ role: 'troll_officer' });
      expect(result).toBe('troll_officer');
    });

    it('returns broadcaster for broadcaster role', () => {
      const result = resolveModerationAuthority({ role: 'broadcaster' });
      expect(result).toBe('broadcaster');
    });

    it('returns broadofficer for broadofficer role', () => {
      const result = resolveModerationAuthority({ role: 'broadofficer' });
      expect(result).toBe('broadofficer');
    });

    it('returns unauthorized for user role', () => {
      const result = resolveModerationAuthority({ role: 'user' });
      expect(result).toBe('unauthorized');
    });

    it('returns unauthorized for regular user role', () => {
      const result = resolveModerationAuthority({ role: 'regular user' });
      expect(result).toBe('unauthorized');
    });

    it('returns unauthorized for null profile', () => {
      const result = resolveModerationAuthority(null);
      expect(result).toBe('unauthorized');
    });
  });

  describe('canPerformModerationAction', () => {
    it('allows ceo to perform any action', () => {
      expect(canPerformModerationAction('ceo', 'arrest', false, false)).toBe(true);
      expect(canPerformModerationAction('ceo', 'set_to_user', false, false)).toBe(true);
      expect(canPerformModerationAction('ceo', 'grant_license', false, false)).toBe(true);
      expect(canPerformModerationAction('ceo', 'end_stream', false, false)).toBe(true);
    });

    it('allows admin to perform most actions', () => {
      expect(canPerformModerationAction('admin', 'arrest', false, false)).toBe(true);
      expect(canPerformModerationAction('admin', 'mute', false, false)).toBe(true);
      expect(canPerformModerationAction('admin', 'kick', false, false)).toBe(true);
    });

    it('restricts lead_troll_officer from set_to_user and grant_license', () => {
      expect(canPerformModerationAction('lead_troll_officer', 'set_to_user', false, false)).toBe(false);
      expect(canPerformModerationAction('lead_troll_officer', 'grant_license', false, false)).toBe(false);
      expect(canPerformModerationAction('lead_troll_officer', 'arrest', false, false)).toBe(true);
      expect(canPerformModerationAction('lead_troll_officer', 'mute', false, false)).toBe(true);
    });

    it('restricts troll_officer to allowed actions', () => {
      expect(canPerformModerationAction('troll_officer', 'arrest', false, false)).toBe(true);
      expect(canPerformModerationAction('troll_officer', 'mute', false, false)).toBe(true);
      expect(canPerformModerationAction('troll_officer', 'kick', false, false)).toBe(true);
      expect(canPerformModerationAction('troll_officer', 'suspend_license', false, false)).toBe(true);
      expect(canPerformModerationAction('troll_officer', 'set_to_user', false, false)).toBe(false);
      expect(canPerformModerationAction('troll_officer', 'grant_license', false, false)).toBe(false);
      expect(canPerformModerationAction('troll_officer', 'end_stream', false, false)).toBe(false);
    });

    it('allows broadcaster to moderate own stream', () => {
      expect(canPerformModerationAction('broadcaster', 'mute', true, false)).toBe(true);
      expect(canPerformModerationAction('broadcaster', 'arrest', true, false)).toBe(true);
      expect(canPerformModerationAction('broadcaster', 'kick', true, false)).toBe(true);
      expect(canPerformModerationAction('broadcaster', 'suspend_license', true, false)).toBe(true);
      expect(canPerformModerationAction('broadcaster', 'end_stream', true, false)).toBe(true);
      expect(canPerformModerationAction('broadcaster', 'remove_officer', true, false)).toBe(true);
      expect(canPerformModerationAction('broadcaster', 'set_to_user', true, false)).toBe(false);
      expect(canPerformModerationAction('broadcaster', 'grant_license', true, false)).toBe(false);
    });

    it('denies broadcaster from moderating other streams', () => {
      expect(canPerformModerationAction('broadcaster', 'mute', false, false)).toBe(false);
      expect(canPerformModerationAction('broadcaster', 'arrest', false, false)).toBe(false);
    });

    it('allows broadofficer to moderate assigned stream', () => {
      expect(canPerformModerationAction('broadofficer', 'mute', false, true)).toBe(true);
      expect(canPerformModerationAction('broadofficer', 'arrest', false, true)).toBe(true);
      expect(canPerformModerationAction('broadofficer', 'kick', false, true)).toBe(true);
      expect(canPerformModerationAction('broadofficer', 'suspend_license', false, true)).toBe(true);
      expect(canPerformModerationAction('broadofficer', 'background_check', false, true)).toBe(true);
      expect(canPerformModerationAction('broadofficer', 'end_stream', false, true)).toBe(false);
      expect(canPerformModerationAction('broadofficer', 'grant_license', false, true)).toBe(false);
      expect(canPerformModerationAction('broadofficer', 'set_to_user', false, true)).toBe(false);
    });

    it('denies broadofficer from moderating unassigned streams', () => {
      expect(canPerformModerationAction('broadofficer', 'mute', false, false)).toBe(false);
    });

    it('denies unauthorized users', () => {
      expect(canPerformModerationAction('unauthorized', 'mute', false, false)).toBe(false);
      expect(canPerformModerationAction('unauthorized', 'arrest', false, false)).toBe(false);
    });
  });

  describe('requiresProof', () => {
    it('returns true for arrest', () => {
      expect(requiresProof('arrest')).toBe(true);
    });

    it('returns false for all other actions', () => {
      expect(requiresProof('mute')).toBe(false);
      expect(requiresProof('unmute')).toBe(false);
      expect(requiresProof('disable_chat')).toBe(false);
      expect(requiresProof('kick')).toBe(false);
      expect(requiresProof('suspend_license')).toBe(false);
      expect(requiresProof('grant_license')).toBe(false);
      expect(requiresProof('background_check')).toBe(false);
    });
  });

  describe('hasValidProof', () => {
    it('returns true for screenshot proof type', () => {
      expect(hasValidProof({ proof_type: 'screenshot' })).toBe(true);
    });

    it('returns true for uploaded image proof type', () => {
      expect(hasValidProof({ proof_type: 'uploaded_image' })).toBe(true);
    });

    it('returns true for video clip proof type', () => {
      expect(hasValidProof({ proof_type: 'video_clip' })).toBe(true);
    });

    it('returns true for broadcast timestamp proof type', () => {
      expect(hasValidProof({ proof_type: 'broadcast_timestamp' })).toBe(true);
    });

    it('returns true for existing URL proof type', () => {
      expect(hasValidProof({ proof_type: 'existing_url' })).toBe(true);
    });

    it('returns true for proof URL', () => {
      expect(hasValidProof({ proof_url: 'https://example.com/evidence.png' })).toBe(true);
    });

    it('returns true for recording timestamp', () => {
      expect(hasValidProof({ recording_timestamp: '00:14:32' })).toBe(true);
    });

    it('returns true for written notes', () => {
      expect(hasValidProof({ proof_type: 'written_notes', notes: 'Evidence notes' })).toBe(true);
    });

    it('returns false for empty proof', () => {
      expect(hasValidProof(null)).toBe(false);
      expect(hasValidProof(undefined)).toBe(false);
      expect(hasValidProof({})).toBe(false);
      expect(hasValidProof({ proof_type: '' })).toBe(false);
    });
  });

  describe('canRepeatLicenseSuspension', () => {
    it('returns true for officer roles', () => {
      expect(canRepeatLicenseSuspension('troll_officer')).toBe(true);
      expect(canRepeatLicenseSuspension('lead_troll_officer')).toBe(true);
      expect(canRepeatLicenseSuspension('admin')).toBe(true);
      expect(canRepeatLicenseSuspension('ceo')).toBe(true);
    });

    it('returns false for broadcaster and broadofficer', () => {
      expect(canRepeatLicenseSuspension('broadcaster')).toBe(false);
      expect(canRepeatLicenseSuspension('broadofficer')).toBe(false);
    });
  });

  describe('getVisibleActions', () => {
    it('returns all actions for CEO', () => {
      const actions = getVisibleActions('ceo', false, false);
      expect(actions.length).toBe(11);
    });

    it('returns all actions for admin', () => {
      const actions = getVisibleActions('admin', false, false);
      expect(actions.length).toBe(11);
    });

    it('excludes set_to_user and grant_license for lead_troll_officer', () => {
      const actions = getVisibleActions('lead_troll_officer', false, false);
      expect(actions.some(a => a.id === 'set_to_user')).toBe(false);
      expect(actions.some(a => a.id === 'grant_license')).toBe(false);
    });

    it('returns limited actions for troll_officer', () => {
      const actions = getVisibleActions('troll_officer', false, false);
      expect(actions.some(a => a.id === 'mute')).toBe(true);
      expect(actions.some(a => a.id === 'unmute')).toBe(true);
      expect(actions.some(a => a.id === 'arrest')).toBe(true);
      expect(actions.some(a => a.id === 'disable_chat')).toBe(true);
      expect(actions.some(a => a.id === 'kick')).toBe(true);
      expect(actions.some(a => a.id === 'suspend_license')).toBe(true);
      expect(actions.some(a => a.id === 'background_check')).toBe(true);
      expect(actions.some(a => a.id === 'set_to_user')).toBe(false);
      expect(actions.some(a => a.id === 'grant_license')).toBe(false);
      expect(actions.some(a => a.id === 'end_stream')).toBe(false);
    });

    it('returns stream-scoped actions for broadcaster', () => {
      const actions = getVisibleActions('broadcaster', true, false);
      expect(actions.some(a => a.id === 'mute')).toBe(true);
      expect(actions.some(a => a.id === 'arrest')).toBe(true);
      expect(actions.some(a => a.id === 'suspend_license')).toBe(true);
      expect(actions.some(a => a.id === 'remove_officer')).toBe(true);
      expect(actions.some(a => a.id === 'end_stream')).toBe(true);
      expect(actions.some(a => a.id === 'background_check')).toBe(true);
      expect(actions.some(a => a.id === 'set_to_user')).toBe(false);
      expect(actions.some(a => a.id === 'grant_license')).toBe(false);
    });

    it('returns empty for broadcaster without stream ownership', () => {
      const actions = getVisibleActions('broadcaster', false, false);
      expect(actions.length).toBe(0);
    });

    it('returns stream-scoped actions for broadofficer', () => {
      const actions = getVisibleActions('broadofficer', false, true);
      expect(actions.some(a => a.id === 'mute')).toBe(true);
      expect(actions.some(a => a.id === 'arrest')).toBe(true);
      expect(actions.some(a => a.id === 'suspend_license')).toBe(true);
      expect(actions.some(a => a.id === 'background_check')).toBe(true);
      expect(actions.some(a => a.id === 'end_stream')).toBe(false);
      expect(actions.some(a => a.id === 'grant_license')).toBe(false);
      expect(actions.some(a => a.id === 'set_to_user')).toBe(false);
    });

    it('returns empty for plain user', () => {
      const actions = getVisibleActions('unauthorized', false, false);
      expect(actions.length).toBe(0);
    });
  });
});