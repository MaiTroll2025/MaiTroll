# 🚀 Daily Login Wall - Setup Instructions

## Quick Start (5 Minutes)

### Step 1: Apply Database Migration
1. Go to your **Supabase Dashboard** → SQL Editor
2. Open and run the file: `add_daily_login_posts.sql`
3. This creates:
   - `daily_login_posts` table for tracking posts
   - Database functions for RPC calls
   - RLS security policies
   - Necessary indexes

### Step 2: Deploy Code
Code is already in place:
- ✅ `src/components/trollWall/DailyLoginWall.tsx` - User interface component
- ✅ `src/lib/hooks/useDailyLoginPost.ts` - Business logic hook
- ✅ `src/pages/Mai TrollWall.tsx` - Wall page integration
- ✅ `src/pages/Home.tsx` - Home page feature card

### Step 3: Test the Feature
1. Start your dev server: `npm run dev`
2. Navigate to `/wall` (Mai Troll Wall page)
3. You should see the **Daily Login Wall** section at the top
4. Try posting to earn coins!

---

## ✅ What You'll See

### Daily Login Wall Component
```
┌─ Daily Login Post ┐
│ Post once daily to earn 0-100 Troll Coins
│ [textarea: What's on your mind? _______________]
│ Characters: 23/500
│ [Post & Earn Coins] (shows +47 🪙 on hover)
└─────────────────────────────────────────────────┘
```

### After Posting
```
✅ Great! You already posted today. Come back tomorrow!
```

---

## 💰 How It Works

1. **User writes a post** → Max 500 characters
2. **Clicks "Post & Earn Coins"** → Random coins generated (0-100)
3. **Post created & coins awarded** → Toast notification shows amount
4. **Daily limit enforced** → Cannot post again until tomorrow (UTC)
5. **Profile updated** → Coins show in player stats

---

## 🔍 Verification

### Check Database
```sql
-- See today's posts
SELECT user_id, coins_earned, posted_at 
FROM daily_login_posts 
WHERE DATE(posted_at) = CURRENT_DATE
ORDER BY posted_at DESC;

-- See how many posts a user has made
SELECT user_id, COUNT(*) as total_posts, SUM(coins_earned) as total_coins
FROM daily_login_posts
GROUP BY user_id
ORDER BY total_posts DESC;
```

### Check in Application
1. Navigate to `/wall`
2. View the Daily Login Wall section
3. Try to post if you haven't today
4. Check your coin balance increases in Stats page

---

## 🎯 Features Implemented

### For Users
- ✅ Post daily to earn 0-100 coins
- ✅ One post per day limit (UTC-based)
- ✅ Random coin preview on hover
- ✅ Success notifications with coin amount
- ✅ Character counter (500 max)
- ✅ Mobile responsive design

### For Admins
- ✅ Track all daily posts in database
- ✅ Query user posting streaks
- ✅ Monitor coin distribution
- ✅ RLS security prevents unauthorized access
- ✅ Automatic timezone handling (UTC)

### For Developers
- ✅ Reusable `useDailyLoginPost` hook
- ✅ Clean component structure
- ✅ Error handling & validation
- ✅ TypeScript typed
- ✅ ESLint compliant
- ✅ Comprehensive documentation

---

## 📋 File Locations

```
Project Root/
├── add_daily_login_posts.sql          ← Run this in Supabase SQL Editor
├── DAILY_LOGIN_WALL_DOCUMENTATION.md  ← Full technical docs
├── DAILY_LOGIN_WALL_SETUP.md          ← This file
│
└── src/
    ├── components/
    │   └── trollWall/
    │       ├── DailyLoginWall.tsx      ← Main component
    │       ├── CreatePostModal.tsx     ← (existing)
    │       └── GiftModal.tsx           ← (existing)
    │
    ├── lib/
    │   ├── hooks/
    │   │   ├── useDailyLoginPost.ts    ← Business logic hook
    │   │   └── useCoins.ts             ← (existing, for coin updates)
    │   └── supabase.ts                 ← (existing Supabase client)
    │
    └── pages/
        ├── Mai TrollWall.tsx           ← (modified - added component)
        ├── Home.tsx                    ← (modified - added feature card)
        └── WallPostPage.tsx            ← (existing single post view)
```

---

## 🐛 Troubleshooting

### "Daily Login Wall component not showing"
- Verify SQL migration was applied successfully
- Check browser console for errors
- Ensure you're logged in
- Clear browser cache and reload

### "Coins not being awarded"
- Check Supabase SQL Editor for RPC function errors
- Verify `user_profiles` table has `troll_coins` column
- Check browser console for API errors
- Ensure user has authentication token

### "Can post multiple times per day"
- SQL migration may not have applied UNIQUE constraint
- Check `daily_login_posts` table structure
- Re-run SQL migration
- Clear and try again next UTC day

### "Styling looks wrong"
- Verify Tailwind CSS is configured
- Check no CSS conflicts with other components
- Clear `.next` or build cache
- Rebuild: `npm run build`

---

## 📊 Monitoring

### Daily Active Users
```sql
SELECT 
  DATE(posted_at) as date,
  COUNT(DISTINCT user_id) as active_users
FROM daily_login_posts
GROUP BY DATE(posted_at)
ORDER BY date DESC
LIMIT 30;
```

### Coin Distribution
```sql
SELECT 
  DATE(posted_at) as date,
  COUNT(*) as posts,
  AVG(coins_earned) as avg_coins,
  MIN(coins_earned) as min_coins,
  MAX(coins_earned) as max_coins,
  SUM(coins_earned) as total_coins
FROM daily_login_posts
GROUP BY DATE(posted_at)
ORDER BY date DESC;
```

### User Streaks
```sql
SELECT 
  user_id,
  (SELECT username FROM user_profiles WHERE id = daily_login_posts.user_id) as username,
  COUNT(DISTINCT DATE(posted_at)) as days_posted,
  SUM(coins_earned) as total_coins_earned,
  MAX(posted_at) as last_post
FROM daily_login_posts
GROUP BY user_id
ORDER BY days_posted DESC
LIMIT 20;
```

---

## 🔐 Security Notes

- ✅ **RLS Enabled**: Users can only see their own daily posts
- ✅ **Rate Limiting**: Database UNIQUE constraint prevents duplicate posts
- ✅ **Validation**: Server-side validation on coins (0-100)
- ✅ **Authentication**: Functions require authenticated user
- ✅ **SQL Injection**: Parameterized queries via Supabase RPC
- ✅ **Timezone Safe**: Uses UTC for consistency

---

## 🎮 Player Experience Timeline

### Day 1
- User sees Daily Login Wall on `/wall`
- Posts "Hello Mai Troll!" 
- Earns 47 Troll Coins randomly
- Toast shows: "🎉 You earned 47 Troll Coins!"
- Post appears in wall feed with `is_daily_login_post` flag

### Day 2
- User returns to wall
- DailyLoginWall component shows: "You already posted today"
- Button is disabled/grayed out
- User is encouraged to return tomorrow

### Day 3
- New UTC day begins (00:00 UTC)
- Daily counter resets
- User can post again
- Process repeats

---

## 🚀 Next Steps (Optional Enhancements)

### Easy Additions
1. **Streak Counter** - Show "3 day streak!" in stats page
2. **Weekly Bonus** - Extra coins for posting 7 days straight
3. **Post Templates** - Suggestions for daily post content
4. **Badges** - "Daily Poster" badge at 7, 30, 100 days

### Medium Complexity
1. **Leaderboard** - Top daily posters this week
2. **Themes** - Different daily themes (Monday = Music, etc.)
3. **Notifications** - Remind users to post
4. **Analytics** - Personal posting stats dashboard

### Advanced
1. **Jackpot** - Random user wins mega bonus each day
2. **Community Goals** - Extra rewards if 1000+ posts/day
3. **Seasonal Events** - Double coins during holidays
4. **Achievements** - Unlock special status for milestones

---

## 📞 Support

**Documentation**: See `DAILY_LOGIN_WALL_DOCUMENTATION.md`
**Code**: Check source files for inline comments
**Database**: Queries included in this guide above

---

**Setup Complete! 🎉**

Your Daily Login Wall system is now live. Users can earn coins daily by posting to the Mai Troll Wall!

Last Updated: January 21, 2026
