import { supabase } from '../lib/supabase';
import { generateUUID } from '../lib/uuid';

export interface SendChatResult {
  ok: boolean;
  error?: string;
  envelope?: any;
}

/**
 * Routes a chat message through the `send-message` Edge Function, which enforces
 * chat-blocks, mutes, bans and broadcaster locks server-side before anything is
 * broadcast or persisted. Use this for every chat-send path (including the
 * ephemeral floating chat) so moderation can never be bypassed by client state.
 *
 * Returns the signed envelope on success. On failure `error` holds the
 * human-readable message returned by the Edge Function.
 */
export async function sendChatThroughGate(opts: {
  streamId: string;
  content: string;
  type?: 'chat' | 'gift' | 'mod' | 'sys' | 'battle' | 'count';
  isHighlighted?: boolean;
  highlightColor?: string;
}): Promise<SendChatResult> {
  const { streamId, content, type = 'chat', isHighlighted, highlightColor } = opts;

  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !sessionData.session) {
    return { ok: false, error: 'Not authenticated' };
  }

  const txn_id = generateUUID();

  try {
    const response = await fetch(`${import.meta.env.VITE_EDGE_FUNCTIONS_URL}/send-message`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${sessionData.session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type,
        stream_id: streamId,
        txn_id,
        data: { content, is_highlighted: isHighlighted, highlight_color: highlightColor },
      }),
    });

    const contentType = response.headers.get('content-type') || '';
    const rawText = await response.text();
    const parsed = contentType.toLowerCase().includes('application/json') && rawText.trim().length > 0
      ? JSON.parse(rawText)
      : undefined;

    if (!response.ok) {
      const errMsg = parsed?.error || parsed?.message || rawText || response.statusText;
      return { ok: false, error: String(errMsg) };
    }

    return { ok: true, envelope: parsed };
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Failed to send message' };
  }
}
