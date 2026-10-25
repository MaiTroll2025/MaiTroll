import { supabase } from './supabase';

export async function checkModeration(content: string, context: string): Promise<{ allowed: boolean; action?: string; message?: string }> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return { allowed: true };
  const { data, error } = await supabase.functions.invoke('moderation-check', {
    body: { user_id: session.user.id, content, context },
  });
  if (error) return { allowed: true };
  return data ?? { allowed: true };
}