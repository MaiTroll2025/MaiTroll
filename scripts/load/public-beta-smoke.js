/* global __ENV */
import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:5173';
const SUPABASE_URL = __ENV.SUPABASE_URL;
const SUPABASE_ANON_KEY = __ENV.SUPABASE_ANON_KEY;
const STREAM_ID = __ENV.STREAM_ID;

export const options = {
  thresholds: {
    http_req_failed: ['rate<0.02'],
    http_req_duration: ['p(95)<800'],
  },
  scenarios: {
    anonymous_public_pages: {
      executor: 'ramping-vus',
      stages: [
        { duration: '1m', target: Number(__ENV.PUBLIC_VUS || 50) },
        { duration: '3m', target: Number(__ENV.PUBLIC_VUS || 50) },
        { duration: '1m', target: 0 },
      ],
      exec: 'publicPages',
    },
    supabase_lobby_reads: {
      executor: 'constant-vus',
      vus: Number(__ENV.SUPABASE_VUS || 10),
      duration: __ENV.SUPABASE_DURATION || '3m',
      exec: 'supabaseReads',
    },
  },
};

export function publicPages() {
  const paths = ['/', '/login', '/broadcast', '/tcnn', '/terms', '/privacy', '/refunds', '/safety'];
  const path = paths[Math.floor(Math.random() * paths.length)];
  const res = http.get(`${BASE_URL}${path}`);
  check(res, {
    'page status ok': (r) => r.status >= 200 && r.status < 500,
    'page not blank': (r) => String(r.body || '').length > 500,
  });
  sleep(1);
}

export function supabaseReads() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    sleep(1);
    return;
  }

  const headers = {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
  };

  const streamQuery = STREAM_ID
    ? `/rest/v1/streams?id=eq.${STREAM_ID}&select=id,title,is_live,viewer_count,current_viewers,total_likes&limit=1`
    : '/rest/v1/streams?select=id,title,is_live,viewer_count,current_viewers,total_likes&is_live=eq.true&limit=20';

  const res = http.get(`${SUPABASE_URL}${streamQuery}`, { headers });
  check(res, {
    'supabase read ok': (r) => r.status === 200,
    'supabase read bounded': (r) => String(r.body || '').length < 20000,
  });
  sleep(1);
}
