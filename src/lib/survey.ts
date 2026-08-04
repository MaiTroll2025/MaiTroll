import { supabase } from './supabase'
import { createNotification } from './notifications'
import type { WeeklySurvey, SurveyResponse, SurveyWithResponseCount } from '../types/survey'

export async function getActiveSurveyForCurrentWeek(): Promise<WeeklySurvey | null> {
  const now = new Date()
  const dayOfWeek = now.getDay()
  const weekStart = new Date(now)
  weekStart.setDate(now.getDate() - dayOfWeek)
  weekStart.setHours(0, 0, 0, 0)
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekStart.getDate() + 6)
  weekEnd.setHours(23, 59, 59, 999)

  const { data, error } = await supabase
    .from('weekly_surveys')
    .select('*')
    .eq('is_active', true)
    .gte('week_start_date', weekStart.toISOString().split('T')[0])
    .lte('week_end_date', weekEnd.toISOString().split('T')[0])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    console.error('[survey] Failed to fetch active survey:', error)
    return null
  }
  return data as WeeklySurvey | null
}

export async function getSurveyById(surveyId: string): Promise<WeeklySurvey | null> {
  const { data, error } = await supabase
    .from('weekly_surveys')
    .select('*')
    .eq('id', surveyId)
    .maybeSingle()

  if (error) {
    console.error('[survey] Failed to fetch survey:', error)
    return null
  }
  return data as WeeklySurvey | null
}

export async function hasUserRespondedToSurvey(surveyId: string, userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('survey_responses')
    .select('id')
    .eq('survey_id', surveyId)
    .eq('user_id', userId)
    .maybeSingle()

  if (error && error.code !== 'PGRST116') {
    console.error('[survey] Failed to check response:', error)
  }
  return !!data
}

export async function submitSurveyResponse(
  surveyId: string,
  userId: string,
  answers: Record<string, string>
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('survey_responses')
      .insert({
        survey_id: surveyId,
        user_id: userId,
        answers,
      })

    if (error) {
      if (error.code === '23505') {
        return { success: false, error: 'You have already submitted a response for this survey.' }
      }
      throw error
    }
    return { success: true }
  } catch (err: any) {
    console.error('[survey] Failed to submit response:', err)
    return { success: false, error: err?.message || 'Failed to submit response' }
  }
}

export async function createSurvey(survey: {
  title: string
  description?: string
  week_start_date: string
  week_end_date: string
  questions?: any[]
  target_roles?: string[]
  created_by?: string
}): Promise<{ success: boolean; survey?: WeeklySurvey; error?: string }> {
  try {
    const { data, error } = await supabase
      .from('weekly_surveys')
      .insert({
        title: survey.title,
        description: survey.description || null,
        week_start_date: survey.week_start_date,
        week_end_date: survey.week_end_date,
        questions: survey.questions || [
          { id: 'changes', label: 'What needs to be changed?', type: 'textarea', required: false },
          { id: 'issues', label: 'Any issues you are experiencing?', type: 'textarea', required: false },
          { id: 'tips', label: 'What would you like to see next?', type: 'textarea', required: false },
        ],
        target_roles: survey.target_roles || [],
        created_by: survey.created_by || null,
        is_active: true,
      })
      .select()
      .single()

    if (error) throw error
    return { success: true, survey: data as WeeklySurvey }
  } catch (err: any) {
    console.error('[survey] Failed to create survey:', err)
    return { success: false, error: err?.message || 'Failed to create survey' }
  }
}

export async function getAllSurveys(): Promise<SurveyWithResponseCount[]> {
  const { data, error } = await supabase
    .from('weekly_surveys')
    .select(`
      *,
      survey_responses(count)
    `)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[survey] Failed to fetch surveys:', error)
    return []
  }
  return (data || []).map((s: any) => ({
    ...s,
    response_count: s.survey_responses?.[0]?.count || 0,
  })) as SurveyWithResponseCount[]
}

export async function getSurveyResponses(surveyId: string): Promise<SurveyResponse[]> {
  // DEBUG: Check current auth state
  const { data: sessionData } = await supabase.auth.getSession();
  console.log('[survey DEBUG] Current session:', sessionData?.session?.user?.id || 'NO SESSION');
  console.log('[survey DEBUG] Fetching responses for survey:', surveyId);

  // DEBUG: Count all responses for this survey (no RLS filter on user)
  const { count: totalCount } = await supabase
    .from('survey_responses')
    .select('*', { count: 'exact', head: true })
    .eq('survey_id', surveyId);
  console.log('[survey DEBUG] Total rows in DB for this survey (with RLS):', totalCount);

  const { data, error } = await supabase
    .from('survey_responses')
    .select('*')
    .eq('survey_id', surveyId)
    .order('submitted_at', { ascending: false })

  console.log('[survey DEBUG] Query result data length:', data?.length, 'error:', error);

  if (error) {
    console.error('[survey] Failed to fetch responses:', error)
    return []
  }
  return (data || []) as SurveyResponse[]
}

export async function getAllResponses(): Promise<SurveyResponse[]> {
  const { data, error } = await supabase
    .from('survey_responses')
    .select(`
      *,
      weekly_surveys(title, week_start_date)
    `)
    .order('submitted_at', { ascending: false })

  if (error) {
    console.error('[survey] Failed to fetch all responses:', error)
    return []
  }
  return (data || []) as any[]
}

export function exportResponsesCSV(responses: any[], survey?: WeeklySurvey): string {
  const questions = survey?.questions || [
    { id: 'changes', label: 'What needs to be changed?' },
    { id: 'issues', label: 'Any issues you are experiencing?' },
    { id: 'tips', label: 'What would you like to see next?' },
  ]

  const headers = ['Response ID', 'User ID', 'Survey', 'Submitted At', ...questions.map(q => q.label)]
  const rows = responses.map(r => {
    const answers = typeof r.answers === 'string' ? JSON.parse(r.answers) : r.answers
    return [
      r.id,
      r.user_id,
      r.weekly_surveys?.title || r.survey_id,
      new Date(r.submitted_at).toLocaleString(),
      ...questions.map(q => answers?.[q.id] || ''),
    ].map(v => `"${String(v || '').replace(/"/g, '""')}"`)
  })

  return [headers.map(h => `"${h}"`).join(','), ...rows.map(r => r.join(','))].join('\n')
}

export async function notifySurveyAvailable(userIds: string[], surveyTitle: string, surveyId: string): Promise<void> {
  for (const userId of userIds) {
    await createNotification(
      userId,
      'survey',
      '📋 Weekly Survey Available',
      `Share your feedback: "${surveyTitle}". Your input helps improve Mai Troll!`,
      { survey_id: surveyId, action_url: `/survey/${surveyId}` }
    )
  }
}

export async function toggleSurveyActive(surveyId: string, isActive: boolean): Promise<boolean> {
  const { error } = await supabase
    .from('weekly_surveys')
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq('id', surveyId)

  if (error) {
    console.error('[survey] Failed to toggle survey:', error)
    return false
  }
  return true
}

export async function deleteSurvey(surveyId: string): Promise<boolean> {
  const { error } = await supabase
    .from('weekly_surveys')
    .delete()
    .eq('id', surveyId)

  if (error) {
    console.error('[survey] Failed to delete survey:', error)
    return false
  }
  return true
}
