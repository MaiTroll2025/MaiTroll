export const allowedOrigins = [
  'https://maitalent.fun',
  'https://www.maitalent.fun',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://192.168.1.193:5178',
  'http://localhost:5178',
]

export function resolveCorsOrigin(requestOrigin: string | null): string {
  if (requestOrigin && allowedOrigins.includes(requestOrigin)) {
    return requestOrigin
  }
  return allowedOrigins[0]
}

export function corsHeaders(requestOrigin: string | null): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': resolveCorsOrigin(requestOrigin),
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Headers':
      'authorization, x-client-info, apikey, content-type, x-api-key',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  }
}

export function withCors(
  body: unknown,
  status = 200,
  request?: Request | null,
): Response {
  const requestOrigin = request?.headers.get('origin') ?? null;
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders(requestOrigin),
      'Content-Type': 'application/json',
    },
  });
}

export function handleCorsPreflight(req?: Request | null): Response {
  const requestOrigin = req?.headers.get('origin') ?? null;
  return new Response(null, {
    status: 204,
    headers: {
      ...corsHeaders(requestOrigin),
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
    },
  });
}

export function unauthorizedResponse(
  message = 'Unauthorized',
  requestOrigin: string | null = null,
): Response {
  return new Response(
    JSON.stringify({ success: false, error: message, code: 'UNAUTHORIZED' }),
    { status: 401, headers: { ...corsHeaders(requestOrigin), 'Content-Type': 'application/json' } },
  )
}
