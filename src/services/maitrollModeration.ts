/**
 * Mai Troll Canonical Moderation Service
 *
 * Centralized moderation utilities for frontend:
 * - Unicode safety validation
 * - Content moderation checks
 * - Jail/bond state management
 * - Ban evasion risk assessment
 *
 * IMPORTANT:
 * Backend/database state is authoritative.
 *
 * For jail enforcement specifically, an active row in public.jail with
 * status = 'jailed' is treated as authoritative. The frontend must NOT
 * decide that an inmate is free simply because a discipline RPC returns
 * is_jailed = false.
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
  severity?: string;
  jailedAt?: string;
  arrestedBy?: string;
  courtDate?: string;
  caseId?: string;
}

export interface BondResult {
  success: boolean;
  code?: string;
  message?: string;
  data?: {
    [x: string]: unknown;
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

const BIDI_CONTROL_CODES = new Set([
  8206,
  8207,
  8234,
  8235,
  8236,
  8237,
  8238,
  8298,
  8299,
  8300,
  8301,
  8302,
  8303,
]);

const ZERO_WIDTH_CODES = new Set([
  8203,
  8204,
  8205,
  65279,
  8288,
]);

const INVISIBLE_SEPARATOR_CODES = new Set([
  57344,
  65529,
  65530,
  65531,
  65532,
  65533,
]);

const COMBINING_RANGES: Array<[number, number]> = [
  [768, 879],
  [6832, 6911],
  [7616, 7679],
  [8400, 8447],
  [65056, 65071],
];

export function validateUnicodeSafety(
  text: string,
): { allowed: boolean; reason?: string } {
  if (!text) {
    return { allowed: true };
  }

  const chars = Array.from(text);

  for (const char of chars) {
    const code = char.codePointAt(0);

    if (code === undefined) {
      continue;
    }

    // Control characters except TAB, LF, CR.
    if (
      code >= 0 &&
      code <= 31 &&
      code !== 9 &&
      code !== 10 &&
      code !== 13
    ) {
      return {
        allowed: false,
        reason: 'Control characters detected',
      };
    }

    if (BIDI_CONTROL_CODES.has(code)) {
      return {
        allowed: false,
        reason: 'Bidirectional control characters detected',
      };
    }

    if (ZERO_WIDTH_CODES.has(code)) {
      return {
        allowed: false,
        reason: 'Zero-width characters detected',
      };
    }

    if (INVISIBLE_SEPARATOR_CODES.has(code)) {
      return {
        allowed: false,
        reason: 'Invisible separator characters detected',
      };
    }
  }

  let currentCombining = 0;
  let maxCombining = 0;

  for (const char of chars) {
    const code = char.codePointAt(0);

    if (code === undefined) {
      continue;
    }

    const isCombining = COMBINING_RANGES.some(
      ([start, end]) => code >= start && code <= end,
    );

    if (isCombining) {
      currentCombining += 1;
    } else {
      maxCombining = Math.max(maxCombining, currentCombining);
      currentCombining = 0;
    }
  }

  maxCombining = Math.max(maxCombining, currentCombining);

  if (maxCombining > 2) {
    return {
      allowed: false,
      reason: 'Excessive combining marks detected',
    };
  }

  return { allowed: true };
}

// ============================================================================
// TEXT NORMALIZATION
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
// PROHIBITED TERMS
// ============================================================================

const PROHIBITED_TERMS: Record<
  string,
  {
    category: string;
    severity: string;
    contextSensitive: boolean;
  }
> = {
  nigger: {
    category: 'slur',
    severity: 'severe',
    contextSensitive: false,
  },
  nigga: {
    category: 'slur',
    severity: 'severe',
    contextSensitive: false,
  },
  faggot: {
    category: 'slur',
    severity: 'severe',
    contextSensitive: false,
  },
  fagget: {
    category: 'slur',
    severity: 'severe',
    contextSensitive: false,
  },
  cracker: {
    category: 'slur',
    severity: 'high',
    contextSensitive: false,
  },
  slave: {
    category: 'historical',
    severity: 'moderate',
    contextSensitive: true,
  },
  kill: {
    category: 'violence',
    severity: 'moderate',
    contextSensitive: true,
  },
  murder: {
    category: 'violence',
    severity: 'moderate',
    contextSensitive: true,
  },
  crackhead: {
    category: 'harassment',
    severity: 'high',
    contextSensitive: false,
  },
  gay: {
    category: 'identity',
    severity: 'low',
    contextSensitive: true,
  },
  retard: {
    category: 'slur',
    severity: 'high',
    contextSensitive: false,
  },
  kike: {
    category: 'slur',
    severity: 'severe',
    contextSensitive: false,
  },
  chink: {
    category: 'slur',
    severity: 'severe',
    contextSensitive: false,
  },
  spic: {
    category: 'slur',
    severity: 'severe',
    contextSensitive: false,
  },
  wetback: {
    category: 'slur',
    severity: 'severe',
    contextSensitive: false,
  },
};

export function checkProhibitedTerms(text: string): {
  prohibited: boolean;
  term?: string;
  severity?: string;
  category?: string;
} {
  const normalized = normalizeForModeration(text);

  if (!normalized) {
    return {
      prohibited: false,
    };
  }

  const words = normalized.split(/\s+/);

  for (const word of words) {
    const config = PROHIBITED_TERMS[word];

    if (!config) {
      continue;
    }

    if (!config.contextSensitive || config.severity === 'severe') {
      return {
        prohibited: true,
        term: word,
        severity: config.severity,
        category: config.category,
      };
    }
  }

  return {
    prohibited: false,
  };
}

// ============================================================================
// MODERATION SERVICE
// ============================================================================

export const moderation = {
  // ==========================================================================
  // CONTENT MODERATION
  // ==========================================================================

  async checkContent(
    userId: string,
    content: string,
    source: string = 'chat',
  ): Promise<ModerationResult> {
    const unicodeCheck = validateUnicodeSafety(content);

    if (!unicodeCheck.allowed) {
      return {
        allowed: false,
        code: 'UNICODE_ABUSE',
        reason: unicodeCheck.reason,
        message:
          'That message contains unsupported or abusive characters. Please rewrite it using normal text.',
      };
    }

    const termCheck = checkProhibitedTerms(content);

    if (
      termCheck.prohibited &&
      termCheck.severity === 'severe'
    ) {
      return {
        allowed: false,
        code: 'PROHIBITED_LANGUAGE',
        reason: 'Prohibited language detected',
        prohibitedTerm: termCheck.term,
        category: termCheck.category,
        severity: termCheck.severity,
        message:
          "That message violates Mai Troll's chat rules and was not sent.",
      };
    }

    try {
      const { data, error } = await supabase.rpc(
        'moderate_user_content',
        {
          p_user_id: userId,
          p_content: content,
          p_source: source,
          p_context: {},
        },
      );

      if (error) {
        console.error(
          '[Moderation] Content moderation RPC failed:',
          error,
        );

        // Preserve existing availability behavior.
        return { allowed: true };
      }

      if (data && !data.allowed) {
        return {
          allowed: false,
          code: data.code,
          reason: data.reason,
          message:
            data.message ||
            "That message violates Mai Troll's chat rules and was not sent.",
        };
      }

      return {
        allowed: true,
      };
    } catch (error) {
      console.error(
        '[Moderation] Content moderation error:',
        error,
      );

      return {
        allowed: true,
      };
    }
  },

  // ==========================================================================
  // USERNAME MODERATION
  // ==========================================================================

  async checkUsername(
    username: string,
    userId?: string,
  ): Promise<{ safe: boolean; reason?: string }> {
    const unicodeCheck = validateUnicodeSafety(username);

    if (!unicodeCheck.allowed) {
      return {
        safe: false,
        reason: 'Username contains unsupported characters.',
      };
    }

    const normalized = normalizeForModeration(username);

    const forbiddenNames = new Set([
      'admin',
      'administrator',
      'moderator',
      'maitroll',
      'maitrolladmin',
      'maitrollsupport',
      'support',
      'official',
      'system',
    ]);

    if (forbiddenNames.has(normalized)) {
      return {
        safe: false,
        reason: 'This username is not allowed.',
      };
    }

    const termCheck = checkProhibitedTerms(username);

    if (termCheck.prohibited) {
      return {
        safe: false,
        reason: 'This username contains prohibited content.',
      };
    }

    try {
      const { data, error } = await supabase.rpc(
        'check_username_safe',
        {
          p_username: username,
          p_user_id: userId,
        },
      );

      if (error) {
        console.error(
          '[Moderation] Username check failed:',
          error,
        );

        return {
          safe: true,
        };
      }

      return {
        safe: Boolean(data?.safe),
        reason: data?.reason,
      };
    } catch (error) {
      console.error(
        '[Moderation] Username check error:',
        error,
      );

      return {
        safe: true,
      };
    }
  },

  // ==========================================================================
  // JAIL STATE
  // ==========================================================================

  /**
   * Get the user's current jail state.
   *
   * CRITICAL:
   *
   * The public.jail table is authoritative for active detention.
   *
   * If a row exists for this user with:
   *
   *     status = 'jailed'
   *
   * then isJailed MUST be true.
   *
   * We intentionally do not determine custody solely from the release
   * timestamp. The backend/database controls when the jail row becomes
   * released.
   */
  async getJailState(userId: string): Promise<JailState> {
    if (!userId) {
      return {
        isJailed: false,
      };
    }

    try {
      // ----------------------------------------------------------------------
      // STEP 1: Read the actual active jail record.
      // ----------------------------------------------------------------------

      const {
        data: jail,
        error: jailError,
      } = await supabase
        .from('jail')
        .select(`
          id,
          user_id,
          release_time,
          scheduled_release_at,
          reason,
          severity,
          bond_amount,
          bond_posted,
          bond_paid,
          arrested_by,
          charge,
          sentence_days,
          status,
          court_date,
          discipline_level,
          jailed_at,
          bond_posted_by,
          case_id,
          created_at
        `)
        .eq('user_id', userId)
        .eq('status', 'jailed')
        .order('created_at', {
          ascending: false,
        })
        .limit(1)
        .maybeSingle();

      // ----------------------------------------------------------------------
      // STEP 2: If the jail table query succeeded, trust it.
      // ----------------------------------------------------------------------

      if (!jailError) {
        if (jail) {
          /*
           * Your current database schema has both release_time and
           * scheduled_release_at.
           *
           * scheduled_release_at takes priority when available.
           * release_time is the fallback.
           */
          const scheduledReleaseAt =
            jail.scheduled_release_at ||
            jail.release_time ||
            undefined;

          const bondAmount = Number(
            jail.bond_amount || 0,
          );

          /*
           * DO NOT calculate custody from the timestamp.
           *
           * status='jailed' means the user is jailed.
           */
          return {
            isJailed: true,

            jailId: jail.id,

            disciplineLevel: Number(
              jail.discipline_level || 0,
            ),

            scheduledReleaseAt,

            bondAmount,

            /*
             * Bond is available only when it has not already been paid
             * or posted and a positive bond amount exists.
             */
            bondAllowed:
              bondAmount > 0 &&
              !Boolean(jail.bond_paid) &&
              !Boolean(jail.bond_posted),

            reason:
              jail.reason ||
              jail.charge ||
              'Violation of MaiTroll community rules',

            severity:
              jail.severity ||
              'moderate',

            jailedAt:
              jail.jailed_at ||
              jail.created_at ||
              undefined,

            arrestedBy:
              jail.arrested_by ||
              undefined,

            courtDate:
              jail.court_date ||
              undefined,

            caseId:
              jail.case_id ||
              jail.id,
          };
        }

        /*
         * The jail query worked and there is no active jailed row.
         *
         * Now it is safe to check the discipline evaluator for any
         * additional backend-derived state.
         */
        try {
          const {
            data: discipline,
            error: disciplineError,
          } = await supabase.rpc(
            'evaluate_user_discipline',
            {
              p_user_id: userId,
            },
          );

          if (
            !disciplineError &&
            discipline &&
            discipline.is_jailed
          ) {
            return {
              isJailed: true,
              jailId: discipline.jail_id,
              disciplineLevel:
                discipline.discipline_level,
              scheduledReleaseAt:
                discipline.scheduled_release_at,
              bondAmount:
                discipline.bond_amount,
              bondAllowed:
                discipline.bond_allowed,
              reason:
                discipline.reason,
              severity:
                discipline.severity,
              jailedAt:
                discipline.jailed_at,
              arrestedBy:
                discipline.arrested_by,
              courtDate:
                discipline.court_date,
              caseId:
                discipline.case_id ||
                discipline.jail_id,
            };
          }
        } catch (disciplineError) {
          console.error(
            '[Moderation] Discipline evaluator failed:',
            disciplineError,
          );
        }

        return {
          isJailed: false,
        };
      }

      // ----------------------------------------------------------------------
      // STEP 3: Direct jail lookup failed.
      //
      // Only now do we use the discipline RPC as a fallback.
      // ----------------------------------------------------------------------

      console.error(
        '[Moderation] Active jail lookup failed:',
        jailError,
      );

      try {
        const {
          data: discipline,
          error: disciplineError,
        } = await supabase.rpc(
          'evaluate_user_discipline',
          {
            p_user_id: userId,
          },
        );

        if (disciplineError || !discipline) {
          console.error(
            '[Moderation] Discipline fallback failed:',
            disciplineError,
          );

          return {
            isJailed: false,
          };
        }

        return {
          isJailed: Boolean(
            discipline.is_jailed,
          ),
          jailId:
            discipline.jail_id,
          disciplineLevel:
            discipline.discipline_level,
          scheduledReleaseAt:
            discipline.scheduled_release_at,
          bondAmount:
            discipline.bond_amount,
          bondAllowed:
            discipline.bond_allowed,
          reason:
            discipline.reason,
          severity:
            discipline.severity,
          jailedAt:
            discipline.jailed_at,
          arrestedBy:
            discipline.arrested_by,
          courtDate:
            discipline.court_date,
          caseId:
            discipline.case_id ||
            discipline.jail_id,
        };
      } catch (fallbackError) {
        console.error(
          '[Moderation] Jail-state fallback failed:',
          fallbackError,
        );

        return {
          isJailed: false,
        };
      }
    } catch (error) {
      console.error(
        '[Moderation] Failed to get jail state:',
        error,
      );

      return {
        isJailed: false,
      };
    }
  },

  // ==========================================================================
  // POST BOND
  // ==========================================================================

  async postBond(
    jailId: string,
  ): Promise<BondResult> {
    if (!jailId) {
      return {
        success: false,
        code: 'INVALID_JAIL_ID',
        message: 'A valid jail record is required.',
      };
    }

    try {
      const {
        data,
        error,
      } = await supabase.rpc(
        'post_jail_bond',
        {
          p_jail_id: jailId,
        },
      );

      if (error) {
        console.error(
          '[Moderation] Post bond RPC failed:',
          error,
        );

        return {
          success: false,
          code: 'FUNCTION_ERROR',
          message:
            error.message ||
            'Failed to post bond.',
        };
      }

      if (data && !data.success) {
        return {
          success: false,
          code: data.code,
          message: data.message,
          data: data.data,
        };
      }

      return {
        success: true,
        code:
          data?.code ||
          'BOND_PAID',
        message:
          data?.message ||
          'Bond posted successfully.',
        data:
          data?.data,
      };
    } catch (error: any) {
      console.error(
        '[Moderation] Post bond error:',
        error,
      );

      return {
        success: false,
        code: 'ERROR',
        message:
          error?.message ||
          'Failed to post bond.',
      };
    }
  },

  // ==========================================================================
  // BAN EVASION
  // ==========================================================================

  async checkBanEvasion(
    userId: string,
  ): Promise<BanEvasionResult> {
    try {
      const {
        data,
        error,
      } = await supabase.rpc(
        'evaluate_ban_evasion',
        {
          p_user_id: userId,
        },
      );

      if (error || !data) {
        return {
          riskScore: 0,
          evasionDetected: false,
          signals: [],
        };
      }

      return {
        riskScore:
          Number(data.risk_score) || 0,

        evasionDetected:
          Boolean(data.evasion_detected),

        signals:
          Array.isArray(data.signals)
            ? data.signals
            : [],
      };
    } catch (error) {
      console.error(
        '[Moderation] Ban evasion check failed:',
        error,
      );

      return {
        riskScore: 0,
        evasionDetected: false,
        signals: [],
      };
    }
  },

  // ==========================================================================
  // CHAT RESTRICTION
  // ==========================================================================

  async checkChatRestriction(
    userId: string,
    streamId?: string,
  ): Promise<{
    restricted: boolean;
    reasons: string[];
  }> {
    try {
      const {
        data,
        error,
      } = await supabase.rpc(
        'check_user_chat_restriction',
        {
          p_user_id: userId,
          p_stream_id: streamId,
        },
      );

      if (error || !data) {
        return {
          restricted: false,
          reasons: [],
        };
      }

      return {
        restricted:
          Boolean(data.restricted),

        reasons:
          Array.isArray(data.reasons)
            ? data.reasons
            : [],
      };
    } catch (error) {
      console.error(
        '[Moderation] Chat restriction check failed:',
        error,
      );

      return {
        restricted: false,
        reasons: [],
      };
    }
  },
};

// ============================================================================
// USER-FACING MESSAGES
// ============================================================================

export const MODERATION_MESSAGES = {
  PROHIBITED_LANGUAGE:
    "That message violates Mai Troll's chat rules and was not sent.",

  UNICODE_ABUSE:
    'That message contains unsupported or abusive characters. Please rewrite it using normal text.',

  USERNAME_NOT_ALLOWED:
    'This username is not allowed.',

  USER_JAILED:
    'You are currently in jail.',

  INSUFFICIENT_TROLL_COINS:
    "You don't have enough Troll Coins to post bond.",

  BOND_PAID:
    'Bond Posted — You Have Been Released',

  RATE_LIMITED:
    'You are sending messages too fast. Please slow down.',
} as const;

export default moderation;