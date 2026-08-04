# Mai Troll Promo Redemption API Contract

This document describes the contract MaiTalent.fun should use to redeem Mai Troll promo cards.

## Recommended endpoint

- **URL:** `POST /functions/v1/redeem-maitalent-promo`
- **Full runtime URL:** `https://<PROJECT_REF>.supabase.co/functions/v1/redeem-maitalent-promo`
- **HTTP method:** `POST`

## Purpose

MaiTalent.fun should call this single atomic endpoint to:

1. validate that the promo code is a valid Mai Troll code,
2. verify that the code is signed and untampered,
3. verify that the code is not expired,
4. verify that the code has not already been redeemed,
5. mark the code as redeemed atomically,
6. return the trusted token amount to credit on MaiTalent.fun.

This endpoint must be the only redemption call used by MaiTalent.fun to prevent double-redemption races.

## Required headers

- `Content-Type: application/json`
- `Authorization: Bearer <TROLL_CITY_SERVICE_TOKEN>`
  - This token must be issued by Mai Troll and accepted by the Mai Troll redemption endpoint.
  - It may also be implemented as an API key header such as `x-api-key: <TROLL_CITY_API_KEY>` if agreed.
- `X-Client-Platform: maitalent.fun` (recommended for audit/logging)

## Required request body

```json
{
  "code": "TC-ABC123-2026",
  "requestor": {
    "platform": "maitalent.fun",
    "accountId": "mt-user-12345"
  }
}
```

### Field definitions

- `code` (string, required): the promo card code issued by Mai Troll.
- `requestor.platform` (string, optional but recommended): the caller platform, e.g. `maitalent.fun`.
- `requestor.accountId` (string, optional): the MaiTalent.fun user identifier for logging and reconciliation.

## Success response format

```json
{
  "success": true,
  "code": "TC-ABC123-2026",
  "tokenAmount": 40,
  "promoId": "d4f8915a-3e56-4a91-8a5f-aab12c3e4d5f",
  "status": "redeemed",
  "redeemedAt": "2026-07-03T14:32:07.000Z"
}
```

### Field definitions

- `success` (boolean): always `true` for a successful redemption.
- `code` (string): the promo code that was redeemed.
- `tokenAmount` (number): the exact token amount MaiTalent.fun should trust and credit.
- `promoId` (string): Mai Troll’s internal promo card identifier or UUID.
- `status` (string): should be `redeemed` on success.
- `redeemedAt` (string): ISO timestamp when Mai Troll marked the code redeemed.

## Error response format

```json
{
  "success": false,
  "error": "Promo code already redeemed",
  "code": "ALREADY_REDEEMED"
}
```

### Error response contract

- `success` (boolean): always `false` on failure.
- `error` (string): human-readable error description.
- `code` (string): machine-friendly error code.

## Expected error codes

| Error code | Meaning |
| --- | --- |
| `EXPIRED_CODE` | The promo card has expired. |
| `ALREADY_REDEEMED` | The promo card was already redeemed. |
| `INVALID_CODE` | The provided promo code is invalid or malformed. |
| `REVOKED_CODE` | The promo code was revoked by Mai Troll. |
| `DAILY_CAP_EXCEEDED` | The user exceeded their daily token cap before redemption. |
| `UNAUTHORIZED` | Missing or invalid auth token. |
| `INVALID_REQUEST` | Request body or fields are invalid. |
| `NOT_IMPLEMENTED` | The endpoint is not implemented yet. |
| `SERVER_ERROR` | Generic server failure. |

## Signature / HMAC validation method

Mai Troll promo cards must be secured by a signature mechanism so MaiTalent.fun can trust the returned token amount.

### Recommended security model

1. Each promo card contains a signed payload or a signed token.
2. Mai Troll signs the promo card with a server-side secret using HMAC-SHA256.
3. The redemption endpoint validates the signature before processing.
4. MaiTalent.fun does not need to verify the signature itself; it relies on Mai Troll’s authenticated endpoint.

### Example signed payload

- `promo_code`: `TC-ABC123-2026`
- `token_amount`: `40`
- `expires_at`: `2026-07-10T00:00:00.000Z`
- `issued_at`: `2026-07-03T12:00:00.000Z`
- `signature`: `base64url(hmac_sha256(secret, payload))`

### Required environment variables for Mai Troll

- `SUPABASE_URL`: Supabase project URL.
- `SUPABASE_SERVICE_ROLE_KEY`: Supabase service role key for atomic redemption transactions.
- `Mai Troll_PROMO_SIGNING_SECRET`: secret used to generate/verify promo card signatures.
- `Mai Troll_PROMO_API_KEY` or `Mai Troll_SERVICE_TOKEN`: token used by MaiTalent.fun for endpoint authentication.

## Example valid request

```http
POST /functions/v1/redeem-maitalent-promo HTTP/1.1
Host: <PROJECT_REF>.supabase.co
Authorization: Bearer xxxxxxxxxxxxxxxxxxxxx
Content-Type: application/json
X-Client-Platform: maitalent.fun

{
  "code": "TC-ABC123-2026",
  "requestor": {
    "platform": "maitalent.fun",
    "accountId": "mt-user-12345"
  }
}
```

## Example valid response

```json
{
  "success": true,
  "code": "TC-ABC123-2026",
  "tokenAmount": 40,
  "promoId": "d4f8915a-3e56-4a91-8a5f-aab12c3e4d5f",
  "status": "redeemed",
  "redeemedAt": "2026-07-03T14:32:07.000Z"
}
```

## Example error responses

### Expired code

```json
{
  "success": false,
  "error": "Promo code expired",
  "code": "EXPIRED_CODE"
}
```

### Already redeemed code

```json
{
  "success": false,
  "error": "Promo code already redeemed",
  "code": "ALREADY_REDEEMED"
}
```

### Invalid code

```json
{
  "success": false,
  "error": "Invalid promo code",
  "code": "INVALID_CODE"
}
```

### Revoked code

```json
{
  "success": false,
  "error": "Promo code revoked",
  "code": "REVOKED_CODE"
}
```

### Daily cap exceeded

```json
{
  "success": false,
  "error": "Promo redemption would exceed daily cap",
  "code": "DAILY_CAP_EXCEEDED"
}
```

## Recommended usage guidance for MaiTalent.fun

1. Use the single atomic endpoint, not separate verify and redeem calls.
2. Send the full promo `code` and include the authenticated service header.
3. Trust only the returned `tokenAmount` field from the success response.
4. Store `promoId` or `code` as the redemption reference in MaiTalent.fun’s local transaction record.
5. On any non-success response, do not credit tokens and surface the `error`/`code` details.

## Fields MaiTalent.fun should store

- `promoCode` or `code`
- `promoId` (Mai Troll internal promo record id)
- `tokenAmount`
- `redeemedAt`
- `status` (`redeemed`)
- `platform` / `accountId` (optional requestor metadata)

## Why one atomic endpoint

A single atomic endpoint is required to avoid race conditions and duplicate redemption. If verification and redemption were split into two separate endpoints, MaiTalent.fun could receive a valid response but still fail to redeem, causing inconsistent state.

## Trust boundary

- The exact token amount field MaiTalent.fun should trust is: `tokenAmount`.
- The redemption reference field MaiTalent.fun should store locally is: `promoId` (and/or `code`).

## Summary

Use:

- `POST /functions/v1/redeem-maitalent-promo`
- `Authorization: Bearer <TROLL_CITY_SERVICE_TOKEN>`
- body `{ "code": "..." }`
- success returns `tokenAmount`
- error returns machine-readable `code`

MaiTalent.fun must treat this endpoint as the single source of truth for all Mai Troll promo card redemptions.