# Mai Troll Discovery Algorithm Plan

## Purpose

Build a discovery and recommendation system that helps viewers find content they genuinely enjoy, helps smaller creators get discovered, and helps creators earn from healthy community interaction.

The system should be optimized for Mai Troll's ecosystem instead of copying TikTok exactly. TikTok optimizes primarily for watch time and session length. Mai Troll should optimize for watch quality, community participation, legitimate gifting, creator discovery, safety, and repeat visits.

This document is a product and engineering plan. It does not change the existing application.

## Main Principle

Mai Troll should promote content that creates real participation and keeps people coming back, not simply content with the most followers, viewers, or money.

A large broadcast with weak retention should not automatically outrank a smaller broadcast where viewers stay, chat, participate, follow, and return.

## Core Architecture Decision

Do not build seven separate algorithms. Build one underlying **MaiTroll Signal Engine**, then let each product surface consume the shared signals with its own ranker and weights.

```text
MaiTroll Signal Engine
|
|- Viewer Interest
|- Watch Quality
|- Retention
|- Engagement
|- Gift Quality
|- Creator Consistency
|- Freshness
|- Momentum
|- Exploration
|- Trust
|- Content Quality
  |
  |- Live Now Ranker
  |- For You Ranker
  |- Gift Momentum Ranker
  |- HytroGames Ranker
  |- Podcast Ranker
  |- Troll Wall Ranker
  |- Profile Discovery Ranker
```

The Signal Engine owns event normalization, feature calculation, trust adjustments, aggregation windows, and shared quality definitions. Surface rankers own candidate selection, signal weights, diversity rules, and presentation-specific constraints.

This architecture makes the system easier to evolve. A better retention calculation, trust signal, or gift-quality rule can improve every surface without duplicating logic. At the same time, a podcast can prioritize completion while Live Now prioritizes current momentum without creating disconnected scoring systems.

### Signal Engine Responsibilities

- Normalize events from broadcasts, HytroGames, podcasts, Troll Wall, profiles, and gifts.
- Calculate shared features such as retention, watch quality, freshness, and trust.
- Maintain short-term, medium-term, and long-term aggregation windows.
- Apply fraud, spam, moderation, and privacy rules consistently.
- Produce versioned feature definitions and scores.
- Expose candidate features to surface-specific rankers.

### Surface Ranker Responsibilities

- Select eligible candidates for the surface.
- Apply surface-specific weights.
- Apply creator, category, and content diversity limits.
- Reserve exploration positions.
- Apply surface-specific freshness and lifecycle rules.
- Return an explainable ranking reason for internal analytics.

No surface ranker should independently redefine core concepts such as a legitimate gift, a valid watch, a trusted account, or an eligible public post.

## Product Surfaces

Use one shared signal engine with separate ranking strategies for each product surface.

### 1. Live Now

For active broadcasts, HytroGame streams, court streams, and other live content.

Primary goals:

- Help viewers find relevant live content quickly.
- Reward strong retention and active participation.
- Surface new and rising creators.
- Avoid allowing one large creator to dominate every surface.

### 2. For You

A personalized feed based on each viewer's interests and behavior.

Primary goals:

- Show content related to what the viewer actually watches.
- Mix familiar creators with new discoveries.
- Learn from skips, completed sessions, follows, shares, gifts, and reports.

### 3. Gift Momentum

A discovery surface for broadcasts with healthy gifting activity.

Primary goals:

- Highlight communities where viewers are participating and supporting creators.
- Reward unique and returning gifters.
- Prevent one wealthy account from buying permanent visibility.
- Exclude suspicious gifting, refunds, chargebacks, and self-gifting.

### 4. HytroGame Discovery

A dedicated surface for game streams, matches, tournaments, and interactive events.

Primary goals:

- Rank live gameplay by engagement, competition, participation, and retention.
- Support tournaments and game categories.
- Give smaller or newer game creators an opportunity to appear.

### 5. Podcast Discovery

A slower-moving ranking surface for live and recorded podcast content.

Primary goals:

- Rank by completion and listening quality rather than only clicks.
- Make topics, guests, and transcripts discoverable.
- Recommend episodes based on subject interest.

### 6. Troll Wall Discovery

A feed for public posts, trending topics, and creator conversations.

Primary goals:

- Promote meaningful discussion and original posts.
- Make individual public posts discoverable.
- Remove spam, abuse, duplicate content, and engagement manipulation from ranking.

### 7. Public Profiles

Profiles should act as creator landing pages and hubs for public content.

Each public profile can connect:

- Broadcasts
- HytroGame streams
- Podcasts
- Troll Wall posts
- Followers and public activity
- Marketplace listings
- Public roles or creator categories

## Unified Signal Model

The Signal Engine should produce a shared set of normalized signals. Each surface ranker then uses those signals with different weights.

```text
Pulse Score =
  viewer_interest
+ watch_or_listen_quality
+ retention
+ fresh_activity
+ creator_consistency
+ social_proof
+ category_match
+ exploration_bonus
- spam_penalty
- repeat_penalty
- report_penalty
- artificial_engagement_penalty
```

The score should be calculated per viewer where personalization is relevant and globally where the surface is general discovery.

Do not expose the exact production formula publicly. Explain the major principles publicly, but keep precise weights and abuse thresholds private.

## Broadcast Ranking

Track the following signals:

- Watch time
- Percentage of the broadcast watched
- Viewer retention after 10 seconds, 30 seconds, and 2 minutes
- Rewatches
- Chat participation
- Follows
- Shares
- Viewer return rate
- Current viewer growth
- Stream title and category relevance
- Audio and video quality
- Creator response to chat
- Viewer reports
- Moderation actions
- Whether viewers stay after receiving a notification
- Whether viewers move from the broadcast to the creator profile

Important principle:

A broadcast with 20 viewers who stay for 30 minutes should be able to outrank a broadcast with 200 viewers who leave after 20 seconds.

### Live Momentum

Live content should respond to current activity without becoming unstable.

Recalculate active stream scores approximately every 30 to 60 seconds. Use a short-term momentum window and a longer-term quality window.

```text
live_momentum =
  recent_viewer_growth
+ recent_chat_growth
+ recent_follow_growth
+ recent_share_growth
+ recent_retention
```

Use momentum as one component, not the whole ranking. A sudden artificial spike should not immediately take over the feed.

### Stream Lifecycle

Use different ranking behavior for each state:

- New stream: temporary discovery boost.
- Growing stream: stronger momentum weighting.
- Established stream: stronger retention and creator consistency weighting.
- Ended stream: lower live priority but possible replay or highlight discovery.
- Deleted or private stream: remove from all public ranking.

Do not constantly reorder a viewer's current feed while they are actively watching. Excessive reordering creates a poor experience.

## Gifter and Gift Momentum Algorithm

Gifting should improve discovery when it reflects healthy community participation. It should not turn the front page into a pay-to-win advertising board.

### Gift Signals

Track:

- Number of unique gifters
- Number of returning gifters
- Legitimate gift value
- Gift frequency over time
- Gift activity spread across the broadcast
- Creator acknowledgment or response
- Viewer retention after gifts
- Viewer follows after gifts
- New viewers arriving after gift activity
- Refunds
- Chargebacks
- Suspicious accounts
- Self-gifting or coordinated gifting

```text
gift_momentum =
  unique_gifters
+ returning_gifters
+ gift_velocity
+ creator_response
+ post_gift_retention
- refund_risk
- suspicious_activity
```

### Diminishing Returns

Use a logarithmic or capped value signal so the first legitimate gifts matter more than unlimited spending by one person.

```text
gift_value_signal = log(1 + legitimate_gift_value)
```

Also apply a unique-gifter bonus:

```text
gifter_diversity_bonus = unique_gifters / max(total_gifters, 1)
```

### Gift Ranking Rules

- Do not rank solely by total gift value.
- Do not allow a single account to dominate a category indefinitely.
- Give more weight to unique and returning gifters.
- Give more weight when gifting leads to retention or other healthy engagement.
- Reduce weight for refunds, chargebacks, self-gifting, and account clusters.
- Never reveal private financial information in public ranking.

## HytroGame Algorithm

Use gaming-specific signals in addition to general live signals:

- Concurrent viewers
- Match or round activity
- Viewer participation
- Game and category popularity
- Average watch duration
- Rematches or repeat visits
- Chat activity during important moments
- Clips and highlights created
- Live, scheduled, replay, or tournament state
- Skill level or tournament status
- Match outcomes and competitive context

Possible discovery labels:

- Rising Now
- Most Competitive
- Community Favorite
- Best New Streamer
- Most Interactive
- Tournament Live
- Close Match
- Game Night Hot

Labels should be generated from real metrics and should not be sold or manually assigned as ranking shortcuts.

## Podcast Algorithm

Podcast ranking should use longer time windows than live content.

Track:

- Episode completion percentage
- Average listening duration
- Follows after listening
- Repeat listening
- Saves
- Shares
- Topic and category match
- Transcript search relevance
- Episode freshness
- Guest interest
- Return listening over 7, 30, and 90 days

A podcast with fewer clicks but strong completion and repeat listening should outrank a podcast with many clicks and immediate abandonment.

Podcast pages should include searchable transcript text where appropriate. This benefits both in-app discovery and search engine indexing.

## Troll Wall Algorithm

The Troll Wall should use a combination of freshness, quality, conversation, and personalization.

Signals:

- Originality
- Read time
- Replies
- Meaningful replies rather than empty reactions
- Shares
- Saves
- Profile visits
- Follows after reading
- Return visits
- Media quality
- Topic relevance
- Report rate
- Hide or block rate
- Duplicate-content similarity
- Author trust history

Do not rank a post only by likes. A smaller post that creates thoughtful conversation should be able to compete with a large account.

### Public Post Pages

Every eligible public post should have a stable page such as:

```text
/post/:postId
```

That page should contain:

- Full post text
- Author and profile link
- Creation date
- Public media
- Replies or engagement summary
- Canonical URL
- Moderation state
- Related public posts

Deleted, private, banned, moderated, or very low-quality posts should not be recommended or indexed.

## Personalization

Maintain a viewer interest profile based on behavior, not only explicit likes.

Signals may include:

- Categories watched
- Creators followed
- Games viewed
- Podcast topics completed
- Typical watch duration
- Gifts sent
- Likes, shares, skips, and reports
- Search behavior
- Preferred language
- Region where appropriate
- Time of day
- Whether the viewer returns to a creator

Suggested initial blend:

```text
Personalized Score =
  60% viewer preference
+ 20% content quality
+ 10% current momentum
+ 10% exploration
```

The exploration portion is essential. Every viewer should periodically see new creators and categories instead of being trapped in a narrow recommendation loop.

## Creator Fairness

Reserve part of discovery inventory for smaller and newer creators.

Initial distribution target:

```text
70% proven relevant content
20% rising creators
10% new or experimental content
```

These values should be tested and adjusted by surface.

A creator should be eligible for discovery based on quality and trust signals, not only followers, total views, or total gifts.

Useful creator labels:

- Rising Troll
- New Creator
- Community Favorite
- High Troll Energy
- Most Interactive
- Consistent Creator

## Branded Product Concept: Troll Energy

Make Troll Energy a user-facing MaiTroll concept, not merely an internal algorithm score. Do not expose an opaque decimal such as `74.32` as the primary creator experience. Give creators a simple branded result they can understand and act on.

Example creator analytics:

```text
YOUR TROLL ENERGY

High Troll Energy - 87
+12% this week

Your strongest signals:
- Chat participation
- Returning viewers
- Unique gifters
- Viewer retention
```

The numeric value can support analytics, experimentation, and internal ranking, but the primary product language should use understandable bands and explanations:

- Low Troll Energy
- Building Troll Energy
- Good Troll Energy
- High Troll Energy
- Maximum Troll Energy

The labels should be descriptive rather than punitive. A creator with low Troll Energy should receive practical guidance, not a hidden penalty with no explanation.

Troll Energy should have separate views for creators and content. A creator can have strong overall Troll Energy while one individual broadcast or post has weak energy, and a new creator can have a strong individual piece of content without having a long account history.

### Troll Energy Inputs

Create a composite metric that represents healthy activity around a creator or piece of content.

```text
Troll Energy =
  live interaction
+ viewer retention
+ unique gifters
+ game participation
+ shares
+ creator responsiveness
- reports
- artificial engagement
```

Troll Energy should be used for discovery labels, creator analytics, and experimentation. It should not be the only ranking score.

Possible labels:

- High Troll Energy
- Gift Rally
- Crowd Favorite
- Rising Troll
- Courtroom Heat
- Game Night Hot
- Podcast Worth Hearing

### Troll Energy Product Rules

- Troll Energy is a summary and coaching concept, not the only ranking score.
- Ranking should use normalized underlying signals, not the displayed badge alone.
- Financial activity must be balanced with retention, participation, and trust.
- Trust and safety problems can make content ineligible regardless of Troll Energy.
- Show creators which signals contributed to their result.
- Use time windows such as today, this week, and this month.
- Compare creators against their own recent baseline before comparing them with the entire platform.
- Avoid public leaderboards that encourage unhealthy spending or harassment.

## Eligibility Before Ranking

Separate eligibility from ranking aggressively. Ranking decides which eligible content should appear first. Eligibility decides whether content is allowed to enter discovery at all.

Popularity, gifts, watch time, or a high Troll Energy value must never bypass eligibility, trust, safety, or quality gates.

```text
CONTENT CREATED
  |
  v
PUBLIC?
  |
  v
ELIGIBLE?
  |
  v
TRUST / SAFETY CHECK
  |
  v
QUALITY CHECK
  |
  v
CANDIDATE GENERATION
  |
  v
PERSONALIZATION
  |
  v
RANKING
  |
  v
DIVERSITY / EXPLORATION
  |
  v
VIEWER
```

### Eligibility Pipeline

1. **Content created:** Record the content event and assign a stable content ID.
2. **Public check:** Confirm that the content, creator, audience, and media are actually public and accessible without signing in where required.
3. **Eligibility check:** Confirm that the content type is supported, available, not deleted, not expired, and not restricted by account or region rules.
4. **Trust and safety check:** Apply moderation status, account trust, spam detection, fraud detection, report thresholds, and payment-abuse rules.
5. **Quality check:** Verify that the content has enough useful information, valid metadata, playable media where required, and is not a duplicate or obvious low-effort spam item.
6. **Candidate generation:** Add eligible content to the appropriate surface candidate pool.
7. **Personalization:** Match candidates to the viewer's interests and current context.
8. **Ranking:** Score candidates with the surface ranker using shared Signal Engine features.
9. **Diversity and exploration:** Apply creator, category, repetition, and new-creator constraints.
10. **Viewer:** Deliver the final feed or discovery result and record the impression.

Eligibility should be represented explicitly in data, for example with fields equivalent to:

```text
is_public
is_eligible
trust_state
safety_state
quality_state
indexing_state
eligibility_reason
eligible_at
```

This creates a clean boundary: rankers can optimize discovery without accidentally deciding whether unsafe, private, deleted, or low-quality content is allowed to appear.

## Anti-Manipulation and Trust Layer

Create a separate trust system that evaluates engagement quality.

Detect:

- Bots
- Sudden viewer spikes
- Repeated short visits
- Coordinated likes or follows
- Self-gifting
- Gift loops
- Multiple accounts controlled by one person
- Viewer farming
- Chargeback patterns
- Fake chat activity
- Spam posting
- Repeated copied content
- Manipulated traffic from external sources

Do not immediately punish a creator solely because an anomaly was detected. Initially reduce the affected signal's ranking weight and send serious cases to moderation review.

Recommended trust actions:

- Ignore suspicious events in ranking.
- Temporarily cap discovery benefit.
- Hold gift-based promotion during payment review.
- Require manual review for repeated abuse.
- Restore normal weighting when behavior returns to normal.

## Data Architecture

Do not calculate every ranking query directly from raw event tables. Store periodic aggregates.

Recommended tables or equivalent structures:

- `content_engagement_hourly`
- `creator_engagement_daily`
- `viewer_interest_profiles`
- `gift_engagement_events`
- `recommendation_impressions`
- `recommendation_feedback`
- `trust_risk_scores`
- `content_pulse_scores`
- `content_moderation_states`

### Recommendation Event Flow

Track this funnel:

```text
shown
-> clicked
-> watched or listened
-> stayed
-> followed
-> shared
-> gifted
-> returned
```

Each recommendation impression should have a request or session identifier so results can be measured accurately.

Do not store unnecessary sensitive data. Use aggregated and pseudonymous identifiers where possible.

## Ranking Calculation Strategy

Use a two-stage system.

### Stage 1: Candidate Generation

Collect a manageable set of possible content from:

- Followed creators
- Similar creators
- Current live streams
- Trending categories
- Recent posts
- New creators
- Gift momentum
- Search or topic matches
- Geographic or language relevance where appropriate

### Stage 2: Ranking

Score and order the candidates using:

- Viewer interest
- Quality
- Retention
- Freshness
- Momentum
- Creator fairness
- Trust and safety
- Diversity rules

Apply final constraints after scoring:

- Do not show too many items from the same creator.
- Do not show repeated content.
- Do not show blocked or reported content.
- Maintain category diversity.
- Reserve exploration positions.
- Remove private, deleted, or unavailable content.

## Quality and Safety Gates

Before content enters public recommendations, verify:

- It is public.
- The creator is not banned.
- The content is not deleted.
- The content is not under a severe moderation restriction.
- The page has valid content metadata.
- The content is not an obvious duplicate or spam item.
- The content is available in the viewer's region if regional restrictions exist.

## Search and Indexing Connection

The recommendation system and Google indexing system should share public-content eligibility rules, but they should not be identical.

## Execution Order: Algorithm First, Indexing Second

Implement the discovery foundation before making every public content type a major Google indexing target.

### Stage 1: Build the MaiTroll Signal Engine

- Instrument events and normalize content, creator, viewer, gift, trust, and moderation signals.
- Establish eligibility before ranking.
- Build the shared feature calculations.
- Launch rules-based rankers for Live Now, For You, Gift Momentum, HytroGames, Podcast, Troll Wall, and Profile Discovery.
- Add Troll Energy analytics and creator feedback.
- Measure retention, watch quality, legitimate gifting, creator discovery, reports, and return visits.
- Tune the system with controlled experiments before using it as the primary discovery layer.

### Stage 2: Build Public Content Destinations

Give every eligible public content type a stable, useful page that can stand on its own without requiring a viewer to sign in.

- Public creator profiles
- Individual live broadcasts
- HytroGame streams and game pages
- TCNN articles
- Podcast shows and episodes
- Public Troll Court sessions
- Marketplace listings
- Individual public Troll Wall posts

Each page should contain meaningful server-rendered or prerendered content, a canonical URL, unique metadata, structured data, internal links, and a clear route back to the creator or category.

### Stage 3: Submit the Public Graph to Google

- Generate dynamic sitemaps from eligible content only.
- Allow Google to crawl public profiles, streams, articles, games, podcasts, court sessions, marketplace listings, and public posts.
- Keep private, deleted, banned, duplicate, thin, and account-management pages out of the index.
- Add canonical URLs and structured data.
- Verify the site in Google Search Console.
- Submit sitemap indexes and inspect representative URLs.
- Monitor crawl errors, duplicate pages, soft 404s, and pages that Google crawls but does not index.

The algorithm creates the content graph and determines what is valuable inside MaiTroll. The indexing layer makes eligible parts of that graph understandable and discoverable outside the app.

## Target Google Search Results

The long-term goal is for Google to understand MaiTroll as a network of creators, live content, games, journalism, podcasts, court streams, marketplace listings, and public conversations.

Representative result formats should look like:

```text
Joshua's Live - MaiTroll
Live gaming broadcast from Joshua on MaiTroll.

@username - MaiTroll
Creator profile, broadcasts, posts, and HytroGames on MaiTroll.

How to [topic] - MaiTroll
TCNN article explaining [topic].

[Game] Live Streams - MaiTroll HytroGames
Watch live [Game] streams, matches, and community gameplay.

[Podcast Episode] - MaiTroll
Listen to the MaiTroll podcast episode about [topic].

[Public Troll Wall post] - MaiTroll
Public conversation and post from the MaiTroll community.
```

These are target page and metadata outcomes, not guaranteed exact snippets. Google chooses the final title and description based on page content, search intent, quality, and its own indexing systems.

### SEO Page Requirements

Every target page should have:

- A stable public URL.
- A unique title and description.
- A canonical link.
- Useful visible page content in the initial HTML or prerendered output.
- Relevant Schema.org structured data.
- Open Graph and social preview metadata.
- Links to related profiles, categories, and public content.
- A correct `index, follow` or `noindex, nofollow` directive.
- Correct handling for deleted, private, banned, expired, or moderated content.

Content eligible for Google indexing should generally be:

- Public
- Stable and canonical
- Useful and original
- Accessible without signing in
- Moderated and safe
- Available at a permanent URL
- Linked from another crawlable page

Public indexable surfaces should include:

- Profiles
- Broadcast pages
- HytroGame streams
- Podcasts and episodes
- Court watch pages
- TCNN articles
- Marketplace listings
- Public Troll Wall posts

Do not index:

- Private profiles
- Private posts
- Deleted content
- Admin pages
- Messages
- Orders and account pages
- Search-result URLs
- Endless filter combinations
- Thin duplicate pages
- Moderated content that should not be public

## Metrics and Success Criteria

Measure the algorithm by surface.

### Viewer Metrics

- Average watch time
- Average listening time
- Completion percentage
- Session return rate
- Follows per session
- Shares per session
- Viewer satisfaction
- Content hides and reports
- New creator discovery rate

### Creator Metrics

- Unique viewers
- Returning viewers
- Qualified followers
- Legitimate gifts
- Unique gifters
- Earnings distribution
- New creator reach
- Creator retention
- Creator satisfaction

### System Metrics

- Recommendation click-through rate
- Watch or listen start rate
- Ranking latency
- Freshness latency
- Duplicate-content rate
- Suspicious engagement rate
- Moderation escape rate
- Public page crawlability
- Indexed-to-valid-page ratio

Never optimize one metric in isolation. For example, increasing watch time while reports and creator churn increase is not a successful change.

## A/B Testing

Every major ranking change should be tested against a control group.

Test separately:

- Gift weighting
- Exploration percentage
- New creator boost
- Freshness window
- HytroGame category weighting
- Podcast completion weighting
- Troll Wall conversation weighting
- Notification-driven ranking

Primary evaluation should use a combination of:

- Retention
- Viewer satisfaction
- Creator outcomes
- Legitimate gifting
- Safety reports
- Long-term return rate

Do not ship a ranking change only because it increases clicks.

## Rollout Plan

### Phase 1: Instrumentation

- Identify all public content types.
- Standardize content IDs and creator IDs.
- Track impressions, clicks, views, watches, skips, follows, shares, gifts, reports, and returns.
- Add moderation and trust events.
- Establish data retention rules.

### Phase 2: Rules-Based Ranking

- Build a transparent baseline using weighted signals.
- Add freshness, quality, retention, category relevance, and diversity rules.
- Add basic new creator exploration.
- Keep the exact formula configurable.

### Phase 3: Live and Gift Ranking

- Add live momentum.
- Add unique-gifter and returning-gifter signals.
- Add diminishing returns for gift value.
- Add refund and suspicious-activity penalties.
- Launch Gift Momentum as a separate surface.

### Phase 4: Personalization

- Build viewer interest profiles.
- Add followed creators and category preferences.
- Add exploration and diversity controls.
- Add viewer-level feedback from skips, hides, and reports.

### Phase 5: HytroGame and Podcast Specialization

- Add game-specific ranking.
- Add tournament and match states.
- Add podcast completion, transcript, save, and repeat-listen signals.
- Build category-specific discovery labels.

### Phase 6: Troll Wall and Profiles

- Add public post scoring.
- Add post detail pages.
- Add creator profile content hubs.
- Add conversation quality and duplicate detection.
- Apply public-content eligibility rules.

### Phase 7: Trust and Machine Learning

- Train models only after enough reliable event data exists.
- Use the rules-based system as a safety floor.
- Keep moderation vetoes and public-content rules outside the model.
- Compare machine-learned ranking against the rules-based control group.

## Recommended Initial Weights

These are starting points for experimentation, not permanent values.

### Broadcasts

```text
25% watch quality
20% retention
15% viewer interest
10% current momentum
10% chat interaction
10% creator consistency
05% legitimate gift momentum
05% exploration
```

### HytroGames

```text
25% watch quality
20% retention
15% game/category match
15% live match activity
10% viewer participation
05% legitimate gift momentum
05% creator consistency
05% exploration
```

### Podcasts

```text
30% completion
20% listening duration
15% topic match
10% repeat listening
10% follows and saves
05% shares
05% freshness
05% exploration
```

### Troll Wall

```text
25% read time
20% meaningful replies
15% viewer interest
10% shares and saves
10% freshness
10% author consistency
05% profile visits
05% exploration
```

All surfaces should apply trust, moderation, diversity, and duplicate-content penalties after the initial score.

## Final Product Goal

MaiTroll isn't trying to copy TikTok's algorithm. It's building an algorithm that understands what makes a MaiTroll community good.

The winning system should:

- Help viewers find content they want to watch.
- Help creators earn through legitimate engagement.
- Help new creators get discovered.
- Make gifting feel meaningful instead of pay-to-win.
- Make HytroGames and podcasts easier to discover.
- Make public profiles and posts useful destinations.
- Protect the community from manipulation and spam.
- Produce high-quality public pages that search engines can understand.

The target advantage is specialization: a recommendation system designed specifically for broadcasts, creators, gifters, games, podcasts, court content, and Troll Wall communities.
