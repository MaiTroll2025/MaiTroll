import { supabase } from './supabase';

const FORUM_KEYWORDS = [
  'scam', 'fraud', 'phishing', 'illegal', 'drugs', 'weapon', 'hate', 'slur',
  'nazi', 'terror', 'bomb', 'suicide', 'self-harm', 'child', 'minor', 'porn',
  'xxx', 'nsfw', 'sex', 'naked', 'nude',
];

function containsKeyword(content: string): { matched: string } | null {
  const lower = content.toLowerCase();
  for (const keyword of FORUM_KEYWORDS) {
    if (lower.includes(keyword)) {
      return { matched: keyword };
    }
  }
  return null;
}

export function checkForumKeywords(content: string): { allowed: boolean; matched?: string; message?: string } {
  const hit = containsKeyword(content);
  if (hit) {
    return {
      allowed: false,
      matched: hit.matched,
      message: `Post contains prohibited keyword: "${hit.matched}"`,
    };
  }
  return { allowed: true };
}

export async function checkModeration(content: string, context: string): Promise<{ allowed: boolean; action?: string; message?: string }> {
  // Fast local keyword block for forums/replies before hitting the backend
  if (context === 'forum_post' || context === 'forum_reply') {
    const keywordCheck = checkForumKeywords(content);
    if (!keywordCheck.allowed) {
      return {
        allowed: false,
        message: keywordCheck.message,
      };
    }
  }

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return { allowed: true };
  const { data, error } = await supabase.functions.invoke('moderation-check', {
    body: { user_id: session.user.id, content, context },
  });
  if (error) return { allowed: true };
  return data ?? { allowed: true };
}
