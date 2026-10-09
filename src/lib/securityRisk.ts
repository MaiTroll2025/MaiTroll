/**
 * Calculate risk level based on risk score
 * @param score - The risk score (0-100+)
 * @returns risk level string
 */
import { supabase } from './supabase';

export const calculateRiskLevel = (score: number): 'low' | 'medium' | 'high' | 'critical' => {
  if (score >= 90) return 'critical';
  if (score >= 60) return 'high';
  if (score >= 25) return 'medium';
  return 'low';
};

/**
 * Update user risk score in the database
 * This function is typically called via the log_security_event RPC
 * but we expose it for direct use if needed
 * @param userId - The user ID
 * @param additionalScore - The amount to increase the risk score by
 */
export const updateUserRiskScore = async (userId: string, additionalScore: number) => {
  if (!userId) return;

  try {
    // First, get the current risk score
    const { data: currentData, error: fetchError } = await supabase
      .from('security_user_risk_scores')
      .select('risk_score, risk_level')
      .eq('user_id', userId)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116 means no rows returned
      throw fetchError;
    }

    const currentScore = currentData?.risk_score || 0;
    const newScore = Math.min(currentScore + additionalScore, 100); // Cap at 100
    const newRiskLevel = calculateRiskLevel(newScore);

    // Upsert the risk score
    const { error: upsertError } = await supabase
      .from('security_user_risk_scores')
      .upsert({
        user_id: userId,
        risk_score: newScore,
        risk_level: newRiskLevel,
        last_event_at: new Date().toISOString(),
        // We don't update other fields like failed_login_count here
        // those would be updated separately in the RPC
      }, {
        onConflict: 'user_id'
      });

    if (upsertError) throw upsertError;
  } catch (error) {
    console.error('Failed to update user risk score:', error);
    throw error;
  }
};

/**
 * Reset a user's risk score to zero
 * @param userId - The user ID
 */
export const resetUserRiskScore = async (userId: string) => {
  if (!userId) return;

  try {
    const { error } = await supabase
      .from('security_user_risk_scores')
      .update({
        risk_score: 0,
        risk_level: 'low',
        last_event_at: new Date().toISOString(),
        // Note: We're not resetting failed_login_count or suspicious_action_count here
        // Those would be reset separately if needed
      })
      .eq('user_id', userId);

    if (error) throw error;
  } catch (error) {
    console.error('Failed to reset user risk score:', error);
    throw error;
  }
};

/**
 * Get risk score for a user
 * @param userId - The user ID
 * @returns The risk score object or null if not found
 */
export const getUserRiskScore = async (userId: string) => {
  if (!userId) return null;

  try {
    const { data, error } = await supabase
      .from('security_user_risk_scores')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error && error.code === 'PGRST116') return null; // No rows found
    if (error) throw error;

    return data;
  } catch (error) {
    console.error('Failed to get user risk score:', error);
    throw error;
  }
};