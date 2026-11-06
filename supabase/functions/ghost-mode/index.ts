import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

async function isCEO(userId: string): Promise<boolean> {
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role, is_admin, is_ceo')
    .eq('id', userId)
    .maybeSingle();

  return !!(profile?.is_ceo || profile?.role === 'ceo' || profile?.is_admin);
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization') || '';
    const token = authHeader.replace(/^Bearer\s+/i, '');
    if (!token || token === authHeader) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!(await isCEO(user.id))) {
      return new Response(JSON.stringify({ error: 'Only CEOs can use ghost mode' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const url = new URL(req.url);
    const path = url.pathname.split('/').pop();

    if (path === 'ghost-mode' && req.method === 'POST') {
      const body = await req.json();
      const { action, streamId } = body;

      if (!streamId) {
        return new Response(JSON.stringify({ error: 'streamId required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data: stream, error: streamError } = await supabase
        .from('streams')
        .select('id, livekit_room_name, status, is_live')
        .eq('id', streamId)
        .maybeSingle();

      if (streamError || !stream) {
        return new Response(JSON.stringify({ error: 'Stream not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (!stream.is_live && stream.status !== 'live') {
        return new Response(JSON.stringify({ error: 'Stream is not live' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (action === 'leave') {
        const { error } = await supabase
          .from('ghost_stream_sessions')
          .delete()
          .eq('stream_id', streamId)
          .eq('user_id', user.id);

        if (error) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        return new Response(JSON.stringify({ success: true, message: 'Ghost session ended' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data: existingSession } = await supabase
        .from('ghost_stream_sessions')
        .select('id')
        .eq('stream_id', streamId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (existingSession) {
        return new Response(JSON.stringify({
          success: true,
          message: 'Ghost session already exists',
          sessionId: existingSession.id,
          roomName: stream.livekit_room_name || streamId,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data, error } = await supabase
        .from('ghost_stream_sessions')
        .insert({
          stream_id: streamId,
          user_id: user.id,
          microphone_enabled: true,
          camera_enabled: false,
        })
        .select()
        .single();

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({
        success: true,
        sessionId: data.id,
        streamId: data.stream_id,
        roomName: stream.livekit_room_name || streamId,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (path === 'ghost-mode' && req.method === 'GET') {
      const url = new URL(req.url);
      const streamId = url.searchParams.get('streamId');

      if (!streamId) {
        return new Response(JSON.stringify({ error: 'streamId required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data, error } = await supabase
        .from('ghost_stream_sessions')
        .select('id, user_id, joined_at, microphone_enabled, camera_enabled')
        .eq('stream_id', streamId);

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ success: true, sessions: data || [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error?.message || 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});