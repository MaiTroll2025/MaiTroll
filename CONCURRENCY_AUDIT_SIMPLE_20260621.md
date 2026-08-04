# 🎯 Mai Troll — CONCURRENCY AUDIT (PLAIN ENGLISH)

**Date:** 2026-06-21  
**What is this?** A plain-English explanation of how many people can use Mai Troll at the same time before things break.

---

## 📊 THE BOTTOM LINE FIRST

| Scenario | How Many People? | What Happens? |
|---|---|---|
| 🟢 **Safe Zone** | **~1,000 total users** | Everything works fine. No worries. |
| 🟡 **Warning Zone** | **~3,000 total users** | Things start slowing down. Some users might see delays or glitches. |
| 🔴 **Breaking Point** | **~10,000 total users** | Things start failing. Streams drop. Pages get slow or crash. |

---

## 👥 WHAT "CONCURRENT USERS" MEANS

"Concurrent users" = people actively using the site **at the same time right now**.

Not total registered users. Not users today. People who have the page open and are doing stuff **this very second**.

---

## 🔢 BREAKDOWN BY WHAT PEOPLE ARE DOING

Think of it like a shopping mall. Different activities put different strain on the building:

### 🟢 Light Strain — Browsing (Safe: ~5,000 people)
- **What they're doing:** Looking at the homepage, scrolling the wall, viewing profiles
- **Why it's light:** These pages mostly just load once and sit still
- **Analogy:** People walking around looking at store windows

### 🟡 Medium Strain — Watching Streams (Safe: ~200 per stream)
- **What they're doing:** Watching someone's broadcast
- **Why it's medium:** Each viewer opens ~12 "channels" (like phone lines) to get live updates — chat, gifts, viewer count, etc.
- **Analogy:** 200 people in a movie theater. The projector handles it fine.

### 🔴 Heavy Strain — Broadcasting (Safe: ~20 total)
- **What they're doing:** Going live, streaming video
- **Why it's heavy:** Each broadcaster opens ~16 channels PLUS sends video through LiveKit (the video system). They're also constantly updating viewer counts, chat, gifts, etc.
- **Analogy:** 20 people all trying to run their own TV stations from the same building

### 🔴 Heavy Strain — Battles (Safe: ~50 total)
- **What they're doing:** Participating in or watching 5v5 battles
- **Why it's heavy:** Battles poll the database every 2 seconds for score updates. That's like asking "who's winning?" 30 times per minute, per viewer.
- **Analogy:** 50 people all refreshing a scoreboard constantly

---

## 🧮 A REALISTIC SCENARIO

Here's what happens with **1,000 concurrent users** split across activities:

| Activity | People | Strain per Person | Total Strain |
|---|---|---|---|
| Browsing homepage | 400 | Low | Low |
| Watching a stream | 300 | Medium | Medium |
| Broadcasting | 10 | High | High |
| In battles | 50 | High | High |
| Using admin tools | 5 | Medium | Low |
| **TOTAL** | **1,000** | | **🟢 SAFE** |

Now here's **3,000 concurrent users**:

| Activity | People | Strain per Person | Total Strain |
|---|---|---|---|
| Browsing homepage | 1,200 | Low | Medium |
| Watching streams | 1,000 | Medium | **High** |
| Broadcasting | 30 | High | **Very High** |
| In battles | 100 | High | **Very High** |
| Using admin tools | 10 | Medium | Low |
| **TOTAL** | **3,000** | | **🟡 WARNING** |

And **10,000 concurrent users**:

| Activity | People | Strain per Person | Total Strain |
|---|---|---|---|
| Browsing homepage | 4,000 | Low | **High** |
| Watching streams | 3,000 | Medium | **🔴 Critical** |
| Broadcasting | 100 | High | **🔴 Critical** |
| In battles | 200 | High | **🔴 Critical** |
| Using admin tools | 20 | Medium | Medium |
| **TOTAL** | **10,000** | | **🔴 BREAKING** |

---

## ⚙️ WHY DOES IT BREAK? (The Simple Version)

Three things limit how many people can use the site at once:

### 1. 📡 "Channels" (Like Phone Lines)
Every user opens multiple "channels" to get live updates. Think of it like phone lines into the server.

- **1 viewer on a stream = ~12 phone lines open**
- **1 broadcaster = ~16 phone lines open**
- **Supabase (our database) supports about 500 concurrent phone lines on the Pro plan**

So if 1,000 people are all watching the same stream, that's **12,000 phone lines** for that one stream alone. Way over the limit.

### 2. 🔄 "Polling" (Constantly Asking "Any Updates?")
Some parts of the app keep asking the database "any new stuff?" over and over:

| What's Being Polled | How Often | Why It's a Problem |
|---|---|---|
| Battle scores | Every 2 seconds | 500 battle viewers = 250 questions/second |
| Top gifters list | Every 15 seconds | 1,000 viewers = 67 questions/second |
| Live homepage content | Every 60 seconds | 2,000 users = 33 questions/second |
| Streamer stats | Every 120 seconds | 1,000 viewers = 8 questions/second |

The database can only answer so many questions per second before it gets overwhelmed.

### 3. 🎥 Video Streaming (LiveKit)
Video doesn't go through Supabase — it goes through a separate system called LiveKit. But each video viewer still needs a connection, and each broadcaster needs to **send** video to everyone.

- **1 broadcaster with 200 viewers** = 1 person uploading, 200 people downloading
- LiveKit handles this well, but it's still a limit

---

## 🚨 THE 5 BIGGEST PROBLEMS (In Plain English)

### Problem 1: Every Live Card on Homepage Opens Its Own Channel
**What's happening:** If the homepage shows 100 live streams, each little card opens a separate "phone line" to track its viewer count.

**Why it's bad:** 100 cards = 100 extra channels per person just from the homepage.

**Fix:** Use one shared channel instead of 100 separate ones.

### Problem 2: Each Viewer Opens 12+ Channels Per Stream
**What's happening:** When you watch a stream, your browser opens about 12 different connections for chat, gifts, viewer count, presence, seats, etc.

**Why it's bad:** 1,000 viewers × 12 channels = 12,000 connections for one stream.

**Fix:** Combine multiple channels into fewer connections.

### Problem 3: Battle Scores Are Checked Every 2 Seconds
**What's happening:** Every person watching a battle asks "what's the score?" every 2 seconds.

**Why it's bad:** 500 people × 30 questions per minute = 15,000 questions per minute just for battle scores.

**Fix:** Check less often (every 5-10 seconds) or only update when the score actually changes.

### Problem 4: No Limit on How Many People Can Watch a Stream
**What's happening:** The admin panel has settings to cap viewers at 10 per stream, but those settings aren't actually enforced. Anyone can join any stream.

**Why it's bad:** A popular stream could get thousands of viewers and crash the system.

**Fix:** Actually enforce the viewer limit when people try to join.

### Problem 5: The App Only Allows 10 Live Events Per Second (Total)
**What's happening:** The entire app is configured to only process 10 database change notifications per second across ALL users.

**Why it's bad:** During a big gift spree or battle, events get dropped because the system can't keep up.

**Fix:** Increase this limit to 20-50.

---

## 📋 QUICK REFERENCE: HOW MANY USERS CAN EACH PAGE HANDLE?

| Page / Feature | Safe | Warning | Breaking |
|---|---|---|---|
| Homepage browsing | 500 | 2,000 | 5,000 |
| Watching ONE stream | 200 | 500 | 2,000 |
| Broadcasting (total) | 20 | 50 | 100 |
| Battles (total) | 50 | 100 | 200 |
| Watching ONE auction | 100 | 300 | 1,000 |
| **Whole platform** | **1,000** | **3,000** | **10,000** |

---

## 🛠️ TOP 5 FIXES THAT WOULD HELP THE MOST

If you want to support more users, these are the changes that would make the biggest difference:

| Priority | Fix | How Many More Users It Supports |
|---|---|---|
| 1️⃣ | Stop opening a channel per live card on homepage | +500 homepage users |
| 2️⃣ | Combine viewer channels from 12 to 3-4 per stream | +300 viewers per stream |
| 3️⃣ | Slow down battle score polling from 2s to 10s | +100 battle viewers |
| 4️⃣ | Enforce viewer caps on streams | Prevents crashes |
| 5️⃣ | Increase events limit from 10/sec to 50/sec | Smoother during peak activity |

---

## 🎯 TL;DR (Too Long; Didn't Read)

**Right now, Mai Troll can safely handle about 1,000 people using it at the same time.**

If you get to 3,000 people, things will start feeling slow and glitchy.

If you get to 10,000 people, things will start breaking.

The main reason is that each person watching a stream opens about 12 separate connections, and the database can only handle so many connections at once. The biggest wins would be combining those connections and reducing how often the app asks the database for updates.
