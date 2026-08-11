# Cash App Payment Flow - Quick Reference

## 🎯 What Users See

### Step 1: Open Coin Store
- Click "Get More Coins" button (anywhere in app)
- Coin store modal opens showing packages

### Step 2: Choose Payment Method
- See two tabs: **💳 Card** | **📱 Cash App**
- Click **📱 Cash App** tab

### Step 3: Select Package & Send
- Pick coin package (e.g., "💰 500 coins - $4.99")
- Click "Send via Cash App" button
- Modal opens with payment instructions

### Step 4: Follow Instructions
```
┌─────────────────────────────────────┐
│ Step 1: Confirm Amount              │
│                                     │
│ You'll send $4.99 to $Mai Troll95  │
│                                     │
│ [Continue]               [Cancel]   │
└─────────────────────────────────────┘
           ↓
┌─────────────────────────────────────┐
│ Step 2: Send Payment                │
│                                     │
│ Cash App Address:                   │
│ $Mai Troll95 [Copy]                │
│                                     │
│ Payment Note:                       │
│ USER123-500 [Copy]                 │
│                                     │
│ ℹ️ Send payment in Cash App with   │
│    the note above                   │
│                                     │
│ [Go Back]       [Done - I'll Verify]│
└─────────────────────────────────────┘
           ↓
┌─────────────────────────────────────┐
│ Step 3: Success ✅                  │
│                                     │
│ Request sent!                       │
│ Admin will verify and approve       │
│                                     │
│ Order ID: xxxxxxxx-xxxx-xxxx        │
│                                     │
│ [Close]                             │
└─────────────────────────────────────┘
```

### Step 5: Send Cash App Payment
1. Open Cash App on phone
2. Tap "Send" button
3. Enter `$Mai Troll95` as recipient
4. Enter `$4.99` amount
5. In memo/note field, paste: `USER123-500`
6. Tap "Confirm" → "Send"
7. Wait for admin verification (usually Within 5 Minutes)

### Step 6: Coins Appear ✅
- Admin verifies payment in their Cash App account
- Admin approves in dashboard
- Your coin balance updates immediately
- You can use coins right away

---

## 👨‍💼 What Admin Sees

### Admin Dashboard - Manual Orders Tab

```
┌─────────────────────────────────────────────────────────────┐
│ Manual Coin Orders                                          │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│ 🔄 Pending (2)  ✅ Fulfilled (8)  ⏸️ On Hold (0)           │
│                                                              │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│ ┌────────────────────────────────────────────────────────┐ │
│ │ john_doe (john@example.com)                     🟨 PENDING │
│ │ 500 coins for $4.99 | Created: 2 min ago             │ │
│ │ Note: JOHND-500                                        │ │
│ │                                                        │ │
│ │ TX ID: [________________] (optional)                  │ │
│ │ [Mark Paid & Credit Coins]                            │ │
│ └────────────────────────────────────────────────────────┘ │
│                                                              │
│ ┌────────────────────────────────────────────────────────┐ │
│ │ alice_smith (alice@example.com)                 🟦 PAID   │
│ │ 1000 coins for $9.99 | Created: 15 min ago            │ │
│ │ Note: ALICES-1000                                      │ │
│ │ TX ID: cashapp-tx-abc123                               │ │
│ │ Paid At: 5 min ago                                     │ │
│ │                                                        │ │
│ │ ⏳ Processing...                                        │ │
│ └────────────────────────────────────────────────────────┘ │
│                                                              │
│ ┌────────────────────────────────────────────────────────┐ │
│ │ bob_jones (bob@example.com)                    🟢 FULFILLED │
│ │ 250 coins for $2.99 | Created: 1 hour ago             │ │
│ │ Note: BOBJO-250                                        │ │
│ │ TX ID: cashapp-tx-def456                               │ │
│ │ Fulfilled At: 55 min ago | Balance: 1500 → 1750       │ │
│ │                                                        │ │
│ │ ✅ Coins granted                                       │ │
│ └────────────────────────────────────────────────────────┘ │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### How to Approve an Order

1. **Receive notification** - User has created a payment request
2. **Check Cash App** - Look for matching payment:
   - From: User or @username
   - Amount: Matches order (e.g., $4.99)
   - Note/Memo: Matches suggested note (e.g., JOHND-500)
3. **Mark as Paid**:
   - Go to Admin Dashboard → "Manual Orders"
   - Find the pending order
   - (Optional) Copy Cash App TX ID into "TX ID" field
   - Click "Mark Paid & Credit Coins"
4. **Verify Success**:
   - Status changes from 🟨 PENDING → 🟦 PAID → 🟢 FULFILLED
   - User's balance increases by coin amount
   - Transaction logged in audit trail

### What NOT to Do
- ❌ Don't approve orders without verifying Cash App payment
- ❌ Don't approve if amount doesn't match
- ❌ Don't approve if note doesn't match order
- ❌ Don't approve if user appears suspicious/new
- ❌ Don't refund coins if user claims they didn't send payment - verify Cash App first

---

## 💾 Database Status

### Table: manual_coin_orders

| Field | Type | Purpose |
|-------|------|---------|
| `id` | UUID | Unique order identifier |
| `user_id` | UUID | Which user requested coins |
| `coins` | INTEGER | How many coins to grant |
| `amount_cents` | INTEGER | Price in cents (499 = $4.99) |
| `status` | TEXT | pending / paid / fulfilled / canceled |
| `note_suggested` | TEXT | Reference note for Cash App (e.g., USER123-500) |
| `external_tx_id` | TEXT | Cash App transaction ID (admin enters) |
| `created_at` | TIMESTAMP | When user created order |
| `paid_at` | TIMESTAMP | When admin marked paid |
| `fulfilled_at` | TIMESTAMP | When coins were actually granted |
| `metadata` | JSONB | User email, username, package name at order time |

### Status Flow
```
pending  →  paid  →  fulfilled
 (user       (admin verified   (coins
  creates)    payment)          granted)
```

---

## 🔧 Troubleshooting

### User: "I don't see Cash App option in coin store"
1. Check if you're logged in
2. Try refreshing the page
3. Clear browser cache and reload
4. Check if modal is opening at all

### User: "I sent payment but nothing happened"
1. Verify note matches exactly (case sensitive)
2. Verify amount is correct
3. Check order status in admin dashboard
4. Contact admin to manually verify

### Admin: "Button doesn't work when I click Mark Paid & Credit"
1. Check browser console for errors
2. Verify you have admin role: `SELECT role FROM user_profiles WHERE id = 'your-id'`
3. Try refreshing the dashboard
4. Check if Edge Function is deployed: `supabase functions list`

### Admin: "I see the order but coins didn't get credited"
1. Check order status in database:
   ```sql
   SELECT status, fulfilled_at FROM manual_coin_orders WHERE id = 'order-id'
   ```
2. Check user balance:
   ```sql
   SELECT troll_coins FROM user_profiles WHERE id = 'user-id'
   ```
3. Check transaction log:
   ```sql
   SELECT * FROM coin_transactions WHERE reference = 'order-id'
   ```

### CORS Error: "Response to preflight doesn't pass access control check"
- This means the Edge Function isn't responding properly to preflight
- Solution: Verify the function has this line:
  ```typescript
  if (req.method === "OPTIONS") return new Response("ok", { status: 200, headers: cors });
  ```
- Redeploy if needed: `supabase functions deploy manual-coin-order`

---

## 📊 Monitoring

### Check pending orders
```sql
SELECT COUNT(*) as pending_count FROM manual_coin_orders WHERE status = 'pending';
```

### Check fulfilled orders today
```sql
SELECT COUNT(*) as today_fulfilled, SUM(coins) as total_coins
FROM manual_coin_orders
WHERE status = 'fulfilled'
AND DATE(fulfilled_at) = TODAY();
```

### Check total coins issued via Cash App
```sql
SELECT SUM(coins) as total_coins FROM manual_coin_orders WHERE status = 'fulfilled';
```

### Check revenue
```sql
SELECT SUM(amount_cents) / 100.0 as total_revenue
FROM manual_coin_orders
WHERE status = 'fulfilled';
```

---

## 🚀 Going Live

1. **Test with friends** (5-10 real transactions)
2. **Monitor logs** - `supabase functions logs manual-coin-order --tail`
3. **Verify RLS** - Users only see their orders, admins see all
4. **Check CORS** - Run `npm run test:manual-orders`
5. **Load test** - Create 50+ simultaneous orders (if expecting volume)
6. **Backup database** - Before enabling in production
7. **Document SOP** - Train admins on approval workflow
8. **Set up alerts** - Notify yourself when new orders arrive

---

## Quick Reference Commands

```bash
# Deploy Edge Function
supabase functions deploy manual-coin-order

# View logs
supabase functions logs manual-coin-order --tail

# Test endpoint
curl -X OPTIONS https://gejtbllazzighxwxudyu.supabase.co/functions/v1/manual-coin-order

# Check database
SELECT * FROM manual_coin_orders ORDER BY created_at DESC LIMIT 10;

# Verify coins were granted
SELECT username, troll_coins FROM user_profiles WHERE id = 'user-id';
```

---

**Last Updated**: 2025-01-18  
**System Status**: ✅ Production Ready  
**Support**: Contact @admin for questions
