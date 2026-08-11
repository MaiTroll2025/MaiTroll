/**
 * Mai Troll Canonical Moderation Service
 * 
 * Centralized moderation utilities for frontend:
 * - Unicode safety validation
 * - Content moderation checks
 * - Jail/bond state management
 * - Ban evasion risk assessment
 * 
 * Backend is authoritative. Frontend uses this for immediate UX only.
 */

import { supabase } from '@/lib/supabase';

// ============================================================================
// TYPES
// ============================================================================

export interface ModerationResult {
  allowed: boolean;
  code?: string;
  reason?: string;
  message?: string;
  prohibitedTerm?: string;
  category?: string;
  severity?: string;
}

export interface JailState {
  isJailed: boolean;
  jailId?: string;
  disciplineLevel?: number;
  scheduledReleaseAt?: string;
  bondAmount?: number;
  bondAllowed?: boolean;
  reason?: string;
}

export interface BondResult {
  success: boolean;
  code?: string;
  message?: string;
  data?: {
    jailId?: string;
    transactionId?: string;
    bondAmount?: number;
    disciplineLevel?: number;
    redirectTo?: string;
  };
}

export interface BanEvasionResult {
  riskScore: number;
  evasionDetected: boolean;
  signals: string[];
}

// ============================================================================
// UNICODE PROTECTION
// ============================================================================

export function validateUnicodeSafety(text: string): { allowed: boolean; reason?: string } {
  if (!text) return { allowed: true };

  const chars = Array.from(text);
  
  for (const char of chars) {
    const code = char.codePointAt(0)!;

    // Control characters (excluding tab, newline, CR)
    if (code >= 0 && code <= 31 && code !== 9 && code !== 10 && code !== 13) {
      return { allowed: false, reason: 'Control characters detected' };
    }

    // Bidi controls
    if ([8206, 8207, 8234, 8235, 8236, 8237, 8238, 8298, 8299, 8300, 8301, 8302, 8303].includes(code)) {
      return { allowed: false, reason: 'Bidirectional control characters detected' };
    }

    // Zero-width characters
    if ([8203, 8204, 8205, 65279, 8288].includes(code)) {
      return { allowed: false, reason: 'Zero-width characters detected' };
    }

    // Invisible separators
    if ([57344, 65529, 65530, 65531, 65532, 65533].includes(code)) {
      return { allowed: false, reason: 'Invisible separator characters detected' };
    }
  }

  // Check combining marks per base
  const combiningRanges = [
    [768, 879], [6832, 6911], [7616, 7679], [8400, 8447], [65056, 65071]
  ];
  
  let currentCombining = 0;
  let maxCombining = 0;

  for (const char of chars) {
    const code = char.codePointAt(0)!;
    const isCombining = combiningRanges.some(([start, end]) => code >= start && code <= end);
    
    if (isCombining) {
      currentCombining++;
    } else {
      if (currentCombining > maxCombining) {
        maxCombining = currentCombining;
      }
      currentCombining = 0;
    }
  }

  if (currentCombining > maxCombining) {
    maxCombining = currentCombining;
  }

  if (maxCombining > 2) {
    return { allowed: false, reason: 'Excessive combining marks detected' };
  }

  return { allowed: true };
}

// ============================================================================
// TEXT NORMALIZATION (for frontend pre-check only)
// ============================================================================

export function normalizeForModeration(text: string): string {
  return text
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/(.)\1{2,}/g, '$1')
    .trim();
}

// ============================================================================
// PROHIBITED TERMS CHECK (frontend pre-check only)
// ============================================================================

const PROHIBITED_TERMS: Record<string, { category: string; severity: string; contextSensitive: boolean }> = {
  'nigger': { category: 'slur', severity: 'severe', contextSensitive: false },
  'nigga': { category: 'slur', severity: 'severe', contextSensitive: false },
  'faggot': { category: 'slur', severity: 'severe', contextSensitive: false },
  'fagget': { category: 'slur', severity: 'severe', contextSensitive: false },
  'cracker': { category: 'slur', severity: 'high', contextSensitive: false },
  'slave': { category: 'historical', severity: 'moderate', contextSensitive: true },
  'kill': { category: 'violence', severity: 'moderate', contextSensitive: true },
  'murder': { category: 'violence', severity: 'moderate', contextSensitive: true },
  'crackhead': { category: 'harassment', severity: 'high', contextSensitive: false },
  'gay': { category: 'identity', severity: 'low', contextSensitive: true },
  'retard': { category: 'slur', severity: 'high', contextSensitive: false },
  'kike': { category: 'slur', severity: 'severe', contextSensitive: false },
  'chink': { category: 'slur', severity: 'severe', contextSensitive: false },
  'spic': { category: 'slur', severity: 'severe', contextSensitive: false },
  'wetback': { category: 'slur', severity: 'severe', contextSensitive: false },
};

export function checkProhibitedTerms(text: string): { prohibited: boolean; term?: string; severity?: string } {
  const normalized = normalizeForModeration(text);
  const words = normalized.split(/\s+/);
  
  for (const word of words) {
    for (const [term, config] of Object.entries(PROHIBITED_TERMS)) {
      if (word === term && !config.contextSensitive) {
        return { prohibited: true, term, severity: config.severity };
      }
      if (word === term && config.severity === 'severe') {
        return { prohibited: true, term, severity: config.severity };
      }
    }
  }
  
  return { prohibited: false };
}

// ============================================================================
// MODERATION SERVICE
// ============================================================================

export const moderation = {
  /**
   * Check if content is allowed
   * Backend is authoritative, this is immediate UX feedback only
   */
  async checkContent(
    userId: string,
    content: string,
    source: string = 'chat'
  ): Promise<ModerationResult> {
    // Frontend pre-checks
    const unicodeCheck = validateUnicodeSafety(content);
    if (!unicodeCheck.allowed) {
      return {
        allowed: false,
        code: 'UNICODE_ABUSE',
        reason: unicodeCheck.reason,
        message: 'That message contains unsupported or abusive characters. Please rewrite it using normal text.'
      };
    }

    const termCheck = checkProhibitedTerms(content);
    if (termCheck.prohibited && termCheck.severity === 'severe') {
      return {
        allowed: false,
        code: 'PROHIBITED_LANGUAGE',
        reason: 'Prohibited language detected',
        prohibitedTerm: termCheck.term,
        severity: termCheck.severity,
        message: 'That message violates Mai Troll\'s chat rules and was not sent.'
      };
    }

    // Backend check (authoritative)
    try {
      const { data, error } = await supabase.rpc('moderate_user_content', {
        p_user_id: userId,
        p_content: content,
        p_source: source,
        p_context: {}
      });

      if (error) {
        console.error('Moderation check failed:', error);
        return { allowed: true }; // Fail open for availability
      }

      if (data && !data.allowed) {
        return {
          allowed: false,
          code: data.code,
          reason: data.reason,
          message: data.message || 'That message violates Mai Troll\'s chat rules and was not sent.'
        };
      }

      return { allowed: true };
    } catch (err) {
      console.error('Moderation check error:', err);
      return { allowed: true }; // Fail open
    }
  },

  /**
   * Check if username is safe
   */
  async checkUsername(username: string, userId?: string): Promise<{ safe: boolean; reason?: string }> {
    const unicodeCheck = validateUnicodeSafety(username);
    if (!unicodeCheck.allowed) {
      return { safe: false, reason: 'Username contains unsupported characters.' };
    }

    const normalized = normalizeForModeration(username);
    const forbiddenNames = ['admin', 'administrator', 'moderator', 'maitroll', 'maitrolladmin', 'maitrollsupport', 'support', 'official', 'system'];
    
    if (forbiddenNames.includes(normalized)) {
      return { safe: false, reason: 'This username is not allowed.' };
    }

    const termCheck = checkProhibitedTerms(username);
    if (termCheck.prohibited) {
      return { safe: false, reason: 'This username contains prohibited content.' };
    }

    // Backend check
    try {
      const { data, error } = await supabase.rpc('check_username_safe', {
        p_username: username,
        p_user_id: userId
      });

      if (error) {
        console.error('Username check failed:', error);
        return { safe: true }; // Fail open
      }

      return { safe: data.safe, reason: data.reason };
    } catch (err) {
      console.error('Username check error:', err);
      return { safe: true }; // Fail open
    }
  },

  /**
   * Get current jail state for user
   */
  async getJailState(userId: string): Promise<JailState> {
    try {
      const { data, error } = await supabase.rpc('evaluate_user_discipline', {
        p_user_id: userId
      });

      if (error || !data) {
        return { isJailed: false };
      }

      return {
        isJailed: data.is_jailed || false,
        jailId: data.jail_id,
        disciplineLevel: data.discipline_level,
        scheduledReleaseAt: data.scheduled_release_at,
        bondAmount: data.bond_amount,
        bondAllowed: data.bond_allowed,
        reason: data.reason
      };
    } catch (err) {
      console.error('Failed to get jail state:', err);
      return { isJailed: false };
    }
  },

  /**
   * Post bond to release from jail
   */
  async postBond(jailId: string): Promise<BondResult> {
    try {
      const { data, error } = await supabase.rpc('post_jail_bond', {
        p_jail_id: jailId
      });

      if (error) {
        return {
          success: false,
          code: 'FUNCTION_ERROR',
          message: error.message || 'Failed to post bond.'
        };
      }

      if (data && !data.success) {
        return {
          success: false,
          code: data.code,
          message: data.message,
          data: data.data
        };
      }

      return {
        success: true,
        code: data?.code || 'BOND_PAID',
        message: data?.message || 'Bond posted successfully.',
        data: data?.data
      };
    } catch (err: any) {
      return {
        success: false,
        code: 'ERROR',
        message: err.message || 'Failed to post bond.'
      };
    }
  },

  /**
   * Check ban evasion risk
   */
  async checkBanEvasion(userId: string): Promise<BanEvasionResult> {
    try {
      const { data, error } = await supabase.rpc('evaluate_ban_evasion', {
        p_user_id: userId
      });

      if (error || !data) {
        return { riskScore: 0, evasionDetected: false, signals: [] };
      }

      return {
        riskScore: data.risk_score || 0,
        evasionDetected: data.evasion_detected || false,
        signals: data.signals || []
      };
    } catch (err) {
      console.error('Ban evasion check failed:', err);
      return { riskScore: 0, evasionDetected: false, signals: [] };
    }
  },

  /**
   * Check if user can chat (unified check)
   */
  async checkChatRestriction(userId: string, streamId?: string): Promise<{
    restricted: boolean;
    reasons: string[];
  }> {
    try {
      const { data, error } = await supabase.rpc('check_user_chat_restriction', {
        p_user_id: userId,
        p_stream_id: streamId
      });

      if (error || !data) {
        return { restricted: false, reasons: [] };
      }

      return {
        restricted: data.restricted || false,
        reasons: data.reasons || []
      };
    } catch (err) {
      console.error('Chat restriction check failed:', err);
      return { restricted: false, reasons: [] };
    }
  }
};

// ============================================================================
// USER-FACING MESSAGES
// ============================================================================

export const MODERATION_MESSAGES = {
  PROHIBITED_LANGUAGE: 'That message violates Mai Troll\'s chat rules and was not sent.',
  UNICODE_ABUSE: 'That message contains unsupported or abusive characters. Please rewrite it using normal text.',
  USERNAME_NOT_ALLOWED: 'This username is not allowed.',
  USER_JAILED: 'You are currently in jail.',
  INSUFFICIENT_TROLL_COINS: 'You don\'t have enough Troll Coins to post bond.',
  BOND_PAID: 'Bond Posted — You Have Been Released',
  RATE_LIMITED: 'You are sending messages too fast. Please slow down.'
} as const;

export default moderation;
