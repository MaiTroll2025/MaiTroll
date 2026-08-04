# MaiTalent.fun integration request for Mai Troll promo redemption

Hi MaiTalent.fun team,

We are integrating your promo redemption flow with Mai Troll. Below are the values we are providing from Mai Troll and the request contract your backend should implement.

## Mai Troll values to use

- `TROLL_CITY_PROMO_VERIFY_URL`
  - `https://yjxpwfalenorzrqxwmtr.supabase.co/functions/v1/redeem-maitalent-promo`
- `TROLL_CITY_PROMO_REDEEM_URL`
  - `https://yjxpwfalenorzrqxwmtr.supabase.co/functions/v1/redeem-maitalent-promo`
- `TROLL_CITY_PROMO_SECRET`
  - `gj3f29QZx4vHn6A8r5S2pL1u9Jd0Yc7F`

> Note: We are using a single atomic endpoint for verification and redemption. MaiTalent.fun should call this endpoint once per promo code to validate and redeem the code in one secure transaction.

## Expected request format

```http
POST /functions/v1/redeem-maitalent-promo HTTP/1.1
Host: yjxpwfalenorzrqxwmtr.supabase.co
Authorization: Bearer gj3f29QZx4vHn6A8r5S2pL1u9Jd0Yc7F
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

### Request field definitions

- `code` (string, required): the promo card code issued by Mai Troll
- `requestor.platform` (string, optional but recommended): should be `maitalent.fun`
- `requestor.accountId` (string, optional): MaiTalent.fun user id for logging / reconciliation

## Expected success response

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

### Success response fields

- `success`: `true`
- `code`: the redeemed promo code
- `tokenAmount`: the trusted amount MaiTalent.fun should credit
- `promoId`: Mai Troll internal promo identifier
- `status`: `redeemed`
- `redeemedAt`: ISO timestamp of redemption

## Expected error response

```json
{
  "success": false,
  "error": "Promo code already redeemed",
  "code": "ALREADY_REDEEMED"
}
```

### Standard error codes

- `EXPIRED_CODE`
- `ALREADY_REDEEMED`
- `INVALID_CODE`
- `REVOKED_CODE`
- `DAILY_CAP_EXCEEDED`
- `UNAUTHORIZED`
- `INVALID_REQUEST`
- `SERVER_ERROR`

## What we need from MaiTalent.fun

Please provide the values you plan to use on your side for this promo integration.

At minimum, send us these values:

- `MAITALENT_PROMO_SECRET` (the secret you will store on the MaiTalent.fun backend for calling Mai Troll)
- `MAITALENT_PROMO_CLIENT_NAME` or `MAITALENT_PROMO_PLATFORM_ID` (your identifier for logging and audit)

If you want to support webhook callbacks in the future, please also provide:

- `MAITALENT_PROMO_WEBHOOK_SECRET`

## Additional notes

- We do not require any extra webhook signing value from you for this redemption endpoint today.
- If you want, we can also agree on a second callback endpoint later for redemption receipts or status notifications.

## Summary

Use the single endpoint:

- `POST /functions/v1/redeem-maitalent-promo`

Store these values in your environment:

- `TROLL_CITY_PROMO_VERIFY_URL`
- `TROLL_CITY_PROMO_REDEEM_URL`
- `TROLL_CITY_PROMO_SECRET`

---

## MaiTalent.fun confirmation

MaiTalent.fun will provide the following values:

- `MAITALENT_PROMO_SECRET`: <generated-secret>
- `MAITALENT_PROMO_CLIENT_NAME`: `maitalent.fun`
- `MAITALENT_PROMO_PLATFORM_ID`: `maitalent.fun`

Optional future webhook support:

- `MAITALENT_PROMO_WEBHOOK_SECRET`: <generated-secret>

We will call your single atomic endpoint using the request and auth format above, and we will use the success/error response contract you outlined.

We do not require any additional webhook signing value for this redemption flow today.

Please let us know if you need any other identifier or header from our side for the integration.
