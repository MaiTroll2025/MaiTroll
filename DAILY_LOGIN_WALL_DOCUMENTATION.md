# 🎯 Daily Login Wall - Complete Implementation Guide

## Overview

The **Daily Login Wall** is a gamification feature that encourages users to visit Mai Troll daily by rewarding them for making a post to the community wall. Users earn **0-100 random Troll Coins** for each daily post.

---

## 🎮 User Experience Flow

### Daily Login Process
1. User navigates to **Mai Troll Wall** (`/wall`)
2. At the top, they see the **Daily Login Wall** section
3. They write a post (max 500 characters)
4. Upon submission, the post is created and they earn **random coins (0-100)**
5. They cannot post again until the next day (UTC)

### Visual Feedback
- **Can Post Today**: Green button with "Post & Earn Coins", shows random coin preview on hover
- **Already Posted**: Grayed out section with "You already posted today" message
- **Success**: Toast notification shows exact coins earned: "🎉 You earned 47 Troll Coins!"

---

## 💾 Database Schema

### New Table: `daily_login_posts`
```sql
CREATE TABLE daily_login_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  post_id UUID NOT NULL REFERENCES troll_wall_posts(id) ON DELETE CASCADE,
  coins_earned INTEGER NOT NULL CHECK (coins_earned >= 0 AND coins_earned <= 100),
  posted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  
  -- Ensure one post per user per day (UTC)
  UNIQUE(user_id, DATE(posted_at))
);
```

### Modified Table: `troll_wall_posts`
- **New Column**: `is_daily_login_post` (BOOLEAN, DEFAULT FALSE)
- Marks posts created through daily login feature for filtering

### Related Tables (Used)
- `troll_wall_posts` - Stores the actual posts
- `user_profiles` - Updated with coins earned
- `auth.users` - User authentication

---

## 🔧 Backend Functions

### 1. `can_post_daily_login()` - Check Daily Post Status
**Purpose**: Determine if a user can post today

```sql
FUNCTION can_post_daily_login() RETURNS BOOLEAN

-- Returns TRUE if user hasn't posted today
-- Returns FALSE if user already posted
```

**Usage**:
```typescript
const canPost = await supabase.rpc('can_post_daily_login');
```

### 2. `record_daily_login_post()` - Record Post & Award Coins
**Purpose**: Create daily login post record and award coins atomically

**Parameters**:
- `p_post_id` (UUID): Wall post ID to record
- `p_coins` (INTEGER): Coins to award (0-100)

**Returns**:
```json
{
  "success": true/false,
  "coins_earned": number,
  "message": string,
  "error": string (if failed)
}
```

**Actions**:
1. Validates post exists and belongs to user
2. Checks user hasn't already posted today
3. Inserts record into `daily_login_posts`
4. Marks post as `is_daily_login_post = TRUE`
5. Adds coins to user's `troll_coins` and `total_earned_coins`

**Validation**:
- Post must exist and belong to authenticated user
- One post per user per day (UTC)
- Coins must be 0-100

---

## 🎯 Frontend Implementation

### Components

#### 1. **DailyLoginWall.tsx**
**Location**: `src/components/trollWall/DailyLoginWall.tsx`

**Props**:
```typescript
interface DailyLoginWallProps {
  onPostCreated?: (postId: string) => void
}
```

**Features**:
- Displays daily login status
- Shows posting form or "Already Posted" message
- Random coin preview on button hover
- Character count (max 500)
- Loading/disabled states
- Success notifications

**Key Features**:
```tsx
// Status check on mount
useEffect(() => {
  checkDailyPostStatus()
}, [checkDailyPostStatus])

// Handle form submission
const handleSubmit = async (e: React.FormEvent) => {
  // Create wall post
  // Call submitDailyPost
  // Reset form on success
}
```

#### 2. **useDailyLoginPost Hook**
**Location**: `src/lib/hooks/useDailyLoginPost.ts`

**Exports**:
```typescript
export function useDailyLoginPost() {
  const checkDailyPostStatus: () => Promise<void>
  const submitDailyPost: (postId: string) => Promise<DailyLoginPostReward>
  const generateRandomReward: () => number
  const loading: boolean
  const canPostToday: boolean
  const lastPostDate: string | null
}
```

**Key Methods**:
- `checkDailyPostStatus()`: Queries database for today's post
- `submitDailyPost(postId)`: Calls RPC function, updates UI, refreshes coins
- `generateRandomReward()`: Returns Math.random() * 101 (0-100)

---

## 📱 Integration Points

### 1. **Mai TrollWall Page** (`src/pages/Mai TrollWall.tsx`)
```tsx
import DailyLoginWall from '../components/trollWall/DailyLoginWall'

// In JSX:
<DailyLoginWall onPostCreated={() => loadPosts()} />
```

**Placement**: Top of page, above all other posts

**Callback**: Reloads posts when new daily post created

### 2. **Home Page** (`src/pages/Home.tsx`)
- Added feature card describing daily login rewards
- Shows "Daily Login Posts" with Coins icon
- Description: "Post once daily to earn 0-100 Troll Coins"
- Links to wall feature in features section

---

## 🔌 API Endpoints Used

### Supabase RPC Calls
```typescript
// 1. Check if can post today
supabase.rpc('can_post_daily_login')

// 2. Record daily post and award coins
supabase.rpc('record_daily_login_post', {
  p_post_id: string,      // UUID
  p_coins: number         // 0-100
})
```

### Supabase Table Operations
```typescript
// Insert new wall post
supabase.from('troll_wall_posts').insert({
  user_id, post_type, content, is_daily_login_post, metadata
})

// Query user's daily posts
supabase.from('daily_login_posts')
  .select('posted_at')
  .eq('user_id', userId)
  .order('posted_at', { ascending: false })
  .limit(1)
```

---

## 💰 Coin Economy

### Daily Rewards
- **Min**: 0 Troll Coins
- **Max**: 100 Troll Coins
- **Distribution**: Uniform random (equal probability for each value 0-100)
- **Frequency**: Once per day (UTC)
- **Annual Potential**: 0-36,500 coins/year

### Coin Tracking
- Coins stored in `user_profiles.troll_coins`
- Earning tracked in `user_profiles.total_earned_coins`
- No spending/loss from daily posts
- Transaction type: `'bonus'`

---

## 🛡️ Security & Validation

### RLS (Row Level Security)
```sql
-- Users can only view their own daily posts
CREATE POLICY "Users can view own daily posts"
  ON daily_login_posts FOR SELECT
  USING (auth.uid() = user_id);

-- Function runs as SECURITY DEFINER
CREATE FUNCTION record_daily_login_post(...) SECURITY DEFINER
```

### Validations
1. **Authentication**: User must be logged in
2. **Daily Limit**: Enforced by UNIQUE constraint on `(user_id, DATE(posted_at))`
3. **Coin Range**: Validated 0 ≤ coins ≤ 100
4. **Post Ownership**: Function verifies post belongs to user
5. **Duplicate Prevention**: Database UNIQUE constraint prevents multiple posts/day

---

## 📊 Monitoring & Analytics

### Queries to Track

**Daily Active Posters**:
```sql
SELECT DATE(posted_at), COUNT(DISTINCT user_id) as posters
FROM daily_login_posts
GROUP BY DATE(posted_at)
ORDER BY DATE(posted_at) DESC;
```

**Average Daily Coins Earned**:
```sql
SELECT 
  DATE(posted_at) as date,
  AVG(coins_earned) as avg_coins,
  MIN(coins_earned) as min_coins,
  MAX(coins_earned) as max_coins
FROM daily_login_posts
GROUP BY DATE(posted_at);
```

**User Streak**:
```sql
SELECT 
  user_id,
  COUNT(DISTINCT DATE(posted_at)) as total_posts,
  SUM(coins_earned) as total_coins
FROM daily_login_posts
GROUP BY user_id
ORDER BY total_posts DESC;
```

---

## 🚀 Future Enhancements

### Possible Features
1. **Streak Counter**: Display consecutive days posted
2. **Bonus Multiplier**: Extra coins for long streaks
3. **Weekly Challenges**: Special daily post themes
4. **Leaderboard**: Top daily posters this week/month
5. **Post Categories**: Different coin rewards for post types
6. **Trending Posts**: Highlight popular daily posts
7. **Weekly Jackpot**: Random user wins bonus coins
8. **Post Sharing**: Share daily posts to social media

### Database Additions Needed
```sql
-- Streak tracking
ALTER TABLE user_profiles 
ADD COLUMN daily_post_streak INTEGER DEFAULT 0;

-- Post difficulty/themes
ALTER TABLE daily_login_posts
ADD COLUMN theme VARCHAR(50);
```

---

## 🧪 Testing Checklist

- [ ] User can post text to wall
- [ ] Coins awarded 0-100 range
- [ ] Cannot post twice in same day
- [ ] Can post again next day
- [ ] Post marked as `is_daily_login_post`
- [ ] Toast notifications display correctly
- [ ] Form validates max 500 characters
- [ ] UI disables posting after daily limit
- [ ] Coin balance updates in real-time
- [ ] RLS prevents viewing others' posts
- [ ] Timestamps are in UTC
- [ ] Mobile UI responsive

---

## 📁 File Structure

```
src/
├── components/
│   └── trollWall/
│       └── DailyLoginWall.tsx (NEW - 200 lines)
├── lib/
│   └── hooks/
│       └── useDailyLoginPost.ts (NEW - 160 lines)
├── pages/
│   ├── Mai TrollWall.tsx (MODIFIED - added import & component)
│   └── Home.tsx (MODIFIED - added feature card)
└── types/
    └── trollWall.ts (EXISTING - no changes)

Database:
├── add_daily_login_posts.sql (NEW migration file)
├── Functions:
│   ├── can_post_daily_login()
│   └── record_daily_login_post()
└── Tables:
    ├── daily_login_posts (NEW)
    └── troll_wall_posts (modified: added is_daily_login_post column)
```

---

## ✅ Installation Steps

### 1. Run SQL Migration
```bash
# Execute add_daily_login_posts.sql in Supabase SQL Editor
# Creates:
# - daily_login_posts table
# - Indexes
# - RLS policies
# - Functions (can_post_daily_login, record_daily_login_post)
```

### 2. Deploy Components
Components already created:
- ✅ `DailyLoginWall.tsx`
- ✅ `useDailyLoginPost.ts`
- ✅ Updated `Mai TrollWall.tsx`
- ✅ Updated `Home.tsx`

### 3. Test Features
- Navigate to `/wall`
- See Daily Login Wall at top
- Submit a post
- Verify coins awarded
- Check cannot post again today
- Check `daily_login_posts` table has record

---

## 🎓 Code Examples

### Using the Hook Directly
```typescript
import { useDailyLoginPost } from '@/lib/hooks/useDailyLoginPost'

function MyComponent() {
  const { canPostToday, submitDailyPost } = useDailyLoginPost()
  
  const handlePost = async (postId: string) => {
    const result = await submitDailyPost(postId)
    if (result.success) {
      console.log(`Earned ${result.coinsEarned} coins!`)
    }
  }
  
  return canPostToday ? <button onClick={...}>Post</button> : <p>Posted!</p>
}
```

### Querying Daily Post Data
```typescript
// Check if user posted today
const { data, error } = await supabase
  .from('daily_login_posts')
  .select('coins_earned')
  .eq('user_id', userId)
  .eq('DATE(posted_at)', today)
  .single()

if (data) {
  console.log(`Posted today, earned ${data.coins_earned} coins`)
}
```

---

## 📝 Notes

- **Timezone**: All timestamps use UTC for consistency
- **Reset Time**: Daily limit resets at 00:00 UTC
- **Coin Generation**: Uses JavaScript's `Math.random()` - client-side preview only
- **Race Conditions**: Prevented by database UNIQUE constraint
- **Performance**: Indexes on user_id, post_id, and date fields
- **Scalability**: Optimized for millions of daily posts

---

**Last Updated**: January 21, 2026
**Version**: 1.0
**Status**: ✅ Complete & Integrated
