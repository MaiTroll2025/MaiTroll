# Cash App Integration Points - System Overview

## ✅ Integration Status

### Frontend Integration

#### 1. **CoinStoreModal.tsx** - Entry Point
**Location**: `src/components/broadcast/CoinStoreModal.tsx`

**Integration**:
- Added import: `import CashAppPaymentModal from "./CashAppPaymentModal";`
- Added state: `const [paymentMethod, setPaymentMethod] = useState<'stripe' | 'cashapp'>('stripe');`
- Added state: `const [cashAppModalOpen, setCashAppModalOpen] = useState(false);`
- Modified coin purchase footer to show payment method toggle:
  ```tsx
  <div className="flex gap-2">
    <button onClick={() => setPaymentMethod('stripe')} className={paymentMethod === 'stripe' ? 'active' : ''}>
      💳 Card
    </button>
    <button onClick={() => setPaymentMethod('cashapp')} className={paymentMethod === 'cashapp' ? 'active' : ''}>
      📱 Cash App
    </button>
  </div>
  ```

**Usage Flow**:
```
User clicks "Get Coins" button
  ↓
CoinStoreModal opens
  ↓
User selects coin package
  ↓
User clicks "💳 Card" or "📱 Cash App"
  ↓
If Stripe: Existing Stripe checkout flow
If Cash App: 
  - setCashAppModalOpen(true)
  - CashAppPaymentModal renders
```

**Key Props Passed**:
```tsx
<CashAppPaymentModal
  isOpen={cashAppModalOpen}
  onClose={() => setCashAppModalOpen(false)}
  coins={selectedPackage.coins}
  amount={parseFloat(selectedPackage.price)}
  onSuccess={(orderId) => {
    toast.success(`Order created: ${orderId}`);
    setCashAppModalOpen(false);
  }}
/>
```

---

#### 2. **CashAppPaymentModal.tsx** - Payment UI
**Location**: `src/components/broadcast/CashAppPaymentModal.tsx`

**Integration**:
- Uses `supabase` client to call Edge Function
- Uses `useAuthStore` to get current user/profile
- Uses `toast` from sonner for notifications
- Uses lucide-react icons for UI

**API Call**:
```typescript
const response = await fetch(
  `${VITE_SUPABASE_URL}/functions/v1/manual-coin-order`,
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      action: 'create',
      coins,
      amount_usd: amount,
      username: profile?.username || user?.email,
    }),
  }
);
```

**Response Handling**:
```typescript
const data = await response.json();
if (data.success) {
  setOrderId(data.orderId);
  setNoteSuggested(data.instructions.note);
  setStep('awaiting');
  // Now show $Mai Troll95 and note for user to copy
} else {
  toast.error(data.error);
}
```

---

#### 3. **LivePage & WatchPage** - Modal Integration Points
**Locations**:
- `src/pages/LivePage.tsx` (line 3083)
- `src/pages/WatchPage.tsx` (line 735)

**Usage**:
```tsx
// Both pages import and use CoinStoreModal
import CoinStoreModal from '../components/broadcast/CoinStoreModal';

// Button click opens modal
<button onClick={() => setIsCoinStoreOpen(true)}>
  Get More Coins
</button>

// Modal rendered at bottom of page
{isCoinStoreOpen && (
  <CoinStoreModal 
    onClose={() => setIsCoinStoreOpen(false)} 
    onPurchase={handleCoinsPurchased} 
  />
)}

// onPurchase callback updates page state when coins added
const handleCoinsPurchased = (coins: number) => {
  refreshProfile(); // Refresh user balance
};
```

---

### Backend Integration

#### 1. **Edge Function** - API Handler
**Location**: `supabase/functions/manual-coin-order/index.ts`

**Integration Points**:
- Uses Supabase Auth JWT verification
- Uses Supabase client (admin mode) for database operations
- Calls `approve_manual_order` RPC for coin granting
- Returns CORS headers for browser requests

**Environment Variables**:
```bash
SUPABASE_URL=https://yjxpwfalenorzrqxwmtr.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi... (admin key)
MANUAL_ORDERS_ADMIN_KEY=optional-fallback-key
```

**Request Flow**:
```
Browser POST /manual-coin-order
  ↓
OPTIONS preflight (returns 200 with CORS headers)
  ↓
Edge Function receives request
  ↓
Extract Bearer token from Authorization header
  ↓
Verify token with supabaseAdmin.auth.getUser(token)
  ↓
Parse action from request body
  ↓
If action='create':
  - Insert into manual_coin_orders table
  - Return orderId + instructions
If action='approve':
  - Verify user is admin/secretary
  - Call approve_manual_order RPC
  - Return success + new balance
  ↓
Return JSON response with status code + CORS headers
```

---

#### 2. **Database - manual_coin_orders Table**
**Creation Migration**: `20260116090000_manual_coin_orders.sql`

**Schema**:
```sql
CREATE TABLE public.manual_coin_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  package_id UUID REFERENCES coin_packages(id),
  coins INTEGER NOT NULL,
  amount_cents INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  note_suggested TEXT,
  external_tx_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  paid_at TIMESTAMP WITH TIME ZONE,
  fulfilled_at TIMESTAMP WITH TIME ZONE,
  metadata JSONB
);
```

**Integration with Existing Tables**:
- **Links to**: `auth.users` (user_id)
- **Links to**: `coin_packages` (package_id, optional)
- **Updates**: `user_profiles.troll_coins` when approved
- **Logs to**: `coin_transactions` table (audit trail)

---

#### 3. **RLS Policies**
**Creation Migration**: `20260117094000_manual_orders_admin_policy.sql`

**Policies**:
```sql
-- Users can see/create their own orders
CREATE POLICY "users_select_own_manual_orders"
  ON manual_coin_orders FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "users_insert_own_manual_orders"
  ON manual_coin_orders FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Admins/secretaries can see and update all
CREATE POLICY "admin_or_secretary_select_manual_orders"
  ON manual_coin_orders FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND (role IN ('admin', 'secretary') OR is_admin = true)
    )
  );

CREATE POLICY "admin_or_secretary_update_manual_orders"
  ON manual_coin_orders FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND (role IN ('admin', 'secretary') OR is_admin = true)
    )
  );
```

---

#### 4. **RPC Function - approve_manual_order**
**Purpose**: Atomic transaction to grant coins after admin approval

**Parameters**:
- `p_order_id` (UUID): Order to approve
- `p_admin_id` (UUID): Admin performing approval
- `p_external_tx_id` (TEXT): Optional Cash App transaction ID

**Operations**:
```sql
1. Fetch order by ID (WITH UPDATE lock for atomicity)
2. Verify status is 'pending'
3. Update order status: pending → paid → fulfilled
4. Increment user_profiles.troll_coins by order.coins
5. Insert row in coin_transactions table
6. Return { success: true, new_balance: integer }
```

**Error Handling**:
- Returns `{ success: false, error_message: "Order not found or not pending" }` if order doesn't exist or is already paid
- No coins are credited if any step fails

---

### Admin Dashboard Integration

#### AdminManualOrders.tsx
**Location**: `src/pages/admin/components/AdminManualOrders.tsx`

**Integration**:
- Fetches from `manual_coin_orders` table
- Joins with `user_profiles` for user details
- Calls Edge Function with action='approve'
- Updates UI in real-time as orders are approved

**Key Functions**:
```typescript
// Load all orders (called on mount and after approval)
const loadOrders = useCallback(async () => {
  const { data, error } = await supabase
    .from('manual_coin_orders')
    .select('*');
  // Fetch user profiles and packages in parallel
  // Store in state for rendering
}, []);

// Approve order and grant coins
const approveOrder = useCallback(async (orderId, externalTxId) => {
  const { data: sessionData } = await supabase.auth.getSession();
  const response = await fetch(
    `${VITE_SUPABASE_URL}/functions/v1/manual-coin-order`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${sessionData.session.access_token}`,
      },
      body: JSON.stringify({
        action: 'approve',
        order_id: orderId,
        external_tx_id: externalTxId,
      }),
    }
  );
  const result = await response.json();
  // Refresh orders list
  loadOrders();
}, []);
```

**UI Components**:
```tsx
// Order card showing:
- User avatar (from user_profiles)
- Username & email
- Coins + amount
- Payment note
- Created timestamp
- Status badge
- TX ID input field
- "Mark Paid & Credit" button
- Approval status/timestamp
```

---

## 📊 Data Flow Diagrams

### Create Order Flow
```
User Client Browser
  ↓
Click "📱 Cash App" button in CoinStoreModal
  ↓
CashAppPaymentModal opens with 3 steps
  ↓
User fills Step 1 (Confirm Amount)
  ↓
Step 2 shows $Mai Troll95 + payment note
  ↓
User clicks "Done - I'll Verify"
  ↓
POST /functions/v1/manual-coin-order
  action: 'create'
  coins: 500
  amount_usd: 4.99
  username: 'john_doe'
  ↓
Edge Function validates JWT token
  ↓
Edge Function inserts into manual_coin_orders
  ↓
Returns { orderId, instructions }
  ↓
Frontend shows success message with orderId
```

### Approval Flow
```
Admin Opens Admin Dashboard
  ↓
Clicks "Manual Orders" tab
  ↓
Sees list of pending orders
  ↓
Checks Cash App account for matching payment
  ↓
Enters optional TX ID
  ↓
Clicks "Mark Paid & Credit Coins"
  ↓
POST /functions/v1/manual-coin-order
  action: 'approve'
  order_id: 'xxx'
  external_tx_id: 'cashapp-tx-123'
  ↓
Edge Function verifies admin role
  ↓
Edge Function calls approve_manual_order RPC
  ↓
RPC updates manual_coin_orders status
  ↓
RPC increments user_profiles.troll_coins
  ↓
RPC inserts coin_transactions record
  ↓
Returns new balance
  ↓
Frontend reloads orders list
  ↓
Admin sees status changed to "FULFILLED"
  ↓
User's balance updated (next page load or refresh)
```

### Real-Time Updates
```
User's Profile Page
  ↓
Shows troll_coins balance: 1000
  ↓
Admin approves order for +500 coins
  ↓
User's database row updated: troll_coins = 1500
  ↓
User refreshes page OR closes/reopens modal
  ↓
CoinStoreModal re-fetches profile
  ↓
Shows new balance: 1500
```

---

## 🔗 Component Dependencies

```
LivePage / WatchPage (pages)
  ↓
  uses → CoinStoreModal (component)
         ↓
         uses → CashAppPaymentModal (component)
                ↓
                calls → POST /manual-coin-order (action='create')
                        ↓
                        calls → supabaseAdmin.from('manual_coin_orders').insert()

AdminDashboard (page)
  ↓
  uses → AdminManualOrders (component)
         ↓
         calls → GET manual_coin_orders
                ↓
                calls → POST /manual-coin-order (action='approve')
                        ↓
                        calls → approve_manual_order RPC
                               ↓
                               updates manual_coin_orders
                               updates user_profiles.troll_coins
                               inserts coin_transactions
```

---

## 🔐 Security Integration

### Authentication
- All API calls require valid JWT token from Supabase Auth
- Token extracted from `Authorization: Bearer {token}` header
- Token verified server-side via `supabaseAdmin.auth.getUser(token)`

### Authorization
- **Create order**: Any authenticated user
- **Approve order**: Only users with role='admin' or is_admin=true or role='secretary'
- Checked via RLS policies and Edge Function role verification

### Data Privacy
- Users can only see/create their own orders (RLS policy)
- Admins can see all orders
- No cross-user data leakage due to RLS enforcement

---

## 📈 Performance Considerations

### Database
- `manual_coin_orders` table has index on `user_id`, `status`, `created_at`
- Queries are indexed and should be sub-millisecond for <100k rows
- RPC function uses `FOR UPDATE` lock for atomicity

### API
- Edge Function is serverless and scales automatically
- CORS preflight is cached by browsers (5 min typical)
- POST requests should complete in <500ms

### Frontend
- CoinStoreModal lazy-loads catalog on first open
- CashAppPaymentModal is lightweight (only 3 states)
- AdminManualOrders loads orders on demand

---

## 🧪 Testing Integration Points

### Unit Tests
- Test CashAppPaymentModal steps (confirm → awaiting → success)
- Test order creation validation (coins required, amount required)
- Test approval validation (admin role required)

### Integration Tests
- Create order via frontend, verify appears in database
- Approve order via admin dashboard, verify coins credited
- Verify RLS prevents non-admin from approving

### E2E Tests
- User flow: Open app → click coins → select Cash App → follow modal
- Admin flow: Open dashboard → see pending → verify in Cash App → approve
- Verify user balance updates after approval

### CORS Tests
- Run `npm run test:manual-orders`
- Verify OPTIONS returns 200 with correct headers
- Verify POST from browser works without CORS errors

---

## 🚀 Deployment Integration

### Database Migrations
1. Must run migration to create `manual_coin_orders` table
2. Must run migration to create RLS policies
3. Must run migration to create `approve_manual_order` RPC

### Edge Function Deployment
```bash
supabase functions deploy manual-coin-order
```
- Deploys to production Supabase project
- Automatically configured with environment variables
- Accessible at `/functions/v1/manual-coin-order`

### Frontend Build
- No special build configuration needed
- Component imports work with standard React build
- Edge Function URL from VITE_SUPABASE_URL env var

---

## 📝 Integration Checklist

Before deploying to production:

- [ ] Database migrations executed (manual_coin_orders table created)
- [ ] RLS policies enabled and tested
- [ ] approve_manual_order RPC function exists
- [ ] Edge Function deployed: `supabase functions deploy manual-coin-order`
- [ ] CashAppPaymentModal component created
- [ ] CoinStoreModal updated with payment method toggle
- [ ] AdminManualOrders component present in admin dashboard
- [ ] CORS test passes: `npm run test:manual-orders`
- [ ] Environment variables set (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY)
- [ ] Manual testing: Create order → Approve → Verify coins
- [ ] Admin testing: View pending → Approve → See status change
- [ ] Security: Verify non-admin cannot approve
- [ ] Performance: Test with 50+ concurrent orders
- [ ] Monitoring: Set up logs and alerts

---

**Last Updated**: 2025-01-18  
**Status**: ✅ All Integration Points Complete
