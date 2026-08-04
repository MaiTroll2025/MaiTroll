# Cash App Manual Coin Order System

## Overview
This document explains the Cash App payment flow for purchasing coins through manual verification by Admin and Secretary roles.

## User Flow

### 1. User Initiates Cash App Payment
- User opens **Coin Store Modal** (any page with coins)
- Selects coin package
- Clicks "💳 Card" or "📱 Cash App" tab to switch payment method
- Clicks "Send via Cash App" button
- **CashAppPaymentModal** opens

### 2. Payment Request Creation
- User sees payment instructions:
  - **Cash App**: $Mai Troll95
  - **Amount**: e.g., $4.99
  - **Note**: e.g., `USER123-500` (auto-generated: username prefix + coin count)
- User copies CashApp address and note
- User confirms: "Done - I'll Complete Payment"
- Order created in `manual_coin_orders` table with status `pending`
- Modal closes with success toast

### 3. User Sends Cash App Payment
- User opens Cash App app
- Sends ${amount} to **$Mai Troll95**
- Includes reference **note** in payment message
- System admin (@Mai Troll95 owner) receives the payment

## Admin/Secretary Workflow

### 4. Secretary Reviews Order (Optional)
- Secretary can view pending orders in Admin Dashboard → **Manual Orders** tab
- Secretary can:
  - View user details (username, email, profile)
  - See order amount & coin count
  - See the suggested note/reference
  - Add notes or comments
  - Forward request to Admin with verification message

### 5. Admin Verifies & Approves
- Admin checks Cash App $Mai Troll95 account
- Verifies payment was received with matching note
- Goes to Admin Dashboard → **Manual Orders** tab
- Finds the pending order
- **Optional**: Enters external transaction ID (Cash App TX reference)
- Clicks **"Mark Paid & Credit"** button

### 6. System Processes Approval
1. Order status changes from `pending` → `paid` → `fulfilled`
2. User's `troll_coins` balance incremented
3. Transaction logged in coin transaction table
4. Admin dashboard updated with new balances
5. User receives notification (future: email/in-app alert)

## Database Schema

### manual_coin_orders
```sql
id                UUID PRIMARY KEY
user_id           UUID (FOREIGN KEY → auth.users)
package_id        UUID (FOREIGN KEY → coin_packages, optional)
coins             INTEGER (amount of coins to grant)
amount_cents      INTEGER (price in cents, e.g., 499 = $4.99)
status            ENUM ('pending', 'paid', 'fulfilled', 'canceled')
note_suggested    VARCHAR (reference for Cash App, e.g., 'USER123-500')
external_tx_id    VARCHAR (admin-entered transaction reference)
paid_at           TIMESTAMP (when admin marks paid)
fulfilled_at      TIMESTAMP (when coins actually granted)
created_at        TIMESTAMP (order creation time)
metadata          JSONB (user info, package details at order time)
```

### user_profiles (updated field)
```sql
troll_coins       INTEGER (updated on order fulfillment)
```

## API Endpoint

### POST /functions/v1/manual-coin-order

#### Actions

##### `create` - Create a new manual order
**Request:**
```json
{
  "action": "create",
  "coins": 500,
  "amount_usd": 4.99,
  "username": "john_doe",
  "package_id": "pkg-123" (optional)
}
```

**Response (Success):**
```json
{
  "success": true,
  "orderId": "order-uuid",
  "instructions": {
    "provider": "cashapp",
    "cashtag": "$Mai Troll95",
    "note": "JOHND-500",
    "message": "Send Cash App payment, include note with your username prefix and coins..."
  }
}
```

**Response (Error):**
```json
{
  "error": "Missing coins or amount"
}
```

---

##### `approve` - Admin marks order as paid and grants coins
**Request:**
```json
{
  "action": "approve",
  "order_id": "order-uuid",
  "external_tx_id": "cashapp-tx-abc123" (optional)
}
```

**Response (Success):**
```json
{
  "success": true,
  "message": "Order fulfilled. Coins granted."
}
```

**Response (Error - Forbidden):**
```json
{
  "error": "Forbidden"
}
```
Only users with role `admin`, `secretary`, or `is_admin=true` can approve.

---

## Components

### CashAppPaymentModal.tsx
- Displays payment instructions
- Provides copy buttons for CashApp address and note
- Tracks order status
- Shows user-friendly messaging

### CoinStoreModal.tsx (updated)
- Added "💳 Card" / "📱 Cash App" toggle tabs
- Stripe payment for card payments (existing)
- Cash App payment via CashAppPaymentModal (new)

### AdminManualOrders.tsx
- Lists all pending, paid, and fulfilled orders
- Admin can:
  - Enter external TX ID
  - Click "Mark Paid & Credit" to approve
  - Refresh to reload latest orders
- Color-coded status badges
- User info cards showing username, email, role
- Direct link to focus on specific order

## Security Features

1. **RLS Policies**: Users can only see/create their own orders
2. **Role-Based Access**: Only admin/secretary can approve
3. **Authentication**: All endpoints require valid JWT token
4. **CORS**: Properly configured with status 200 for preflight
5. **Idempotency**: Order approval includes state checks

## Future Enhancements

- [ ] Automatic notifications to user when order fulfilled
- [ ] Email confirmation for Cash App payments
- [ ] Secretary → Admin forwarding workflow
- [ ] Payment expiration (auto-cancel if unpaid after 24h)
- [ ] Refund mechanism for disputed payments
- [ ] Webhook integration with Cash App API (if available)
- [ ] Duplicate payment detection
- [ ] Rate limiting to prevent abuse

## Troubleshooting

### CORS Error: "Response to preflight request doesn't pass access control check"
**Solution**: Ensure Edge Function returns status 200 for OPTIONS requests with proper CORS headers.

### Order not appearing after creation
**Verify**:
- RLS policy allows user to insert into `manual_coin_orders`
- Authentication token is valid
- User ID is correctly passed

### Coins not granted after approval
**Check**:
- Order status is `fulfilled` in database
- `troll_coins` field was actually incremented
- Transaction log entry was created
- User refreshed profile

### Admin cannot see orders
**Verify**:
- User role is `admin` or `secretary`
- RLS policy `admin_or_secretary_select_manual_orders` exists and is enabled
- Token includes correct role in JWT claims
