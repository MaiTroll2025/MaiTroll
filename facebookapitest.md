# Facebook API and Supabase Deployment Test

**Project:** `gejtbllazzighxwxudyu`  
**Supabase URL:** `https://gejtbllazzighxwxudyu.supabase.co`  
**Tested:** 2026-10-08  
**Result:** Supabase deployment and safe smoke tests passed. Meta credential validity and Page publishing remain unverified pending an authenticated Facebook OAuth connection.

## Deployment

| Function | Status | Version | Result |
|---|---:|---:|---|
| `facebook-oauth-callback` | ACTIVE | 2 | Deployed with gateway JWT verification disabled for the OAuth redirect callback. |
| `facebook-oauth-init` | ACTIVE | 2 | Deployed with JWT verification enabled. |
| `facebook-integration` | ACTIVE | 1 | Deployed with JWT verification enabled. |
| `facebook-publish` | ACTIVE | 2 | Deployed with JWT verification enabled. |

Migration `20291010000001` is recorded as applied. Remote checks confirmed `role_permission_matrix`, `facebook_page_connections`, `facebook_publications`, and `set_wall_post_facebook_featured(uuid, boolean)` exist.

## Secret configuration

Secret names were checked using the Supabase CLI. Secret values were not written to this report or intentionally logged.

| Secret | Present | Notes |
|---|---:|---|
| `FACEBOOK_APP_ID` | Yes | Existing configured name. |
| `FACEBOOK_APP_SECRET` | Yes | Existing configured name. |
| `SUPABASE_URL` | Yes | Present. |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Present. |
| `META_APP_ID` / `META_APP_SECRET` | No | The OAuth functions now fall back to `FACEBOOK_APP_ID` / `FACEBOOK_APP_SECRET`. |
| `META_GRAPH_API_VERSION` | No | Optional; defaults to `v26.0`. |
| `META_OAUTH_REDIRECT_URI` | No | Optional; defaults to this project's `facebook-oauth-callback` endpoint. |
| `META_PAGE_ID` | No | Optional; required only when selecting a specific Page among multiple managed Pages. |
| `SITE_URL` | No | Optional; the function uses its built-in fallback. |

The OAuth callback returned a redirect with `reason=invalid_state` when given a deliberately invalid test state. This is the expected response for the test and shows that the callback did not stop at its missing-app-configuration check. It does **not** prove that Meta accepts the app ID/secret values.

## API smoke tests

| Test | Result | Interpretation |
|---|---|---|
| OAuth callback endpoint, invalid test state | HTTP 302 to the Marketing page with `facebook=error&reason=invalid_state` | Public callback is reachable and handles invalid state as expected. No OAuth code or Page token was supplied. |
| Integration endpoint, unauthenticated POST | HTTP 401 `UNAUTHORIZED_NO_AUTH_HEADER` | Protected endpoint is reachable and rejects requests without authorization. |
| Integration endpoint, CORS preflight | HTTP 200 | Edge Function responds to `OPTIONS` with configured CORS headers. |
| Meta Graph API `v26.0/me?fields=id`, without credentials | HTTP 400, OAuth error code 2500 (active access token required) | Meta Graph API host and version endpoint responded. This is an expected unauthenticated response, not a credential-validation test. |

## Remaining verification

- Secret presence and naming are verified; **the actual Facebook app credentials have not been authenticated against Meta**. Supabase's secret listing does not expose values, and the safe smoke tests do not send them to Meta.
- Complete the administrator OAuth flow to verify the app credentials, required permissions, Page selection, and Page-token storage.
- Run the dashboard's connection test after OAuth to validate the stored Page token and Page read permissions.
- A real Facebook post was not attempted; doing so would create an external post and requires explicit Page authorization.
